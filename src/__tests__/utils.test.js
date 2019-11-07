/* eslint-disable no-undef */
const { generateName } = require('../utils');

describe('Utility functions', () => {

  it('should generate names from template', () => {
    expect(generateName('{name}Get', { name: 'Product' })).toEqual('productGet');
    expect(generateName('{name}', { name: 'Product' })).toEqual('product');
    expect(generateName('{name}name', { name: 'Product' })).toEqual('productName');
    expect(generateName('customName', { name: 'Product' })).toEqual('customName');
    expect(generateName('{name}{type}', { name: 'Product', type: 'Create' })).toEqual('productCreate');
    expect(generateName('{name}{type}{bulk}', { name: 'Product', type: 'Create' })).toEqual('productCreate');
    expect(generateName('{bulk}{name}{type}', { name: 'Product', type: 'Create', bulk: 'Bulk' })).toEqual('bulkProductCreate');
    expect(generateName('{bulk}{name}{type}', { name: 'product', type: 'Create', bulk: 'bulk' }, { pascalCase: true })).toEqual('BulkProductCreate');
    expect(generateName('My{bulk}Custom{name}dope{type}', { name: 'product', type: 'Create', bulk: 'bulk' }, { pascalCase: true })).toEqual('MyBulkCustomProductDopeCreate');
  });

});