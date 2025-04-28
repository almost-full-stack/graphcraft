const fields = require('./fields');
const generateName = require('./generateName');
const helpers = require('./helpers');

module.exports = {
  ...fields,
  generateName,
  ...helpers
};