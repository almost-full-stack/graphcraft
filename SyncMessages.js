const AWS = require('aws-sdk');
const s3 = new AWS.S3();
const Client = require('ssh2-sftp-client');
const Response = require('./Response');
const sftp = new Client();

function uploadToS3(key, content) { // eslint-disable-line no-unused-vars
  return new Promise((resolve, reject) => {

    s3.upload({
        'Bucket': process.env.S3_BUCKET,
        'Key': key,
        'Body': content,
    }, (err, data) => {
        if (err) {
            reject(err);
        } else {
            resolve(data);
        }
    });

  });
}

const processFile = (filename, stream) => {

  console.log('processing ' + filename); // eslint-disable-line no-console

  return new Promise((resolve, reject) => {

    try {

      const fileInfo = filename.split('.');

      if (fileInfo[1] === 'ACK') {
        Response.ack(fileInfo[5], fileInfo[7] + '.' + fileInfo[8]).then(() => resolve(''));
      } else if (fileInfo[1] == 'NAK') {
        Response.nak(fileInfo[3], fileInfo[4] + '.' + fileInfo[5]).then(() => resolve(''));
      } else if (fileInfo[2] == '509' || fileInfo[2] == '515') {

        let fin = '';

        stream.on('data', (buffer) => {
          const part = buffer.toString();

          fin += part;
        });

        stream.on('end', () => {

          fin = fin.replace(/\r?\n/g, '\r\n');
          if (fileInfo[2] == '509') {
            Response.mt509(filename, fin).then(() => resolve(fin));
          } else {
            Response.mt515(filename, fin).then(() => resolve(fin));
          }

        });

      }
    } catch (err) {
      console.log(err); // eslint-disable-line no-console
      reject(err);
    }

  });

}

const syncFile = async (filename) => {

  const currentPath = process.env.SFTP_ROOT_OUTGOING_DIR + '/' + filename;

  const stream = await sftp.get(currentPath);
  const content = await processFile(filename, stream);

  await uploadToS3(filename, content);
  await sftp.delete(currentPath);

  return filename;

}

module.exports.sync = async (options) => {

  await sftp.connect({
    'host': process.env.SFTP_HOST,
    'port': process.env.SFTP_PORT,
    'username': process.env.SFTP_USERNAME,
    // eslint-disable-next-line  no-path-concat
    'privateKey': require('fs').readFileSync(__dirname + '/../.ssh/' + process.env.SFTP_PRIVATE_KEY) // eslint-disable-line no-sync
  });

  const files = await sftp.list(process.env.SFTP_ROOT_OUTGOING_DIR);
  const syncPromiseArray = [];

  files.forEach((file) => {
    if (file.name != process.env.SYNC_DIR && file.name.indexOf('.') !== 0) {
      syncPromiseArray.push(syncFile(file.name));
    }
  });

  const result = await Promise.all(syncPromiseArray);

  await sftp.end();

  return result;

};
