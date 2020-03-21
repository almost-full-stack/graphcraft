const assert = require('assert');
const cls = require('cls-hooked');
const TRANSACTION_NAMESPACE = 'sequelize-graphql-schema';
const sequelizeNamespace = cls.createNamespace(TRANSACTION_NAMESPACE);
const { createContext, resetCache } = require('dataloader-sequelize');
const { define } = require('./utils');

// library options
const defaultOptions = {

  /**
   * naming convention for mutations/queries and types
   * {name} = Model Name or gql Type name
   * {type} = Get | Create | Update | Delete
   * {bulk} = Bulk (bulk operations only)
   * */

  naming: {
    pascalCase: true, // applied everywhere, set to true if you want to use camelCase
    queries: '{name}{type}', // applied to auto generated queries
    mutations: '{name}{type}{bulk}', // applied to auto generated mutations
    input: '{name}', // applied to all input types
    rootQueries: 'RootQueries',
    rootMutations: 'RootMutations',
    // {type} and {bulk} will be replaced with one of the following
    type: {
      create: 'Create',
      update: 'Update',
      delete: 'Delete',
      restore: 'Restore',
      get: '',
      bulk: 'Bulk',
      count: 'Count',
      default: 'Default'
    }
  },

  // default limit to be applied on find queries
  limits: {
    default: 50, // default limit. use 0 for no limit
    max: 100, // maximum allowed limit. use 0 for unlimited
    nested: false // whether to apply these limits on nested/sub types or not
  },

  // nested objects can be passed and will be mutated automatically. Only hasMany and belongsTo relation supported
  nestedMutations: true, // doesn't work with add bulk mutation

  // applied globaly on both auto-generated and custom queries/mutations
  exposeOnly: {
    queries: [],
    mutations: [],
    // instead of not generating queries/mutations this will instead throw an error.
    throw: false // string message
  },

  /**
   * update modes when sending nested association objects, if _Op field is not specified and updateMode is not set to WITHOP one of following will apply automatically.
   * UPDATE_ONLY > update incoming records
   * UPDATE_ADD > update existing records and add new ones i.e [{id: 1, name: 'test'}, {name: 'test2'}] record[0] will be updated and record[1] will be added
   * UPDATE_ADD_DELETE > not recommended: update existing records, add new ones and delete non-existent records i.e [{id: 1, name: 'test'}, {name: 'test2'}] record[0] will be updated, record[1] will be added, anything else will be deleted
   * MIXED > i.e [{id: 1, name: 'test'}, {id:2}, {name: 'test2'}], record[0] will be updated, record[1] will be deleted and record[2] will be added
   * WITHOP > _Op field to be specified with an operation, that operation to be used while mutating sub types
   * IGNORE > ignore nested update
   */

  nestedUpdateMode: 'MIXED',
  // these models will be excluded from graphql schema
  exclude: [],
  // include these arguments to all queries/mutations
  includeArguments: {},
  // enabled/disable dataloader for nested queries
  dataloader: false,
  // mutations are run inside transactions. Transactions are accessible in extend hook
  transactionedMutations: true,
  // custom graphql types: type names should be unique throughout the project
  types: {},
  // custom queries: query names should be unique throughout the project
  queries: {},
  // custom mutations: mutation names should be unique throughout the project
  mutations: {},
  // global hooks, behaves same way as model before/extend
  globalHooks: {
    before: {}, // will be executed before all auto-generated mutations/queries (fetch/create/update/destroy)
    extend: {} // will be executed after all auto-generated mutations/queries (fetch/create/update/destroy)
  },
  fetchDeleted: false, // Globally when using queries, this will allow to fetch both deleted and undeleted records (works only when tables have paranoid option enabled)
  restoreDeleted: false, // Applies globally, create restore endpoint for deleted records
  // executes after all queries/mutations
  logger() {
    return Promise.resolve();
  },
  // executes before all queries/mutations
  authorizer() {
    return Promise.resolve();
  },
  // executes when exceptions are thrown
  errorHandler: {
    'ETIMEDOUT': { statusCode: 503 }
  }
};

// Model options model.graphql
const defaultModelGraphqlOptions = {
  attributes: {
    exclude: [], // list attributes which are to be ignored in Model Input
    include: {}, // attributes in key:type format which are to be included in Model Input
  },
  // scope usage is highy recommended.
  scopes: null, // common scope to be applied on all find/update/destroy operations
  alias: {}, // rename default queries/mutations to specified custom name
  bulk: { // OR bulk: ['create', 'destroy', ....]
    enabled: [], // enable bulk options ['create', 'destroy', 'update']
    // Use bulkColumn when using bulk option for 'create' when using returning true and to increase efficiency
    bulkColumn: false, // bulk identifier column, when bulk creating this column will be auto filled with a uuid and later used to fetch added records 'columnName' or ['columnName', true] when using a foreign key as bulk column
    returning: true // This will return all created/updated items, doesn't use sequelize returning option
  },
  types: {}, // user defined custom types: type names should be unique throughout the project
  mutations: {}, // user defined custom mutations: : mutation names should be unique throughout the project
  queries: {}, // user defined custom queries: : query names should be unique throughout the project
  excludeMutations: [], // exclude one or more default mutations ['create', 'destroy', 'update']
  excludeQueries: [], // exclude one or more default queries ['fetch']
  extend: {}, // extend/after hook default queries/mutations behavior {fetch, create, destroy, update}
  before: {}, // before hook for default queries/mutations behavior {fetch, create, destroy, update}
  overwrite: {}, // overwrite default queries/mutations behavior {fetch, create, destroy, update}
  joins: false, // make a query using join (left/right/inner) instead of batch dataloader, join will appear in all subtype args. Right join won't work for sqlite
  readonly: false, // exclude create/delete/update mutations automatically
  fetchDeleted: false, // same as fetchDeleted as global except it lets you override global settings
  restoreDeleted: false // same as restoreDeleted as global except it lets you override global settings
};

const options = {};
const GenerateQueries = require('./libs/generateQueries');
const GenerateMutations = require('./libs/generateMutations');
const GenerateTypes = require('./libs/generateTypes');
let dataloaderContext;

const errorHandler = (error) => {
  for (const name in options.errorHandler) {
    if (error.message.indexOf(name) > -1) {
      Object.assign(error, options.errorHandler[name]);
      break;
    }
  }

  return error;
};

function generateSchema(models, context) {

  assert(models.Sequelize, 'Sequelize not found as models.Sequelize.');
  assert(models.sequelize, 'sequelize instance not found as models.sequelize.');

  if (options.dataloader) {
    dataloaderContext = createContext(models.sequelize);
    options.dataloaderContext = dataloaderContext;
  }

  options.Sequelize = models.Sequelize;
  options.sequelize = models.sequelize;
  options.models = models;

  options.Sequelize.useCLS(sequelizeNamespace);

  const { generateModelTypes } = GenerateTypes(options);
  const generateQueries = GenerateQueries(options);
  const generateMutations = GenerateMutations(options);
  const modelsIncluded = {};

  for (const modelName in models) {

    const model = models[modelName];

    if ('name' in model && modelName !== 'Sequelize' && !options.exclude.includes(modelName)) {
      model.graphql = model.graphql || defaultModelGraphqlOptions;
      model.graphql.attributes = Object.assign({}, defaultModelGraphqlOptions.attributes, model.graphql.attributes);
      model.graphql = Object.assign({}, defaultModelGraphqlOptions, model.graphql);
      modelsIncluded[modelName] = model;
    }

  }

  const modelTypes = generateModelTypes(modelsIncluded, options.types || {});

  return Promise.resolve({
    query: generateQueries(modelsIncluded, modelTypes.outputTypes, modelTypes.inputTypes),
    mutation: generateMutations(modelsIncluded, modelTypes.outputTypes, modelTypes.inputTypes)
  });

}

const init = (_options) => {
  const newOptions = { ..._options };

  newOptions.naming = Object.assign({}, defaultOptions.naming, newOptions.naming);
  newOptions.naming.type = Object.assign({}, defaultOptions.naming.type, newOptions.naming.type);
  newOptions.exposeOnly = Object.assign({}, defaultOptions.exposeOnly, newOptions.exposeOnly);
  newOptions.limits = Object.assign({}, defaultOptions.limits, newOptions.limits);
  Object.assign(options, defaultOptions, newOptions);

  return {
    generateSchema,
    // reset dataloader cache, recommended to be used at the end of each request when working with aws lambda
    resetCache,
    // use this to prime custom queries
    dataloaderContext,
    errorHandler
  };
};

// Other utils that can be exported
// should be defined here
// TODO: maybe better to use a class
// export multiple things in the common way
init.define = define;

module.exports = init;
