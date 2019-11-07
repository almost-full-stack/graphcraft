/* eslint-disable max-depth */
const {
  GraphQLObjectType,
  GraphQLList,
  GraphQLInt,
  GraphQLNonNull
} = require('graphql');
const { sanitizeField, generateName } = require('../utils');

module.exports = (options) => {

  const { mutation } = require('../resolvers')(options);
  const { generateGraphQLField, generateIncludeArguments } = require('./generateTypes')(options);
  const pascalCase = options.naming.pascalCase;

  return (models, outputTypes = {}, inputTypes = {}) => {

    const includeArguments = generateIncludeArguments(options.includeArguments, outputTypes);
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
      name: options.naming.rootMutations,
      fields: Object.keys(createMutationsFor).reduce((allMutations, modelTypeName) => {

        const mutations = {};
        const inputModelType = inputTypes[modelTypeName];
        const outputModelType = outputTypes[modelTypeName];
        const model = models[modelTypeName];
        const key = model.primaryKeyAttributes[0];
        const aliases = model.graphql.alias;

        if (!model.graphql.excludeMutations.includes('create')) {
          mutations[generateName(aliases.create || options.naming.mutations, { type: 'create', name: modelTypeName }, { pascalCase })] = {
            type: outputModelType,
            description: 'Create a ' + modelTypeName,
            args: Object.assign({ [modelTypeName]: { type: inputModelType } }, includeArguments),
            resolve: (source, args, context, info) => mutation(source, args, context, info, { type: 'create', models, modelTypeName })
          };
        }

        if (!model.graphql.excludeMutations.includes('update')) {
          mutations[generateName(aliases.update || options.naming.mutations, { type: 'update', name: modelTypeName }, { pascalCase })] = {
            type: outputModelType || GraphQLInt,
            description: 'Update a ' + modelTypeName,
            args: Object.assign({ [modelTypeName]: { type: inputModelType } }, includeArguments),
            resolve: (source, args, context, info) => {
              const where = { [key]: args[modelTypeName][key] }; // enhance to support composite keys

              return mutation(source, args, context, info, { type: 'update', where, models, modelTypeName });
            }
          };
        }

        if (!model.graphql.excludeMutations.includes('destroy')) {
          mutations[generateName(aliases.destroy || options.naming.mutations, { type: 'delete', name: modelTypeName }, { pascalCase })] = {
            type: GraphQLInt,
            description: 'Delete a ' + modelTypeName,
            // enhance this to support composite keys
            args: Object.assign({ [key]: { type: new GraphQLNonNull(GraphQLInt) } }, includeArguments),
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

          mutations[generateName(aliases.createBulk || options.naming.mutations, { type: 'create', name: modelTypeName, bulk: 'bulk' }, { pascalCase })] = {
            type: (typeof hasBulkOptionCreate === 'string') ? new GraphQLList(outputModelType) : GraphQLInt,
            description: 'Create bulk ' + modelTypeName + ' and return number of rows or created rows.',
            args: Object.assign({ [modelTypeName]: { type: new GraphQLList(inputModelType) } }, includeArguments),
            resolve: (source, args, context, info) => mutation(source, args, context, info, { type: 'create', isBulk: true, models, modelTypeName })
          };

        }

        if (bulkOptions.update) {

          mutations[generateName(aliases.updateBulk || options.naming.mutations, { type: 'update', name: modelTypeName, bulk: 'bulk' }, { pascalCase })] = {
            type: outputModelType ? new GraphQLList(outputModelType) : GraphQLInt,
            description: 'Delete bulk ' + modelTypeName,
            args: Object.assign({ [modelTypeName]: { type: new GraphQLList(inputModelType) } }, includeArguments),
            resolve: (source, args, context, info) => {
              const where = { [key]: args[modelTypeName].map((input) => input[key]) };

              return mutation(source, args, context, info, { type: 'update', isBulk: true, where, models, modelTypeName });
            }
          };

        }

        if (bulkOptions.destroy) {

          mutations[generateName(aliases.destroyBulk || options.naming.mutations, { type: 'delete', name: modelTypeName, bulk: 'bulk' }, { pascalCase })] = {
            type: GraphQLInt,
            description: 'Update bulk ' + modelTypeName + ' and return number of rows modified or updated rows.',
            args: Object.assign({ [key]: { type: new GraphQLList(new GraphQLNonNull(GraphQLInt)) } }, includeArguments),
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
            {}, includeArguments,
            currentMutation.input ? { [sanitizeField(currentMutation.input)]: { type: generateGraphQLField(currentMutation.input, inputTypes) } } : {},
          );

          mutations[generateName(mutation, {}, { pascalCase })] = {
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