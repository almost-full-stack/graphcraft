const _ = require('lodash');
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

    /*const resolveMutation = async () => {

      let data = null;
      const existingRecords = await findOneRecord(model, type === 'destroy' ? where : null);
      const operationType = (isBulk && type === 'create') ? 'bulkCreate' : type;

      if (isBulk && type === 'update') {

        const keys = model.primaryKeyAttributes;
        const updatePromises = [];

        args[inputTypeName].forEach((input) => {
          updatePromises.push(
            model.update(input, {
              where: keys.reduce((all, key) => {
                all[key] = input[key];

                return all;
              }, {})
            })
          );
        });

        data = await Promise.all(updatePromises);

      } else {

        if (typeof isBulk === 'string' && args[inputTypeName].length && !args[inputTypeName][0][isBulk]) {

          const bulkAddId = uuid();

          args[inputTypeName].forEach((input) => {
            input[isBulk] = bulkAddId;
          });

        }

        const validate = true;

        data = await model[operationType](type === 'destroy' ? { where } : args[inputTypeName], { where, validate });

        if (typeof isBulk === 'string') {
          data = await model.findAll({ where: { [isBulk]: args[inputTypeName][0][isBulk] } });
        }

      }


      if (operationType === 'bulkCreate' && isBulk === true) return data.length;


      return data;

    };*/

    const bulkMutate = (transaction) => {
      return Promise.resolve();
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