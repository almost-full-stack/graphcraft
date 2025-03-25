const { GraphQLList, GraphQLNonNull } = require('graphql');

const constants = require('../../../constants');
const { sanitizeString, isFieldArray, isFieldRequired } = require('../../../utils');

const stringToTypeMap = constants.STRINGTOTYPEMAP;

/**
 * Generates a GraphQL type (scalar, list, non-null, or custom) from a given type definition.
 *
 * Accepts types as:
 * - Scalar string types:
 *   - "int", "string", "boolean", "float", "id", "date", "json"
 * - Wrapped types for modifiers:
 *   - "int!" → Non-null integer
 *   - "[int]" → List of integers
 *   - "[int]!" → Non-null list of integers
 *   - "[int!]" → List of non-null integers
 * - Custom/Sequelize models:
 *   - A `Sequelize.Model`
 *   - A registered custom GraphQL type in `existingTypes`
 * - Enum (array-based):
 *   - An array of strings or [label, value] tuples to create an enum-like config
 *
 * @param {string|Array|Object} fieldType - The type descriptor or enum array.
 * @param {Object} [existingTypes={}] - A map of custom GraphQL types.
 * @returns {GraphQLType|Object} - The constructed GraphQL type or enum values config.
 */
function GenerateGraphQLField(fieldType, existingTypes = {}) {
  // If fieldType is an array, treat it as an enum config
  if (Array.isArray(fieldType)) {
    const enumValues = {};

    for (const value of fieldType) {
      if (Array.isArray(value)) {
        enumValues[value[0]] = { value: value[1] };
      } else {
        enumValues[value] = { value };
      }
    }

    return enumValues;
  }

  const sanitized = sanitizeString(fieldType);
  const baseType =
    existingTypes[sanitized] ||
    stringToTypeMap[sanitized.toLowerCase()] ||
    stringToTypeMap['string'];

  const arrayKind = isFieldArray(fieldType); // 0 = not array, 1 = [type], 2 = [type]!, 3 = [type!]
  const isRequired = isFieldRequired(fieldType);

  let finalType = baseType;

  if (arrayKind) {
    if (arrayKind === 1) {
      finalType = new GraphQLList(baseType);
    } else if (arrayKind === 2) {
      finalType = new GraphQLNonNull(new GraphQLList(baseType));
    } else if (arrayKind === 3) {
      finalType = new GraphQLList(GraphQLNonNull(baseType));
    }
  } else if (isRequired) {
    finalType = new GraphQLNonNull(baseType);
  }

  return finalType;
}

module.exports = GenerateGraphQLField;
