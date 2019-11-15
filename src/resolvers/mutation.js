const _ = require('lodash');
const uuid = require('uuid/v4');
const hooks = require('./hooks');

function findOneRecord(model, where) {
  if (where) {
    return model.findOne({ where });
  }

  return Promise.resolve(null);

}

function keysWhichAreModelAssociations (input, associations) {
  const keys = Object.keys(input);


  return keys.reduce((all, key) => {
    if (associations[key] && input[key] && input[key].length) {
      all.push({ key, target: associations[key].target, fields: [associations[key].foreignKey] }); // Using an array to support multiple keys in future.
    }

    return all;
  }, []);
}

function recursiveCreateAssociations(graphqlParams, mutationOptions, options) {

  const { modelTypeName, models } = mutationOptions;
  const model = models[modelTypeName];
  const { input, createdRecord, operation } = options;
  const availableAssociations = keysWhichAreModelAssociations(input, model.associations);

  return Promise.all(availableAssociations.map((association) => {

    return Promise.all(input[association.key].map((record) => {
      const recordToCreate = { ...record };
      const newArgs = {};

      recordToCreate[association.fields[0]] = createdRecord.id;
      newArgs[association.target.name] = recordToCreate;

      return operation({ ...graphqlParams, args: newArgs }, { ...mutationOptions, modelTypeName: association.target.name, skipReturningBulk: true });
    }));

  }));
}

function recursiveUpdateAssociations(graphqlParams, mutationOptions, options) {

  const { modelTypeName, models, nestedUpdateMode } = mutationOptions;
  const model = models[modelTypeName];
  const { input } = options;
  const availableAssociations = keysWhichAreModelAssociations(input, model.associations);
  const updateMode = nestedUpdateMode.toUpperCase();

  return Promise.all(availableAssociations.map((association) => {

    if (updateMode === 'UPDATE_ONLY') {
      const newArgs = { [association.target.name]: input[association.key] };

      return updateMutation({ ...graphqlParams, args: newArgs }, { ...mutationOptions, modelTypeName: association.target.name, isBulk: true, skipReturningBulk: true });
    } else if (updateMode === 'UPDATE_ADD') {

    }

  }));

}

async function createMutation (graphqlParams, mutationOptions) {

  /**
   * skipReturningBulk: will be passed when creating associations, in that case we can just skip returning options
   */

  const { args } = graphqlParams;
  const { isBulk, modelTypeName, models, transaction, skipReturningBulk } = mutationOptions;
  const model = models[modelTypeName];
  const { bulkColumn, returning } = Array.isArray(model.graphql.bulk) ? {} : model.graphql.bulk;
  const bulkIdentifier = uuid();
  let input = args[modelTypeName];

  if (isBulk) {

    const individually = returning && !bulkColumn; // create records in separate create calls.

    // When using bulkColumn, we need to populate it with a unique identifier to use it in where for findAll
    if (bulkColumn) {
      input = (args[modelTypeName] || []).map((record) => {

        record[bulkColumn] = bulkIdentifier;

        return record;
      });
    }

    if (!individually || skipReturningBulk) {

      // create records in bulk and return created objects using findall on bulkColumn
      await model.bulkCreate(input, { transaction, validate: true });

      if (returning && bulkColumn) {
        return model.findAll({ where: { [bulkColumn]: bulkIdentifier }, transaction });
      }

    } else {

      // create records individually and return created objects if returning is set to true
      const createdRecords = await Promise.all(
        input.map((record) => model.create(record, { transaction }))
      );

      if (returning) {
        return createdRecords;
      }

    }

    // return length when bulk option is without returning.
    return input.length;

  }

  const createdRecord = await model.create(input, { transaction });

  await recursiveCreateAssociations({ ...graphqlParams }, { ...mutationOptions }, { input, createdRecord, operation: createMutation });

  return createdRecord;

}

async function updateMutation (graphqlParams, mutationOptions) {

  const { args } = graphqlParams;
  const { isBulk, where, modelTypeName, models, transaction, skipReturningBulk, nestedUpdateMode } = mutationOptions;
  const model = models[modelTypeName];
  const { returning } = Array.isArray(model.graphql.bulk) ? {} : model.graphql.bulk;
  const input = args[modelTypeName];

  if (isBulk) {
    const keys = model.primaryKeyAttributes;
    const updatePromises = [];
    const findWhere = {};

    input.forEach((record) => {

      const where = keys.reduce((all, key) => {

        findWhere[key] = findWhere[key] || [];
        findWhere[key].push(record[key]);
        all[key] = record[key];

        return all;
      }, {});

      updatePromises.push(
        model.update(record, { where, transaction })
      );

    });

    await Promise.all(updatePromises);

    if (!returning || skipReturningBulk) {
      return input.length;
    }

    return model.findAll({ where: findWhere, transaction });
  }

  await model.update(input, { where, transaction });

  if (nestedUpdateMode.toUpperCase() !== 'NONE') {
    await recursiveUpdateAssociations({ ...graphqlParams }, { ...mutationOptions }, { input });
  }

  return model.findOne({ where, transaction });

}

function destroyMutation({ source, args, context, info }, mutationOptions) {
  const { isBulk, where, key, modelTypeName, models, transaction } = mutationOptions;
  const model = models[modelTypeName];

  // Unlikely to happen but still an extra check to not allow array of ids when destroying with non-bulk option.
  if (Array.isArray(where[key]) && !isBulk) {
    throw Error('Invalid operation input.');
  }

  return model.destroy({ where, transaction });

}

module.exports = (options) => {

  const { sequelize, nestedUpdateMode } = options;

  return async (source, args, context, info, mutationOptions) => {

    const { type, isBulk, modelTypeName, models } = mutationOptions;
    const model = models[modelTypeName];
    const key = model.primaryKeyAttributes[0];
    const where = { [key]: (type === 'destroy' ? args[key] : args[modelTypeName][key]) };

    await options.authorizer(source, args, context, info);

    // mutation being overwritten at graphql.overwrite.[create/destroy/update], run it and skip the rest
    if (_.has(model.graphql.overwrite, type)) {
      return model.graphql.overwrite[type](source, args, context, info, where);
    }

    await hooks.before(model, source, args, context, info, type, where);

    const resolve = async (transaction) => {

      let data;

      const preparedOptions = { ...mutationOptions, where, transaction, key, nestedUpdateMode };
      const graphqlParams = { source, args, context, info };

      if (type === 'create') {
        data = await createMutation(graphqlParams, preparedOptions);
      } else if (type === 'update') {
        data = await updateMutation(graphqlParams, preparedOptions);
      } else if (type === 'destroy') {
        data = await destroyMutation(graphqlParams, preparedOptions);
      } else {
        throw Error('Invalid mutation.');
      }

      const previousRecord = await findOneRecord(model, !isBulk && type === 'destroy' ? where : null);

      if (_.has(model.graphql.extend, type) || _.has(model.graphql.after, type)) {
        await (model.graphql.extend || model.graphql.after)[type](previousRecord || data, source, args, context, info, where);
      }

      await options.logger(data, source, args, context, info);

      return data;

    };

    if (options.transactionedMutations && type != 'custom') {

      return sequelize.transaction((transaction) => resolve(transaction));

    }

    return resolve();

  };

};