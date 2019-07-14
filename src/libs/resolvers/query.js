const _ = require('lodash');
const {resolver} = require('graphql-sequelize');
const {EXPECTED_OPTIONS_KEY} = require('dataloader-sequelize');
const {whereQueryVarsToValues} = require('../utils');
const hooks = require('./hooks');

module.exports = (options) => {

  const {Sequelize, dataloaderContext} = options;

  return (model, isAssoc = false, field = null, assocModel = null) => {
    return async (source, args, context, info) => {

      if (args.where) args.where = whereQueryVarsToValues(args.where, info.variableValues);

      const _model = !field && isAssoc && model.target ? model.target : model;
      const type = 'fetch';

      // authorization should not be executed for nested queries
      if (!isAssoc) await options.authorizer(source, args, context, info);

      if (_.has(_model.graphql.overwrite, type)) {
        return _model.graphql.overwrite[type](source, args, context, info);
      }

      await hooks.before(_model, source, args, context, info, type);

      const before = (findOptions, args, context, info) => {

        const orderArgs = args.order || '';
        const orderBy = [];

        if (orderArgs != '') {
          const orderByClauses = orderArgs.split(',');

          orderByClauses.forEach((clause) => {
            if (clause.indexOf('reverse:') === 0) {
              orderBy.push([clause.substring(8), 'DESC']);
            } else {
              orderBy.push([clause, 'ASC']);
            }
          });
        }

        if (args.orderEdges) {
          const orderByClauses = args.orderEdges.split(',');

          orderByClauses.forEach((clause) => {
            const colName = '`' + model.through.model.name + '`.`' + (clause.indexOf('reverse:') === 0 ? clause.substring(8) : clause) + '`';

            orderBy.push([Sequelize.col(colName), clause.indexOf('reverse:') === 0 ? 'DESC' : 'ASC']);
          });
        }

        findOptions.order = orderBy;

        if (args.whereEdges) {
          if (!findOptions.where)
            findOptions.where = {};

          for (const key in args.whereEdges) {
            if (_.has(args.whereEdges, key)) {
              args.whereEdges = whereQueryVarsToValues(args.whereEdges, info.variableValues);

              const colName = '`' + model.through.model.name + '`.`' + key + '`';

              findOptions.where[colName] = Sequelize.where(Sequelize.col(colName), args.whereEdges[key]);
            }
          }
        }

        findOptions.paranoid = ((args.where && args.where.deletedAt && args.where.deletedAt.ne === null) || args.paranoid === false) ? false : _model.options.paranoid;

        return findOptions;
      };

      const scope = Array.isArray(_model.graphql.scopes) ? {
        method: [_model.graphql.scopes[0], _.get(args, _model.graphql.scopes[1], _model.graphql.scopes[2] || null)]
      } : _model.graphql.scopes;

      let data;

      if (field) {
        const modelNode = source.node[_model.name];

        data = modelNode[field];
      } else {
        data = await resolver(model instanceof Sequelize.Model ? model.scope(scope) : model, {
          [EXPECTED_OPTIONS_KEY]: dataloaderContext,
          before,
          separate: isAssoc
        })(source, args, context, info);
      }

      // little trick to pass args
      // on source params for connection fields
      if (data) {
        data.__args = args;
        data.__parent = source;
      }

      if (_.has(_model.graphql.extend, type)) {
        return _model.graphql.extend[type](data, source, args, context, info);
      }

      return data;

    };
  };

};