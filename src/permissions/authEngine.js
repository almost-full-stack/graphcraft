function buildAncestry(rn) {
  const parts = rn.split('::');
  const out = [];
  for (let i = parts.length; i > 0; i -= 2) out.push(parts.slice(0, i).join('::'));
  return out; // most-specific → ... → 'rn'
}

function matchesRnPattern(pattern, rn) {
  const escaped = pattern.replace(/[-\/\\^$+?.()|[\]{}]/g, '\\$&').replace(/\*/g, '[^:]+');
  return new RegExp(`^${escaped}$`).test(rn);
}

const specificityOf = (pattern) => String(pattern).length;

function makeEngine(cfg) {
  const { roles, users, resourceIndex, permissionAssignments, fieldPolicies } = cfg;

  const findRole = (name) => roles.find(r => r.name === name);
  const findUser = (username) => users.find(u => u.username === username);
  const ownerOf = (rn) => resourceIndex.find(r => r.resourceRn === rn)?.owner || null;
  const ownerRoleOf = (rn) => {
    const owner = ownerOf(rn);
    const usr = owner ? findUser(owner) : null;
    return usr ? findRole(usr.role) : null;
  };

  // Resource-level permission
  function hasPermission({ username, resourceRn, permission, enableOwnerFallback = true }) {
    const actor = findUser(username); if (!actor) throw new Error('unknown user');
    const actorRole = findRole(actor.role); if (!actorRole) throw new Error('unknown role');

    const ancestry = buildAncestry(resourceRn);
    const matches = [];

    for (const row of permissionAssignments) {
      if (row.role !== actorRole.name || row.permission !== permission) continue;
      for (const pat of row.resourceRns || []) {
        const isMatch = ancestry.includes(pat) || matchesRnPattern(pat, resourceRn);
        if (isMatch) matches.push({ allow: row.allow, spec: specificityOf(pat) });
      }
    }

    matches.sort((a, b) => b.spec - a.spec);
    if (matches.length) return matches[0].allow === true;

    if (enableOwnerFallback) {
      const oRole = ownerRoleOf(resourceRn);
      if (oRole && actorRole.rank > oRole.rank) return true;
    }
    return false;
  }

  // Field-level allowed set
  function getAllowedFields({ username, resourceRn, modelName, action, allFields = [] }) {
    const actor = findUser(username); if (!actor) throw new Error('unknown user');
    const roleName = actor.role;
    const ancestry = buildAncestry(resourceRn);

    const items = [];
    for (const row of fieldPolicies) {
      if (row.role !== roleName || row.model !== modelName || row.action !== action) continue;
      const pat = row.resourceRn;
      const isMatch = ancestry.includes(pat) || matchesRnPattern(pat, resourceRn);
      if (!isMatch) continue;
      items.push({ allow: row.allow, fields: row.fields, spec: specificityOf(pat) });
    }

    items.sort((a, b) => b.spec - a.spec);

    const allowed = new Set();
    for (const it of items) {
      if ((it.fields || []).includes('*')) {
        if (it.allow) allFields.forEach(f => allowed.add(f));
        else allowed.clear();
      } else {
        if (it.allow) it.fields.forEach(f => allowed.add(f));
        else it.fields.forEach(f => allowed.delete(f));
      }
    }

    return Array.from(allowed);
  }

  const projectAttributes = (attrs, allowed) => attrs.filter(a => allowed.includes(a));
  const sanitizePayload = (payload, allowed) =>
    Object.fromEntries(Object.entries(payload).filter(([k]) => allowed.includes(k)));

  return { hasPermission, getAllowedFields, projectAttributes, sanitizePayload, buildAncestry, matchesRnPattern };
}

module.exports = { makeEngine };
