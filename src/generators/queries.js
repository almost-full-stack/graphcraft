/* eslint-disable max-depth */
const {
  GraphQLObjectType,
  GraphQLList,
  GraphQLInt,
  GraphQLNonNull,
  GraphQLBoolean
} = require('graphql');
const {
  defaultListArgs,
  defaultArgs
} = require('graphql-sequelize');
const camelCase = require('camelcase');
const { includeArguments, sanitizeFieldName } = require('../utils');

module.exports = (options) => {

  const { query } = require('../resolvers')(options);

  /**
  * Returns a root `GraphQLObjectType` used as query for `GraphQLSchema`.
  *
  * It creates an object whose properties are `GraphQLObjectType` created
  * from Sequelize models.
  * @param {*} models The sequelize models used to create the root `GraphQLSchema`
  */
  return (models, outputTypes, inputTypes) => {

    const createQueriesFor = {};

    for (const outputTypeName in outputTypes) {
      if (models[outputTypeName]) {
        createQueriesFor[outputTypeName] = outputTypes[outputTypeName];
      }
    }

    return new GraphQLObjectType({
      name: 'Root_Query',
      fields: Object.keys(createQueriesFor).reduce((fields, modelTypeName) => {

        const modelType = outputTypes[modelTypeName];
        const queries = {
          [modelType.name + 'Default']: {
            type: GraphQLInt,
            description: 'An empty default Query.',
            resolve: () => 1
          }
        };
        const paranoidType = models[modelType.name].options.paranoid ? { paranoid: { type: GraphQLBoolean } } : {};

        const aliases = models[modelType.name].graphql.alias;

        if (models[modelType.name].graphql.excludeQueries.indexOf('query') === -1) {
          queries[camelCase(aliases.fetch || (modelType.name + 'Get'))] = {
            type: new GraphQLList(modelType),
            args: Object.assign(defaultArgs(models[modelType.name]), defaultListArgs(), includeArguments(), paranoidType),
            resolve: (source, args, context, info) => {
              return query(models[modelType.name], modelType.name, source, args, context, info);
            }
          }
        }

        if (models[modelTypeName].graphql && models[modelTypeName].graphql.queries) {

          for (const query in models[modelTypeName].graphql.queries) {

            if (models[modelTypeName].graphql.queries[query]) {
              let isArray = false;
              // eslint-disable-next-line no-unused-vars
              let isRequired = false;
              let outPutType = GraphQLInt;
              let inPutType = GraphQLInt;
              let typeName = models[modelTypeName].graphql.queries[query].output;
              let inputTypeNameField = models[modelTypeName].graphql.queries[query].input;

              if (typeName) {

                const typeReference = sanitizeFieldName(typeName);

                typeName = typeReference.type;
                isArray = typeReference.isArray;
                isRequired = typeReference.isRequired;

                if (isArray) {
                  outPutType = new GraphQLList(outputTypes[typeName]);
                } else {
                  outPutType = outputTypes[models[modelTypeName].graphql.queries[query].output];
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

              const inputArg = models[modelTypeName].graphql.queries[query].input ? { [inputTypeNameField]: { type: inPutType } } : {};

              queries[camelCase(query)] = {
                type: outPutType,
                args: Object.assign(inputArg, defaultListArgs(), includeArguments(), paranoidType),
                resolve: (source, args, context, info) => {
                  return options.authorizer(source, args, context, info).then((_) => {
                    return models[modelTypeName].graphql.queries[query].resolver(source, args, context, info);
                  });
                }
              };
            }

          }

        }

        return Object.assign(fields, queries);

      }, {})
    });
  };

};