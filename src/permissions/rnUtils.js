// rnUtils.js
function toModelCase(s) {
  // 'discipline' -> 'Discipline', 'competition_category' -> 'CompetitionCategory'
  return String(s).
    split(/[_\s-]+/).
    map((p) => (p ? p[0].toUpperCase() + p.slice(1) : '')).
    join('');
}

/**
 * parseRn('rn::club:1::discipline:1') =>
 * [{ key:'club', id:'1' }, { key:'discipline', id:'1' }]
 */
function parseRn(rn) {
  const parts = String(rn).split('::').filter(Boolean);
  // parts = ['rn','club:1','discipline:1'] or ['club:1','discipline:1'] depending on input
  const pairs = parts.
    filter((p) => p !== 'rn').
    map((seg) => {
      const i = seg.indexOf(':');


return i === -1
        ? { key: seg, id: null }
        : { key: seg.slice(0, i), id: seg.slice(i + 1) };
    });


return pairs;
}

/** Leaf model key (last segment key). For rn::club:1::discipline:1 -> 'discipline' */
function leafModelKey(rn) {
  const pairs = parseRn(rn);


return pairs.length ? pairs[pairs.length - 1].key : null;
}

/** All model keys in path: rn::club:1::discipline:1 -> ['club','discipline'] */
function modelsInPath(rn) {
  return parseRn(rn).map((p) => p.key);
}

/** Leaf model name in PascalCase: 'Discipline' */
function leafModelName(rn) {
  const key = leafModelKey(rn);


return key ? toModelCase(key) : null;
}

module.exports = { parseRn, leafModelKey, modelsInPath, leafModelName, toModelCase };
