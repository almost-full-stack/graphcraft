const {
  GraphQLObjectType,
  GraphQLList,
  GraphQLInt,
  GraphQLNonNull,
  GraphQLBoolean
} = require('graphql');
const {
  defaultListArgs,
  defaultArgs,
  argsToFindOptions
} = require('graphql-sequelize');
const camelCase = require('camelcase');
const options = {};
const {checkIfGeneratorRequired, whereQueryVarsToValues, sanitizeFieldName} = require('../utils');
const {includeArguments, getTypeByString} = require('./types').generator(options);
const {query} = require('../resolvers')(options);
const pascalCase = true;

/**
 * Returns a root `GraphQLObjectType` used as query for `GraphQLSchema`.
 *
 * It creates an object whose properties are `GraphQLObjectType` created
 * from Sequelize models.
 * @param {*} models The sequelize models used to create the root `GraphQLSchema`
 */
const generateQueryRootType = (models, outputTypes, inputTypes) => {

  const createQueriesFor = {};

  // Generate queries only for those outputTypes which have a model.
  for (const outputTypeName in outputTypes) {
    if (models[outputTypeName] && checkIfGeneratorRequired(models[outputTypeName])) {
      createQueriesFor[outputTypeName] = outputTypes[outputTypeName];
    }
  }

  return new GraphQLObjectType({
    name: 'Root_Query',
    fields: Object.keys(createQueriesFor).reduce((fields, modelTypeName) => {

      const modelType = outputTypes[modelTypeName];
      const queries = {};

      const paranoidType = models[modelType.name].options.paranoid ? {paranoid: {type: GraphQLBoolean}} : {};

      const aliases = models[modelType.name].graphql.alias;

      if (models[modelType.name].graphql.excludeQueries.indexOf('count') === -1) {
        queries[camelCase(aliases.count || (modelType.name + 'Count'), {pascalCase})] = {
          type: GraphQLInt,
          args: {
            where: defaultListArgs().where
          },
          resolve: (source, {
            where
          }, context, info) => {
            const args = argsToFindOptions.default({where});

            if (args.where) args.where = whereQueryVarsToValues(args.where, info.variableValues);

            return models[modelTypeName].count({
              where: args.where
            });
          },
          description: 'A count of the total number of objects in this connection, ignoring pagination.'
        };
      }

      if (models[modelType.name].graphql.excludeQueries.indexOf('fetch') === -1) {
        queries[camelCase(aliases.fetch || modelType.name, {pascalCase})] = {
          type: new GraphQLList(modelType),
          args: Object.assign(defaultArgs(models[modelType.name]), defaultListArgs(), includeArguments(), paranoidType),
          resolve: query(models[modelType.name])
        };
      }

      if (models[modelTypeName].graphql && models[modelTypeName].graphql.queries) {

        for (const query in models[modelTypeName].graphql.queries) {

          //let outPutType = (queries[camelCase(query)] && queries[camelCase(query)].type) || GraphQLInt;
          const description = models[modelTypeName].graphql.queries[query].description || (queries[camelCase(query)] && queries[camelCase(query)].description) || null;
          let outPutType = GraphQLInt;
          let inPutType = GraphQLInt;
          let typeName = models[modelTypeName].graphql.queries[query].output;
          let inputTypeNameField = models[modelTypeName].graphql.queries[query].input;

          if (typeName) {

            const typeReference = sanitizeFieldName(typeName);
            const field = getTypeByString(typeReference.type);

            typeName = typeReference.type;

            if (typeReference.isArray) {
              outPutType = new GraphQLList(field || outputTypes[typeReference.type]);
            } else {
              outPutType = field || outputTypes[typeReference.type];
            }

          }

          if (inputTypeNameField) {

            const typeReference = sanitizeFieldName(inputTypeNameField);

            inputTypeNameField = typeReference.type;

            if (typeReference.isArray) {
              inPutType = new GraphQLList(inputTypes[inputTypeNameField]);
            } else {
              inPutType = inputTypes[inputTypeNameField];
            }

            if (typeReference.isRequired) {
              inPutType = GraphQLNonNull(inPutType);
            }
          }

          const inputArg = models[modelTypeName].graphql.queries[query].input ? {[inputTypeNameField]: {type: inPutType}} : {};

          queries[camelCase(query, {pascalCase})] = {
            type: outPutType,
            description,
            args: Object.assign(inputArg, defaultListArgs(), includeArguments(), paranoidType),
            resolve: (source, args, context, info) => {
              return options.authorizer(source, args, context, info).then((_) => {
                return models[modelTypeName].graphql.queries[query].resolver(source, args, context, info);
              });
            }
          };
        }

      }

      return Object.assign(fields, queries);

    }, {})
  });
};

module.exports.generator = (_options) => {
  Object.assign(options, _options);

  return generateQueryRootType;
};