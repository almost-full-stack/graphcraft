const { attributeFields } = require('graphql-sequelize');

const GenerateAssociationFields = require('./GenerateAssociationFields');
const GenerateIncludeArguments = require('./GenerateIncludeArguments');

/**
 * Generates a GraphQLObjectType or GraphQLInputObjectType from a Sequelize model.
 *
 * @param {Sequelize.Model} model - The Sequelize model to generate the GraphQL type from.
 * @param {Object} existingTypes - A map of already defined GraphQL types (used for associations/custom fields).
 * @param {boolean} [isInput=false] - Whether to generate a GraphQLInputObjectType instead of GraphQLObjectType.
 * @param {Object} [cache] - Optional cache used by `attributeFields` for optimization.
 * @returns {GraphQLObjectType|GraphQLInputObjectType} The generated GraphQL type.
 */
function GenerateGraphQLTypeFromModel(model, existingTypes = {}, isInput = false, cache) {
  const GraphQLClass = isInput ? GraphQLInputObjectType : GraphQLObjectType;
  const attributes = model.graphql?.attributes || {};
  const modelAttributes = model.rawAttributes;

  const excludeAttributes = attributes.exclude || [];
  const onlyAttributes = []; // Reserved for future support

  // Rename map for fields (e.g., Sequelize fieldName => custom name)
  const attributeRenameMap = Object.keys(modelAttributes).reduce((map, fieldName) => {
    const attr = modelAttributes[fieldName];
    if (attr.rename) {
      map[attr.fieldName] = attr.rename;
    }
    return map;
  }, {});

  const modelAttributeFields = attributeFields(model, {
    allowNull: true,
    cache,
    commentToDescription: true,
    map: attributeRenameMap,
    only: onlyAttributes.length ? onlyAttributes : null,
    exclude: excludeAttributes
  });

  // Add default resolvers for output types
  if (!isInput) {
    for (const key of Object.keys(modelAttributeFields)) {
      modelAttributeFields[key].resolve = (source) => source[key];
    }
  }

  const associationFields = GenerateAssociationFields(model.associations, existingTypes, isInput);
  const includeFields = attributes.include
    ? GenerateIncludeArguments(attributes.include, existingTypes, isInput)
    : {};

  return new GraphQLClass({
    name: isInput ? `${model.name}Input` : model.name,
    fields: () => ({
      ...modelAttributeFields,
      ...associationFields,
      ...includeFields
    })
  });
}

module.exports = GenerateGraphQLTypeFromModel;