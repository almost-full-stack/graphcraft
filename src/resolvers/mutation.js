const _ = require('lodash');
const uuid = require('uuid/v4');
const hooks = require('./hooks');

function findOneRecord(model, where) {
  if (where) {
    return model.findOne({ where });
  }

  return Promise.resolve(null);

}

module.exports = (options) => {

  return async (source, args, context, info, mutationOptios) => {

    const { type, where, isBulk, modelTypeName, models } = mutationOptios;
    const model = models[modelTypeName];

    await options.authorizer(source, args, context, info);

    // mutation being overwritten at graphql.overwrite.[create/destroy/update], run it and skip the rest
    if (_.has(model.graphql.overwrite, type)) {
      return model.graphql.overwrite[type](source, args, context, info, where);
    }

    await hooks.before(model, source, args, context, info, type, where);

    const bulkMutate = async (transaction) => {

      const { bulkColumn } = model.graphql;
      const bulkIdentifier = uuid();
      let findWhere = {};

      if (type === 'create') {

        const records = (args[modelTypeName] || []).map((record) => {

          if (bulkColumn) record[bulkColumn] = bulkIdentifier;

          return record;
        });

        await model.bulkCreate(records, { transaction, validate: true });

        if (!bulkColumn) return records.length;

        findWhere = { [bulkColumn]: bulkIdentifier };

      } else if (type === 'update') {

        const keys = model.primaryKeyAttributes;
        const updatePromises = [];

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

      }

      return model.findAll({ where: findWhere, transaction });
    };

    const mutate = (transaction) => {

      if (type === 'custom') {
        return mutationOptios.resolver(source, args, context, info, { where });
      }

      if (isBulk) {
        return bulkMutate(transaction);
      }

      const opArguments = { transaction, where };

      return model[type](type === 'destroy' ? opArguments : args[modelTypeName], opArguments);
    };

    const resolve = async (transaction) => {

      const data = await mutate(transaction);
      const previousRecord = await findOneRecord(model, !isBulk && type === 'destroy' ? where : null);

      if (_.has(model.graphql.extend, type)) {
        await model.graphql.extend[type](previousRecord || data, source, args, context, info, where);
      }

      await options.logger(data, source, args, context, info);

    };

    if (options.transactionedMutations && type != 'custom') {

      return models.sequelize.transaction((transaction) => {
        return resolve(transaction);
      });

    }

    return resolve();

  };

};