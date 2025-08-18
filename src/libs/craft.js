const cls = require('cls-hooked');
const Sequelize = require('sequelize');
const { createContext } = require('dataloader-sequelize');
const { validateModels, getSequelizeConnection, copyMissing } = require('../utils');

const { defaultModelGraphqlOptions, getConfig, setOption } = require('../options');

const GenerateQueries = require('./generateQueries');
const GenerateMutations = require('./generateMutations');
const GenerateTypes = require('./generateTypes');

const TRANSACTION_NAMESPACE = 'GRAPHCRAFT_TRANSACTION_NAMESPACE';

function craft() {

  const options = getConfig();

  return async (models, context) => {
    const { policies, permissionsOn, authenticate, enableDataloader } = options;

    const { isValid, invalidModels } = validateModels(models);

    if (!isValid) {
      throw new Error(`Invalid models detected: ${invalidModels.join(', ')}`);
    }

    const sequelize = getSequelizeConnection(models);

    if (policies) {
      if (typeof policies !== 'function') {
        throw new Error('Policies must be a function');
      }
    }

    if (authenticate) {
      if (typeof authenticate !== 'function') {
        throw new Error('Authenticate must be a function');
      }
    }

    if (enableDataloader) {
      setOption('dataloaderContext', createContext(sequelize));
    }

    if (options.autoTransactions) {
      Sequelize.useCLS(cls.createNamespace(TRANSACTION_NAMESPACE));
    }

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

    const { generateModelTypes } = GenerateTypes(models, options);

    const modelTypes = await generateModelTypes(modelsIncluded, {}, options);

    const generateQueries = GenerateQueries(options, modelTypes.outputTypes, modelTypes.inputTypes);
    const generateMutations = GenerateMutations(options, modelTypes.outputTypes, modelTypes.inputTypes);


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