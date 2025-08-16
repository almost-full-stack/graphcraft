const defaultOptions = require('./base-options');
const defaultModelGraphqlOptions = require('./model-options');
const store = require('./store');

module.exports = {
  defaultOptions,
  defaultModelGraphqlOptions,
  ...store
};