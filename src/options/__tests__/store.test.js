import {
  configure,
  getConfig,
  get,
  setOption,
  updateOptions,
  getInternal,
  __resetForTests,
} from './store.js';

describe('config/store', () => {
  beforeEach(() => {
    __resetForTests();
  });

  test('configure: merges user options over defaults and freezes result', async () => {
    const cfg = configure({
      debug: true,
      limits: { default: 25, max: 200 },
      naming: { templates: { mutation: '{name}{operation}{bulk}' } },
    });

    expect(cfg.debug).toBe(true);
    expect(cfg.limits.default).toBe(25);
    expect(cfg.limits.max).toBe(200);

    // Effective config should be frozen
    expect(Object.isFrozen(cfg)).toBe(true);
    expect(Object.isFrozen(cfg.limits)).toBe(true);

    // get() convenience accessor
    expect(get('limits.default')).toBe(25);
    expect(get('naming.templates.mutation')).toBe('{name}{operation}{bulk}');
    expect(get('does.not.exist', 'fallback')).toBe('fallback');
  });

  test('configure: can only be called once', () => {
    configure({});
    expect(() => configure({ debug: true })).toThrow(/already initialized/i);
  });

  test('getConfig: returns the same frozen snapshot until an edit occurs', () => {
    configure({ debug: false });
    const first = getConfig();
    const second = getConfig();

    expect(first).toBe(second); // cached snapshot

    setOption('debug', true);
    const third = getConfig();

    expect(third).not.toBe(first); // cache invalidated
    expect(third.debug).toBe(true);
  });

  test('setOption: allows only whitelisted paths and validates values', () => {
    configure({ limits: { default: 50, max: 100 }, debug: false });

    // Allowed change
    setOption('debug', true);
    expect(getConfig().debug).toBe(true);

    // Validate range: default cannot exceed max
    expect(() => setOption('limits.default', 150)).toThrow(/cannot exceed/i);

    // Allowed + valid
    setOption('limits.default', 75);
    expect(get('limits.default')).toBe(75);

    // Disallowed path
    expect(() => setOption('naming.templates.query', 'X')).toThrow(/not allowed/i);
  });

  test('updateOptions: batch applies multiple allowed changes atomically', () => {
    configure({ limits: { default: 50, max: 100 }, debug: false });

    const after = updateOptions({
      limits: { default: 80 },
      debug: true,
    });

    expect(after.debug).toBe(true);
    expect(after.limits.default).toBe(80);
  });

  test('updateOptions: fails if any path is disallowed (atomicity)', () => {
    configure({ limits: { default: 50, max: 100 }, debug: false });

    // Prepare a value that would be visible if it were partially applied
    // If atomicity holds, none of these changes should persist on failure
    expect(() =>
      updateOptions({
        limits: { default: 60 },          // allowed
        naming: { templates: { query: 'X' } }, // NOT allowed
      })
    ).toThrow(/not allowed/i);

    // Ensure nothing changed
    expect(get('limits.default')).toBe(50);
    expect(get('debug')).toBe(false);
    expect(get('naming.templates.query')).toBe('{name}{operation}');
  });

  test('_GET_POLICIES: permissionsOn=once memoizes per config version', async () => {
    const policiesMock = jest.fn().mockResolvedValue('P1');

    configure({
      policies: policiesMock,
      permissionsOn: 'once',
    });

    const { _GET_POLICIES } = getInternal();

    const a = await _GET_POLICIES('x');
    const b = await _GET_POLICIES('y'); // should return memoized result, not call again

    expect(a).toBe('P1');
    expect(b).toBe('P1');
    expect(policiesMock).toHaveBeenCalledTimes(1);

    // Changing a whitelisted option invalidates derived helpers (new version)
    setOption('debug', true);

    const { _GET_POLICIES: afterChange } = getInternal();
    const c = await afterChange('z');

    expect(c).toBe('P1');
    expect(policiesMock).toHaveBeenCalledTimes(2); // called again after version bump
  });

  test('_GET_POLICIES: switching permissionsOn at runtime updates behavior', async () => {
    const policiesMock = jest.fn().mockResolvedValue('PX');

    configure({
      policies: policiesMock,
      permissionsOn: 'once',
    });

    // Once: only first call should hit the mock
    let internal = getInternal();
    let getPolicies = internal._GET_POLICIES;

    await getPolicies('k1');
    await getPolicies('k2');
    expect(policiesMock).toHaveBeenCalledTimes(1);

    // Switch to 'always': every call should hit
    setOption('permissionsOn', 'always');
    internal = getInternal();
    getPolicies = internal._GET_POLICIES;

    await getPolicies('k3');
    await getPolicies('k4');
    expect(policiesMock).toHaveBeenCalledTimes(3); // +2 more
  });

  test('_GET_POLICIES: cacheByKey memoizes by first argument', async () => {
    const policiesMock = jest.fn(async (key) => `P:${key}`);

    configure({
      policies: policiesMock,
      permissionsOn: 'cacheByKey',
    });

    const { _GET_POLICIES } = getInternal();

    const a1 = await _GET_POLICIES('alpha');
    const a2 = await _GET_POLICIES('alpha');
    const b1 = await _GET_POLICIES('beta');

    expect(a1).toBe('P:alpha');
    expect(a2).toBe('P:alpha');
    expect(b1).toBe('P:beta');

    // Called once per distinct key
    expect(policiesMock).toHaveBeenCalledTimes(2);
    expect(policiesMock).toHaveBeenNthCalledWith(1, 'alpha');
    expect(policiesMock).toHaveBeenNthCalledWith(2, 'beta');
  });

  test('frozen config cannot be mutated by consumers', () => {
    configure({ debug: false, limits: { default: 10, max: 20 } });

    const cfg = getConfig();
    expect(Object.isFrozen(cfg)).toBe(true);
    expect(Object.isFrozen(cfg.limits)).toBe(true);

    // Attempt to mutate (in non-strict it silently fails); verify no change.
    cfg.debug = true; // should have no effect
    expect(getConfig().debug).toBe(false);

    // Changing via setOption does work
    setOption('debug', true);
    expect(getConfig().debug).toBe(true);
  });

  test('__resetForTests resets the store to defaults and unlocks', () => {
    configure({ debug: true, limits: { default: 5, max: 10 } });
    expect(getConfig().debug).toBe(true);

    __resetForTests();

    // After reset, configure can be called again
    expect(() => configure({ debug: false })).not.toThrow();
    expect(getConfig().debug).toBe(false);
  });
});
