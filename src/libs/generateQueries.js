/* eslint-disable max-depth */
const _ = require('lodash');
const {
  GraphQLObjectType,
  GraphQLList,
  GraphQLInt,
  GraphQLBoolean
} = require('graphql');
const {
  defaultListArgs,
  defaultArgs,
  argsToFindOptions,
  simplifyAST
} = require('graphql-sequelize');
const { sanitizeField, generateName, isAvailable, whereQueryVarsToValues } = require('../utils');

const filterPermissions = (rules, modelName) => {

  if (rules && rules.length) {
    return (rules || []).find((resource) => resource.model == modelName) || {};
  }

  return {};
};

module.exports = (options) => {

  const { query } = require('../resolvers')(options);
  const { generateGraphQLField, generateIncludeArguments } = require('./generateTypes')(options);
  const { naming, exposeOnly, fetchDeleted, GC_PERMISSIONS } = options;
  const pascalCase = naming.pascalCase;
  const permissions = (GC_PERMISSIONS?.rules?.fetch || []).reduce((all, permission) => {
    	
    all[permission.model] = permission;

    return all;

  }, {});

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
    const allCustomQueries = Object.assign({}, options.queries);

    for (const modelName in models) {

      const model = models[modelName];
      const outputTypeName = modelName;
      const customQueryNames = Object.keys(model.graphql.queries || {});
      const modelQueryName = generateName(model.graphql.alias.fetch || naming.queries, { type: naming.type.get, name: outputTypeName }, { pascalCase });

      model.graphql.excludeQueries = model.graphql.excludeQueries || [];

      if (permissions[modelName]?.enable === false && !model.graphql.excludeQueries.includes('fetch')) model.graphql.excludeQueries.push('fetch');

      const toBeGenerated = [].concat(customQueryNames).concat(
        model.graphql.excludeQueries.includes('fetch') ? [] : modelQueryName
      );

      // model must have atleast one query to implement.
      if (model && (!model.graphql.excludeQueries.includes('fetch') || customQueryNames.length)) {
        if (isAvailable(exposeOnly.queries, toBeGenerated) && !exposeOnly.throw) {
          createQueriesFor[outputTypeName] = outputTypes[outputTypeName];
        }
      }
    }

    const fields = Object.keys(createQueriesFor).reduce((allQueries, modelTypeName) => {

      const queries = {};
      const modelType = outputTypes[modelTypeName];
      const model = models[modelType.name];
      const paranoidType = model.options.paranoid && (model.graphql.paranoid || model.graphql.fetchDeleted || fetchDeleted) ? { fetchDeleted: { type: GraphQLBoolean } } : {};
      const aliases = model.graphql.alias;
      const modelQueryName = generateName(aliases.fetch || naming.queries, { type: naming.type.get, name: modelTypeName }, { pascalCase });
      const modelCountQueryName = generateName(aliases.count || naming.queries, { type: naming.type.count, name: modelTypeName }, { pascalCase });
      const modelFindOneQueryName = generateName(aliases.byPk || naming.queries, { type: naming.type.byPk, name: modelTypeName }, { pascalCase });
      const modelPermissions = permissions[modelType.name];

      const createFindOneQuery = (options.findOneQueries === true || (Array.isArray(options.findOneQueries) && options.findOneQueries.includes(modelType.name))) && isAvailable(exposeOnly.queries, [modelFindOneQueryName]);

      if (createFindOneQuery && modelPermissions?.findOne !== false) {
        queries[modelFindOneQueryName] = {
          type: modelType,
          args: _.omit(defaultArgs(model), ['where']),
          resolve: (source, args, context, info) => {

            if (!isAvailable(exposeOnly.queries, [modelFindOneQueryName]) && exposeOnly.throw) {
              throw Error(exposeOnly.throw);
            }

            const permissions = permissions[modelName] || {};

            return query(model, source, args, context, info, { simpleAST: null, permissions });
          },
          description: `Returns one  ${modelType.name}.`
        };
      }

      if (models[modelType.name].graphql.excludeQueries.indexOf('count') === -1 && isAvailable(exposeOnly.queries, [modelCountQueryName])  && modelPermissions?.count !== false) {
        queries[modelCountQueryName] = {
          type: GraphQLInt,
          args: {
            where: defaultListArgs().where
          },
          resolve: (source, { where }, context, info) => {

            if (!isAvailable(exposeOnly.queries, [modelCountQueryName]) && exposeOnly.throw) {
              throw Error(exposeOnly.throw);
            }

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
        queries[modelQueryName] = {
          type: new GraphQLList(modelType),
          description: `Fetch ${modelQueryName}.`,
          args: Object.assign(defaultArgs(model), defaultListArguments, includeArguments, paranoidType),
          resolve: (source, args, context, info) => {

            const permissions = filterPermissions(options?.GC_PERMISSIONS?.rules?.fetch, modelType.name);

            if (!isAvailable(exposeOnly.queries, [modelQueryName]) && exposeOnly.throw) {
              throw Error(exposeOnly.throw);
            }

            const simpleAST = simplifyAST(info.fieldASTs || info.fieldNodes, info).fields || {};

            return query(model, source, args, context, info, { simpleAST, permissions });

          }
        };
      }

      Object.assign(allCustomQueries, (model.graphql.queries || {}));

      return Object.assign(allQueries, queries);

    }, {});

    // Setup Custom Queries
    for (const query in allCustomQueries) {

      if (isAvailable(exposeOnly.queries, query)) {

        const currentQuery = allCustomQueries[query];
        const type = currentQuery.output ? generateGraphQLField(currentQuery.output, outputTypes) : GraphQLInt;
        const description = currentQuery.description || undefined;
        const input = currentQuery.input ? sanitizeField(currentQuery.input) : '';
        const inputName = generateName(naming.input, { name: input });
        const args = Object.assign(
          {}, defaultListArguments, includeArguments,
          currentQuery.input ? { [inputName]: { type: generateGraphQLField(currentQuery.input, inputTypes) } } : {},
        );
        const resolve = async (source, args, context, info) => {

          if (input) args[input] = args[inputName];

          if (!isAvailable(exposeOnly.queries, [query]) && exposeOnly.throw) {
            throw Error(exposeOnly.throw);
          }

          if (!currentQuery.public) {
            await options.authorizer(source, args, context, info);
          }

          return currentQuery.resolver(source, args, context, info);
        };

        fields[generateName(query, {}, { pascalCase })] = { type, description, args, resolve };

      }

    }

    return new GraphQLObjectType({
      name: naming.rootQueries,
      fields
    });
  };

};