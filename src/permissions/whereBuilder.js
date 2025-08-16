// whereBuilder.js
function escapeRegex(s) {
  return String(s).replace(/[-\/\\^$+?.()|[\]{}]/g, '\\$&');
}
function rnPatternToSqlRegex(pattern) {
  const body = escapeRegex(pattern).replace(/\*/g, '[^:]+');


return `^${body}(?:$|::.*)$`;
}
function collectPatternLists({ cfg, username, permission }) {
  const { roles = [], users = [], permissionAssignments = [] } = cfg;
  const actor = users.find((u) => u.username === username);

  if (!actor) throw new Error(`Unknown user "${username}"`);
  const role = roles.find((r) => r.name === actor.role);

  if (!role) throw new Error(`Unknown role "${actor.role}"`);
  const regexes = [];
  const ownerAlsoRegexes = [];

  for (const row of permissionAssignments) {
    if (!row || row.permission !== permission || row.role !== role.name) continue;
    if (row.allow !== true) continue; // JSON focuses on positive paths
    const target = row.ownerAlso ? ownerAlsoRegexes : regexes;

    for (const pat of row.resourceRns || []) target.push(rnPatternToSqlRegex(pat));
  }

return { regexes, ownerAlsoRegexes, actorRole: role };
}

/**
 * JSON AST for WHERE logic.
 * Shape:
 * {
 *   anyOf: [
 *     { type:'pattern', column:'t.resource_rn', operator:'regex', value:'^...$' },
 *     { allOf: [
 *         { type:'compare', left:'(SELECT owner ...)', op:'=', value:'alice' },
 *         { type:'pattern', column:'t.resource_rn', operator:'regex', value:'^...$' }
 *       ]
 *     },
 *     { type:'rankFallback', ownerRankExpr:'(SELECT ...)', op:'<', value:50 }
 *   ],
 *   valuesNeeded: { username:'alice', patterns:[...], ownerAlsoPatterns:[...], rank:50 }
 * }
 */
function buildWhereJSON(cfg, {
  username,
  permission,
  tableAlias = 't',
  rnColumn = 'resource_rn',
  resourceIndex = { table: 'resource_index', rn: 'resource_rn', owner: 'owner_username' },
  usersTable = { table: 'users', username: 'username', role: 'role_name' },
  rolesTable = { table: 'roles', name: 'name', rank: 'rank' },
  includeOwnerAlso = true,
  includeRankFallback = false
} = {}) {
  const { regexes, ownerAlsoRegexes, actorRole } =
    collectPatternLists({ cfg, username, permission });

  const rnExpr = `${tableAlias}.${rnColumn}`;
  const ownerExpr =
    `(SELECT ${resourceIndex.owner} FROM ${resourceIndex.table} ri ` +
    `WHERE ri.${resourceIndex.rn} = ${rnExpr})`;

  const anyOf = [];

  // 1) Role-based patterns
  for (const rx of regexes) {
    anyOf.push({
      type: 'pattern',
      column: rnExpr,
      operator: 'regex', // if you target LIKE later, set to 'like'
      value: rx
    });
  }

  // 2) OwnerAlso patterns
  if (includeOwnerAlso) {
    for (const rx of ownerAlsoRegexes) {
      anyOf.push({
        allOf: [
          { type: 'compare', left: ownerExpr, op: '=', value: username },
          { type: 'pattern', column: rnExpr, operator: 'regex', value: rx }
        ]
      });
    }
  }

  // 3) Rank fallback (actor.rank > owner.rank)
  if (includeRankFallback) {
    const ownerRankExpr =
      `(SELECT r.${rolesTable.rank} FROM ${resourceIndex.table} ri ` +
      `JOIN ${usersTable.table} u ON u.${usersTable.username} = ri.${resourceIndex.owner} ` +
      `JOIN ${rolesTable.table} r ON r.${rolesTable.name} = u.${usersTable.role} ` +
      `WHERE ri.${resourceIndex.rn} = ${rnExpr})`;

    anyOf.push({
      type: 'rankFallback',
      left: ownerRankExpr,
      op: '<',
      value: actorRole.rank
    });
  }

  // If nothing matched, produce FALSE-equivalent JSON
  const ast = {
    anyOf,
    valuesNeeded: {
      username,
      patterns: regexes,
      ownerAlsoPatterns: includeOwnerAlso ? ownerAlsoRegexes : [],
      rank: includeRankFallback ? actorRole.rank : undefined
    }
  };


return ast;
}

/**
 * Optional: render JSON AST to Postgres WHERE fragment with params.
 * (Keeps pure string building separate from AST creation.)
 */
function renderWhereJSONToSQL(ast, {
  dialect = 'postgres'
} = {}) {
  const params = [];

  function renderNode(node) {
    if (node.type === 'pattern') {
      if (dialect === 'postgres') {
        params.push(node.value);

return `${node.column} ~ $${params.length}`;
      }
        // crude LIKE conversion for portability
        const like = node.value.
          replace(/^\^/, '').
          replace(/\$\s*$/, '').
          replace(/\[\^\:\]\+/g, '%').
          replace(/\\:/g, ':');

        params.push(like.includes('%') ? like : like + '%');

return `${node.column} LIKE ?`;

    }
    if (node.type === 'compare') {
      params.push(node.value);

return `${node.left} ${node.op} $${params.length}`;
    }
    if (node.type === 'rankFallback') {
      params.push(node.value);

return `${node.left} ${node.op} $${params.length}`;
    }
    if (node.allOf) {
      const parts = node.allOf.map(renderNode);


return `(${parts.join(' AND ')})`;
    }
    if (node.anyOf) {
      const parts = node.anyOf.map(renderNode);


return `(${parts.join(' OR ')})`;
    }

return 'FALSE';
  }
  const sql = ast.anyOf.length ? renderNode({ anyOf: ast.anyOf }) : 'FALSE';


return { sql, params };
}

module.exports = {
  buildWhereJSON,
  renderWhereJSONToSQL,
  rnPatternToSqlRegex
};
