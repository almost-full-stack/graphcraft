/* eslint-disable max-depth */
const remoteSchema = require('./remoteSchema');
const { createContext, resetCache } = require('dataloader-sequelize');
// eslint-disable-next-line no-unused-vars
const DataLoader = require('dataloader');
const TRANSACTION_NAMESPACE = 'sequelize-graphql-schema';
const cls = require('cls-hooked');
const sequelizeNamespace = cls.createNamespace(TRANSACTION_NAMESPACE);
let dataloaderContext;

let options = {
  exclude: [],
  includeArguments: {},
  remote: {},
  dataloader: false,
  transactionedMutations: true,
  privateMode: false,
  logger() {
    return Promise.resolve();
  },
  authorizer() {
    return Promise.resolve();
  },
  errorHandler: {
    'ETIMEDOUT': { statusCode: 503 }
  }
};

const { queries, mutations, types } = require('./libs')(options);

const defaultModelGraphqlOptions = {
  attributes: {
    exclude: [], // list attributes which are to be ignored in Model Input
    include: {}, // attributes in key:type format which are to be included in Model Input
    import: []
  },
  scopes: null,
  alias: {},
  bulk: [],
  mutations: {},
  excludeMutations: [],
  excludeQueries: [],
  extend: {},
  before: {},
  overwrite: {}
};

const errorHandler = (error) => {
  for (const name in options.errorHandler) {
    if (error.message.indexOf(name) > -1) {
      Object.assign(error, options.errorHandler[name]);
      break;
    }
  }

  return error;
};

const generateModelTypesFromRemote = (context) => {
  if (options.remote) {

    const promises = [];

    for (const opt in options.remote.import) {
      if (options.remote.import[opt]) {
        options.remote.import[opt].headers = options.remote.import[opt].headers || options.remote.headers;
        promises.push(remoteSchema(options.remote.import[opt], context));
      }
    }

    return Promise.all(promises);

  }

  return Promise.resolve(null);

};

// This function is exported
const generateSchema = (models, types, context, Sequelize) => {

  Sequelize = models.Sequelize || Sequelize;
  options.models = models;
  options.Sequelize = models.Sequelize || Sequelize;

  if (options.dataloader) dataloaderContext = createContext(models.sequelize);
  if (Sequelize) {
    Sequelize.useCLS(sequelizeNamespace);
  } else {
    // eslint-disable-next-line no-console
    console.warn('Sequelize not found at Models.Sequelize or not passed as argument. Automatic tranasctions for mutations are disabled.');
    options.transactionedMutations = false;
  }

  const availableModels = {};

  for (const modelName in models) {
    if (models[modelName]) {
      models[modelName].graphql = models[modelName].graphql || defaultModelGraphqlOptions;
      models[modelName].graphql.attributes = Object.assign({}, defaultModelGraphqlOptions.attributes, models[modelName].graphql.attributes);
      models[modelName].graphql = Object.assign({}, defaultModelGraphqlOptions, models[modelName].graphql || {});
      if (options.exclude.indexOf(modelName) === -1) {
        availableModels[modelName] = models[modelName];
      }
    }
  }

  if (options.remote && options.remote.import) {

    return generateModelTypesFromRemote(context).then((result) => {

      const remoteSchema = generateTypesFromObject(result);

      for (const modelName in availableModels) {
        if (availableModels[modelName].graphql.import) {

          availableModels[modelName].graphql.import.forEach((association) => {

            for (let index = 0; index < remoteSchema.queries.length; index++) {
              if (remoteSchema.queries[index].output === association.from) {
                availableModels[modelName].associations[(association.as || association.from)] = {
                  associationType: remoteSchema.queries[index].isList ? 'HasMany' : 'BelongsTo',
                  isRemote: true,
                  target: { name: association.from },
                  query: Object.assign({}, association, remoteSchema.queries[index])
                };
                break;
              }
            }

          });

        }

      }

      const modelTypes = types || types.generateModelTypes(availableModels, remoteSchema.types);

      //modelTypes.outputTypes = Object.assign({}, modelTypes.outputTypes, remoteSchema.types);

      return {
        query: queries(availableModels, modelTypes.outputTypes, modelTypes.inputTypes),
        mutation: mutations(availableModels, modelTypes.inputTypes, modelTypes.outputTypes)
      };

    });

  }

  const modelTypes = types || types.generateModelTypes(availableModels);

  return {
    query: queries(availableModels, modelTypes.outputTypes, modelTypes.inputTypes),
    mutation: mutations(availableModels, modelTypes.inputTypes, modelTypes.outputTypes)
  };


};

module.exports = (_options) => {
  options = Object.assign(options, _options);

  return {
    generateGraphQLType: types.generateGraphQLType,
    generateModelTypes: types.generateModelTypes,
    generateSchema,
    dataloaderContext,
    errorHandler,
    TRANSACTION_NAMESPACE,
    resetCache
  };
};
