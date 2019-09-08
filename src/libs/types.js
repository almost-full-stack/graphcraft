const {
  attributeFields
} = require('graphql-sequelize');
const {
  GraphQLObjectType,
  GraphQLInputObjectType,
  GraphQLList,
  GraphQLNonNull,
  GraphQLEnumType
} = require('graphql');
const { sanitizeFieldName, generateGraphQLField, toGraphQLType } = require('../utils');

/**
* Returns a new `GraphQLObjectType` created from a sequelize model.
*
* It creates a `GraphQLObjectType` object with a name and fields. The
* fields are generated from its sequelize associations.
* @param {*} model The sequelize model used to create the `GraphQLObjectType`
* @param {*} types Existing `GraphQLObjectType` types, created from all the Sequelize models
*/
const generateGraphQLType = (model, types, isInput = false, cache) => {
  const GraphQLClass = isInput ? GraphQLInputObjectType : GraphQLObjectType;
  const includeAttributes = {};

  if (model.graphql.attributes.include) {
    for (const attribute in model.graphql.attributes.include) {
      if (model.graphql.attributes.include[attribute]) {
        const type = types && types[model.graphql.attributes.include[attribute]] ? { type: types[model.graphql.attributes.include[attribute]] } : null;

        includeAttributes[attribute] = type || generateGraphQLField(model.graphql.attributes.include[attribute]);
      }
    }
  }

  return new GraphQLClass({
    name: isInput ? `${model.name}Input` : model.name,
    fields: () => Object.assign(attributeFields(model, Object.assign({}, { allowNull: Boolean(isInput), cache })), generateAssociationFields(model.associations, types, isInput), includeAttributes)
  });
};

const generateCustomGraphQLTypes = (model, types, isInput = false) => {

  const typeCreated = {};
  const customTypes = {};

  const getCustomType = (type, ignoreInputCheck) => {

    const fields = {};

    //Enum
    if (Array.isArray(model.graphql.types[type])) {
      model.graphql.types[type].forEach((value) => {
        if (Array.isArray(value)) {
          fields[value[0]] = { value: value[1] };
        } else {
          fields[value] = { value: value };
        }
      });

      return new GraphQLEnumType({
        name: type,
        values: fields
      });
    }

    for (const field in model.graphql.types[type]) {
      if (model.graphql.types[type][field]) {
      const fieldReference = sanitizeFieldName(model.graphql.types[type][field]);

      if (customTypes[fieldReference.type] !== undefined || model.graphql.types[fieldReference.type] != undefined) {
        typeCreated[fieldReference.type] = true;

        let customField = customTypes[fieldReference.type] || getCustomType(fieldReference.type, true);

        if (fieldReference.isArray) {
          customField = new GraphQLList(customField);
        }

        if (fieldReference.isRequired) {
          customField = GraphQLNonNull(customField);
        }

        fields[fieldReference.type] = { type: customField };

      } else {
        typeCreated[type] = true;
        fields[field] = generateGraphQLField(model.graphql.types[type][field]);
      }

    }

    }

    if (isInput && !ignoreInputCheck) {
      if (type.toUpperCase().endsWith('INPUT')) {
        return new GraphQLInputObjectType({
          name: type,
          fields: () => fields
        });
      }
    } else if (!type.toUpperCase().endsWith('INPUT')) {
      return new GraphQLObjectType({
        name: type,
        fields: () => fields
      });
    }

  };

  if (model.graphql && model.graphql.types) {

    for (const type in model.graphql.types) {
      customTypes[type] = getCustomType(type);
    }

  }

  return customTypes;
};

/**
* Returns a collection of `GraphQLObjectType` generated from Sequelize models.
*
* It creates an object whose properties are `GraphQLObjectType` created
* from Sequelize models.
* @param {*} models The sequelize models used to create the types
*/
// This function is exported
const generateModelTypes = (models, remoteTypes) => {
  let outputTypes = remoteTypes || {};
  let inputTypes = {};

  for (const modelName in models) {
    // Only our models, not Sequelize nor sequelize
    if (_.has(models[modelName], 'name') && modelName !== 'Sequelize') {
      const cache = {};

      inputTypes = Object.assign(inputTypes, generateCustomGraphQLTypes(models[modelName], null, true));
      outputTypes = Object.assign(outputTypes, generateCustomGraphQLTypes(models[modelName], null, false));
      outputTypes[modelName] = generateGraphQLType(models[modelName], outputTypes, false, cache);
      inputTypes[modelName] = generateGraphQLType(models[modelName], inputTypes, true, cache);
    }

  }

  return { outputTypes, inputTypes };
};

const generateTypesFromObject = function (remoteData) {

  const types = {};
  let queries = [];

  remoteData.forEach((item) => {

    for (const type in item.types) {
      if (item.types[type]) {
        types[type] = toGraphQLType(type, item.types[type]);
      }
    }
    item.queries.forEach((query) => {
      const args = {};

      for (const arg in query.args) {
        if (query.args[arg]) {
          args[arg] = generateGraphQLField(query.args[arg]);
        }
      }
      query.args = args;
    });
    queries = queries.concat(item.queries);
  });

  return { types, queries };

};

module.exports = {
  generateGraphQLType,
  generateModelTypes,
  generateTypesFromObject
};