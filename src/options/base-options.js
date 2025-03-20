/**
 * Default configuration options for GraphQL models.
 *
 * This object defines various settings related to GraphQL queries, mutations, permissions,
 * logging, transactions, and naming conventions.
 *
 * @constant {Object} defaultOptions
 *
 * @property {Object} naming - Defines the naming convention for queries, mutations, and types.
 * @property {boolean} naming.pascalCase - If true, uses PascalCase instead of camelCase.
 * @property {string} naming.queries - Format for auto-generated queries (e.g., "{name}{type}").
 * @property {string} naming.mutations - Format for auto-generated mutations (e.g., "{name}{type}{bulk}").
 * @property {string} naming.input - Format for input types.
 * @property {string} naming.rootQueries - Name for root query types.
 * @property {string} naming.rootMutations - Name for root mutation types.
 * @property {Object} naming.type - Defines naming conventions for different operations.
 *
 * @property {Object} limits - Controls limits for find queries.
 * @property {number} limits.default - Default limit for queries (0 for no limit).
 * @property {number} limits.max - Maximum allowed limit (0 for unlimited).
 * @property {boolean} limits.nested - Whether to apply limits to nested/sub-types.
 *
 * @property {boolean} nestedMutations - Enables automatic mutation of nested objects (only for hasMany & belongsTo).
 *
 * @property {Object} exposeOnly - Restricts GraphQL exposure globally for queries/mutations.
 * @property {Array} exposeOnly.queries - List of queries to expose.
 * @property {Array} exposeOnly.mutations - List of mutations to expose.
 * @property {boolean|string} exposeOnly.throw - If set, throws an error instead of not generating queries/mutations.
 *
 * @property {Array} exclude - Models to exclude from the GraphQL schema.
 * @property {Object} includeArguments - Additional arguments included in all queries/mutations.
 * @property {boolean} dataloader - Enables/disables DataLoader for nested queries.
 * @property {boolean} transactionedMutations - Runs mutations inside transactions.
 *
 * @property {Object} importTypes - Custom GraphQL types (e.g., Upload).
 * @property {Object} types - Custom GraphQL types (must be unique).
 * @property {Object} queries - Custom GraphQL queries (must be unique).
 * @property {Object} mutations - Custom GraphQL mutations (must be unique).
 *
 * @property {Object} globalHooks - Global hooks executed before/after all mutations/queries.
 * @property {Object} globalHooks.before - Hooks executed before queries/mutations (fetch, create, update, destroy).
 * @property {Object} globalHooks.extend - Hooks executed after queries/mutations (fetch, create, update, destroy).
 *
 * @property {boolean|Array} findOneQueries - Enables "find one" queries (e.g., "ProductByPk").
 *                                            Can specify an array of models to include.
 *
 * @property {boolean} fetchDeleted - If true, allows queries to return both deleted & undeleted records.
 * @property {boolean} restoreDeleted - If true, creates restore endpoints for deleted records.
 * @property {boolean} noDefaults - If false, generates empty default queries.
 *
 * @property {Function} permissions - Function that returns a Promise to handle permission rules.
 * @returns {Promise<void>}
 *
 * @property {Function} logger - Function that executes after all queries/mutations.
 * @returns {Promise<void>}
 *
 * @property {Function} authorizer - Function that executes before all queries/mutations.
 * @param {Object} src - Source object.
 * @param {Object} arg - Arguments passed to the query/mutation.
 * @param {Object} ctx - GraphQL context.
 * @returns {Promise<void>}
 *
 * @property {Object} errorHandler - Defines error-handling behavior.
 * @property {Object} errorHandler.ETIMEDOUT - Example: Assigns status code 503 for timeout errors.
 *
 * @property {boolean} debug - Enables/disables debugging.
 */

const defaultOptions = {
  naming: {
    pascalCase: true,
    queries: '{name}{type}',
    mutations: '{name}{type}{bulk}',
    input: '{name}',
    rootQueries: 'RootQueriesType',
    rootMutations: 'RootMutationsType',
    type: {
      create: 'Create',
      update: 'Update',
      delete: 'Delete',
      restore: 'Restore',
      byPk: 'ByPK',
      get: '',
      bulk: 'Bulk',
      count: 'Count',
      default: 'Default',
    },
  },

  limits: {
    default: 50,
    max: 100,
    nested: false,
  },

  nestedMutations: true,

  exposeOnly: {
    queries: [],
    mutations: [],
    throw: false,
  },

  exclude: [],
  includeArguments: {},
  dataloader: false,
  transactionedMutations: true,

  importTypes: {},
  types: {},
  queries: {},
  mutations: {},

  globalHooks: {
    before: {},
    extend: {},
  },

  findOneQueries: false,
  fetchDeleted: false,
  restoreDeleted: false,
  noDefaults: true,

  permissions: () => Promise.resolve(),
  logger: () => Promise.resolve(),
  authorizer: (src, arg, ctx) => Promise.resolve(),

  errorHandler: {
    ETIMEDOUT: { statusCode: 503 },
  },

  debug: false,
};

module.exports = defaultOptions;
