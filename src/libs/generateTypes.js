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
  GraphQLEnumType,
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
function generateGraphQLField(fieldType, existingTypes = {}) {

  // ENUM when array
  if (Array.isArray(fieldType)) {

    const values = {};

    fieldType.forEach((value) => {
      if (Array.isArray(value)) {
        values[value[0]] = { value: value[1] };
      } else {
        values[value] = { value };
      }
    });

    return values;
  }

  const sanitizedField = sanitizeField(fieldType);

  let field = existingTypes[sanitizedField] || stringToTypeMap[sanitizedField.toLowerCase()] || stringToTypeMap['string'];
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

function generateIncludeArguments (includeArguments, existingTypes = {}) {
  const fields = {};

  for (const argument in includeArguments) {
    fields[argument] = { type: generateGraphQLField(includeArguments[argument], existingTypes) };
  }

  return fields;
}

/**
* Returns the association fields of an entity.
*
* It iterates over all the associations and produces an object compatible with GraphQL-js.
* BelongsToMany and HasMany associations are represented as a `GraphQLList` whereas a BelongTo
* is simply an instance of a type.
* @param {*} associations A collection of sequelize associations
* @param {*} existingTypes Existing `GraphQLObjectType` types, created from all the Sequelize models
*/
function generateAssociationFields(associations, existingTypes = {}, isInput = false) {
  const fields = {}

  for (const associationName in associations) {
    if (associations[associationName]) {
      const relation = associations[associationName];

      if (!existingTypes[relation.target.name]) {
        return fields;
      }

      // BelongsToMany is represented as a list, just like HasMany
      const type = relation.associationType === 'BelongsToMany' ||
        relation.associationType === 'HasMany'
        ? new GraphQLList(existingTypes[relation.target.name])
        : existingTypes[relation.target.name];

      fields[associationName] = { type };

      /*if (!isInput && !relation.isRemote) {
        // GraphQLInputObjectType do not accept fields with resolve
        fields[associationName].args = Object.assign(defaultArgs(relation), defaultListArgs(), includeArguments());
        fields[associationName].resolve = async (source, args, context, info) => {
        };

      }*/

    }
  }

  return fields;
}

/**
* Returns a new `GraphQLObjectType` created from a sequelize model.
*
* It creates a `GraphQLObjectType` object with a name and fields. The
* fields are generated from its sequelize associations.
* @param {*} model The sequelize model used to create the `GraphQLObjectType`
* @param {*} types Existing `GraphQLObjectType` types, created from all the Sequelize models
*/
function generateGraphQLTypeFromModel(model, existingTypes = {}, isInput = false, cache) {
  const GraphQLClass = isInput ? GraphQLInputObjectType : GraphQLObjectType;
  const includeAttributes = {};
  const attributes = model.graphql.attributes || {};

  // Include attributes which are to be included in GraphQL Type but doesn't exist in Models.
  if (attributes.include) {
    for (const attribute in attributes.include) {
      includeAttributes[attribute] = { type: generateGraphQLField(attributes.include[attribute], existingTypes) };
    }
  }

  const modelAttributeFields = attributeFields(model, Object.assign({}, { allowNull: Boolean(isInput), cache, commentToDescription: true }));

  return new GraphQLClass({
    name: isInput ? `${model.name}Input` : model.name,
    fields: () => Object.assign({}, modelAttributeFields, generateAssociationFields(model.associations, existingTypes, isInput), includeAttributes)
  });
}

function generateGraphQLTypeFromJson(typeJson, existingTypes = {}, allCustomTypes = {}, isInput = false, cache) {


  const GraphQLClass = isInput ? GraphQLInputObjectType : GraphQLObjectType;
  const name = typeJson.name;
  const type = typeJson.type;

  const typeName = isInput ? name.toLowerCase().endsWith('input') ? name : `${name}Input` : name;

  // If Array generate ENUM type and return.
  if (Array.isArray(typeJson.type)) {
    return new GraphQLEnumType({
      name: typeName,
      values: generateGraphQLField(type)
    });
  }

  const fields = {};

  for (const fieldName in type) {
    const sanitizedTypeName = sanitizeField(type[fieldName]);

    // Recursively generate nested types
    if (allCustomTypes[sanitizedTypeName] && !existingTypes[sanitizedTypeName]) {
      existingTypes[sanitizedTypeName] = generateGraphQLTypeFromJson({ name: sanitizedTypeName, type: allCustomTypes[sanitizedTypeName] }, existingTypes, allCustomTypes, isInput, cache);
    }

    fields[fieldName] = { type: generateGraphQLField(type[fieldName], existingTypes) };

  }

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
function generateModelTypes(models, customTypes = {}, remoteTypes = {}) {

  const outputTypes = remoteTypes || {};
  const inputTypes = {};
  const inputCustomTypes = [];

  Object.keys(models).forEach((modelName) => {

    const model = models[modelName];
    const cache = {};

    model.graphql = model.graphql || {};
    outputTypes[modelName] = generateGraphQLTypeFromModel(model, outputTypes, false, cache);
    inputTypes[modelName] = generateGraphQLTypeFromModel(model, inputTypes, true, cache);

    // accumulate all types from all models
    Object.assign(customTypes, model.graphql.types);

    const allOperations = Object.assign({}, model.graphql.queries, model.graphql.mutations);

    for (const operation in allOperations) {
      if (allOperations[operation].input) inputCustomTypes.push(sanitizeField(allOperations[operation].input))
    }

  });

  for (const typeName in customTypes) {
    const cache = {};
    const type = {
      name: typeName,
      type: customTypes[typeName]
    };

    if (inputCustomTypes.includes(typeName) && !inputTypes[typeName]) {
      inputTypes[typeName] = generateGraphQLTypeFromJson(type, inputTypes, customTypes, true, cache);
    }

    if (!outputTypes[typeName]) {
      outputTypes[typeName] = generateGraphQLTypeFromJson(type, outputTypes, customTypes, false, cache);
    }

  }

  return { outputTypes, inputTypes };
}

module.exports = {
  generateModelTypes,
  generateGraphQLField,
  generateGraphQLTypeFromJson,
  generateGraphQLTypeFromModel,
  generateAssociationFields,
  generateIncludeArguments
};