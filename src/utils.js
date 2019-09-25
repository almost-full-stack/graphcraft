const {
  GraphQLList,
  GraphQLInt,
  GraphQLNonNull,
  GraphQLString,
  GraphQLBoolean,
  GraphQLObjectType
} = require('graphql');

const sanitizeFieldName = (type) => {
  const isRequired = type.indexOf('!') > -1;
  const isArray = type.indexOf('[') > -1;

  type = type.replace('[', '');
  type = type.replace(']', '');
  type = type.replace('!', '');

  return { type, isArray, isRequired };
};

const generateGraphQLField = (type) => {

  const typeReference = sanitizeFieldName(type);

  type = typeReference.type.toLowerCase();

  let field = type === 'int' ? GraphQLInt : type === 'boolean' ? GraphQLBoolean : GraphQLString;

  if (typeReference.isArray) {
    field = new GraphQLList(field);
  }

  if (typeReference.isRequired) {
    field = GraphQLNonNull(field);
  }

  return { type: field };
};

const includeArguments = (includeArgs) => {
  const gqlArguments = {};

  for (const argument in includeArgs) {
    if (includeArgs[argument]) {
      gqlArguments[argument] = generateGraphQLField(includeArgs[argument]);
    }
  }

  return gqlArguments;
};

function getBulkOption(options, key) {
  // eslint-disable-next-line no-confusing-arrow
  const bulkOption = options.filter((option) => (Array.isArray(option) ? option[0] == key : option == key));

  return bulkOption.length ? (Array.isArray(bulkOption[0]) ? bulkOption[0][1] : true) : false;
}

const toGraphQLType = function (name, schema) {

  const fields = {};

  for (const field in schema) {
    if (schema[field]) {
      fields[field] = generateGraphQLField(schema[field]);
    }
  }

  return new GraphQLObjectType({
    name,
    fields: () => fields
  });

};

function isFieldArray (name) {
  if (name.startsWith('[') && name.endsWith('!]')) return 3;
  if (name.startsWith('[') && name.endsWith(']!')) return 2;
  if (name.startsWith('[') && name.endsWith(']')) return 1;

  return 0;
}

function isFieldRequired (name) {
  return name.indexOf('!') > -1;
}

const sanitizeField = (name) => {
  return name.replace('[', '').replace(']', '').replace('!', '');
};

module.exports = {
  includeArguments,
  generateGraphQLField,
  sanitizeFieldName,
  getBulkOption,
  toGraphQLType,
  isFieldArray,
  isFieldRequired,
  sanitizeField
};