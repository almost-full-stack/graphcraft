const { GenerateGraphQLField } = require('./GenerateGraphQLField');

/**
 * Generates a map of GraphQL fields from `includeArguments`, optionally with resolvers for output fields.
 *
 * Used to inject custom arguments into a GraphQL input or output type.
 *
 * @param {Object} includeArguments - A key-value map where each key is the argument name, and each value is:
 *   - A type string (e.g., 'string', '[int]!', etc.), or
 *   - An object with:
 *     - `output`: the field type for output object
 *     - `resolver`: a function to resolve this field (only used if `isInput` is false)
 * @param {Object} existingTypes - A map of pre-defined/custom GraphQL types.
 * @param {boolean} [isInput=false] - Whether the arguments are for input types. If true, resolvers are ignored.
 * @returns {Object} - A field config object to be used in GraphQLObjectType or GraphQLInputObjectType.
 */
function GenerateIncludeArguments(includeArguments, existingTypes = {}, isInput = false) {
  const fields = {};

  for (const key in includeArguments) {
    const config = includeArguments[key];

    // If it's an output field with a resolver (used in GraphQLObjectType)
    if (!isInput && config?.output && typeof config.resolver === 'function') {
      fields[key] = {
        type: GenerateGraphQLField(config.output, existingTypes),
        resolve: config.resolver
      };
    } else {
      // For input fields or simple field definitions
      fields[key] = {
        type: GenerateGraphQLField(config, existingTypes)
      };
    }
  }

  return fields;
}

module.exports = GenerateIncludeArguments;