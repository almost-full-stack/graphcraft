/* eslint-disable max-depth */
const {
  GraphQLObjectType,
  GraphQLList,
  GraphQLInt,
  GraphQLNonNull
} = require('graphql');
const camelCase = require('camelcase');
const { EXPECTED_OPTIONS_KEY } = require('dataloader-sequelize');
const { resolver } = require('graphql-sequelize');
const { includeArguments, sanitizeFieldName, getBulkOption } = require('../utils');
const { generateGraphQLField } = require('./generateTypes');

module.exports = (options) => {

  const { mutation } = require('../resolvers')(options);
  const { dataloaderContext } = options;
  const Models = options.models;

  return (models, modelTypes, outputTypes) => {

    const createMutationFor = {};

    for (const modelTypeName in modelTypes) {
      const model = models[modelTypeName];

      // model must have atleast one mutation to implement.
      if (model && (model.graphql.excludeMutations.length < 3 || Object.keys(model.graphql.mutations).length)) {
        createMutationFor[modelTypeName] = modelTypes[modelTypeName];
      }
    }

    return new GraphQLObjectType({
      name: 'Root_Mutations',
      fields: Object.keys(createMutationFor).reduce((allMutations, modelTypeName) => {

        const mutations = {};
        const modelType = modelTypes[modelTypeName];
        const model = models[modelTypeName];
        const key = model.primaryKeyAttributes[0];
        const aliases = model.graphql.alias;

        if (model.graphql.excludeMutations.includes('create')) {
          mutations[camelCase(aliases.create || (modelTypeName + 'Add'), { pascalCase: true })] = {
            type: outputTypes[modelTypeName], // what is returned by resolve, must be of type GraphQLObjectType
            description: 'Create a ' + modelTypeName,
            args: Object.assign({ [modelTypeName]: { type: modelType } }, includeArguments(options.includeArguments)),
            resolve: (source, args, context, info) => mutation(model, modelTypeName, source, args, context, info, 'create')
          };
        }

        if (model.graphql.excludeMutations.includes('update')) {
          mutations[camelCase(aliases.update || (modelTypeName + 'Edit'), { pascalCase: true })] = {
            type: outputTypes[modelTypeName] || GraphQLInt,
            description: 'Update a ' + modelTypeName,
            args: Object.assign({ [modelTypeName]: { type: modelType } }, includeArguments(options.includeArguments)),
            resolve: (source, args, context, info) => {
              const where = { [key]: args[modelTypeName][key] };

              return mutation(model, modelTypeName, source, args, context, info, 'update', where).
                then((boolean) => {
                  // `boolean` equals the number of rows affected (0 or 1)
                  return resolver(model, { [EXPECTED_OPTIONS_KEY]: dataloaderContext })(source, where, context, info);
                });
            }
          };
        }

        if (model.graphql.excludeMutations.indexOf('destroy') === -1) {
          mutations[camelCase(aliases.destroy || (modelTypeName + 'Delete'), { pascalCase: true })] = {
            type: GraphQLInt,
            description: 'Delete a ' + modelTypeName,
            args: Object.assign({ [key]: { type: new GraphQLNonNull(GraphQLInt) } }, includeArguments()),
            resolve: (source, args, context, info) => {
              const where = { [key]: args[key] };

              return mutation(model, modelTypeName, source, args, context, info, 'destroy', where);
            }
          };
        }

        const hasBulkOptionCreate = false; //getBulkOption(modelType.graphql.bulk, 'create');
        const hasBulkOptionEdit = false; //getBulkOption(modelType.graphql.bulk, 'edit');

        if (hasBulkOptionCreate) {
          mutations[camelCase(aliases.create || (modelTypeName + 'AddBulk'), { pascalCase: true })] = {
            type: (typeof hasBulkOptionCreate === 'string') ? new GraphQLList(outputTypes[modelTypeName]) : GraphQLInt, // what is returned by resolve, must be of type GraphQLObjectType
            description: 'Create bulk ' + modelTypeName + ' and return number of rows or created rows.',
            args: Object.assign({ [modelTypeName]: { type: new GraphQLList(modelType) } }, includeArguments()),
            resolve: (source, args, context, info) => mutation(modelType, modelTypeName, source, args, context, info, 'create', null, hasBulkOptionCreate)
          };
        }

        if (hasBulkOptionEdit) {

          mutations[camelCase(aliases.edit || (modelTypeName + 'EditBulk'), { pascalCase: true })] = {
            type: outputTypes[modelTypeName] ? new GraphQLList(outputTypes[modelTypeName]) : GraphQLInt, // what is returned by resolve, must be of type GraphQLObjectType
            description: 'Update bulk ' + modelTypeName + ' and return number of rows modified or updated rows.',
            args: Object.assign({ [modelTypeName]: { type: new GraphQLList(modelType) } }, includeArguments()),
            resolve: async (source, args, context, info) => {
              const whereClause = { [key]: { [Models.Sequelize.Op.in]: args[modelTypeName].map((input) => input[key]) } };

              await mutation(modelType, modelTypeName, source, args, context, info, 'update', null, hasBulkOptionEdit);

              return resolver(modelType, { [EXPECTED_OPTIONS_KEY]: dataloaderContext })(source, whereClause, context, info);
            }
          };
        }

        if (modelType.graphql && modelType.graphql.mutations) {

          for (const mutation in modelType.graphql.mutations) {
            if (modelType.graphql.mutations[mutation]) {
              const isArray = false;
              // eslint-disable-next-line no-unused-vars
              const isRequired = false;
              const outPutType = GraphQLInt;
              const modelType = GraphQLInt;
              const typeName = modelType.graphql.mutations[mutation].output;
              const modelTypeNameField = model.graphql.mutations[mutation].input;

              mutations[camelCase(mutation, { pascalCase: true })] = {
                type: outPutType,
                args: Object.assign({ [modelTypeNameField]: { type: modelType } }, includeArguments()),
                resolve: (source, args, context, info) => {
                  const where = key && args[modelTypeName] ? { [key]: args[modelTypeName][key] } : {};

                  return options.authorizer(source, args, context, info).then((_) => {
                    return modelType.graphql.mutations[mutation].resolver(source, args, context, info, where);
                  }).then((data) => {
                    return options.logger(data, source, args, context, info).then(() => data);
                  });
                }
              };
            }
          }

        }

        return Object.assign(allMutations, mutations);

      }, {})
    });
  };

};