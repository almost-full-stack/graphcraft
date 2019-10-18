/* eslint-disable max-depth */
const {
  GraphQLObjectType,
  GraphQLList,
  GraphQLInt,
  GraphQLNonNull
} = require('graphql');
const camelCase = require('camelcase');
const { generateGraphQLField } = require('./generateTypes');
const { includeArguments, sanitizeField } = require('../utils');
const pascalCase = true;

module.exports = (options) => {

  const { mutation } = require('../resolvers')(options);

  return (models, outputTypes = {}, inputTypes = {}) => {

    const createMutationsFor = {};

    // outputTypes are generated for all non-excluded models
    for (const outputTypeName in outputTypes) {
      const model = models[outputTypeName];

      // model must have atleast one mutation to implement.
      if (model && (model.graphql.excludeMutations.length < 3 || Object.keys(model.graphql.mutations).length)) {
        createMutationsFor[outputTypeName] = outputTypes[outputTypeName];
      }
    }

    return new GraphQLObjectType({
      name: 'Root_Mutations',
      fields: Object.keys(createMutationsFor).reduce((allMutations, modelTypeName) => {

        const mutations = {};
        const inputModelType = inputTypes[modelTypeName];
        const outputModelType = outputTypes[modelTypeName];
        const model = models[modelTypeName];
        const key = model.primaryKeyAttributes[0];
        const aliases = model.graphql.alias;

        if (!model.graphql.excludeMutations.includes('create')) {
          mutations[camelCase(aliases.create || (modelTypeName + 'Create'), { pascalCase })] = {
            type: outputModelType,
            description: 'Create a ' + modelTypeName,
            args: Object.assign({ [modelTypeName]: { type: inputModelType } }, includeArguments(options.includeArguments)),
            resolve: (source, args, context, info) => mutation(source, args, context, info, { type: 'create', models, modelTypeName })
          };
        }

        if (!model.graphql.excludeMutations.includes('update')) {
          mutations[camelCase(aliases.update || (modelTypeName + 'Update'), { pascalCase })] = {
            type: outputModelType || GraphQLInt,
            description: 'Update a ' + modelTypeName,
            args: Object.assign({ [modelTypeName]: { type: inputModelType } }, includeArguments(options.includeArguments)),
            resolve: (source, args, context, info) => {
              const where = { [key]: args[modelTypeName][key] }; // enhance to support composite keys

              return mutation(source, args, context, info, { type: 'update', where, models, modelTypeName });
            }
          };
        }

        if (!model.graphql.excludeMutations.includes('destroy')) {
          mutations[camelCase(aliases.destroy || (modelTypeName + 'Delete'), { pascalCase })] = {
            type: GraphQLInt,
            description: 'Delete a ' + modelTypeName,
            // enhance this to support composite keys
            args: Object.assign({ [key]: { type: new GraphQLNonNull(GraphQLInt) } }, includeArguments()),
            resolve: (source, args, context, info) => {
              const where = { [key]: args[key] };

              return mutation(source, args, context, info, { type: 'destroy', where, models, modelTypeName });
            }
          };
        }

        const bulkOptions = {
          create: model.graphql.bulk.includes('create'),
          update: model.graphql.bulk.includes('update'),
          destroy: model.graphql.bulk.includes('destroy')
        };

        if (bulkOptions.create) {

          mutations[camelCase(aliases.create || (modelTypeName + 'CreateBulk'), { pascalCase })] = {
            type: (typeof hasBulkOptionCreate === 'string') ? new GraphQLList(outputModelType) : GraphQLInt,
            description: 'Create bulk ' + modelTypeName + ' and return number of rows or created rows.',
            args: Object.assign({ [modelTypeName]: { type: new GraphQLList(inputModelType) } }, includeArguments()),
            resolve: (source, args, context, info) => mutation(source, args, context, info, { type: 'create', isBulk: true, models, modelTypeName })
          };

        }

        if (bulkOptions.update) {

          mutations[camelCase(aliases.edit || (modelTypeName + 'UpdateBulk'), { pascalCase })] = {
            type: outputModelType ? new GraphQLList(outputModelType) : GraphQLInt,
            description: 'Delete bulk ' + modelTypeName,
            args: Object.assign({ [modelTypeName]: { type: new GraphQLList(inputModelType) } }, includeArguments()),
            resolve: (source, args, context, info) => {
              const where = { [key]: args[modelTypeName].map((input) => input[key]) };

              return mutation(source, args, context, info, { type: 'update', isBulk: true, where, models, modelTypeName });
            }
          };

        }

        if (bulkOptions.destroy) {

          mutations[camelCase(aliases.edit || (modelTypeName + 'DeleteBulk'), { pascalCase })] = {
            type: GraphQLInt,
            description: 'Update bulk ' + modelTypeName + ' and return number of rows modified or updated rows.',
            args: Object.assign({ [key]: { type: new GraphQLList(new GraphQLNonNull(GraphQLInt)) } }, includeArguments()),
            resolve: (source, args, context, info) => {
              const where = { [key]: args[key] };

              return mutation(source, args, context, info, { type: 'destroy', where, models, modelTypeName });
            }
          };

        }

        // Setup Custom Mutations
        for (const mutation in (model.graphql.mutations || {})) {

          const currentMutation = model.graphql.mutations[mutation];
          const type = currentMutation.output ? generateGraphQLField(currentMutation.output, outputTypes) : GraphQLInt;
          const args = Object.assign(
            {}, includeArguments(),
            currentMutation.input ? { [sanitizeField(currentMutation.input)]: { type: generateGraphQLField(currentMutation.input, inputTypes) } } : {},
          );

          mutations[camelCase(mutation, { pascalCase })] = {
            type,
            args,
            resolve: (source, args, context, info) => {
              const where = key && args[modelTypeName] ? { [key]: args[modelTypeName][key] } : {};

              return mutation(source, args, context, info, { type: 'custom', where, models, modelTypeName, resolver: model.graphql.mutations[mutation].resolver });

            }
          };
        }

        return Object.assign(allMutations, mutations);

      }, {})
    });
  };

};