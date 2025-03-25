const { GraphQLObjectType, GraphQLInputObjectType, GraphQLEnumType } = require('graphql');

const GenerateGraphQLField = require('./GenerateGraphQLField');

const { sanitizeString } = require('../../../utils');

/**
 * Generates a GraphQLObjectType, GraphQLInputObjectType, or GraphQLEnumType from a JSON definition.
 *
 * Supports:
 * - Scalars and lists (e.g., 'string', '[int]!')
 * - Nested custom types via recursion
 * - Enum generation from array types
 *
 * @param {Object} typeJson - JSON definition of the type.
 * @param {string} typeJson.name - The name of the GraphQL type.
 * @param {Object|Array} typeJson.type - The field map (for object types) or array (for enum types).
 * @param {Object} [existingTypes={}] - A cache of already generated types to prevent recursion loops.
 * @param {Object} [allCustomTypes={}] - A map of all user-defined custom types, used for recursive lookup.
 * @param {boolean} [isInput=false] - Whether to generate an input type (GraphQLInputObjectType).
 * @param {Object} [cache] - Optional cache used internally by `attributeFields` or related utilities.
 * @returns {GraphQLObjectType|GraphQLInputObjectType|GraphQLEnumType} - The resulting GraphQL type.
 */
function GenerateGraphQLTypeFromJson(typeJson, existingTypes = {}, allCustomTypes = {}, isInput = false, cache) {
  const GraphQLClass = isInput ? GraphQLInputObjectType : GraphQLObjectType;
  const { name, type } = typeJson;

  // Determine final type name (e.g., append Input suffix if needed)
  const typeName = isInput && !name.toLowerCase().endsWith('input') ? `${name}Input` : name;

  // Handle ENUM type generation from array
  if (Array.isArray(type)) {
    return new GraphQLEnumType({
      name: typeName,
      values: GenerateGraphQLField(type)
    });
  }

  const fields = {};

  for (const fieldName in type) {
    const rawFieldType = type[fieldName];
    const sanitizedTypeName = sanitizeString(rawFieldType);

    // Recursively build nested custom types if not already generated
    if (allCustomTypes[sanitizedTypeName] && !existingTypes[sanitizedTypeName]) {
      existingTypes[sanitizedTypeName] = GenerateGraphQLTypeFromJson(
        { name: sanitizedTypeName, type: allCustomTypes[sanitizedTypeName] },
        existingTypes,
        allCustomTypes,
        isInput,
        cache
      );
    }

    fields[fieldName] = {
      type: GenerateGraphQLField(rawFieldType, existingTypes)
    };
  }

  return new GraphQLClass({
    name: typeName,
    fields: () => fields
  });
}

module.exports = GenerateGraphQLTypeFromJson;