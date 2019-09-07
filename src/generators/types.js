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
const { sanitizeFieldName } = require('../utils');
const { generateGraphQLField } = require('./utils');

/**
* Returns the association fields of an entity.
*
* It iterates over all the associations and produces an object compatible with GraphQL-js.
* BelongsToMany and HasMany associations are represented as a `GraphQLList` whereas a BelongTo
* is simply an instance of a type.
* @param {*} associations A collection of sequelize associations
* @param {*} types Existing `GraphQLObjectType` types, created from all the Sequelize models
*/
const generateAssociationFields = (associations, types, isInput = false) => {
  const fields = {}

  for (const associationName in associations) {
    if (associations[associationName]) {
    const relation = associations[associationName];

    if (!types[relation.target.name]) {
      return fields;
    }

    // BelongsToMany is represented as a list, just like HasMany
    const type = relation.associationType === 'BelongsToMany' ||
      relation.associationType === 'HasMany'
      ? new GraphQLList(types[relation.target.name])
      : types[relation.target.name];

    fields[associationName] = { type };

    if (!isInput && !relation.isRemote) {
      // GraphQLInputObjectType do not accept fields with resolve
      fields[associationName].args = Object.assign(defaultArgs(relation), defaultListArgs(), includeArguments());
      fields[associationName].resolve = async (source, args, context, info) => {

        await execBefore(relation.target, source, args, context, info, 'fetch');
        const data = await resolver(relation, { [EXPECTED_OPTIONS_KEY]: dataloaderContext })(source, args, context, info);

        if (relation.target.graphql.extend.fetch && data.length) {
          const item = await relation.target.graphql.extend.fetch(data, source, args, context, info);

          return [].concat(item);
        }

        return data;

      };

    } else if (!isInput && relation.isRemote) {
      fields[associationName].args = Object.assign({}, relation.query.args, defaultListArgs());
      fields[associationName].resolve = (source, args, context, info) => {
        return remoteResolver(source, args, context, info, relation.query, fields[associationName].args, types[relation.target.name]);
      }

    }

  }
  }

  return fields;

};

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

module.exports = {
  generateGraphQLType,
  generateModelTypes
};