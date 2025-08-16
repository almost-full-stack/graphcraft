// makeEngine.js (no `continue`, same semantics)

function buildAncestry(rn) {
  const parts = String(rn).split('::');
  const out = [];

  for (let i = parts.length; i > 0; i -= 2) {
    out.push(parts.slice(0, i).join('::'));
  }

  return out;
}

function matchesRnPattern(pattern, rn) {
  const escaped = String(pattern).
    replace(/[-\/\\^$+?.()|[\]{}]/g, '\\$&').
    replace(/\*/g, '[^:]+');
  const re = new RegExp(`^${escaped}$`);


  return re.test(String(rn));
}

const specificityOf = (pattern) => String(pattern).length;

function authEngine(cfg) {
  const {
    roles = [],
    users = [],
    resourceIndex = [],
    permissionAssignments = [],
    fieldPolicies = [],
  } = cfg || {};

  const findRole = (name) => roles.find((r) => r && r.name === name);
  const findUser = (username) => users.find((u) => u && u.username === username);
  const ownerOf = (rn) => {
    const row = resourceIndex.find((r) => r && r.resourceRn === rn);

    return row ? row.owner : null;
  };

  const ownerRoleOf = (rn) => {
    const owner = ownerOf(rn);
    const usr = owner ? findUser(owner) : null;


    return usr ? findRole(usr.role) : null;
  };

  const isOwner = (username, rn) => ownerOf(rn) === username;

  // ---------- Resource-level permission ----------
  function hasPermission({ username, resourceRn, permission, enableOwnerFallback = true }) {
    const actor = findUser(username);

    if (!actor) throw new Error(`unknown user "${username}"`);
    const actorRole = findRole(actor.role);

    if (!actorRole) throw new Error(`unknown role "${actor.role}"`);

    const ancestry = buildAncestry(resourceRn);

    // 1) Owner short-circuit via rules marked "or owner"
    if (isOwner(username, resourceRn)) {
      let matchedOwnerRule = false;

      for (const row of permissionAssignments) {
        let consider = true;

        if (!row) {
          consider = false;
        } else if (!row.ownerAlso) {
          consider = false;
        } else if (row.permission !== permission) {
          consider = false;
        }

        if (consider) {
          const rns = Array.isArray(row.resourceRns) ? row.resourceRns : [];

          for (const pat of rns) {
            const match = ancestry.includes(pat) || matchesRnPattern(pat, resourceRn);

            if (match) {
              matchedOwnerRule = true;

              return row.allow === true;
            }
          }
        }
      }
      // If you want owners to always be allowed regardless of rules, you could:
      // if (!matchedOwnerRule) return true;
    }

    // 2) Explicit role-based policies (pick most-specific match; deny wins by choosing first result)
    const matches = [];

    for (const row of permissionAssignments) {
      let consider = true;

      if (!row) {
        consider = false;
      } else if (row.role !== actorRole.name) {
        consider = false;
      } else if (row.permission !== permission) {
        consider = false;
      }

      if (consider) {
        const rns = Array.isArray(row.resourceRns) ? row.resourceRns : [];

        for (const pat of rns) {
          const isMatch = ancestry.includes(pat) || matchesRnPattern(pat, resourceRn);

          if (isMatch) {
            matches.push({ allow: Boolean(row.allow), spec: specificityOf(pat) });
          }
        }
      }
    }

    matches.sort((a, b) => b.spec - a.spec);
    if (matches.length > 0) {
      return matches[0].allow === true;
    }

    // 3) Rank fallback (actor outranks owner)
    if (enableOwnerFallback) {
      const oRole = ownerRoleOf(resourceRn);

      if (oRole && typeof oRole.rank === 'number' && actorRole.rank > oRole.rank) {
        return true;
      }
    }

    return false;
  }

  // ---------- Field-level allowed set (honor ownerAlso for field rules) ----------
  function getAllowedFields({ username, resourceRn, modelName, action, allFields = [] }) {
    const actor = findUser(username);

    if (!actor) throw new Error(`unknown user "${username}"`);
    const roleName = actor.role;
    const ancestry = buildAncestry(resourceRn);

    const items = [];

    // Owner short-circuit: include any ownerAlso field rules that match (ignore role)
    if (isOwner(username, resourceRn)) {
      for (const row of fieldPolicies) {
        let consider = true;

        if (!row) {
          consider = false;
        } else if (!row.ownerAlso) {
          consider = false;
        } else if (row.model !== modelName) {
          consider = false;
        } else if (row.action !== action) {
          consider = false;
        }

        if (consider) {
          const pat = row.resourceRn;
          const match = ancestry.includes(pat) || matchesRnPattern(pat, resourceRn);

          if (match) {
            items.push({
              allow: Boolean(row.allow),
              fields: Array.isArray(row.fields) ? row.fields : [],
              spec: specificityOf(pat),
            });
          }
        }
      }
    }

    // Role-based field rules
    for (const row of fieldPolicies) {
      let consider = true;

      if (!row) {
        consider = false;
      } else if (row.role !== roleName) {
        consider = false;
      } else if (row.model !== modelName) {
        consider = false;
      } else if (row.action !== action) {
        consider = false;
      }

      if (consider) {
        const pat = row.resourceRn;
        const match = ancestry.includes(pat) || matchesRnPattern(pat, resourceRn);

        if (match) {
          items.push({
            allow: Boolean(row.allow),
            fields: Array.isArray(row.fields) ? row.fields : [],
            spec: specificityOf(pat),
          });
        }
      }
    }

    items.sort((a, b) => b.spec - a.spec);

    const allowed = new Set();

    for (const it of items) {
      const hasStar = (it.fields || []).includes('*');

      if (hasStar) {
        if (it.allow) {
          (allFields || []).forEach((f) => allowed.add(f));
        } else {
          allowed.clear();
        }
      } else if (it.allow) {
          it.fields.forEach((f) => allowed.add(f));
        } else {
          it.fields.forEach((f) => allowed.delete(f));
        }
    }

    return Array.from(allowed);
  }

  const projectAttributes = (attrs, allowed) =>
    (Array.isArray(attrs) ? attrs : []).filter((a) => allowed.includes(a));

  const sanitizePayload = (payload, allowed) =>
    Object.fromEntries(Object.entries(payload || {}).filter(([k]) => allowed.includes(k)));

  return {
    hasPermission,
    getAllowedFields,
    projectAttributes,
    sanitizePayload,
    buildAncestry,
    matchesRnPattern,
  };
}

module.exports = { authEngine };
