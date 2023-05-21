/* eslint-disable max-depth */
const {
  GraphQLObjectType,
  GraphQLList,
  GraphQLInt,
  GraphQLNonNull
} = require('graphql');
const { typeMapper } = require('graphql-sequelize');
const { sanitizeField, generateName, isAvailable } = require('../utils');

module.exports = (options) => {

  const { mutation } = require('../resolvers')(options);
  const { generateGraphQLField, generateIncludeArguments } = require('./generateTypes')(options);
  const { naming, exposeOnly, restoreDeleted, GC_PERMISSIONS } = options;
  const pascalCase = naming.pascalCase;
  
  const permissions = Object.keys(GC_PERMISSIONS?.rules || {}).reduce((all, rule) => {
    
    all[rule] = (GC_PERMISSIONS?.rules[rule] || []).reduce((ap, permission) => {
    	
      ap[permission.model] = permission;
  
      return ap;
  
    }, {});;


    return all;

  }, {create: {}, delete: {}, update: {}});

  return (models, outputTypes = {}, inputTypes = {}) => {

    const includeArguments = generateIncludeArguments(options.includeArguments, outputTypes);
    const createMutationsFor = {};
    const modelMutationNames = {};
    const modelBulkOptions = {};
    const allCustomMutations = Object.assign({}, options.mutations);

    // outputTypes are generated for all non-excluded models
    for (const modelName in models) {

      const model = models[modelName];
      const outputTypeName = modelName;
      const aliases = model.graphql.alias;
      const bulk = model.graphql.bulk;
      const bulkEnabled = Array.isArray(bulk) ? bulk : bulk.enabled;

      model.graphql.excludeMutations = model.graphql.excludeMutations || [];

      //if (permissions.create[modelName]?.enable === false && !model.graphql.excludeMutations.includes('create')) model.graphql.excludeMutations.push('create');
      //if (permissions.update[modelName]?.enable === false && !model.graphql.excludeMutations.includes('update')) model.graphql.excludeMutations.push('update');
      //if (permissions.delete[modelName]?.enable === false && !model.graphql.excludeMutations.includes('destroy')) model.graphql.excludeMutations.push('destroy');
      
      const bulkOptions = {
        create: bulkEnabled.includes('create') && (!model.graphql.excludeMutations.includes('create') || permissions.create[modelName]?.enable === false),
        update: bulkEnabled.includes('update') && (!model.graphql.excludeMutations.includes('update') || permissions.update[modelName]?.enable === false),
        destroy: bulkEnabled.includes('destroy') && (!model.graphql.excludeMutations.includes('destroy') || permissions.delete[modelName]?.enable === false)
      };

      const modelMutationName = {
        create: generateName(aliases.create || options.naming.mutations, { type: naming.type.create, name: outputTypeName }, { pascalCase }),
        update: generateName(aliases.update || options.naming.mutations, { type: naming.type.update, name: outputTypeName }, { pascalCase }),
        delete: generateName(aliases.destroy || options.naming.mutations, { type: naming.type.delete, name: outputTypeName }, { pascalCase }),
        restore: generateName(aliases.restore || options.naming.mutations, { type: naming.type.restore, name: outputTypeName }, { pascalCase }),
        createBulk: generateName(aliases.createBulk || options.naming.mutations, { type: naming.type.create, name: outputTypeName, bulk: naming.type.bulk }, { pascalCase }),
        updateBulk: generateName(aliases.updateBulk || options.naming.mutations, { type: naming.type.update, name: outputTypeName, bulk: naming.type.bulk }, { pascalCase }),
        deleteBulk: generateName(aliases.destroyBulk || options.naming.mutations, { type: naming.type.delete, name: outputTypeName, bulk: naming.type.bulk }, { pascalCase })
      };

      modelBulkOptions[outputTypeName] = bulkOptions;
      modelMutationNames[outputTypeName] = modelMutationName;

      const customMutationNames = Object.keys(model.graphql.mutations || {});
      const toBeGenerated = [].concat(customMutationNames).concat(
        (model.graphql.excludeMutations.includes('create') || permissions.create[modelName]?.enable === false) ? [] : modelMutationName.create
      ).concat(
        bulkOptions.create ? [] : modelMutationName.createBulk
      ).concat(
        (model.graphql.excludeMutations.includes('update') || permissions.update[modelName]?.enable === false) ? [] : modelMutationName.update
      ).concat(
        bulkOptions.update ? [] : modelMutationName.updateBulk
      ).concat(
        (model.graphql.excludeMutations.includes('destroy') || permissions.delete[modelName]?.enable === false) ? [] : modelMutationName.delete
      ).concat(
        bulkOptions.destroy ? [] : modelMutationName.deleteBulk
      );

      // model must have atleast one mutation to implement.
      if (model && !model.graphql.readonly && (model.graphql.excludeMutations.length < 3 || Object.keys(model.graphql.mutations).length)) {
        if (isAvailable(exposeOnly.mutations, toBeGenerated)) {
          createMutationsFor[outputTypeName] = outputTypes[outputTypeName];
        }
      }
    }

    const mutationWrapper = (mutationName) => {

      if (!isAvailable(exposeOnly.mutations, [mutationName]) && exposeOnly.throw) {
        throw Error(exposeOnly.throw);
      }

      return mutation;
    };

    const fields = Object.keys(createMutationsFor).reduce((allMutations, modelTypeName) => {

      const mutations = {};
      const inputModelType = inputTypes[modelTypeName];
      const outputModelType = outputTypes[modelTypeName];
      const model = models[modelTypeName];
      const key = model.primaryKeyAttributes[0];
      const inputName = generateName(naming.input, { name: modelTypeName }, { noCase: true });

      if (!model.graphql.excludeMutations.includes('create') && permissions.create[modelTypeName]?.enable !== false && isAvailable(exposeOnly.mutations, modelMutationNames[modelTypeName].create)) {
        mutations[modelMutationNames[modelTypeName].create] = {
          type: outputModelType,
          description: 'Create ' + modelTypeName,
          args: Object.assign({ [inputName]: { type: inputModelType } }, includeArguments),
          resolve: (source, args, context, info) => mutationWrapper(modelMutationNames[modelTypeName].create)(source, args, context, info, { type: 'create', models, modelTypeName, inputName, permissions: permissions.create[modelTypeName] })
        };
      }

      if (!model.graphql.excludeMutations.includes('update') && permissions.update[modelTypeName]?.enable !== false && isAvailable(exposeOnly.mutations, modelMutationNames[modelTypeName].update)) {
        mutations[modelMutationNames[modelTypeName].update] = {
          type: outputModelType || GraphQLInt,
          description: 'Update ' + modelTypeName,
          args: Object.assign({ [inputName]: { type: inputModelType } }, includeArguments),
          resolve: (source, args, context, info) => mutationWrapper(modelMutationNames[modelTypeName].update)(source, args, context, info, { type: 'update', models, modelTypeName, inputName, permissions: permissions.update[modelTypeName] })
        };
      }

      if (!model.graphql.excludeMutations.includes('destroy') && permissions.delete[modelTypeName]?.enable !== false && isAvailable(exposeOnly.mutations, modelMutationNames[modelTypeName].delete)) {
        mutations[modelMutationNames[modelTypeName].delete] = {
          type: GraphQLInt,
          description: 'Delete ' + modelTypeName,
          // enhance this to support composite keys
          args: Object.assign({ [key]: { type: new GraphQLNonNull(typeMapper.toGraphQL(model.rawAttributes[key].type, options.Sequelize)) } }, includeArguments),
          resolve: (source, args, context, info) => mutationWrapper(modelMutationNames[modelTypeName].delete)(source, args, context, info, { type: 'destroy', models, modelTypeName, inputName, permissions: permissions.delete[modelTypeName] })
        };
      }

      if ((!model.graphql.excludeMutations.includes('restore') && permissions.delete[modelTypeName]?.enable !== false && isAvailable(exposeOnly.mutations, modelMutationNames[modelTypeName].restore)) && model.options.paranoid && (model.graphql.restoreDeleted || restoreDeleted)) {
        mutations[modelMutationNames[modelTypeName].restore] = {
          type: outputModelType,
          description: 'Restore ' + modelTypeName,
          args: Object.assign({ [key]: { type: new GraphQLNonNull(typeMapper.toGraphQL(model.rawAttributes[key].type, options.Sequelize)) } }, includeArguments),
          resolve: (source, args, context, info) => mutationWrapper(modelMutationNames[modelTypeName].restore)(source, args, context, info, { type: 'restore', models, modelTypeName, inputName })
        };
      }

      const bulk = model.graphql.bulk;
      const bulkOptions = modelBulkOptions[modelTypeName];

      if (bulkOptions.create && permissions.create[modelTypeName]?.enable !== false && isAvailable(exposeOnly.mutations, modelMutationNames[modelTypeName].createBulk)) {

        mutations[modelMutationNames[modelTypeName].createBulk] = {
          type: (typeof bulk.bulkColumn === 'string' || bulk.returning) ? new GraphQLList(outputModelType) : GraphQLInt,
          description: 'Create bulk ' + modelTypeName + ' and return number of rows or created rows.',
          args: Object.assign({ [inputName]: { type: new GraphQLList(inputModelType) } }, includeArguments),
          resolve: (source, args, context, info) => mutationWrapper(modelMutationNames[modelTypeName].createBulk)(source, args, context, info, { type: 'create', isBulk: true, models, modelTypeName, inputName, permissions: permissions.create[modelTypeName] })
        };

      }

      if (bulkOptions.update && permissions.update[modelTypeName]?.enable !== false && isAvailable(exposeOnly.mutations, modelMutationNames[modelTypeName].updateBulk)) {

        mutations[modelMutationNames[modelTypeName].updateBulk] = {
          type: bulk.returning ? new GraphQLList(outputModelType) : GraphQLInt,
          description: 'Update bulk ' + modelTypeName + ' and return number of rows modified or updated rows.',
          args: Object.assign({ [inputName]: { type: new GraphQLList(new GraphQLNonNull(inputModelType)) } }, includeArguments),
          resolve: (source, args, context, info) => mutationWrapper(modelMutationNames[modelTypeName].updateBulk)(source, args, context, info, { type: 'update', isBulk: true, models, modelTypeName, inputName, permissions: permissions.update[modelTypeName] })
        };

      }

      if (bulkOptions.destroy && permissions.delete[modelTypeName]?.enable !== false && isAvailable(exposeOnly.mutations, modelMutationNames[modelTypeName].deleteBulk)) {

        mutations[modelMutationNames[modelTypeName].deleteBulk] = {
          type: GraphQLInt,
          description: 'Delete bulk ' + modelTypeName,
          args: Object.assign({ [key]: { type: new GraphQLList(new GraphQLNonNull(typeMapper.toGraphQL(model.rawAttributes[key].type, options.Sequelize))) } }, includeArguments),
          resolve: (source, args, context, info) => mutationWrapper(modelMutationNames[modelTypeName].deleteBulk)(source, args, context, info, { type: 'destroy', isBulk: true, models, modelTypeName, inputName, permissions: permissions.delete[modelTypeName] })
        };

      }

      Object.assign(allCustomMutations, (model.graphql.mutations || {}));

      return Object.assign(allMutations, mutations);

    }, {});

    // Setup Custom Mutations
    for (const mutationName in allCustomMutations) {

      if (isAvailable(exposeOnly.mutations, mutationName)) {

        const currentMutation = allCustomMutations[mutationName];
        const type = currentMutation.output ? generateGraphQLField(currentMutation.output, outputTypes) : GraphQLInt;
        const description = currentMutation.description || undefined;
        const input = currentMutation.input ? sanitizeField(currentMutation.input) : '';
        const inputName = generateName(naming.input, { name: input }, { noCase: true });
        const args = Object.assign(
          {}, includeArguments,
          currentMutation.input ? { [inputName]: { type: generateGraphQLField(currentMutation.input, inputTypes) } } : {},
        );

        fields[generateName(mutationName, {}, { pascalCase })] = {
          type,
          args,
          description,
          resolve: (source, args, context, info) => mutationWrapper(mutationName)(source, args, context, info, { type: 'custom', models, resolver: currentMutation.resolver, inputName })
        };

      }

    }

    return new GraphQLObjectType({
      name: options.naming.rootMutations,
      fields
    });
  };

};