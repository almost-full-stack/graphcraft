const _ = require('lodash');
const { resolver, argsToFindOptions } = require('graphql-sequelize');
const { EXPECTED_OPTIONS_KEY } = require('dataloader-sequelize');
const hooks = require('./hooks');
const REVERSE_CLAUSE_STRING = 'reverse:';
const ASC = 'ASC';
const DESC = 'DESC';
const QUERY_TYPE = 'fetch';

const getOrderBy = (orderArgs) => {

  const orderBy = [];

  if (orderArgs) {

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

const getIncludes = (ast, associations) => {

  const includes = [];

  for (const key in ast) {

    const args = ast[key].args || {};
    const join = args.join;

    // check if it is really a association/model
    if (associations[key] && join) {

      includes.push(Object.assign({}, argsToFindOptions.default(args, Object.keys(associations[key].target.rawAttributes)), {
        model: associations[key].target,
        required: join === 'INNER',
        right: join === 'RIGHT',
      }));

    }

  }

  return includes;

};

module.exports = (options) => {

  const { dataloaderContext, limits } = options;

  return async (model, source, args, context, info, queryOptions) => {

    const isAssociation = Boolean(model.target);
    const realModel = isAssociation ? model.target : model;
    const graphql = realModel.graphql;
    const { simpleAST } = queryOptions;
    const includes = getIncludes(simpleAST, realModel.associations);

    // setup dataloader for resolver.
    resolver.contextToOptions = { [EXPECTED_OPTIONS_KEY]: EXPECTED_OPTIONS_KEY };
    context[EXPECTED_OPTIONS_KEY] = dataloaderContext;

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
    const before = (findOptions, args) => {

      if (isAssociation && model.through) {
        findOptions.through = {
          attributes: Object.keys(model.through.model.rawAttributes)
        };
      }

      if (args.throughWhere) {
        findOptions.where = argsToFindOptions.default({ where: args.throughWhere }, Object.keys(model.through.model.rawAttributes));
      }

      const order = getOrderBy(args.order);

      findOptions.order = order.length ? order : undefined;

      // if paranoid option from sequelize is set, this switch can be used to fetch archived, non-archived or all items.
      findOptions.paranoid = ((args.where && args.where.deletedAt && args.where.deletedAt.ne === null) || args.paranoid === false) ? false : model.options.paranoid;

      if (includes.length) {
        findOptions.include = includes;
      }

      return findOptions;
    };

    // see if a scope is specified to be applied to find queries.
    const variablePath = { args, context };
    const scope = Array.isArray(graphql.scopes) ? { method: [graphql.scopes[0], _.get(variablePath, graphql.scopes[1], graphql.scopes[2] || null)] } : graphql.scopes;
    const resolverOptions = {
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