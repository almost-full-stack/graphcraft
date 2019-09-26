const { attributeFields, JSONType, DateType } = require('graphql-sequelize');
const {
  GraphQLObjectType,
  GraphQLInputObjectType,
  GraphQLInt,
  GraphQLBoolean,
  GraphQLFloat,
  GraphQLString,
  GraphQLID,
  GraphQLList,
  GraphQLNonNull
} = require('graphql');
const { isFieldArray, isFieldRequired, sanitizeField } = require('../utils');
const stringToTypeMap = {
  int: GraphQLInt,
  boolean: GraphQLBoolean,
  string: GraphQLString,
  float: GraphQLFloat,
  id: GraphQLID,
  json: JSONType,
  date: DateType
};

/**
 * Returns a new `GraphQLType` generated from a custom type.
 *
 * {fieldName: TYPE}
 * {fieldName: TYPE, allowNull: BOOLEAN} allowNull defaults to false
 *
 * TYPE examples
 * 'int'
 * 'string'
 * 'boolean'
 * 'float'
 * 'id'
 * 'date'
 * 'json'
 * 'SEQUELIZE_MODEL_NAME'
 * 'CUSTOM_TYPE_NAME'
 * 'int!' Non Null
 * '[int]' List
 * '[int]!' Non Null List
 * '[int!]' List of Non Null items
 * Sequelize.Model
 *
 **/
function generateGraphQLField (fieldType) {

  let field = stringToTypeMap[sanitizeField(fieldType).toLowerCase()] || stringToTypeMap['string'];
  const isArray = isFieldArray(fieldType);
  const isRequired = isFieldRequired(fieldType);

  if (isArray) {

    if (isArray === 1) {
      field = new GraphQLList(field);
    } else if (isArray === 2) {
      field = GraphQLNonNull(new GraphQLList(field));
    } else if (isArray === 3) {
      field = new GraphQLList(GraphQLNonNull(field));
    }

  } else if (isRequired) {
    field = GraphQLNonNull(field);
  }

  return field;
}

function generateAssociationFields() {
  return {};
}

/**
* Returns a new `GraphQLObjectType` created from a sequelize model.
*
* It creates a `GraphQLObjectType` object with a name and fields. The
* fields are generated from its sequelize associations.
* @param {*} model The sequelize model used to create the `GraphQLObjectType`
* @param {*} types Existing `GraphQLObjectType` types, created from all the Sequelize models
*/
function generateGraphQLTypeFromModel (model, existingTypes, isInput = false, cache) {
  const GraphQLClass = isInput ? GraphQLInputObjectType : GraphQLObjectType;
  const includeAttributes = {};
  const attributes = model.graphql.attributes;

  if (attributes.include) {
    for (const attribute in attributes.include) {
      if (attributes.include[attribute]) {
        const type = existingTypes && existingTypes[attributes.include[attribute]] ? { type: existingTypes[attributes.include[attribute]] } : null;

        includeAttributes[attribute] = type || generateGraphQLField(attributes.include[attribute]);
      }
    }
  }

  return new GraphQLClass({
    name: isInput ? `${model.name}Input` : model.name,
    fields: () => Object.assign(
      attributeFields(model, Object.assign({}, { allowNull: Boolean(isInput), cache })),
      generateAssociationFields(model.associations, existingTypes, isInput),
      includeAttributes
    )
  });
}

function generateGraphQLTypeFromJson(typeJson, existingTypes, isInput = false, cache) {

  const GraphQLClass = isInput ? GraphQLInputObjectType : GraphQLObjectType;
  const name = typeJson.name;
  const type = typeJson.type;
  const fields = {};

  for (const fieldName in type) {
    fields[fieldName] = generateGraphQLField(type[fieldName]);
  }

  const typeName = isInput ? name.toLowerCase().endsWith('input') ? name : `${name}Input` : name;

  return new GraphQLClass({
    name: typeName,
    fields: () => fields
  });

}

/**
* Returns a collection of `GraphQLObjectType` generated from Sequelize models.
*
* It creates an object whose properties are `GraphQLObjectType` created
* from Sequelize models.
* @param {*} models The sequelize models used to create the types
*/
function generateModelTypes (models, customTypes = {}, remoteTypes = {}) {

  const outputTypes = remoteTypes || {};
  const inputTypes = {};
  const inputCustomTypes = [];

  Object.keys(models).forEach((modelName) => {

    const model = models[modelName];
    const cache = {};

    outputTypes[modelName] = generateGraphQLTypeFromModel(model, outputTypes, false, cache);
    inputTypes[modelName] = generateGraphQLTypeFromModel(model, inputTypes, true, cache);

    // accumulate all types from all models
    Object.assign(customTypes, model.graphql.types);

    const allOperations = Object.assign({}, model.graphql.queries, model.graphql.mutations);

    for (const operation in allOperations) {
      if (allOperations[operation].input) inputCustomTypes.push(allOperations[operation].input)
    }

  });

  for (const typeName in customTypes) {
    const cache = {};
    const type = {
      name: typeName,
      type: customTypes[typeName]
    };

    if (inputCustomTypes.includes(typeName)) {
      inputTypes[typeName] = generateGraphQLTypeFromJson(type, inputTypes, true, cache);
    }

    if (!typeName.toLowerCase().endsWith('input')) {
      outputTypes[typeName] = generateGraphQLTypeFromJson(type, outputTypes, false, cache);
    }

  }

  return { outputTypes, inputTypes };
}

module.exports = {
  generateModelTypes,
  generateGraphQLField,
  generateGraphQLTypeFromJson,
  generateGraphQLTypeFromModel
};