const _ = require('lodash');
const uuid = require('uuid/v4');
const hooks = require('./hooks');

function findOneRecord(model, where) {
  if (where) {
    return model.findOne({ where });
  }

  return Promise.resolve(null);

}

async function createMutation (source, args, context, info, mutationOptions) {

  const { isBulk, modelTypeName, models, transaction } = mutationOptions;
  const model = models[modelTypeName];
  const { bulkColumn, returning } = Array.isArray(model.graphql.bulk) ? {} : model.graphql.bulk;
  const bulkIdentifier = uuid();
  let records = args[modelTypeName];

  if (isBulk) {

    const individually = returning && !bulkColumn; // create records in separate create calls.

    // When using bulkColumn, we need to populate it with a unique identifier to use it in where for findAll
    if (bulkColumn) {
      records = (args[modelTypeName] || []).map((record) => {

        record[bulkColumn] = bulkIdentifier;

        return record;
      });
    }

    if (!individually) {

      // create records in bulk and return created objects using findall on bulkColumn
      await model.bulkCreate(records, { transaction, validate: true });

      if (returning && bulkColumn) {
        return model.findAll({ where: { [bulkColumn]: bulkIdentifier }, transaction });
      }

    } else {

      // create records individually and return created objects if returning is set to true
      const createdRecords = await Promise.all(
        records.map((record) => model.create(record, { transaction }))
      );

      if (returning) {
        return createdRecords;
      }

    }

    // return length when bulk option is without returning.
    return records.length;

  }

  return model.create(records, { transaction });

}

async function updateMutation (source, args, context, info, mutationOptions) {

  const { isBulk, where, modelTypeName, models, transaction } = mutationOptions;
  const model = models[modelTypeName];
  const { returning } = Array.isArray(model.graphql.bulk) ? {} : model.graphql.bulk;
  const records = args[modelTypeName];

  if (isBulk) {
    const keys = model.primaryKeyAttributes;
    const updatePromises = [];
    const findWhere = {};

    args[modelTypeName].forEach((record) => {

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

    if (!returning) {
      return records.length;
    }

    return model.findAll({ where: findWhere, transaction });
  }

  await model.update(records, { where, transaction });

  return model.findOne({ where, transaction });

}

function destroyMutation(source, args, context, info, mutationOptions) {
  const { isBulk, where, key, modelTypeName, models, transaction } = mutationOptions;
  const model = models[modelTypeName];

  // Unlikely to happen but still an extra check to not allow array of ids when destroying with non-bulk option.
  if (Array.isArray(where[key]) && !isBulk) {
    throw Error('Invalid operation input.');
  }

  return model.destroy({ where, transaction });

}

module.exports = (options) => {

  const { sequelize } = options;

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

      const preparedOptions = { ...mutationOptions, where, transaction, key };

      if (type === 'create') {
        data = await createMutation(source, args, context, info, preparedOptions);
      } else if (type === 'update') {
        data = await updateMutation(source, args, context, info, preparedOptions);
      } else if (type === 'destroy') {
        data = await destroyMutation(source, args, context, info, preparedOptions);
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