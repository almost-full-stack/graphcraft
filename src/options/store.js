const defaultOptions = require('./base-options');

// helpers
const isPlain = (v) => Object.prototype.toString.call(v) === '[object Object]';

function deepMerge(base, override) {
  if (!isPlain(base) || !isPlain(override)) return override || base;
  const out = { ...base };
  for (const k of Object.keys(override)) {
    const bv = base[k], ov = override[k];
    if (ov === undefined) continue;
    if (Array.isArray(ov)) out[k] = ov.slice();
    else if (isPlain(ov) && isPlain(bv)) out[k] = deepMerge(bv, ov);
    else out[k] = ov;
  }
  return out;
}

function deepFreeze(obj) {
  if (obj && (Array.isArray(obj) || isPlain(obj))) {
    Object.freeze(obj);
    for (const k of Object.keys(obj)) deepFreeze(obj[k]);
  }
  return obj;
}

function getAtPath(obj, path) {
  return path.split('.').reduce((acc, k) => (acc == null ? acc : acc[k]), obj);
}

function setAtPath(obj, path, value) {
  const parts = path.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    cur[p] ||= {};
    if (!isPlain(cur[p])) throw new Error(`Cannot set through non-object at '${parts.slice(0, i+1).join('.')}'`);
    cur = cur[p];
  }
  cur[parts[parts.length - 1]] = value;
}

// ---------- store ----------
let _frozenBase = deepFreeze({ ...defaultOptions });
let _locked = false;

// The *only* mutable bit after init: a small overlay object with just the fields you allow to change.
let _overlay = {};         // NOT frozen
let _version = 0;          // increments on each edit
let _cachedMerged = null;  // cache merged view
let _cachedVersion = -1;

// 1) init once
function configure(userOptions = {}) {
  if (_locked) throw new Error('Config already initialized');
  _frozenBase = deepFreeze(deepMerge(defaultOptions, userOptions));
  _overlay = {}; // reset overlay on init
  _locked = true;
  _version++;
  return getConfig();
}

// 2) read view (base + overlay)
function getConfig() {
  if (_cachedMerged && _cachedVersion === _version) return _cachedMerged;
  _cachedMerged = deepFreeze(deepMerge(_frozenBase, _overlay));
  _cachedVersion = _version;
  return _cachedMerged;
}

// Whitelist: only these paths can change after init.
const ALLOWED = new Set([
  'dataloaderContext',
  'limits.default',
  'limits.max',
  'debug',
  'exposeOnly.throw',
  'errorHandler.ETIMEDOUT.statusCode'
]);

// Optional per-path validators
const VALIDATORS = {
  'limits.default': (v, cfg) => {
    const max = Number(getAtPath(cfg, 'limits.max'));
    if (!Number.isFinite(v) || v <= 0) throw new Error('limits.default must be a positive number');
    if (Number.isFinite(max) && v > max) throw new Error('limits.default cannot exceed limits.max');
  },
  'limits.max': (v) => {
    if (!Number.isFinite(v) || v <= 0) throw new Error('limits.max must be a positive number');
  },
  'debug': (v) => { if (typeof v !== 'boolean') throw new Error('debug must be boolean'); },
  'exposeOnly.throw': (v) => { if (typeof v !== 'boolean') throw new Error('exposeOnly.throw must be boolean'); },
  'errorHandler.ETIMEDOUT.statusCode': (v) => {
    if (!Number.isInteger(v) || v < 100 || v > 599) throw new Error('statusCode must be an HTTP status');
  },
};

// Single setter for a path (whitelisted only)
function setOption(path, value) {
  if (!_locked) throw new Error('Call configure() before setOption()');
  if (!ALLOWED.has(path)) throw new Error(`Editing '${path}' is not allowed`);

  // Validate against current merged config to enforce invariants
  const current = getConfig();
  const validator = VALIDATORS[path];
  if (validator) validator(value, current);

  // Apply to overlay, not base
  setAtPath(_overlay, path, value);
  _version++;           // bump version to invalidate cache
  return getConfig();   // return the new effective config (frozen)
}

function updateOptions(patchObj) {
  // Validate all first using a temp overlay copy
  const tempOverlay = structuredClone(_overlay);
  for (const [path, value] of Object.entries(flatten(patchObj))) {
    if (!ALLOWED.has(path)) throw new Error(`Editing '${path}' is not allowed`);
    setAtPath(tempOverlay, path, value);
  }
  // Run validators against a simulated merged config
  const simulated = deepMerge(_frozenBase, tempOverlay);
  for (const [path, validator] of Object.entries(VALIDATORS)) {
    const flat = flatten(patchObj);
    if (flat[path] !== undefined) validator(flat[path], simulated);
  }
  // Commit
  _overlay = tempOverlay;
  _version++;
  return getConfig();
}

// Tiny helper to flatten a nested object to 'a.b.c': value
function flatten(obj, prefix = '', out = {}) {
  for (const [k, v] of Object.entries(obj || {})) {
    const p = prefix ? `${prefix}.${k}` : k;
    if (isPlain(v)) flatten(v, p, out);
    else out[p] = v;
  }
  return out;
}

module.exports = { configure, getConfig, setOption, updateOptions };