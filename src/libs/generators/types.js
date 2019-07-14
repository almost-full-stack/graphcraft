const {
  GraphQLList,
  GraphQLNonNull,
  GraphQLString,
  GraphQLInt,
  GraphQLBoolean
} = require('graphql');
const {sanitizeFieldName} = require('../utils');
const options = {};

const getTypeByString = (type) => {
  const lType = type.toLowerCase();

  return lType === 'int' ? GraphQLInt
    : lType === 'boolean' ? GraphQLBoolean
      : lType === 'string' ? GraphQLString
        : options.customTypes[type] ? options.customTypes[type]
          : null;
};

const generateGraphQLField = (type) => {

  const typeReference = sanitizeFieldName(type);
  let field = getTypeByString(typeReference.type);

  if (!field) field = GraphQLString;
  if (typeReference.isArray) field = new GraphQLList(field);
  if (typeReference.isRequired) field = GraphQLNonNull(field);

  return {type: field};
};

const includeArguments = () => {
  const includeArguments = {};

  for (const argument in options.includeArguments) {
    includeArguments[argument] = generateGraphQLField(options.includeArguments[argument]);
  }

  return includeArguments;
};

module.exports.generator = (_options) => {
  Object.assign(options, _options);

  return {
    includeArguments,
    generateGraphQLField,
    getTypeByString
  };
};