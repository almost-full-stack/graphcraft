const { GraphQLList } = require('graphql');
const _ = require('lodash');
const simplifyAST = require('graphql-sequelize/lib/simplifyAST');
const generateIncludes = require('sequelize-graphql-schema/src/graphql-sequelize/generateIncludes');
const argsToFindOptions = require('graphql-sequelize/lib/argsToFindOptions');
const { isConnection, handleConnection } = require('graphql-sequelize/lib/relay');
const invariant = require('invariant');
const { nodeAST, nodeType } = require("./helpers");
const {
  resolver,
} = require('graphql-sequelize');

function inList(list, attribute) {
  return ~list.indexOf(attribute);
}

function validateOptions(options) {
  invariant(
    !options.defaultAttributes || Array.isArray(options.defaultAttributes),
    'options.defaultAttributes must be an array of field names.'
  );
}

function resolverFactory(decorator, target, options) {
  var _resolver
    , targetAttributes
    , isModel = !!target.getTableName
    , isAssociation = !!target.associationType
    , association = isAssociation && target
    , model = isAssociation && target.target || isModel && target;

  targetAttributes = Object.keys(model.rawAttributes);

  options = options || {};
  if (options.include === undefined) options.include = true;
  if (options.before === undefined) options.before = (options) => options;
  if (options.after === undefined) options.after = (result) => result;
  if (options.handleConnection === undefined) options.handleConnection = true;
  if (options.filterAttributes === undefined) options.filterAttributes = resolverFactory.filterAttributes;

  validateOptions(options);

  _resolver = function (source, args, context, info) {
    const joinResolver = (join) => {
      return (source, args, context, info) => {
        var ast = info.fieldASTs || info.fieldNodes
          , type = info.returnType
          , list = options.list || type instanceof GraphQLList
          , simpleAST = simplifyAST(ast, info)
          , fields = simpleAST.fields
          , findOptions = argsToFindOptions.default(args, targetAttributes);

        context = context || {};

        if (isConnection(info.returnType)) {
          simpleAST = nodeAST(simpleAST);
          fields = simpleAST.fields;

          type = nodeType(type);
        }

        type = type.ofType || type;

        let _name = association && association.as.charAt(0).toUpperCase() + association.as.slice(1);
        if (association && source["get" + _name] !== undefined) {
          if (options.handleConnection && isConnection(info.returnType)) {
            return handleConnection(source["get" + _name], args);
          }

          return options.after(source.get(association.as), args, context, {
            ...info,
            ast: simpleAST,
            type: type,
            source: source
          });
        }

        if (options.filterAttributes) {
          findOptions.attributes = Object.keys(fields)
            .map(key => fields[key].key || key)
            .filter(inList.bind(null, targetAttributes));

          if (options.defaultAttributes) {
            findOptions.attributes = findOptions.attributes.concat(options.defaultAttributes);
          }

        } else {
          findOptions.attributes = targetAttributes;
        }

        if (model.primaryKeyAttribute) {
          findOptions.attributes.push(model.primaryKeyAttribute);
        }

        return generateIncludes(
          simpleAST,
          type,
          context,
          options,
          join
        ).then(function (includeResult) {
          findOptions.include = includeResult.include;
          if (includeResult.order) {
            findOptions.order = (findOptions.order || []).concat(includeResult.order);
          }
          findOptions.attributes = _.uniq(findOptions.attributes.concat(includeResult.attributes));

          findOptions.root = context;
          findOptions.context = context;
          findOptions.logging = findOptions.logging || context.logging;

          return options.before(findOptions, args, context, {
            ...info,
            ast: simpleAST,
            type: type,
            source: source
          });
        }).then(function (findOptions) {
          if (list && !findOptions.order) {
            findOptions.order = [model.primaryKeyAttribute, 'ASC'];
          }

          if (association) {
            return source[association.accessors.get](findOptions).then(function (result) {
              if (options.handleConnection && isConnection(info.returnType)) {
                return handleConnection(result, args);
              }
              return result;
            });
          }

          return model[list ? 'findAll' : 'findOne'](findOptions);
        }).then(function (result) {
          return options.after(result, args, context, {
            ...info,
            ast: simpleAST,
            type: type,
            source: source
          });
        });
      }
    }

    return decorator(source, args, context, info, args.join ? joinResolver(args.join) : resolver(target, { before: options.before }));
  }

  if (association) {
    _resolver.$association = association;
  }

  _resolver.$before = options.before;
  _resolver.$after = options.after;
  _resolver.$options = options;

  return _resolver;
}

resolverFactory.filterAttributes = true;

module.exports = resolverFactory;
