const fs = require('fs');

const parseCSV = (s) => s.split(',').map((x) => x.trim()).filter(Boolean);

function loadPolicyFromFile(path) {
  const roles = [];
  const users = [];
  const resourceIndex = [];
  const permissionAssignments = [];
  const fieldPolicies = [];

  const lines = fs.readFileSync(path, 'utf8').split(/\r?\n/);

  for (const raw of lines) {
    const line = raw.trim();

    if (!line || line.startsWith('#')) {
      // skip
    } else {
      let m;

      // role <name> rank <n>
      m = line.match(/^role\s+(\w+)\s+rank\s+(-?\d+)$/i);
      if (m) {
        roles.push({ name: m[1], rank: parseInt(m[2], 10) });

      // user <username> as <role>
      } else if ((m = line.match(/^user\s+(\w+)\s+as\s+(\w+)$/i))) {
        users.push({ username: m[1], role: m[2] });

      // resource <RN> model <Model> owner <username>
      } else if ((m = line.match(/^resource\s+(\S+)\s+model\s+(\w+)\s+owner\s+(\w+)$/i))) {
        resourceIndex.push({ resourceRn: m[1], model: m[2], owner: m[3] });

      // allow|deny <perm> on <RN[,RN,...]> to <role>
      } else if ((m = line.match(/^(allow|deny)\s+(\w+)\s+on\s+(\S+)\s+to\s+(\w+)$/i))) {
        const allow = m[1].toLowerCase() === 'allow';
        const permission = m[2];
        const resourceRns = parseCSV(m[3]);
        const role = m[4];

        permissionAssignments.push({ role, resourceRns, permission, allow });

      // allow|deny read|write fields <f1,f2,...> of <Model> on <RN> to <role>
      } else if ((m = line.match(/^(allow|deny)\s+(read|write)\s+fields\s+(\S+)\s+of\s+(\w+)\s+on\s+(\S+)\s+to\s+(\w+)$/i))) {
        const allow = m[1].toLowerCase() === 'allow';
        const action = m[2].toLowerCase();
        const fields = parseCSV(m[3]);
        const model = m[4];
        const resourceRn = m[5];
        const role = m[6];

        fieldPolicies.push({ role, model, resourceRn, fields, action, allow });

      } else {
        throw new Error(`Unrecognized line: ${line}`);
      }
    }
  }

  return { roles, users, resourceIndex, permissionAssignments, fieldPolicies };
}

module.exports = { loadPolicyFromFile };
