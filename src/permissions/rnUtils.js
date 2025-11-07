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

function modelNameToKey(name) {
  if (name == null) return '';
  const s = String(name).trim();
  if (!s) return '';
  if (/[_\s-]/.test(s)) return s.replace(/[-\s]+/g, '_').toLowerCase();
  return s
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1_$2')
    .toLowerCase();
}

/**
 * buildRn(...)
 *
 * Flexible builder for RN strings. Examples:
 *   buildRn('Club', 1, 'Event', 1)                -> 'rn::club:1::event:1'
 *   buildRn({model:'Club', id:1}, {model:'Event', id:1})
 *   buildRn(['Club',1], ['Event',1])
 *   buildRn('club:1','event:1')
 *   buildRn([{model:'Club',id:1}, ['Event',1], 'Category', 5])
 */
function buildRn(...args) {
  // accept single array arg as list
  if (args.length === 1 && Array.isArray(args[0])) args = args[0];

  const segs = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a == null) continue;

    if (typeof a === 'string') {
      // "club:1" or "club"
      if (a.includes(':')) {
        const [m, id] = a.split(':', 2);
        segs.push({ key: modelNameToKey(m), id: id === '' ? null : id });
      } else {
        // peek next for id
        const next = args[i + 1];
        if (next != null && (typeof next === 'number' || String(next).match(/^\d+$/))) {
          segs.push({ key: modelNameToKey(a), id: String(next) });
          i++;
        } else {
          segs.push({ key: modelNameToKey(a), id: null });
        }
      }
    } else if (Array.isArray(a)) {
      const [m, id] = a;
      segs.push({ key: modelNameToKey(m), id: id == null ? null : String(id) });
    } else if (typeof a === 'object') {
      const m = a.model ?? a.modelName ?? a.name ?? a.key;
      const id = a.id ?? a.keyId ?? null;
      segs.push({ key: modelNameToKey(m), id: id == null ? null : String(id) });
    }
  }

  const parts = ['rn', ...segs.map((s) => (s.id == null ? s.key : `${s.key}:${s.id}`))];
  return parts.join('::');
}

module.exports = { parseRn, leafModelKey, modelsInPath, leafModelName, toModelCase, buildRn };
