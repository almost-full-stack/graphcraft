const _ = require('lodash');
const { resolver, argsToFindOptions } = require('graphql-sequelize');
const { EXPECTED_OPTIONS_KEY } = require('dataloader-sequelize');
const hooks = require('./hooks');
const REVERSE_CLAUSE_STRING = 'reverse:';
const ASC = 'ASC';
const DESC = 'DESC';
const QUERY_TYPE = 'fetch';

const getOrderBy = (orderArgs = '') => {

  const orderBy = [];

  if (orderArgs != '') {

    const orderByClauses = orderArgs.split(',');

    orderByClauses.forEach((clause) => {
      if (clause.indexOf(REVERSE_CLAUSE_STRING) === 0) {
        orderBy.push([clause.substring(REVERSE_CLAUSE_STRING.length), DESC]);
      } else {
        orderBy.push([clause, ASC]);
      }
    });

  }

  return orderBy;
};

module.exports = (options) => {

  const { dataloaderContext, limits } = options;

  return async (model, inputTypeName, source, args, context, info, isAssociation = false) => {

    const realModel = isAssociation ? model.target : model;
    const graphql = realModel.graphql;

    if (!isAssociation) {
      args.limit = args.limit || limits.default;
      args.limit = args.limit > limits.max ? limits.max : args.limit;
    }

    // No need to call authorizer again on associations
    if (!isAssociation) await options.authorizer(source, args, context, info);

    // query being overwritten at graphql.overwrite.fetch, run it and skip the rest
    if (_.has(graphql.overwrite, QUERY_TYPE)) {
      return graphql.overwrite[QUERY_TYPE](source, args, context, info);
    }

    // hook coming from graphql.before.fetch
    await hooks.before(isAssociation ? model.target : model, source, args, context, info, QUERY_TYPE);

    // sequelize-graphql before hook to parse orderby clause to make sure it supports multiple orderby
    const before = (findOptions, args, context) => {

      if (args.throughWhere) {

        const throughFindOptions = argsToFindOptions.default({ where: args.throughWhere }, Object.keys(model.through.model.rawAttributes));

        findOptions.through = {
          where: throughFindOptions.where,
          attributes: Object.keys(model.through.model.rawAttributes)
        };

      }

      findOptions.order = getOrderBy(args.order || '');

      // if paranoid option from sequelize is set, this switch can be used to fetch archived, non-archived or all items.
      findOptions.paranoid = ((args.where && args.where.deletedAt && args.where.deletedAt.ne === null) || args.paranoid === false) ? false : model.options.paranoid;

      return findOptions;
    };

    // see if a scope is specified to be applied to find queries.
    const variablePath = { args, context };
    const scope = Array.isArray(graphql.scopes) ? { method: [graphql.scopes[0], _.get(variablePath, graphql.scopes[1], graphql.scopes[2] || null)] } : graphql.scopes;
    const resolverOptions = {
      [EXPECTED_OPTIONS_KEY]: dataloaderContext,
      before,
      separate: isAssociation
    };

    const data = await resolver((isAssociation ? model : model.scope(scope)), resolverOptions)(source, args, context, info);

    if (_.has(graphql.extend, QUERY_TYPE) || _.has(graphql.after, QUERY_TYPE)) {
      await (graphql.extend || graphql.after)[QUERY_TYPE](data, source, args, context, info);
    }

    // Logger only runs for base query.
    if (!isAssociation) await options.logger(data, source, args, context, info);

    return data;

  };
};