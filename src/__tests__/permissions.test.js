/* eslint-disable no-undef */
const permissions = require('../permissions');

describe('Permissions service', () => {
  it('should build ancestry from resource RN', () => {
    expect(permissions.buildAncestry('rn::class:1::group:2')).toEqual([
      'rn::class:1::group:2',
      'rn::class:1',
      'rn'
    ]);
  });
});
