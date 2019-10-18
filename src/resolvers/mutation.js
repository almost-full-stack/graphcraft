const _ = require('lodash');
const uuid = require('uuid/v4');
const hooks = require('./hooks');

const findOneRecord = (model, where) => {
  if (where) {
    return model.findOne({ where });
  }

  return Promise.resolve(null);

};

module.exports = (options) => {
  //model, source, args, context, info, options
  return async (source, args, context, info, { type, where, isBulk, modelTypeName, models }) => {

    const model = models[modelTypeName];

    await options.authorizer(source, args, context, info);

    // mutation being overwritten at graphql.overwrite.[create/destroy/update], run it and skip the rest
    if (_.has(model.graphql.overwrite, type)) {
      return model.graphql.overwrite[type](source, args, context, info, where);
    }

    const resolveMutation = async () => {

      await hooks.before(model, source, args, context, info, type, where);

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

      if (_.has(model.graphql.extend, type)) {
        data = await model.graphql.extend[type](type === 'destroy' ? existingRecords : data, source, args, context, info, where);
      }

      if (operationType === 'bulkCreate' && isBulk === true) return data.length;

      await options.logger(data, source, args, context, info);

      return data;

    };

    if (options.transactionedMutations) {

      return models.sequelize.transaction((transaction) => {
        context.transaction = transaction;

        return resolveMutation();
      });

    }

    return resolveMutation();


  };

};