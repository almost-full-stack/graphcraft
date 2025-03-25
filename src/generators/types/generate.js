const { attributeFields } = require('graphql-sequelize');
const {
  GraphQLList,
} = require('graphql');
const {
  defaultListArgs,
  defaultArgs
} = require('graphql-sequelize');

const { sanitizeField } = require('../utils');
const constants = require('../constants');

const { GenerateGraphQLField, GenerateIncludeArguments, GenerateGraphQLTypeFromModel, GenerateGraphQLTypeFromJson, GenerateAssociationFields } = require('./utils');

const options = {};

/**
* Returns a collection of `GraphQLObjectType` generated from Sequelize models.
*
* It creates an object whose properties are `GraphQLObjectType` created
* from Sequelize models.
* @param {*} models The sequelize models used to create the types
*/
function generateModelTypes(models, remoteTypes = {}, options = {}) {

  const customTypes = options.types;
  const importTypes = options.importTypes;
  const outputTypes = remoteTypes || {};
  const inputTypes = {};
  const inputCustomTypes = [];
  const allCustomTypes = {};

  Object.keys(models).forEach((modelName) => {

    const model = models[modelName];
    const cache = {};

    model.graphql = model.graphql || {};
    outputTypes[modelName] = GenerateGraphQLTypeFromModel(model, outputTypes, false, cache);
    inputTypes[modelName] = GenerateGraphQLTypeFromModel(model, inputTypes, true, cache);

    // accumulate all types from all models
    Object.assign(allCustomTypes, customTypes, model.graphql.types, customTypes, importTypes);

    const allOperations = Object.assign({}, model.graphql.queries, model.graphql.mutations, options.queries, options.mutations);

    for (const operation in allOperations) {
      if (allOperations[operation].input) inputCustomTypes.push(sanitizeField(allOperations[operation].input));
    }

  });

  for (const typeName in allCustomTypes) {
    const cache = {};
    const type = {
      name: typeName,
      type: allCustomTypes[typeName]
    };

    if (inputCustomTypes.includes(typeName) && !inputTypes[typeName]) {
      inputTypes[typeName] = importTypes[typeName] || GenerateGraphQLTypeFromJson(type, inputTypes, allCustomTypes, true, cache);
    }

    if (!outputTypes[typeName]) {
      outputTypes[typeName] = importTypes[typeName] || GenerateGraphQLTypeFromJson(type, outputTypes, allCustomTypes, false, cache);
    }

  }

  return { outputTypes, inputTypes };
}

module.exports = (_options) => {

  Object.assign(options, _options);

  return {
    generateModelTypes,
    GenerateGraphQLField,
    GenerateGraphQLTypeFromJson,
    GenerateGraphQLTypeFromModel,
    GenerateAssociationFields,
    GenerateIncludeArguments
  };
};