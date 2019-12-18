/* eslint-disable max-depth */
const {
  GraphQLObjectType,
  GraphQLList,
  GraphQLInt,
  GraphQLBoolean,
  GraphQLString
} = require('graphql');
const {
  defaultListArgs,
  defaultArgs,
  argsToFindOptions
} = require('graphql-sequelize');
const { sanitizeField, generateName, isAvailable, whereQueryVarsToValues } = require('../utils');

module.exports = (options) => {

  const { query } = require('../resolvers')(options);
  const { generateGraphQLField, generateIncludeArguments } = require('./generateTypes')(options);
  const { naming, exposeOnly } = options;
  const pascalCase = naming.pascalCase;

  /**
  * Returns a root `GraphQLObjectType` used as query for `GraphQLSchema`.
  *
  * It creates an object whose properties are `GraphQLObjectType` created
  * from Sequelize models.
  * @param {*} models The sequelize models used to create the root `GraphQLSchema`
  */
  return (models, outputTypes = {}, inputTypes = {}) => {

    const includeArguments = generateIncludeArguments(options.includeArguments, outputTypes);
    const defaultListArguments = defaultListArgs();
    const createQueriesFor = {};

    for (const outputTypeName in outputTypes) {

      const model = models[outputTypeName];
      const customQueryNames = Object.keys(model.graphql.queries || {});
      const modelQueryName = generateName(model.graphql.alias.fetch || options.naming.queries, { type: naming.type.get, name: outputTypeName }, { pascalCase });
      const toBeGenerated = [].concat(customQueryNames).concat(
        model.graphql.excludeQueries.includes('fetch') ? [] : modelQueryName
      );

      // model must have atleast one query to implement.
      if (model && (!model.graphql.excludeQueries.includes('fetch') || customQueryNames.length)) {
        if (isAvailable(exposeOnly.queries, toBeGenerated)) {
          createQueriesFor[outputTypeName] = outputTypes[outputTypeName];
        }
      }
    }

    return new GraphQLObjectType({
      name: options.naming.rootQueries,
      fields: Object.keys(createQueriesFor).reduce((allQueries, modelTypeName) => {

        const queries = {};
        const modelType = outputTypes[modelTypeName];
        const model = models[modelType.name];
        const paranoidType = model.graphql.paranoid && model.options.paranoid ? { paranoid: { type: GraphQLBoolean } } : {};
        const aliases = model.graphql.alias;
        const modelQueryName = generateName(aliases.fetch || options.naming.queries, { type: naming.type.get, name: modelTypeName }, { pascalCase });


      queries[generateName(model.graphql.alias.default || options.naming.queries, { type: naming.type.default, name: modelTypeName }, { pascalCase })] = {
          type: GraphQLString,
          description: 'An empty default Query. Can be overwritten for your needs (for example metadata).',
          resolve: () => '1'
        };

      if (models[modelType.name].graphql.excludeQueries.indexOf('count') === -1) {
        queries[generateName(model.graphql.alias.count || options.naming.queries, { type: naming.type.count, name: modelTypeName }, { pascalCase })] = {
          type: GraphQLInt,
          args: {
            where: defaultListArgs().where
          },
          resolve: (source, {
            where
          }, context, info) => {
            const args = argsToFindOptions.default({ where });

            if (args.where) whereQueryVarsToValues(args.where, info.variableValues);

            return models[modelTypeName].count({
              where: args.where
            });
          },
          description: 'A count of the total number of objects in this connection, ignoring pagination.'
        };
      }

        if (!model.graphql.excludeQueries.includes('fetch') && isAvailable(exposeOnly.queries, [modelQueryName])) {
          queries[generateName(aliases.fetch || options.naming.queries, { type: naming.type.get, name: modelTypeName }, { pascalCase })] = {
            type: new GraphQLList(modelType),
            args: Object.assign(defaultArgs(model), defaultListArguments, includeArguments, paranoidType),
            resolve: (source, args, context, info) => {
              return query(model, modelType.name, source, args, context, info);
            }
          };
        }

        // Setup Custom Queries
        for (const query in (model.graphql.queries || {})) {

          const currentQuery = model.graphql.queries[query];
          const type = currentQuery.output ? generateGraphQLField(currentQuery.output, outputTypes) : GraphQLInt;
          const args = Object.assign(
            {}, defaultListArguments, includeArguments, paranoidType,
            currentQuery.input ? { [sanitizeField(currentQuery.input)]: { type: generateGraphQLField(currentQuery.input, inputTypes) } } : {},
          );
          const resolve = async (source, args, context, info) => {

            await options.authorizer(source, args, context, info);

            return currentQuery.resolver(source, args, context, info);
          };

          queries[generateName(query, {}, { pascalCase })] = { type, args, resolve };

        }

        return Object.assign(allQueries, queries);

      }, {})
    });
  };

};