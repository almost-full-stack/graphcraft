// config/store.js
// Shared configuration store for the library.
//
// How to use:
//   1) Call `configure(userOptions)` once at startup.
//   2) Anywhere else, call `getConfig()` to read the current frozen config.
//   3) If you need to tweak a FEW safe fields later, use `setOption(path, value)`
//      or `updateOptions(patch)` — only whitelisted paths are allowed.
//   4) Internal-only helpers (derived from config) are available via `getInternal()`.
//      Example: `_GET_POLICIES` wraps the user’s `policies` function based on `permissionsOn`.

import _ from 'lodash';
import defaultOptions from './base-options.js';
import { loadPolicy } from '../permissions/dslLoader.js';

/* ----------------------------- utilities ----------------------------- */

const isPlain = (v) => Object.prototype.toString.call(v) === '[object Object]';

// Deep merge where plain objects merge; arrays / functions / primitives replace.
function deepMerge(base, override) {
  if (!isPlain(base) || !isPlain(override)) return override ?? base;
  const out = { ...base };
  for (const k of Object.keys(override)) {
    const bv = base[k];
    const ov = override[k];
    if (ov === undefined) continue;
    if (Array.isArray(ov)) out[k] = ov.slice();
    else if (isPlain(ov) && isPlain(bv)) out[k] = deepMerge(bv, ov);
    else out[k] = ov;
  }
  return out;
}

// Deep-freeze only plain objects/arrays. (Functions/instances stay as-is.)
function deepFreeze(obj) {
  if (obj && (Array.isArray(obj) || isPlain(obj))) {
    Object.freeze(obj);
    for (const k of Object.keys(obj)) deepFreeze(obj[k]);
  }
  return obj;
}

// Safe nested get: 'a.b.c'
function getAt(obj, path) {
  return _.get(obj, path);
  //return path.split('.').reduce((acc, k) => (acc == null ? acc : acc[k]), obj);
}

// Safe nested set: creates missing objects on the path
function setAt(obj, path, value) {
  _.set(obj, path, value);
  /*
  const parts = path.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    if (!isPlain(cur[p])) cur[p] = {};
    cur = cur[p];
  }
  cur[parts[parts.length - 1]] = value;*/
}

// Flatten nested object to {'a.b.c': value}
function flatten(obj, prefix = '', out = {}) {
  for (const [k, v] of Object.entries(obj || {})) {
    const p = prefix ? `${prefix}.${k}` : k;
    if (isPlain(v)) flatten(v, p, out);
    else out[p] = v;
  }
  return out;
}

/* ------------------------------- state -------------------------------- */

// Frozen base set by `configure()`
let _base = deepFreeze({ ...defaultOptions });

// Small mutable overlay for post-init edits (only whitelisted paths)
let _overlay = {};

// Versioning & caches
let _locked = false;         // has configure() been called?
let _version = 0;            // bump to invalidate caches
let _cachedConfig = null;    // frozen effective config (base + overlay)
let _cachedVersion = -1;

// Derived/internal helpers (rebuilt when version changes)
let _derived = null;
let _derivedVersion = -1;

// Recompute caches if stale
function ensureCaches() {
  if (!_cachedConfig || _cachedVersion !== _version) {
    _cachedConfig = deepFreeze(deepMerge(_base, _overlay));
    _cachedVersion = _version;
  }
  if (!_derived || _derivedVersion !== _version) {
    _derived = buildDerived(_cachedConfig);
    _derivedVersion = _version;
  }
}

/* ------------------------------ public API ---------------------------- */

// Initialize once; merges user options over defaults and freezes.
export function configure(userOptions = {}) {
  if (_locked) throw new Error('Config already initialized');
  _base = deepFreeze(deepMerge(defaultOptions, userOptions));
  _overlay = {};
  _locked = true;
  _version++;
  _cachedConfig = null;
  _derived = null;
  return getConfig();
}

// Read the current frozen effective config.
export function getConfig() {
  ensureCaches();
  return _cachedConfig;
}

// Convenience: get a nested value with fallback.
export function get(path, fallback) {
  const v = getAt(getConfig(), path);
  return v === undefined ? fallback : v;
}

/* ------------------ tight, whitelisted post-init edits ---------------- */

// Only these paths may change after initialization. Keep short.
const ALLOWED = new Set([
  'limits.default',
  'limits.max',
  'debug',
  'exposeOnly.throw',
  'errorHandler.ETIMEDOUT.statusCode',
  'dataloaderContext',
  'permissionsOn' // controls internal _GET_POLICIES behavior
]);

const VALIDATORS = {
  'limits.default': (v, cfg) => {
    const max = Number(getAt(cfg, 'limits.max'));
    if (!Number.isFinite(v) || v <= 0) throw new Error('limits.default must be a positive number');
    if (Number.isFinite(max) && v > max) throw new Error('limits.default cannot exceed limits.max');
  },
  'limits.max': (v) => {
    if (!Number.isFinite(v) || v <= 0) throw new Error('limits.max must be a positive number');
  },
  'debug': (v) => {
    if (typeof v !== 'boolean') throw new Error('debug must be boolean');
  },
  'exposeOnly.throw': (v) => {
    if (typeof v !== 'boolean') throw new Error('exposeOnly.throw must be boolean');
  },
  'errorHandler.ETIMEDOUT.statusCode': (v) => {
    if (!Number.isInteger(v) || v < 100 || v > 599) throw new Error('statusCode must be 100-599');
  },
  'permissionsOn': (v) => {
    if (!['once', 'always', 'cacheByKey'].includes(v)) {
      throw new Error('permissionsOn must be "once", "always", or "cacheByKey"');
    }
  }
};

// Set a single allowed option after init.
export function setOption(path, value) {
  if (!_locked) throw new Error('Call configure() before setOption()');
  if (!ALLOWED.has(path)) throw new Error(`Editing '${path}' is not allowed`);
  const cfg = getConfig();
  const validate = VALIDATORS[path];
  if (validate) validate(value, cfg);
  setAt(_overlay, path, value);
  _version++;
  _cachedConfig = null;
  _derived = null; // force rebuild of internal helpers
  return getConfig();
}

// Batch update multiple options atomically.
export function updateOptions(patch) {
  if (!_locked) throw new Error('Call configure() before updateOptions()');

  // Dry-run into a temp overlay and validate
  const nextOverlay = structuredClone(_overlay);
  const flat = flatten(patch);

  for (const path of Object.keys(flat)) {
    if (!ALLOWED.has(path)) throw new Error(`Editing '${path}' is not allowed`);
    setAt(nextOverlay, path, flat[path]);
  }

  const simulated = deepMerge(_base, nextOverlay);
  for (const [path, validator] of Object.entries(VALIDATORS)) {
    if (flat[path] !== undefined) validator(flat[path], simulated);
  }

  // Commit
  _overlay = nextOverlay;
  _version++;
  _cachedConfig = null;
  _derived = null;
  return getConfig();
}

/* ------------------------- internal / derived API ---------------------- */

// Build internal helpers derived from the current config.
// These are NOT user-settable and are rebuilt on every version change.
function buildDerived(cfg) {
  
  console.log('Building derived config...');

  function makePoliciesWrapper() {
    const userPolicies = async () => {
      const policies = await cfg.policies();

      if (policies) {

        const parsedPolicy = loadPolicy(policies);
        console.log('Parsed Policy:', parsedPolicy);

        return parsedPolicy;
      }

      return {};
    }

    const mode = cfg.permissionsOn || 'once';

    if (mode === 'once') {
      // Compute once per config version.
      let memo;
      let seenVersion = _version;
      return async (...args) => {
        if (memo !== undefined && seenVersion === _version) return memo;
        memo = await userPolicies(...args);
        seenVersion = _version;
        return memo;
      };
    }

    if (mode === 'always') {
      return (...args) => userPolicies(...args);
    }

    // Fallback: pass-through
    return (...args) => userPolicies(...args);
  }

  return Object.freeze({
    _GET_POLICIES: makePoliciesWrapper()
  });
}

// Internal-only view for use inside the project.
export function getInternal() {
  ensureCaches();
  return _derived;
}

/* --------------------------- test-only reset --------------------------- */

// Reset the store to defaults (use in tests only; do not expose publicly).
export function __resetForTests() {
  _base = deepFreeze({ ...defaultOptions });
  _overlay = {};
  _locked = false;
  _version++;
  _cachedConfig = null;
  _derived = null;
}
