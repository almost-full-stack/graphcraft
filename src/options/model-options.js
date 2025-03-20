/**
 * Default configuration options for the model.
 *
 * This object defines various options related to GraphQL operations on a model, including attribute selection,
 * query/mutation customization, hooks, and bulk operations.
 *
 * @constant {Object} defaultModelGraphqlOptions
 * @property {Object} attributes - Controls attribute inclusion/exclusion.
 * @property {Array} attributes.exclude - List of attributes to be ignored in Model Input.
 * @property {Object} attributes.include - Attributes in key:type format to be included in Model Input.
 *
 * @property {Object|null} scopes - Common scope applied on all find/update/destroy operations. Highly recommended.
 * @property {Object} alias - Rename default queries/mutations to specified custom names.
 *
 * @property {Object} bulk - Controls bulk operations.
 * @property {Array} bulk.enabled - List of enabled bulk operations (e.g., ['create', 'destroy', 'update']).
 * @property {boolean|string|string[]} bulk.bulkColumn - Defines a bulk identifier column when using bulk create.
 *          Accepts a column name string or an array with a foreign key reference.
 * @property {boolean} bulk.returning - If true, returns all created/updated items (does not use Sequelize returning option).
 *
 * @property {Object} types - User-defined custom types. Type names must be unique across the project.
 * @property {Object} mutations - User-defined custom mutations. Mutation names must be unique across the project.
 * @property {Object} queries - User-defined custom queries. Query names must be unique across the project.
 *
 * @property {Array} excludeMutations - List of default mutations to exclude (e.g., ['create', 'destroy', 'update']).
 * @property {Array} excludeQueries - List of default queries to exclude (e.g., ['fetch']).
 *
 * @property {Object} extend - Defines after-hook behavior for default queries/mutations (fetch, create, destroy, update).
 * @property {Object} before - Defines before-hook behavior for default queries/mutations (fetch, create, destroy, update).
 * @property {Object} overwrite - Overwrites default query/mutation behavior (fetch, create, destroy, update).
 *
 * @property {boolean} joins - Enables joins instead of batch dataloader for queries. Supports left/right/inner joins.
 *           (Right join does not work with SQLite.)
 * @property {boolean} readonly - If true, automatically excludes create/delete/update mutations.
 * @property {boolean} fetchDeleted - Overrides global settings to include deleted records in queries.
 * @property {boolean} restoreDeleted - Overrides global settings to restore deleted records.
 * @property {Object} find - Defines GraphQL-Sequelize find hooks (before, after).
 */

const defaultModelGraphqlOptions = {
  attributes: {
    exclude: [],
    include: {},
  },

  scopes: null,
  alias: {},

  bulk: {
    enabled: [],
    bulkColumn: false,
    returning: true,
  },

  types: {},
  mutations: {},
  queries: {},

  excludeMutations: [],
  excludeQueries: [],

  extend: {},
  before: {},
  overwrite: {},

  joins: false,
  readonly: false,
  fetchDeleted: false,
  restoreDeleted: false,

  find: {},
};

module.exports = defaultModelGraphqlOptions;