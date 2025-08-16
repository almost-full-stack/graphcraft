// makeEngine.js
function buildAncestry(rn) {
  const parts = String(rn).split('::');
  const out = [];

  for (let i = parts.length; i > 0; i -= 2) out.push(parts.slice(0, i).join('::'));

return out;
}
function matchesRnPattern(pattern, rn) {
  const escaped = String(pattern).replace(/[-\/\\^$+?.()|[\]{}]/g, '\\$&').replace(/\*/g, '[^:]+');


return new RegExp(`^${escaped}$`).test(String(rn));
}
const specificityOf = (pattern) => String(pattern).length;

function makeEngine(cfg) {
  const {
    roles = [],
    users = [],
    resourceIndex = [],
    permissionAssignments = [],
    fieldPolicies = [],
  } = cfg || {};

  const findRole = (name) => roles.find((r) => r && r.name === name);
  const findUser = (username) => users.find((u) => u && u.username === username);
  const ownerOf = (rn) => (resourceIndex.find((r) => r && r.resourceRn === rn) || {}).owner || null;
  const ownerRoleOf = (rn) => {
    const owner = ownerOf(rn);
    const usr = owner ? findUser(owner) : null;


return usr ? findRole(usr.role) : null;
  };
  const isOwner = (username, rn) => ownerOf(rn) === username;

  // Resource-level permission
  function hasPermission({ username, resourceRn, permission, enableOwnerFallback = true }) {
    const actor = findUser(username);

if (!actor) throw new Error(`unknown user "${username}"`);
    const actorRole = findRole(actor.role);

if (!actorRole) throw new Error(`unknown role "${actor.role}"`);

    const ancestry = buildAncestry(resourceRn);

    // 1) Owner short-circuit via rules marked "or owner"
    if (isOwner(username, resourceRn)) {
      // Any matching rule with ownerAlso=true for this permission lets owner do it
      for (const row of permissionAssignments) {
        if (!row || !row.ownerAlso || row.permission !== permission) continue;
        for (const pat of row.resourceRns || []) {
          if (ancestry.includes(pat) || matchesRnPattern(pat, resourceRn)) {
            return row.allow === true;
          }
        }
      }
      // If you want owners to always be able to do everything, uncomment:
      // return true;
    }

    // 2) Explicit role-based policies
    const matches = [];

    for (const row of permissionAssignments) {
      if (!row || row.role !== actorRole.name || row.permission !== permission) continue;
      for (const pat of row.resourceRns || []) {
        const isMatch = ancestry.includes(pat) || matchesRnPattern(pat, resourceRn);

        if (isMatch) matches.push({ allow: Boolean(row.allow), spec: specificityOf(pat) });
      }
    }
    matches.sort((a, b) => b.spec - a.spec);
    if (matches.length) return matches[0].allow === true;

    // 3) Rank fallback (actor outranks owner)
    if (enableOwnerFallback) {
      const oRole = ownerRoleOf(resourceRn);

      if (oRole && typeof oRole.rank === 'number' && actorRole.rank > oRole.rank) return true;
    }

return false;
  }

  // Field-level allowed set (honor ownerAlso for field rules too)
  function getAllowedFields({ username, resourceRn, modelName, action, allFields = [] }) {
    const actor = findUser(username);

if (!actor) throw new Error(`unknown user "${username}"`);
    const roleName = actor.role;
    const ancestry = buildAncestry(resourceRn);

    const items = [];

    // Owner short-circuit: include any ownerAlso field rules that match (ignore role)
    if (isOwner(username, resourceRn)) {
      for (const row of fieldPolicies) {
        if (!row || !row.ownerAlso || row.model !== modelName || row.action !== action) continue;
        const pat = row.resourceRn;

        if (ancestry.includes(pat) || matchesRnPattern(pat, resourceRn)) {
          items.push({ allow: Boolean(row.allow), fields: row.fields, spec: specificityOf(pat) });
        }
      }
    }

    // Role-based field rules
    for (const row of fieldPolicies) {
      if (!row || row.role !== roleName || row.model !== modelName || row.action !== action) continue;
      const pat = row.resourceRn;

      if (ancestry.includes(pat) || matchesRnPattern(pat, resourceRn)) {
        items.push({ allow: Boolean(row.allow), fields: row.fields, spec: specificityOf(pat) });
      }
    }

    items.sort((a, b) => b.spec - a.spec);

    const allowed = new Set();

    for (const it of items) {
      if ((it.fields || []).includes('*')) {
        if (it.allow) (allFields || []).forEach((f) => allowed.add(f));
        else allowed.clear();
      } else if (it.allow) it.fields.forEach((f) => allowed.add(f));
        else it.fields.forEach((f) => allowed.delete(f));
    }

return Array.from(allowed);
  }

  const projectAttributes = (attrs, allowed) => (Array.isArray(attrs) ? attrs : []).filter((a) => allowed.includes(a));
  const sanitizePayload = (payload, allowed) => Object.fromEntries(Object.entries(payload || {}).filter(([k]) => allowed.includes(k)));

  return { hasPermission, getAllowedFields, projectAttributes, sanitizePayload, buildAncestry, matchesRnPattern };
}

module.exports = { makeEngine };
