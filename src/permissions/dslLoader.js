const parseCSV = (s) => String(s || '').split(',').map((x) => x.trim()).filter(Boolean);

// Join wrapped statements so you can break RN lists across lines
function normalizeStatements(text) {
  const raw = text.split(/\r?\n/);
  const out = [];
  let buf = '';

  for (const lineRaw of raw) {
    const line = lineRaw.trim();

    if (line && !line.startsWith('#')) {
      buf += (buf ? ' ' : '') + line;
      // End heuristics: role/user/resource lines are single statements; policy lines end with " to <role>" or " to <role> or owner"
      if ((/^(role|user|resource)\b/i).test(line) || (/\s+to\s+\w+(?:\s+or\s+owner)?$/i).test(buf)) {
        out.push(buf);
        buf = '';
      }
    }
  }
  if (buf) out.push(buf);

  return out;
}

function loadPolicy(policyText) {
  const roles = [];
  const users = [];
  const resourceIndex = [];
  const permissionAssignments = [];
  const fieldPolicies = [];

  const text = policyText;
  const lines = normalizeStatements(text);

  for (const line of lines) {
    let m;

    // role <name> rank <n>
    if ((m = line.match(/^role\s+(\w+)\s+rank\s+(-?\d+)$/i))) {
      roles.push({ name: m[1], rank: parseInt(m[2]) });

    // user <username> as <role>
    } else if ((m = line.match(/^user\s+(\w+)\s+as\s+(\w+)$/i))) {
      users.push({ username: m[1], role: m[2] });

    // resource <RN> model <Model> owner <username>
    // or: resource <RN> owner <username>   (model optional)
    } else if ((m = line.match(/^resource\s+(\S+)\s+(?:model\s+(\w+)\s+)?owner\s+(\w+)$/i))) {
      const resourceRn = m[1];
      const model = m[2] || null; // keep null if you infer elsewhere
      const owner = m[3];

      resourceIndex.push({ resourceRn, model, owner });

    // allow|deny <perm> on <RN[,RN,...]> to <role> [or owner]
    } else if ((m = line.match(/^(allow|deny)\s+(\w+)\s+on\s+(.+?)\s+to\s+(\w+)(?:\s+or\s+owner)?$/i))) {
      const allow = m[1].toLowerCase() === 'allow';
      const permission = m[2];
      const resourceRns = parseCSV(m[3]);
      const role = m[4];
      const ownerAlso = (/\s+or\s+owner$/i).test(line);

      permissionAssignments.push({ role, resourceRns, permission, allow, ownerAlso });

    // allow|deny read|write fields <f1,f2,...> of <Model> on <RN> to <role> [or owner]
    } else if ((m = line.match(/^(allow|deny)\s+(read|write)\s+fields\s+(.+?)\s+of\s+(\w+)\s+on\s+(\S+)\s+to\s+(\w+)(?:\s+or\s+owner)?$/i))) {
      const allow = m[1].toLowerCase() === 'allow';
      const action = m[2].toLowerCase();
      const fields = parseCSV(m[3]);
      const model = m[4];
      const resourceRn = m[5];
      const role = m[6];
      const ownerAlso = (/\s+or\s+owner$/i).test(line);

      fieldPolicies.push({ role, model, resourceRn, fields, action, allow, ownerAlso });

    } else {
      throw new Error(`Unrecognized line: ${line}`);
    }
  }

  return { roles, users, resourceIndex, permissionAssignments, fieldPolicies };
}

module.exports = { loadPolicy };
