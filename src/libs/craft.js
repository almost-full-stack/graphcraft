const cls = require('cls-hooked');
const Sequelize = require('sequelize');
const { createContext } = require('dataloader-sequelize');
const { validateModels, getSequelizeConnection, copyMissing } = require('../utils');

const { defaultModelGraphqlOptions } = require('../options');

const GenerateQueries = require('./generateQueries');
const GenerateMutations = require('./generateMutations');
const GenerateTypes = require('./generateTypes');

const TRANSACTION_NAMESPACE = 'GRAPHCRAFT_TRANSACTION_NAMESPACE';

function craft(options) {

  return async (models, context) => {
    const { permissions, permissionsOn, authenticate, enableDataloader } = options;

    const { isValid, invalidModels } = validateModels(models);

    if (!isValid) {
      throw new Error(`Invalid models detected: ${invalidModels.join(', ')}`);
    }

    const sequelize = getSequelizeConnection(models);

    if (permissions) {
      if (typeof permissions !== 'function') {
        throw new Error('Permissions must be a function');
      }
    }

    if (authenticate) {
      if (typeof authenticate !== 'function') {
        throw new Error('Authenticate must be a function');
      }
    }

    if (enableDataloader) {
      options.dataloaderContext = createContext(sequelize);
    }

    if (permissionsOn === 'once') {
      const generatedPermissions = await permissions({
        models,
        ...context,
      });

      options._GET_PERMISSIONS = async () => {

        let gcPermissions = generatedPermissions;

        if (permissionsOn === 'always') {
          gcPermissions = await permissions({
            models,
            ...context,
          });
        }

        return { permissions: gcPermissions, options: {} };
      };
    }

    if (options.autoTransactions) {
      Sequelize.useCLS(cls.createNamespace(TRANSACTION_NAMESPACE));
    }

    const { generateModelTypes } = GenerateTypes(models, options);
    const generateQueries = GenerateQueries(options);
    const generateMutations = GenerateMutations(options);

    const modelsIncluded = {};

    for (const modelName in models) {
      const model = models[modelName];

      if (
        'name' in model &&
        modelName !== 'Sequelize' &&
        !options.exclude.includes(modelName)
      ) {
        model.graphql = copyMissing(model.graphql || {}, defaultModelGraphqlOptions);
        modelsIncluded[modelName] = model;
      }
    }

    const modelTypes = await generateModelTypes(modelsIncluded, {}, options);

    return Promise.resolve({
      query: generateQueries(
        modelsIncluded,
        modelTypes.outputTypes,
        modelTypes.inputTypes
      ),
      mutation: generateMutations(
        modelsIncluded,
        modelTypes.outputTypes,
        modelTypes.inputTypes
      ),
    });
  };

}

module.exports = craft;