"use strict";

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; var ownKeys = Object.keys(source); if (typeof Object.getOwnPropertySymbols === 'function') { ownKeys = ownKeys.concat(Object.getOwnPropertySymbols(source).filter(function (sym) { return Object.getOwnPropertyDescriptor(source, sym).enumerable; })); } ownKeys.forEach(function (key) { _defineProperty(target, key, source[key]); }); } return target; }

function _typeof(obj) { if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof = function _typeof(obj) { return typeof obj; }; } else { _typeof = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof(obj); }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

function asyncGeneratorStep(gen, resolve, reject, _next, _throw, key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { Promise.resolve(value).then(_next, _throw); } }

function _asyncToGenerator(fn) { return function () { var self = this, args = arguments; return new Promise(function (resolve, reject) { var gen = fn.apply(self, args); function _next(value) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "next", value); } function _throw(err) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "throw", err); } _next(undefined); }); }; }

function _toConsumableArray(arr) { return _arrayWithoutHoles(arr) || _iterableToArray(arr) || _nonIterableSpread(); }

function _nonIterableSpread() { throw new TypeError("Invalid attempt to spread non-iterable instance"); }

function _iterableToArray(iter) { if (Symbol.iterator in Object(iter) || Object.prototype.toString.call(iter) === "[object Arguments]") return Array.from(iter); }

function _arrayWithoutHoles(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = new Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } }

/* eslint-disable max-depth */
require('./jsdoc.def');

var _require = require('graphql'),
    GraphQLObjectType = _require.GraphQLObjectType,
    GraphQLInputObjectType = _require.GraphQLInputObjectType,
    GraphQLList = _require.GraphQLList,
    GraphQLInt = _require.GraphQLInt,
    GraphQLNonNull = _require.GraphQLNonNull,
    GraphQLString = _require.GraphQLString,
    GraphQLBoolean = _require.GraphQLBoolean,
    GraphQLEnumType = _require.GraphQLEnumType;

var _require2 = require('graphql-sequelize'),
    resolver = _require2.resolver,
    defaultListArgs = _require2.defaultListArgs,
    defaultArgs = _require2.defaultArgs,
    argsToFindOptions = _require2.argsToFindOptions,
    relay = _require2.relay;

var _require3 = require('graphql-subscriptions'),
    PubSub = _require3.PubSub,
    withFilter = _require3.withFilter;

var pubsub = new PubSub();

var Sequelize = require('sequelize');

var attributeFields = require('./graphql-sequelize/attributeFields');

var sequelizeConnection = relay.sequelizeConnection;

var camelCase = require('camelcase');

var remoteSchema = require('./remoteSchema');

var _require4 = require('graphql-request'),
    GraphQLClient = _require4.GraphQLClient;

var _ = require('lodash');

var _require5 = require('dataloader-sequelize'),
    createContext = _require5.createContext,
    EXPECTED_OPTIONS_KEY = _require5.EXPECTED_OPTIONS_KEY,
    resetCache = _require5.resetCache;

var TRANSACTION_NAMESPACE = 'sequelize-graphql-schema';

var cls = require('cls-hooked');

var uuid = require('uuid/v4');

var sequelizeNamespace = cls.createNamespace(TRANSACTION_NAMESPACE);
var dataloaderContext;
var options = {
  exclude: [],
  includeArguments: {},
  remote: {},
  dataloader: false,
  customTypes: [],
  transactionedMutations: true,
  privateMode: false,
  logger: function logger() {
    return Promise.resolve();
  },
  authorizer: function authorizer() {
    return Promise.resolve();
  },
  errorHandler: {
    'ETIMEDOUT': {
      statusCode: 503
    }
  }
};
/** @type {SeqGraphQL} */

var defaultModelGraphqlOptions = {
  attributes: {
    exclude: {
      // list attributes which are to be ignored in Model Input (exclusive filter)
      create: [],
      update: [],
      fetch: []
    },
    only: {
      // allow to use only listed attributes (inclusive filter, it ignores exclude option)
      create: null,
      update: null,
      fetch: null
    },
    include: {},
    // attributes in key:type format which are to be included in Model Input
    "import": []
  },
  scopes: null,
  alias: {},
  bulk: [],
  mutations: {},
  subscriptions: {},
  queries: {},
  excludeMutations: [],
  excludeSubscriptions: [],
  excludeQueries: [],
  extend: {},
  before: {},
  subsFilter: {},
  overwrite: {}
};
var Models = {};

var errorHandler = function errorHandler(error) {
  for (var name in options.errorHandler) {
    if (error.message.indexOf(name) > -1) {
      Object.assign(error, options.errorHandler[name]);
      break;
    }
  }

  return error;
};

var whereQueryVarsToValues = function whereQueryVarsToValues(o, vals) {
  [].concat(_toConsumableArray(Object.getOwnPropertyNames(o)), _toConsumableArray(Object.getOwnPropertySymbols(o))).forEach(function (k) {
    if (_.isFunction(o[k])) {
      o[k] = o[k](vals);
      return;
    }

    if (_.isObject(o[k])) {
      whereQueryVarsToValues(o[k], vals);
    }
  });
};

var getTypeByString = function getTypeByString(type) {
  var lType = type.toLowerCase();
  return lType === 'int' ? GraphQLInt : lType === 'boolean' ? GraphQLBoolean : lType === 'string' ? GraphQLString : options.customTypes[type] ? options.customTypes[type] : null;
};
/**
 * @typedef Name
 * @property {string} singular
 * @property {string} plural
 */

/**
 * @param {Name} name
 * @returns string
 */


var assocSuffix = function assocSuffix(model) {
  var plural = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;
  var asName = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : null;
  return _.upperFirst(asName ? asName : plural && !model.options.freezeTableName ? model.options.name.plural : model.options.name.singular);
};

var remoteResolver =
/*#__PURE__*/
function () {
  var _ref = _asyncToGenerator(
  /*#__PURE__*/
  regeneratorRuntime.mark(function _callee(source, args, context, info, remoteQuery, remoteArguments, type) {
    var availableArgs, pickedArgs, queryArgs, passedArgs, arg, fields, query, variables, key, headers, client, data;
    return regeneratorRuntime.wrap(function _callee$(_context) {
      while (1) {
        switch (_context.prev = _context.next) {
          case 0:
            availableArgs = _.keys(remoteQuery.args);
            pickedArgs = _.pick(remoteArguments, availableArgs);
            queryArgs = [];
            passedArgs = [];

            for (arg in pickedArgs) {
              queryArgs.push("$".concat(arg, ":").concat(pickedArgs[arg].type));
              passedArgs.push("".concat(arg, ":$").concat(arg));
            }

            fields = _.keys(type.getFields());
            query = "query ".concat(remoteQuery.name, "(").concat(queryArgs.join(', '), "){\n    ").concat(remoteQuery.name, "(").concat(passedArgs.join(', '), "){\n      ").concat(fields.join(', '), "\n    }\n  }");
            variables = _.pick(args, availableArgs);
            key = remoteQuery.to || 'id';

            if (_.indexOf(availableArgs, key) > -1 && !variables.where) {
              variables[key] = source[remoteQuery["with"]];
            } else if (_.indexOf(availableArgs, 'where') > -1) {
              variables.where = variables.where || {};
              variables.where[key] = source[remoteQuery["with"]];
            }

            headers = _.pick(context.headers, remoteQuery.headers);
            client = new GraphQLClient(remoteQuery.endpoint, {
              headers: headers
            });
            _context.next = 14;
            return client.request(query, variables);

          case 14:
            data = _context.sent;
            return _context.abrupt("return", data[remoteQuery.name]);

          case 16:
          case "end":
            return _context.stop();
        }
      }
    }, _callee);
  }));

  return function remoteResolver(_x, _x2, _x3, _x4, _x5, _x6, _x7) {
    return _ref.apply(this, arguments);
  };
}();

var getTypeName = function getTypeName(model, isInput, isUpdate, isAssoc) {
  return isInput ? model.name + (isUpdate ? 'Edit' : 'Add') + 'Input' + (isAssoc ? 'Connection' : '') : model.name;
};

var includeArguments = function includeArguments() {
  var includeArguments = {};

  for (var argument in options.includeArguments) {
    includeArguments[argument] = generateGraphQLField(options.includeArguments[argument]);
  }

  return includeArguments;
};

var defaultMutationArgs = function defaultMutationArgs() {
  return {
    set: {
      type: GraphQLBoolean,
      description: 'If true, all relations use \'set\' operation instead of \'add\', destroying existing'
    },
    transaction: {
      type: GraphQLBoolean,
      description: 'Enable transaction for this operation and all its nested'
    }
  };
};

var execBefore = function execBefore(model, source, args, context, info, type, where) {
  if (model.graphql && _.has(model.graphql, 'before') && _.has(model.graphql.before, type)) {
    return model.graphql.before[type](source, args, context, info, where);
  }

  return Promise.resolve();
};

var findOneRecord = function findOneRecord(model, where) {
  if (where) {
    return model.findOne({
      where: where
    });
  }

  return Promise.resolve();
};

var queryResolver = function queryResolver(model) {
  var isAssoc = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;
  var field = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : null;
  var assocModel = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : null;
  return (
    /*#__PURE__*/
    function () {
      var _ref2 = _asyncToGenerator(
      /*#__PURE__*/
      regeneratorRuntime.mark(function _callee2(source, args, context, info) {
        var _model, type, before, scope, data, modelNode, _resolver;

        return regeneratorRuntime.wrap(function _callee2$(_context2) {
          while (1) {
            switch (_context2.prev = _context2.next) {
              case 0:
                if (args.where) whereQueryVarsToValues(args.where, info.variableValues);
                _model = !field && isAssoc && model.target ? model.target : model;
                type = 'fetch'; // authorization should not be executed for nested queries

                if (isAssoc) {
                  _context2.next = 6;
                  break;
                }

                _context2.next = 6;
                return options.authorizer(source, args, context, info);

              case 6:
                if (!_.has(_model.graphql.overwrite, type)) {
                  _context2.next = 8;
                  break;
                }

                return _context2.abrupt("return", _model.graphql.overwrite[type](source, args, context, info));

              case 8:
                _context2.next = 10;
                return execBefore(_model, source, args, context, info, type);

              case 10:
                before = function before(findOptions, args, context, info) {
                  var orderArgs = args.order || '';
                  var orderBy = [];

                  if (orderArgs != '') {
                    var orderByClauses = orderArgs.split(',');
                    orderByClauses.forEach(function (clause) {
                      if (clause.indexOf('reverse:') === 0) {
                        orderBy.push([clause.substring(8), 'DESC']);
                      } else {
                        orderBy.push([clause, 'ASC']);
                      }
                    });
                  }

                  if (args.orderEdges) {
                    var _orderByClauses = args.orderEdges.split(',');

                    _orderByClauses.forEach(function (clause) {
                      var colName = '`' + model.through.model.name + '`.`' + (clause.indexOf('reverse:') === 0 ? clause.substring(8) : clause) + '`';
                      orderBy.push([Sequelize.col(colName), clause.indexOf('reverse:') === 0 ? 'DESC' : 'ASC']);
                    });
                  }

                  findOptions.order = orderBy;

                  if (args.whereEdges) {
                    if (!findOptions.where) findOptions.where = {};

                    for (var key in args.whereEdges) {
                      if (_.has(args.whereEdges, key)) {
                        whereQueryVarsToValues(args.whereEdges, info.variableValues);
                        var colName = '`' + model.through.model.name + '`.`' + key + '`';
                        findOptions.where[colName] = Sequelize.where(Sequelize.col(colName), args.whereEdges[key]);
                      }
                    }
                  }

                  findOptions.paranoid = args.where && args.where.deletedAt && args.where.deletedAt.ne === null || args.paranoid === false ? false : _model.options.paranoid;
                  return findOptions;
                };

                scope = Array.isArray(_model.graphql.scopes) ? {
                  method: [_model.graphql.scopes[0], _.get(args, _model.graphql.scopes[1], _model.graphql.scopes[2] || null)]
                } : _model.graphql.scopes;

                if (!field) {
                  _context2.next = 17;
                  break;
                }

                modelNode = source.node[_model.name];
                data = modelNode[field];
                _context2.next = 20;
                break;

              case 17:
                _context2.next = 19;
                return resolver(model instanceof Sequelize.Model ? model.scope(scope) : model, (_resolver = {}, _defineProperty(_resolver, EXPECTED_OPTIONS_KEY, dataloaderContext), _defineProperty(_resolver, "before", before), _defineProperty(_resolver, "separate", isAssoc), _resolver))(source, args, context, info);

              case 19:
                data = _context2.sent;

              case 20:
                // little trick to pass args
                // on source params for connection fields
                if (data) {
                  data.__args = args;
                  data.__parent = source;
                }

                if (!_.has(_model.graphql.extend, type)) {
                  _context2.next = 23;
                  break;
                }

                return _context2.abrupt("return", _model.graphql.extend[type](data, source, args, context, info));

              case 23:
                return _context2.abrupt("return", data);

              case 24:
              case "end":
                return _context2.stop();
            }
          }
        }, _callee2);
      }));

      return function (_x8, _x9, _x10, _x11) {
        return _ref2.apply(this, arguments);
      };
    }()
  );
};

var mutationResolver =
/*#__PURE__*/
function () {
  var _ref3 = _asyncToGenerator(
  /*#__PURE__*/
  regeneratorRuntime.mark(function _callee7(model, inputTypeName, mutationName, source, args, context, info, type, where, isBulk) {
    var preData, operationType, validate, bulkAddId, data, operation, createAssoc;
    return regeneratorRuntime.wrap(function _callee7$(_context8) {
      while (1) {
        switch (_context8.prev = _context8.next) {
          case 0:
            if (args.where) whereQueryVarsToValues(args.where, info.variableValues);
            if (where) whereQueryVarsToValues(where, info.variableValues);
            _context8.next = 4;
            return options.authorizer(source, args, context, info);

          case 4:
            _context8.next = 6;
            return findOneRecord(model, type === 'destroy' || type === 'update' ? where : null);

          case 6:
            preData = _context8.sent;
            operationType = isBulk && type === 'create' ? 'bulkCreate' : type;
            validate = true;

            if (typeof isBulk === 'string' && args[inputTypeName].length && !args[inputTypeName][0][isBulk]) {
              bulkAddId = uuid();
              args[inputTypeName].forEach(function (input) {
                input[isBulk] = bulkAddId;
              });
            }

            data = {};

            operation =
            /*#__PURE__*/
            function () {
              var _ref4 = _asyncToGenerator(
              /*#__PURE__*/
              regeneratorRuntime.mark(function _callee4(opType, _model, _source, _args, name, assocInst, sourceInst, transaction) {
                var toDestroy,
                    hookType,
                    finalize,
                    res,
                    _name,
                    _op,
                    updWhere,
                    k,
                    pk,
                    _inst,
                    _args5 = arguments;

                return regeneratorRuntime.wrap(function _callee4$(_context4) {
                  while (1) {
                    switch (_context4.prev = _context4.next) {
                      case 0:
                        toDestroy = _args5.length > 8 && _args5[8] !== undefined ? _args5[8] : null;
                        hookType = opType == 'set' ? 'update' : type;

                        if (!(_model.graphql && _.has(_model.graphql.overwrite, hookType))) {
                          _context4.next = 4;
                          break;
                        }

                        return _context4.abrupt("return", _model.graphql.overwrite[hookType](_source, _args, context, info, where));

                      case 4:
                        _context4.next = 6;
                        return execBefore(_model, _source, _args, context, info, hookType, where);

                      case 6:
                        finalize =
                        /*#__PURE__*/
                        function () {
                          var _ref5 = _asyncToGenerator(
                          /*#__PURE__*/
                          regeneratorRuntime.mark(function _callee3(res) {
                            var _data, subsData, mutationType;

                            return regeneratorRuntime.wrap(function _callee3$(_context3) {
                              while (1) {
                                switch (_context3.prev = _context3.next) {
                                  case 0:
                                    _data = {};

                                    if (!((opType === 'create' || opType === 'update' || opType === 'upsert') && !isBulk)) {
                                      _context3.next = 5;
                                      break;
                                    }

                                    _context3.next = 4;
                                    return createAssoc(_model, res, _args[name], transaction);

                                  case 4:
                                    _data = _context3.sent;

                                  case 5:
                                    if (!_.has(_model.graphql.extend, hookType)) {
                                      _context3.next = 7;
                                      break;
                                    }

                                    return _context3.abrupt("return", _model.graphql.extend[hookType](type === 'destroy' ? preData : res, _source, _args, context, info, where));

                                  case 7:
                                    res = Object.assign(res, _data);
                                    subsData = type === 'destroy' ? preData : res;
                                    _context3.t0 = type;
                                    _context3.next = _context3.t0 === 'create' ? 12 : _context3.t0 === 'destroy' ? 14 : _context3.t0 === 'update' ? 16 : _context3.t0 === 'upsert' ? 16 : 18;
                                    break;

                                  case 12:
                                    mutationType = isBulk ? 'BULK_CREATED' : 'CREATED';
                                    return _context3.abrupt("break", 19);

                                  case 14:
                                    mutationType = 'DELETED';
                                    return _context3.abrupt("break", 19);

                                  case 16:
                                    mutationType = 'UPDATED';
                                    return _context3.abrupt("break", 19);

                                  case 18:
                                    return _context3.abrupt("break", 19);

                                  case 19:
                                    pubsub.publish(mutationName, {
                                      mutation: mutationType,
                                      node: subsData,
                                      previousValues: preData // updatedFields: [] // TODO: implement

                                    });
                                    return _context3.abrupt("return", res);

                                  case 21:
                                  case "end":
                                    return _context3.stop();
                                }
                              }
                            }, _callee3);
                          }));

                          return function finalize(_x30) {
                            return _ref5.apply(this, arguments);
                          };
                        }();

                        if (!(opType == 'add' || opType == 'set')) {
                          _context4.next = 13;
                          break;
                        }

                        if (_source.through && _source.through.model) {
                          delete _args[name][_source.target.name];
                          delete _args[name][_source.foreignIdentifierField];
                          _name = assocSuffix(_source.target, ['BelongsTo', 'HasOne'].indexOf(_source.associationType) < 0, _source.as);
                          _op = opType + _name;
                        } else {
                          _name = assocSuffix(_model, ['BelongsTo', 'HasOne'].indexOf(_source.associationType) < 0, _source.as);
                          _op = opType + _name;
                        }

                        _context4.next = 11;
                        return sourceInst[_op](assocInst, opType == 'add' ? {
                          through: _args[name],
                          transaction: transaction
                        } : {
                          transaction: transaction
                        });

                      case 11:
                        res = _context4.sent;
                        return _context4.abrupt("return", finalize(res));

                      case 13:
                        updWhere = {};
                        _context4.t0 = opType;
                        _context4.next = _context4.t0 === 'upsert' ? 17 : _context4.t0 === 'update' ? 29 : 31;
                        break;

                      case 17:
                        _context4.t1 = regeneratorRuntime.keys(_model.primaryKeyAttributes);

                      case 18:
                        if ((_context4.t2 = _context4.t1()).done) {
                          _context4.next = 28;
                          break;
                        }

                        k = _context4.t2.value;
                        pk = _model.primaryKeyAttributes[k]; // not association case

                        if (_args[name][pk]) {
                          _context4.next = 25;
                          break;
                        }

                        opType = 'create';
                        updWhere = where;
                        return _context4.abrupt("break", 28);

                      case 25:
                        updWhere[pk] = _args[name][pk];
                        _context4.next = 18;
                        break;

                      case 28:
                        return _context4.abrupt("break", 32);

                      case 29:
                        updWhere = where;
                        return _context4.abrupt("break", 32);

                      case 31:
                        return _context4.abrupt("break", 32);

                      case 32:
                        // allow destroy on instance if specified
                        _inst = toDestroy && opType == 'destroy' ? toDestroy : _model;
                        _context4.next = 35;
                        return _inst[opType](opType === 'destroy' ? {
                          where: where,
                          transaction: transaction
                        } : _args[name], {
                          where: where,
                          validate: validate,
                          transaction: transaction
                        });

                      case 35:
                        res = _context4.sent;

                        if (!(opType !== 'create' && opType !== 'destroy')) {
                          _context4.next = 42;
                          break;
                        }

                        _context4.t3 = finalize;
                        _context4.next = 40;
                        return _model.findOne({
                          where: updWhere,
                          transaction: transaction
                        });

                      case 40:
                        _context4.t4 = _context4.sent;
                        return _context4.abrupt("return", (0, _context4.t3)(_context4.t4));

                      case 42:
                        return _context4.abrupt("return", finalize(res));

                      case 43:
                      case "end":
                        return _context4.stop();
                    }
                  }
                }, _callee4);
              }));

              return function operation(_x22, _x23, _x24, _x25, _x26, _x27, _x28, _x29) {
                return _ref4.apply(this, arguments);
              };
            }();

            createAssoc =
            /*#__PURE__*/
            function () {
              var _ref6 = _asyncToGenerator(
              /*#__PURE__*/
              regeneratorRuntime.mark(function _callee6(_source, _sourceInst, _args, transaction) {
                var _data, processAssoc, _loop, name, _ret;

                return regeneratorRuntime.wrap(function _callee6$(_context7) {
                  while (1) {
                    switch (_context7.prev = _context7.next) {
                      case 0:
                        _data = {};

                        processAssoc =
                        /*#__PURE__*/
                        function () {
                          var _ref7 = _asyncToGenerator(
                          /*#__PURE__*/
                          regeneratorRuntime.mark(function _callee5(aModel, name, fields, isList) {
                            var _a2, _a, _model3, fkName, crObj, fkVal, _at2, _at, node, _data3, edge, _data2, _model2, newInst;

                            return regeneratorRuntime.wrap(function _callee5$(_context5) {
                              while (1) {
                                switch (_context5.prev = _context5.next) {
                                  case 0:
                                    if (!(_typeof(fields) === 'object' && aModel)) {
                                      _context5.next = 35;
                                      break;
                                    }

                                    _a = (_a2 = {}, _defineProperty(_a2, name, fields), _defineProperty(_a2, "transaction", transaction), _a2);

                                    if (!(aModel.associationType === 'BelongsToMany')) {
                                      _context5.next = 28;
                                      break;
                                    }

                                    _model3 = aModel.through.model;
                                    fkName = aModel.foreignIdentifierField;
                                    crObj = fields[aModel.target.name];
                                    fkVal = fields[fkName];

                                    if (!(crObj && fkVal)) {
                                      _context5.next = 11;
                                      break;
                                    }

                                    return _context5.abrupt("return", Promise.reject(new Error("Cannot define both foreignKey for association (".concat(fkVal, ") AND Instance for creation (").concat(crObj, ") in your mutation!"))));

                                  case 11:
                                    if (!(!crObj && !fkVal)) {
                                      _context5.next = 13;
                                      break;
                                    }

                                    return _context5.abrupt("return", Promise.reject(new Error("You must specify foreignKey for association (".concat(fkName, ") OR Instance for creation (").concat(aModel.target.name, ") in your mutation!"))));

                                  case 13:
                                    if (!crObj) {
                                      _context5.next = 24;
                                      break;
                                    }

                                    _at = (_at2 = {}, _defineProperty(_at2, aModel.target.name, crObj), _defineProperty(_at2, "transaction", transaction), _at2);
                                    _context5.next = 17;
                                    return operation(operationType === 'update' ? 'upsert' : 'create', aModel.target, _model3, _at, aModel.target.name, null, _sourceInst, transaction);

                                  case 17:
                                    node = _context5.sent;
                                    _context5.next = 20;
                                    return operation('add', _model3, aModel, _a, name, node, _sourceInst, transaction);

                                  case 20:
                                    _data3 = _context5.sent;
                                    edge = _data3[0][0];
                                    edge[aModel.target.name] = node;
                                    return _context5.abrupt("return", _defineProperty({}, _model3.name, edge));

                                  case 24:
                                    _context5.next = 26;
                                    return operation('add', _model3, aModel, _a, name, fkVal, _sourceInst, transaction);

                                  case 26:
                                    _data2 = _context5.sent;
                                    return _context5.abrupt("return", _defineProperty({}, _model3.name, _data2[0][0]));

                                  case 28:
                                    _model2 = aModel.target;
                                    _context5.next = 31;
                                    return operation(operationType === 'update' ? 'upsert' : 'create', _model2, aModel.target, _a, name, {}, _sourceInst, transaction);

                                  case 31:
                                    newInst = _context5.sent;
                                    _context5.next = 34;
                                    return operation(aModel.associationType === 'BelongsTo' ? 'set' : 'add', _model2, aModel, _a, name, newInst, _sourceInst, transaction);

                                  case 34:
                                    return _context5.abrupt("return", newInst);

                                  case 35:
                                    return _context5.abrupt("return", null);

                                  case 36:
                                  case "end":
                                    return _context5.stop();
                                }
                              }
                            }, _callee5);
                          }));

                          return function processAssoc(_x35, _x36, _x37, _x38) {
                            return _ref7.apply(this, arguments);
                          };
                        }();

                        _loop =
                        /*#__PURE__*/
                        regeneratorRuntime.mark(function _loop(name) {
                          var aModel, _refModel, _name, _getOp, assoc, toUpdate, v, k, _op, p, obj, newInst, _newInst;

                          return regeneratorRuntime.wrap(function _loop$(_context6) {
                            while (1) {
                              switch (_context6.prev = _context6.next) {
                                case 0:
                                  if (_source.associations) {
                                    _context6.next = 2;
                                    break;
                                  }

                                  return _context6.abrupt("return", "continue");

                                case 2:
                                  aModel = _source.associations[name];

                                  if (!Array.isArray(_args[name])) {
                                    _context6.next = 47;
                                    break;
                                  }

                                  _data[name] = [];

                                  if (!(args['set'] == true)) {
                                    _context6.next = 35;
                                    break;
                                  }

                                  _refModel = _source.through && _source.through.model ? _source.target : aModel.target;
                                  _name = assocSuffix(_refModel, true, aModel.as);

                                  if (!(aModel.associationType === 'HasMany' || aModel.associationType === 'HasOne')) {
                                    _context6.next = 32;
                                    break;
                                  }

                                  // we cannot use set() to remove because of a bug: https://github.com/sequelize/sequelize/issues/8588
                                  _getOp = 'get' + _name; // eslint-disable-next-line no-await-in-loop

                                  _context6.next = 12;
                                  return _sourceInst[_getOp]({
                                    transaction: transaction
                                  });

                                case 12:
                                  assoc = _context6.sent;

                                  if (!assoc) {
                                    _context6.next = 30;
                                    break;
                                  }

                                  toUpdate = function toUpdate(inst) {
                                    for (var p in _args[name]) {
                                      var obj = _args[name][p];
                                      var found = void 0;

                                      for (var k in aModel.target.primaryKeyAttributes) {
                                        found = true;
                                        var pk = aModel.target.primaryKeyAttributes[k];

                                        if (obj[pk] != inst[pk]) {
                                          found = false;
                                          break;
                                        }
                                      }

                                      if (found) {
                                        return true;
                                      }
                                    }

                                    return false;
                                  };

                                  if (!_.isArray(assoc)) {
                                    _context6.next = 27;
                                    break;
                                  }

                                  _context6.t0 = regeneratorRuntime.keys(assoc);

                                case 17:
                                  if ((_context6.t1 = _context6.t0()).done) {
                                    _context6.next = 25;
                                    break;
                                  }

                                  k = _context6.t1.value;
                                  v = assoc[k]; // eslint-disable-next-line max-depth

                                  if (toUpdate(v)) {
                                    _context6.next = 23;
                                    break;
                                  }

                                  _context6.next = 23;
                                  return operation('destroy', aModel.target, _source, [], null, null, _sourceInst, transaction, v);

                                case 23:
                                  _context6.next = 17;
                                  break;

                                case 25:
                                  _context6.next = 30;
                                  break;

                                case 27:
                                  if (toUpdate(assoc)) {
                                    _context6.next = 30;
                                    break;
                                  }

                                  _context6.next = 30;
                                  return operation('destroy', aModel.target, _source, [], null, null, _sourceInst, transaction, v);

                                case 30:
                                  _context6.next = 35;
                                  break;

                                case 32:
                                  _op = 'set' + _name; // eslint-disable-next-line no-await-in-loop

                                  _context6.next = 35;
                                  return _sourceInst[_op]([], {
                                    transaction: transaction
                                  });

                                case 35:
                                  _context6.t2 = regeneratorRuntime.keys(_args[name]);

                                case 36:
                                  if ((_context6.t3 = _context6.t2()).done) {
                                    _context6.next = 45;
                                    break;
                                  }

                                  p = _context6.t3.value;
                                  obj = _args[name][p]; // eslint-disable-next-line no-await-in-loop

                                  _context6.next = 41;
                                  return processAssoc(aModel, name, obj, true);

                                case 41:
                                  newInst = _context6.sent;

                                  if (newInst) {
                                    _data[name].push(newInst);
                                  }

                                  _context6.next = 36;
                                  break;

                                case 45:
                                  _context6.next = 51;
                                  break;

                                case 47:
                                  _context6.next = 49;
                                  return processAssoc(aModel, name, _args[name], false);

                                case 49:
                                  _newInst = _context6.sent;

                                  if (_newInst) {
                                    _data[name] = _newInst;
                                  }

                                case 51:
                                case "end":
                                  return _context6.stop();
                              }
                            }
                          }, _loop);
                        });
                        _context7.t0 = regeneratorRuntime.keys(_args);

                      case 4:
                        if ((_context7.t1 = _context7.t0()).done) {
                          _context7.next = 12;
                          break;
                        }

                        name = _context7.t1.value;
                        return _context7.delegateYield(_loop(name), "t2", 7);

                      case 7:
                        _ret = _context7.t2;

                        if (!(_ret === "continue")) {
                          _context7.next = 10;
                          break;
                        }

                        return _context7.abrupt("continue", 4);

                      case 10:
                        _context7.next = 4;
                        break;

                      case 12:
                        return _context7.abrupt("return", _data);

                      case 13:
                      case "end":
                        return _context7.stop();
                    }
                  }
                }, _callee6);
              }));

              return function createAssoc(_x31, _x32, _x33, _x34) {
                return _ref6.apply(this, arguments);
              };
            }();

            if (!args['transaction']) {
              _context8.next = 19;
              break;
            }

            _context8.next = 16;
            return Models.sequelize.transaction(function (transaction) {
              context.transaction = transaction;
              return operation(operationType, model, source, args, inputTypeName, null, null, transaction);
            });

          case 16:
            data = _context8.sent;
            _context8.next = 22;
            break;

          case 19:
            _context8.next = 21;
            return operation(operationType, model, source, args, inputTypeName, null, null);

          case 21:
            data = _context8.sent;

          case 22:
            _context8.next = 24;
            return options.logger(data, source, args, context, info);

          case 24:
            if (!isBulk) {
              _context8.next = 26;
              break;
            }

            return _context8.abrupt("return", args[inputTypeName].length);

          case 26:
            return _context8.abrupt("return", type == 'destroy' ? parseInt(data) : data);

          case 27:
          case "end":
            return _context8.stop();
        }
      }
    }, _callee7);
  }));

  return function mutationResolver(_x12, _x13, _x14, _x15, _x16, _x17, _x18, _x19, _x20, _x21) {
    return _ref3.apply(this, arguments);
  };
}();

var subscriptionResolver = function subscriptionResolver(model) {
  return (
    /*#__PURE__*/
    function () {
      var _ref10 = _asyncToGenerator(
      /*#__PURE__*/
      regeneratorRuntime.mark(function _callee8(data, args, context, info) {
        var subData;
        return regeneratorRuntime.wrap(function _callee8$(_context9) {
          while (1) {
            switch (_context9.prev = _context9.next) {
              case 0:
                if (args.where) whereQueryVarsToValues(args.where, info.variableValues);

                if (!_.has(model.graphql.extend, 'subscription')) {
                  _context9.next = 6;
                  break;
                }

                _context9.next = 4;
                return model.graphql.extend['subscription'](data, null, args, context, info, null);

              case 4:
                subData = _context9.sent;
                return _context9.abrupt("return", subData);

              case 6:
                return _context9.abrupt("return", data);

              case 7:
              case "end":
                return _context9.stop();
            }
          }
        }, _callee8);
      }));

      return function (_x39, _x40, _x41, _x42) {
        return _ref10.apply(this, arguments);
      };
    }()
  );
};

function fixIds(model, fields, assoc, source, isUpdate) {
  var newId = function newId(modelName) {
    var allowNull = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;
    return {
      name: 'id',
      description: "The ID for ".concat(modelName),
      type: allowNull ? GraphQLInt : new GraphQLNonNull(GraphQLInt)
    };
  }; // Fix Relay ID


  var rawAttributes = model.rawAttributes;

  _.each(Object.keys(rawAttributes), function (key) {
    if (key === 'clientMutationId') {
      return;
    } // Check if reference attribute


    var attr = rawAttributes[key];

    if (!attr) {
      return;
    }

    if (attr.references) {
      var modelName = attr.references.model;
      fields[key] = newId(modelName, isUpdate || assoc || attr.allowNull);
    } else if (attr.autoIncrement) {
      // Make autoIncrement fields optional (allowNull=True)
      fields[key] = newId(model.name, true);
    }
  });
}

var sanitizeFieldName = function sanitizeFieldName(type) {
  var isRequired = type.indexOf('!') > -1;
  var isArray = type.indexOf('[') > -1;
  type = type.replace('[', '');
  type = type.replace(']', '');
  type = type.replace('!', '');
  return {
    type: type,
    isArray: isArray,
    isRequired: isRequired
  };
};

var generateGraphQLField = function generateGraphQLField(type) {
  var typeReference = sanitizeFieldName(type);
  var field = getTypeByString(typeReference.type);
  if (!field) field = GraphQLString;
  if (typeReference.isArray) field = new GraphQLList(field);
  if (typeReference.isRequired) field = GraphQLNonNull(field);
  return {
    type: field
  };
};

var toGraphQLType = function toGraphQLType(name, schema) {
  var _fields = {};

  for (var field in schema) {
    _fields[field] = generateGraphQLField(schema[field]);
  }

  return new GraphQLObjectType({
    name: name,
    fields: function fields() {
      return _fields;
    }
  });
};

var generateTypesFromObject = function generateTypesFromObject(remoteData) {
  var types = {};
  var queries = [];
  remoteData.forEach(function (item) {
    for (var type in item.types) {
      types[type] = toGraphQLType(type, item.types[type]);
    }

    item.queries.forEach(function (query) {
      var args = {};

      for (var arg in query.args) {
        args[arg] = generateGraphQLField(query.args[arg]);
      }

      query.args = args;
    });
    queries = queries.concat(item.queries);
  });
  return {
    types: types,
    queries: queries
  };
};

function getBulkOption(options, key) {
  var bulkOption = options.filter(function (option) {
    return Array.isArray(option) ? option[0] == key : option == key;
  });
  return bulkOption.length ? Array.isArray(bulkOption[0]) ? bulkOption[0][1] : true : false;
}
/**
 * Returns the association fields of an entity.
 *
 * It iterates over all the associations and produces an object compatible with GraphQL-js.
 * BelongsToMany and HasMany associations are represented as a `GraphQLList` whereas a BelongTo
 * is simply an instance of a type.
 * @param {*} associations A collection of sequelize associations
 * @param {*} types Existing `GraphQLObjectType` types, created from all the Sequelize models
 */


var generateAssociationFields = function generateAssociationFields(model, associations, types, cache) {
  var isInput = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : false;
  var isUpdate = arguments.length > 5 && arguments[5] !== undefined ? arguments[5] : false;
  var assoc = arguments.length > 6 && arguments[6] !== undefined ? arguments[6] : null;
  var source = arguments.length > 7 && arguments[7] !== undefined ? arguments[7] : null;
  var fields = {};

  var buildAssoc = function buildAssoc(assocModel, relation, associationType, associationName) {
    var foreign = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : false;

    if (!types[assocModel.name]) {
      //if (assocModel != source) { // avoid circular loop
      types[assocModel.name] = generateGraphQLType(assocModel, types, cache, isInput, isUpdate, assocModel, source); //} else
      //  return fields;
    }

    if (!associationName) // edge case
      return false; // BelongsToMany is represented as a list, just like HasMany

    var type = associationType === 'BelongsToMany' || associationType === 'HasMany' ? new GraphQLList(types[assocModel.name]) : types[assocModel.name];
    fields[associationName] = {
      type: type
    };

    if (isInput) {
      if (associationType === 'BelongsToMany') {
        var _aModel = relation.through.model;
        if (!_aModel.graphql) _aModel.graphql = defaultModelGraphqlOptions; // if n:m join table, we have to create the connection input type for it

        var _name = getTypeName(_aModel, isInput, false, true);

        if (!types[_name]) {
          var gqlType = generateGraphQLType(_aModel, types, cache, isInput, false, assocModel, model);
          gqlType.name = _name;
          types[_name] = new GraphQLList(gqlType);
        }

        fields[associationName].type = types[_name];
      }
    } else if (!relation.isRemote) {
      // 1:1 doesn't need connectionFields
      if (['BelongsTo', 'HasOne'].indexOf(associationType) < 0) {
        var edgeFields = {};

        if (associationType === 'BelongsToMany') {
          var _aModel2 = relation.through.model;
          if (!_aModel2.graphql) _aModel2.graphql = defaultModelGraphqlOptions;
          var exclude = _aModel2.graphql.attributes.exclude;
          exclude = Array.isArray(exclude) ? exclude : exclude['fetch'];
          var only = _aModel2.graphql.attributes.only;
          only = Array.isArray(only) ? only : only['fetch'];
          edgeFields = Object.assign(attributeFields(_aModel2, {
            exclude: exclude,
            only: only,
            commentToDescription: true,
            cache: cache
          }), types[assocModel.name].args); // Pass Through model to resolve function

          _.each(edgeFields, function (edgeField, field) {
            edgeField.resolve = queryResolver(_aModel2, true, field);
          });
        }

        var connection = sequelizeConnection({
          name: model.name + associationName,
          nodeType: types[assocModel.name],
          target: relation,
          connectionFields: {
            total: {
              type: new GraphQLNonNull(GraphQLInt),
              description: "Total count of ".concat(assocModel.name, " results associated with ").concat(model.name, " with all filters applied."),
              resolve: function resolve(source, args, context, info) {
                return source.edges.length;
              }
            },
            count: {
              type: new GraphQLNonNull(GraphQLInt),
              description: "Total count of ".concat(assocModel.name, " results associated with ").concat(model.name, " without limits applied."),
              resolve: function resolve(source, args, context, info) {
                if (!source.__parent) return 0;

                var _args = argsToFindOptions["default"](source.__args);

                var where = _args['where'];
                var suffix = assocSuffix(assocModel, ['BelongsTo', 'HasOne'].indexOf(associationType) < 0, associationName);
                return source.__parent['count' + suffix]({
                  where: where
                });
              }
            }
          },
          edgeFields: edgeFields
        });
        connection.resolve = queryResolver(relation, true, null, assocModel);
        fields[associationName].type = connection.connectionType;
        fields[associationName].args = Object.assign(defaultArgs(relation), defaultListArgs(), {
          whereEdges: defaultListArgs().where,
          orderEdges: defaultListArgs().order
        }, connection.connectionArgs);
        fields[associationName].resolve = connection.resolve;
      } else {
        // GraphQLInputObjectType do not accept fields with resolve
        fields[associationName].args = Object.assign(defaultArgs(relation), defaultListArgs(), types[assocModel.name].args);
        fields[associationName].resolve = queryResolver(relation, true);
      }
    } else {
      fields[associationName].args = Object.assign({}, relation.query.args, defaultListArgs());

      fields[associationName].resolve = function (source, args, context, info) {
        return remoteResolver(source, args, context, info, relation.query, fields[associationName].args, types[assocModel.name]);
      };
    }

    return false;
  };

  for (var associationName in associations) {
    var relation = associations[associationName];
    var res = buildAssoc(relation.target, relation, relation.associationType, associationName);
    if (res) return res;
  } //Discovers hidden relations that are implicit created
  // (for example for join table in n:m case)


  var rawAttributes = model.rawAttributes;

  for (var key in rawAttributes) {
    if (key === 'clientMutationId') {
      return;
    }

    var attr = rawAttributes[key];

    if (attr && attr.references) {
      var modelName = attr.references.model;
      var assocModel = model.sequelize.modelManager.getModel(modelName, {
        attribute: 'tableName'
      }); // TODO: improve it or ask sequelize community to fix it
      // ISSUE: belongsToMany
      // when you have to create the association resolvers for
      // a model used as "through" for n:m relation
      // our library cannot find the correct information
      // since the association from "through" table to the target
      // is not created by Sequelize. So we've to create it here
      // to allow graphql-sequelize understand how to build the query.
      // example of the issue:
      // tableA belongsToMany tableB (through tableC)
      // tableC doesn't belongsTo tableB and tableA
      // so graphql-sequelize resolver is not able to understand how to
      // build the query.
      // HACK-FIX(?):

      if (!model.associations[assocModel.name]) {
        model.belongsTo(assocModel, {
          foreignKey: attr.field
        });
      }

      var reference = model.associations[assocModel.name];
      buildAssoc(assocModel, reference, 'BelongsTo', reference.name || reference.as, true);
    }
  }

  return fields;
};

var generateIncludeAttributes = function generateIncludeAttributes(model, types) {
  var isInput = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;
  var includeAttributes = {};

  if (model.graphql.attributes.include) {
    for (var attribute in model.graphql.attributes.include) {
      var type = null;
      var typeName = model.graphql.attributes.include[attribute] + (isInput ? 'Input' : '');

      if (types && types[typeName]) {
        type = {
          type: types[typeName]
        };
      }

      if (!type && model.graphql.types && model.graphql.types[typeName]) {
        type = generateGraphQLField(model.graphql.types[typeName]);
      }

      includeAttributes[attribute] = type || generateGraphQLField(typeName);
    }
  }

  return includeAttributes;
};

var generateGraphQLFields = function generateGraphQLFields(model, types, cache) {
  var isInput = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : false;
  var isUpdate = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : false;
  var assoc = arguments.length > 5 && arguments[5] !== undefined ? arguments[5] : null;
  var source = arguments.length > 6 && arguments[6] !== undefined ? arguments[6] : null;
  var exclude = model.graphql.attributes.exclude;
  exclude = Array.isArray(exclude) ? exclude : exclude[!isInput ? 'fetch' : isUpdate ? 'update' : 'create'];
  var only = model.graphql.attributes.only;
  only = Array.isArray(only) ? only : only[!isInput ? 'fetch' : isUpdate ? 'update' : 'create'];
  var fields = Object.assign(attributeFields(model, Object.assign({}, {
    exclude: exclude,
    only: only,
    allowNull: !isInput || isUpdate,
    checkDefaults: isInput,
    commentToDescription: true,
    cache: cache
  })), generateAssociationFields(model, model.associations, types, cache, isInput, isUpdate, assoc, source), generateIncludeAttributes(model, types, isInput));

  if (assoc && (model.name == assoc.name && model.associations[assoc.name] || model.name != assoc.name)) {
    if (!types[assoc.name]) {
      types[assoc.name] = generateGraphQLType(assoc, types, cache, isInput, isUpdate, assoc, source);
    }

    fields[assoc.name] = {
      name: getTypeName(assoc, isInput, isUpdate, false),
      type: types[assoc.name]
    };
  }

  fields['_SeqGQLMeta'] = {
    type: GraphQLString
  };

  if (isInput) {
    fixIds(model, fields, assoc, source, isUpdate); // FIXME: Handle timestamps
    // console.log('_timestampAttributes', Model._timestampAttributes);

    delete fields.createdAt;
    delete fields.updatedAt;
  }

  return fields;
};
/**
 * Returns a new `GraphQLObjectType` created from a sequelize model.
 *
 * It creates a `GraphQLObjectType` object with a name and fields. The
 * fields are generated from its sequelize associations.
 * @param {*} model The sequelize model used to create the `GraphQLObjectType`
 * @param {*} types Existing `GraphQLObjectType` types, created from all the Sequelize models
 */


var generateGraphQLType = function generateGraphQLType(model, types, cache) {
  var isInput = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : false;
  var isUpdate = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : false;
  var assoc = arguments.length > 5 && arguments[5] !== undefined ? arguments[5] : null;
  var source = arguments.length > 6 && arguments[6] !== undefined ? arguments[6] : null;
  var GraphQLClass = isInput ? GraphQLInputObjectType : GraphQLObjectType;

  var thunk = function thunk() {
    return generateGraphQLFields(model, types, cache, isInput, isUpdate, assoc, source);
  };

  var fields = assoc ? thunk : thunk();
  var name = getTypeName(model, isInput, isUpdate, assoc); // can be already created by generateGraphQLFields recursion

  if (types[model.name] && types[model.name].name == name) return types[model.name];
  return new GraphQLClass({
    name: name,
    fields: fields
  });
}; // eslint-disable-next-line no-unused-vars


var getCustomType = function getCustomType(model, type, customTypes, isInput) {
  var ignoreInputCheck = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : false;
  var _fields2 = {};

  if (typeof model.graphql.types[type] === 'string') {
    return generateGraphQLField(model.graphql.types[type]);
  }

  for (var field in model.graphql.types[type]) {
    var fieldReference = sanitizeFieldName(model.graphql.types[type][field]);

    if (customTypes[fieldReference.type] !== undefined || model.graphql.types[fieldReference.type] != undefined) {
      var customField = customTypes[fieldReference.type] || getCustomType(model, fieldReference.type, customTypes, isInput, true);

      if (fieldReference.isArray) {
        customField = new GraphQLList(customField);
      }

      if (fieldReference.isRequired) {
        customField = GraphQLNonNull(customField);
      }

      _fields2[fieldReference.type] = {
        type: customField
      };
    } else {
      _fields2[field] = generateGraphQLField(model.graphql.types[type][field]);
    }
  }

  if (isInput && !ignoreInputCheck) {
    if (type.toUpperCase().endsWith('INPUT')) {
      return new GraphQLInputObjectType({
        name: type,
        fields: function fields() {
          return _fields2;
        }
      });
    }
  } else if (!type.toUpperCase().endsWith('INPUT')) {
    return new GraphQLObjectType({
      name: type,
      fields: function fields() {
        return _fields2;
      }
    });
  }
};

var generateCustomGraphQLTypes = function generateCustomGraphQLTypes(model, types) {
  var isInput = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;
  var typeCreated = {};
  var customTypes = {};

  var getCustomType = function getCustomType(type, ignoreInputCheck) {
    var _fields3 = {}; //Enum

    if (Array.isArray(model.graphql.types[type])) {
      model.graphql.types[type].forEach(function (value) {
        if (Array.isArray(value)) {
          _fields3[value[0]] = {
            value: value[1]
          };
        } else {
          _fields3[value] = {
            value: value
          };
        }
      });
      return new GraphQLEnumType({
        name: type,
        values: _fields3
      });
    }

    for (var field in model.graphql.types[type]) {
      var fieldReference = sanitizeFieldName(model.graphql.types[type][field]);

      if (customTypes[fieldReference.type] !== undefined || model.graphql.types[fieldReference.type] != undefined) {
        typeCreated[fieldReference.type] = true;
        var customField = customTypes[fieldReference.type] || getCustomType(fieldReference.type, true);

        if (fieldReference.isArray) {
          customField = new GraphQLList(customField);
        }

        if (fieldReference.isRequired) {
          customField = GraphQLNonNull(customField);
        }

        _fields3[fieldReference.type] = {
          type: customField
        };
      } else {
        typeCreated[type] = true;
        _fields3[field] = generateGraphQLField(model.graphql.types[type][field]);
      }
    }

    if (isInput && !ignoreInputCheck) {
      if (type.toUpperCase().endsWith('INPUT')) {
        return new GraphQLInputObjectType({
          name: type,
          fields: function fields() {
            return _fields3;
          }
        });
      }
    } else if (!type.toUpperCase().endsWith('INPUT')) {
      return new GraphQLObjectType({
        name: type,
        fields: function fields() {
          return _fields3;
        }
      });
    }
  };

  if (model.graphql && model.graphql.types) {
    for (var type in model.graphql.types) {
      customTypes[type] = getCustomType(type);
    }
  }

  return customTypes;
};
/**
 * Returns a collection of `GraphQLObjectType` generated from Sequelize models.
 *
 * It creates an object whose properties are `GraphQLObjectType` created
 * from Sequelize models.
 * @param {*} models The sequelize models used to create the types
 */
// This function is exported


var generateModelTypes = function generateModelTypes(models, remoteTypes) {
  var outputTypes = remoteTypes || {};
  var inputTypes = {};
  var inputUpdateTypes = {};
  var cache = {};

  for (var modelName in models) {
    // Only our models, not Sequelize nor sequelize
    if (_.has(models[modelName], 'name') && modelName !== 'Sequelize') {
      outputTypes = Object.assign(outputTypes, generateCustomGraphQLTypes(models[modelName], null, false));
      inputTypes = Object.assign(inputTypes, generateCustomGraphQLTypes(models[modelName], null, true));
      outputTypes[modelName] = generateGraphQLType(models[modelName], outputTypes, cache, false, false, null, models[modelName]);
      inputTypes[modelName] = generateGraphQLType(models[modelName], inputTypes, cache, true, false, null, models[modelName]);
      inputUpdateTypes[modelName] = generateGraphQLType(models[modelName], inputTypes, cache, true, true, null, models[modelName]);
    }
  }

  return {
    outputTypes: outputTypes,
    inputTypes: inputTypes,
    inputUpdateTypes: inputUpdateTypes
  };
};

var generateModelTypesFromRemote = function generateModelTypesFromRemote(context) {
  if (options.remote) {
    var promises = [];

    for (var opt in options.remote["import"]) {
      options.remote["import"][opt].headers = options.remote["import"][opt].headers || options.remote.headers;
      promises.push(remoteSchema(options.remote["import"][opt], context));
    }

    return Promise.all(promises);
  }

  return Promise.resolve(null);
};
/**
 * Returns a root `GraphQLObjectType` used as query for `GraphQLSchema`.
 *
 * It creates an object whose properties are `GraphQLObjectType` created
 * from Sequelize models.
 * @param {*} models The sequelize models used to create the root `GraphQLSchema`
 */


var generateQueryRootType = function generateQueryRootType(models, outputTypes, inputTypes) {
  var createQueriesFor = {};

  for (var outputTypeName in outputTypes) {
    if (models[outputTypeName]) {
      createQueriesFor[outputTypeName] = outputTypes[outputTypeName];
    }
  }

  return new GraphQLObjectType({
    name: 'Root_Query',
    fields: Object.keys(createQueriesFor).reduce(function (fields, modelTypeName) {
      var modelType = outputTypes[modelTypeName];

      var queries = _defineProperty({}, camelCase(modelType.name + 'Default'), {
        type: GraphQLString,
        description: 'An empty default Query. Can be overwritten for your needs (for example metadata).',
        resolve: function resolve() {
          return '1';
        }
      });

      var paranoidType = models[modelType.name].options.paranoid ? {
        paranoid: {
          type: GraphQLBoolean
        }
      } : {};
      var aliases = models[modelType.name].graphql.alias;

      if (models[modelType.name].graphql.excludeQueries.indexOf('count') === -1) {
        queries[camelCase(aliases.count || modelType.name + 'Count')] = {
          type: GraphQLInt,
          args: {
            where: defaultListArgs().where
          },
          resolve: function resolve(source, _ref11, context, info) {
            var where = _ref11.where;
            var args = argsToFindOptions["default"]({
              where: where
            });
            if (args.where) whereQueryVarsToValues(args.where, info.variableValues);
            return models[modelTypeName].count({
              where: args.where
            });
          },
          description: 'A count of the total number of objects in this connection, ignoring pagination.'
        };
      }

      if (models[modelType.name].graphql.excludeQueries.indexOf('fetch') === -1) {
        queries[camelCase(aliases.fetch || modelType.name + 'Get')] = {
          type: new GraphQLList(modelType),
          args: Object.assign(defaultArgs(models[modelType.name]), defaultListArgs(), includeArguments(), paranoidType),
          resolve: queryResolver(models[modelType.name])
        };
      }

      if (models[modelTypeName].graphql && models[modelTypeName].graphql.queries) {
        var _loop2 = function _loop2(query) {
          //let outPutType = (queries[camelCase(query)] && queries[camelCase(query)].type) || GraphQLInt;
          var description = models[modelTypeName].graphql.queries[query].description || queries[camelCase(query)] && queries[camelCase(query)].description || null;
          var outPutType = GraphQLInt;
          var inPutType = GraphQLInt;
          var typeName = models[modelTypeName].graphql.queries[query].output;
          var inputTypeNameField = models[modelTypeName].graphql.queries[query].input;

          if (typeName) {
            var typeReference = sanitizeFieldName(typeName);
            var field = getTypeByString(typeReference.type);
            typeName = typeReference.type;

            if (typeReference.isArray) {
              outPutType = new GraphQLList(field || outputTypes[typeReference.type]);
            } else {
              outPutType = field || outputTypes[typeReference.type];
            }
          }

          if (inputTypeNameField) {
            var _typeReference = sanitizeFieldName(inputTypeNameField);

            inputTypeNameField = _typeReference.type;

            if (_typeReference.isArray) {
              inPutType = new GraphQLList(inputTypes[inputTypeNameField]);
            } else {
              inPutType = inputTypes[inputTypeNameField];
            }

            if (_typeReference.isRequired) {
              inPutType = GraphQLNonNull(inPutType);
            }
          }

          var inputArg = models[modelTypeName].graphql.queries[query].input ? _defineProperty({}, inputTypeNameField, {
            type: inPutType
          }) : {};
          queries[camelCase(query)] = {
            type: outPutType,
            description: description,
            args: Object.assign(inputArg, defaultListArgs(), includeArguments(), paranoidType),
            resolve: function resolve(source, args, context, info) {
              return options.authorizer(source, args, context, info).then(function (_) {
                return models[modelTypeName].graphql.queries[query].resolver(source, args, context, info);
              });
            }
          };
        };

        for (var query in models[modelTypeName].graphql.queries) {
          _loop2(query);
        }
      }

      return Object.assign(fields, queries);
    }, {})
  });
};

var generateMutationRootType = function generateMutationRootType(models, inputTypes, inputUpdateTypes, outputTypes) {
  var createMutationFor = {};

  for (var inputTypeName in inputTypes) {
    if (models[inputTypeName]) {
      createMutationFor[inputTypeName] = inputTypes[inputTypeName];
    }
  }

  return new GraphQLObjectType({
    name: 'Root_Mutations',
    fields: Object.keys(createMutationFor).reduce(function (fields, inputTypeName) {
      var inputType = inputTypes[inputTypeName];
      var inputUpdateType = inputUpdateTypes[inputTypeName];
      var key = models[inputTypeName].primaryKeyAttributes[0];
      var aliases = models[inputTypeName].graphql.alias;

      var mutations = _defineProperty({}, inputTypeName + 'Default', {
        type: GraphQLInt,
        description: 'An empty default Mutation.',
        resolve: function resolve() {
          return 1;
        }
      });

      if (models[inputTypeName].graphql.excludeMutations.indexOf('create') === -1) {
        var mutationName = camelCase(aliases.create || inputTypeName + 'Add');
        mutations[mutationName] = {
          type: outputTypes[inputTypeName],
          // what is returned by resolve, must be of type GraphQLObjectType
          description: 'Create a ' + inputTypeName,
          args: Object.assign(_defineProperty({}, inputTypeName, {
            type: inputUpdateType
          }), includeArguments(), defaultMutationArgs()),
          resolve: function resolve(source, args, context, info) {
            return mutationResolver(models[inputTypeName], inputTypeName, mutationName, source, args, context, info, 'create');
          }
        };
      }

      if (models[inputTypeName].graphql.excludeMutations.indexOf('update') === -1) {
        var _Object$assign2;

        var _mutationName = camelCase(aliases.update || inputTypeName + 'Edit');

        mutations[_mutationName] = {
          type: outputTypes[inputTypeName] || GraphQLInt,
          description: 'Update a ' + inputTypeName,
          args: Object.assign((_Object$assign2 = {}, _defineProperty(_Object$assign2, key, {
            type: new GraphQLNonNull(GraphQLInt)
          }), _defineProperty(_Object$assign2, "where", defaultListArgs().where), _defineProperty(_Object$assign2, inputTypeName, {
            type: inputUpdateType
          }), _Object$assign2), includeArguments(), defaultMutationArgs()),
          resolve: function resolve(source, args, context, info) {
            var where = _objectSpread({}, args['where'], _defineProperty({}, key, args[key]));

            return mutationResolver(models[inputTypeName], inputTypeName, _mutationName, source, args, context, info, 'update', where).then(function (_boolean) {
              // `boolean` equals the number of rows affected (0 or 1)
              return resolver(models[inputTypeName], _defineProperty({}, EXPECTED_OPTIONS_KEY, dataloaderContext))(source, where, context, info);
            });
          }
        };
      }

      if (models[inputTypeName].graphql.excludeMutations.indexOf('destroy') === -1) {
        var _Object$assign3;

        var _mutationName2 = camelCase(aliases.destroy || inputTypeName + 'Delete');

        mutations[_mutationName2] = {
          type: GraphQLInt,
          description: 'Delete a ' + inputTypeName,
          args: Object.assign((_Object$assign3 = {}, _defineProperty(_Object$assign3, key, {
            type: new GraphQLNonNull(GraphQLInt)
          }), _defineProperty(_Object$assign3, "where", defaultListArgs().where), _Object$assign3), includeArguments(), defaultMutationArgs()),
          resolve: function resolve(source, args, context, info) {
            var where = _objectSpread({}, args['where'], _defineProperty({}, key, args[key]));

            return mutationResolver(models[inputTypeName], inputTypeName, _mutationName2, source, args, context, info, 'destroy', where);
          }
        };
      }

      var hasBulkOptionCreate = getBulkOption(models[inputTypeName].graphql.bulk, 'create');
      var hasBulkOptionEdit = getBulkOption(models[inputTypeName].graphql.bulk, 'edit');
      var hasBulkOptionDelete = getBulkOption(models[inputTypeName].graphql.bulk, 'delete');

      if (hasBulkOptionCreate) {
        mutations[camelCase(aliases.create || inputTypeName + 'AddBulk')] = {
          type: typeof hasBulkOptionCreate === 'string' ? new GraphQLList(outputTypes[inputTypeName]) : GraphQLInt,
          // what is returned by resolve, must be of type GraphQLObjectType
          description: 'Create bulk ' + inputTypeName + ' and return number of rows or created rows.',
          args: Object.assign(_defineProperty({}, inputTypeName, {
            type: new GraphQLList(inputType)
          }), includeArguments()),
          resolve: function resolve(source, args, context, info) {
            return mutationResolver(models[inputTypeName], inputTypeName, source, args, context, info, 'create', null, hasBulkOptionCreate);
          }
        };
      }

      if (hasBulkOptionDelete) {
        var _mutationName3 = camelCase(aliases.bulkDelete || inputTypeName + 'DeleteBulk');

        mutations[_mutationName3] = {
          type: GraphQLInt,
          // what is returned by resolve, must be of type GraphQLObjectType
          description: 'Delete bulk ' + inputTypeName + ' and return number of rows deleted.',
          args: Object.assign(_defineProperty({
            where: defaultListArgs().where
          }, key, {
            type: new GraphQLList(new GraphQLNonNull(GraphQLInt))
          }), includeArguments(), defaultMutationArgs()),
          resolve: function resolve(source, args, context, info) {
            var where = _objectSpread({}, args['where'], _defineProperty({}, key, args[key]));

            return mutationResolver(models[inputTypeName], key, _mutationName3, source, args, context, info, 'destroy', where, true);
          }
        };
      }

      if (hasBulkOptionEdit) {
        mutations[camelCase(aliases.edit || inputTypeName + 'EditBulk')] = {
          type: outputTypes[inputTypeName] ? new GraphQLList(outputTypes[inputTypeName]) : GraphQLInt,
          // what is returned by resolve, must be of type GraphQLObjectType
          description: 'Update bulk ' + inputTypeName + ' and return number of rows modified or updated rows.',
          args: Object.assign(_defineProperty({}, inputTypeName, {
            type: new GraphQLList(inputType)
          }), includeArguments()),
          resolve: function () {
            var _resolve = _asyncToGenerator(
            /*#__PURE__*/
            regeneratorRuntime.mark(function _callee9(source, args, context, info) {
              var whereClause;
              return regeneratorRuntime.wrap(function _callee9$(_context10) {
                while (1) {
                  switch (_context10.prev = _context10.next) {
                    case 0:
                      whereClause = _defineProperty({}, key, _defineProperty({}, Models.Sequelize.Op["in"], args[inputTypeName].map(function (input) {
                        return input[key];
                      })));
                      _context10.next = 3;
                      return mutationResolver(models[inputTypeName], inputTypeName, source, args, context, info, 'update', null, hasBulkOptionEdit);

                    case 3:
                      return _context10.abrupt("return", resolver(models[inputTypeName], _defineProperty({}, EXPECTED_OPTIONS_KEY, dataloaderContext))(source, whereClause, context, info));

                    case 4:
                    case "end":
                      return _context10.stop();
                  }
                }
              }, _callee9);
            }));

            function resolve(_x43, _x44, _x45, _x46) {
              return _resolve.apply(this, arguments);
            }

            return resolve;
          }()
        };
      }

      if (models[inputTypeName].graphql && models[inputTypeName].graphql.mutations) {
        var _loop3 = function _loop3(mutation) {
          var isArray = false;
          var outPutType = GraphQLInt;
          var inPutType = GraphQLInt;
          var typeName = models[inputTypeName].graphql.mutations[mutation].output;
          var inputTypeNameField = models[inputTypeName].graphql.mutations[mutation].input;

          if (typeName) {
            var typeReference = sanitizeFieldName(typeName);
            typeName = typeReference.type;
            isArray = typeReference.isArray;

            if (isArray) {
              outPutType = new GraphQLList(outputTypes[typeName]);
            } else {
              outPutType = outputTypes[typeName];
            }
          }

          if (inputTypeNameField) {
            var _typeReference2 = sanitizeFieldName(inputTypeNameField);

            inputTypeNameField = _typeReference2.type;

            if (_typeReference2.isArray) {
              inPutType = new GraphQLList(inputTypes[inputTypeNameField]);
            } else {
              inPutType = inputTypes[inputTypeNameField];
            }

            if (_typeReference2.isRequired) {
              inPutType = GraphQLNonNull(inPutType);
            }
          }

          mutations[camelCase(mutation)] = {
            type: outPutType,
            args: Object.assign(_defineProperty({}, inputTypeNameField, {
              type: inPutType
            }), includeArguments()),
            resolve: function resolve(source, args, context, info) {
              var where = key && args[inputTypeName] ? _defineProperty({}, key, args[inputTypeName][key]) : {};
              return options.authorizer(source, args, context, info).then(function (_) {
                return models[inputTypeName].graphql.mutations[mutation].resolver(source, args, context, info, where);
              }).then(function (data) {
                return options.logger(data, source, args, context, info).then(function () {
                  return data;
                });
              });
            }
          };
        };

        for (var mutation in models[inputTypeName].graphql.mutations) {
          _loop3(mutation);
        }
      }

      var toReturn = Object.assign(fields, mutations);
      return toReturn;
    }, {})
  });
};

var generateSubscriptionRootType = function generateSubscriptionRootType(models, inputTypes, inputUpdateTypes, outputTypes) {
  var createSubsFor = {};

  for (var inputTypeName in inputTypes) {
    if (models[inputTypeName]) {
      createSubsFor[inputTypeName] = inputTypes[inputTypeName];
    }
  }

  var mutationTypes = new GraphQLEnumType({
    name: 'mutationTypes',
    values: {
      CREATED: {
        value: 'CREATED'
      },
      BULK_CREATED: {
        value: 'BULK_CREATED'
      },
      DELETED: {
        value: 'DELETED'
      },
      UPDATED: {
        value: 'UPDATED'
      }
    }
  });
  return new GraphQLObjectType({
    name: 'Root_Subscription',
    fields: Object.keys(createSubsFor).reduce(function (fields, inputTypeName) {
      var key = models[inputTypeName].primaryKeyAttributes[0];
      var aliases = models[inputTypeName].graphql.alias;
      var subscriptions = {};
      {
        var _filter = models[inputTypeName].graphql.subsFilter["default"];
        var filter = _filter ? _filter : function () {
          return true;
        };
        var subsName = camelCase(aliases.subscribe || inputTypeName + 'Subs');
        subscriptions[subsName] = {
          type: new GraphQLObjectType({
            name: subsName + 'Output',
            fields: {
              mutation: {
                type: mutationTypes
              },
              node: {
                type: outputTypes[inputTypeName] // what is returned by resolve, must be of type GraphQLObjectType

              },
              updatedFields: {
                type: new GraphQLList(GraphQLString)
              },
              previousValues: {
                type: outputTypes[inputTypeName]
              }
            }
          }),
          description: 'On creation/update/delete of ' + inputTypeName,
          args: {
            mutation: {
              type: new GraphQLList(mutationTypes)
            }
          },
          subscribe: withFilter(function (rootValue, args, context, info) {
            var filterType = [];
            if (!args.mutation || args.mutation.indexOf('CREATED') >= 0) filterType.push(camelCase(inputTypeName + 'Add'));
            if (!args.mutation || args.mutation.indexOf('UPDATED') >= 0) filterType.push(camelCase(inputTypeName + 'Edit'));
            if (!args.mutation || args.mutation.indexOf('DELETED') >= 0) filterType.push(camelCase(inputTypeName + 'Delete'));
            if (!args.mutation || args.mutation.indexOf('BULK_CREATED') >= 0) filterType.push(camelCase(inputTypeName + 'AddBulk'));
            return pubsub.asyncIterator(filterType);
          }, filter),
          resolve: subscriptionResolver(models[inputTypeName])
        };
      }

      if (models[inputTypeName].graphql && models[inputTypeName].graphql.subscriptions) {
        var _loop4 = function _loop4(subscription) {
          var isArray = false;
          var outPutType = GraphQLInt;
          var typeName = models[inputTypeName].graphql.subscriptions[subscription].output;

          if (typeName) {
            if (typeName.startsWith('[')) {
              typeName = typeName.replace('[', '');
              typeName = typeName.replace(']', '');
              isArray = true;
            }

            if (isArray) {
              outPutType = new GraphQLList(outputTypes[typeName]);
            } else {
              outPutType = outputTypes[typeName];
            }
          }

          subscriptions[camelCase(subscription)] = {
            type: outPutType,
            args: Object.assign(_defineProperty({}, models[inputTypeName].graphql.subscriptions[subscription].input, {
              type: inputTypes[models[inputTypeName].graphql.subscriptions[subscription].input]
            }), includeArguments()),
            resolve: function resolve(source, args, context, info) {
              var where = key && args[inputTypeName] ? _defineProperty({}, key, args[inputTypeName][key]) : {};
              return options.authorizer(source, args, context, info).then(function (_) {
                return models[inputTypeName].graphql.subscriptions[subscription].resolver(source, args, context, info, where);
              }).then(function (data) {
                return data;
              });
            },
            subscribe: models[inputTypeName].graphql.subscriptions[subscription].subscriber
          };
        };

        for (var subscription in models[inputTypeName].graphql.subscriptions) {
          _loop4(subscription);
        }
      }

      var toReturn = Object.assign(fields, subscriptions);
      return toReturn;
    }, {})
  });
}; // This function is exported


var generateSchema = function generateSchema(models, types, context, Sequelize) {
  Models = models;
  Sequelize = models.Sequelize || Sequelize;
  if (options.dataloader) dataloaderContext = createContext(models.sequelize);

  if (Sequelize) {
    Sequelize.useCLS(sequelizeNamespace);
  } else {
    console.warn('Sequelize not found at Models.Sequelize or not passed as argument. Automatic tranasctions for mutations are disabled.'); // eslint-disable-line no-console

    options.transactionedMutations = false;
  }

  var availableModels = {};

  for (var modelName in models) {
    models[modelName].graphql = models[modelName].graphql || defaultModelGraphqlOptions;
    models[modelName].graphql.attributes = Object.assign({}, defaultModelGraphqlOptions.attributes, models[modelName].graphql.attributes);
    models[modelName].graphql = Object.assign({}, defaultModelGraphqlOptions, models[modelName].graphql || {});

    if (options.exclude.indexOf(modelName) === -1) {
      availableModels[modelName] = models[modelName];
    }
  }

  if (options.remote && options.remote["import"]) {
    return generateModelTypesFromRemote(context).then(function (result) {
      var remoteSchema = generateTypesFromObject(result);

      var _loop5 = function _loop5(_modelName) {
        if (availableModels[_modelName].graphql["import"]) {
          availableModels[_modelName].graphql["import"].forEach(function (association) {
            for (var index = 0; index < remoteSchema.queries.length; index++) {
              if (remoteSchema.queries[index].output === association.from) {
                availableModels[_modelName].associations[association.as || association.from] = {
                  associationType: remoteSchema.queries[index].isList ? 'HasMany' : 'BelongsTo',
                  isRemote: true,
                  target: {
                    name: association.from
                  },
                  query: Object.assign({}, association, remoteSchema.queries[index])
                };
                break;
              }
            }
          });
        }
      };

      for (var _modelName in availableModels) {
        _loop5(_modelName);
      }

      var modelTypes = types || generateModelTypes(availableModels, remoteSchema.types); //modelTypes.outputTypes = Object.assign({}, modelTypes.outputTypes, remoteSchema.types);

      return {
        query: generateQueryRootType(availableModels, modelTypes.outputTypes, modelTypes.inputTypes),
        mutation: generateMutationRootType(availableModels, modelTypes.inputTypes, modelTypes.inputUpdateTypes, modelTypes.outputTypes)
      };
    });
  }

  var modelTypes = types || generateModelTypes(availableModels);
  return {
    query: generateQueryRootType(availableModels, modelTypes.outputTypes, modelTypes.inputTypes),
    mutation: generateMutationRootType(availableModels, modelTypes.inputTypes, modelTypes.inputUpdateTypes, modelTypes.outputTypes),
    subscription: generateSubscriptionRootType(availableModels, modelTypes.inputTypes, modelTypes.inputUpdateTypes, modelTypes.outputTypes)
  };
};

module.exports = function (_options) {
  options = Object.assign(options, _options);
  return {
    generateGraphQLType: generateGraphQLType,
    generateModelTypes: generateModelTypes,
    generateSchema: generateSchema,
    dataloaderContext: dataloaderContext,
    errorHandler: errorHandler,
    whereQueryVarsToValues: whereQueryVarsToValues,
    TRANSACTION_NAMESPACE: TRANSACTION_NAMESPACE,
    resetCache: resetCache
  };
};