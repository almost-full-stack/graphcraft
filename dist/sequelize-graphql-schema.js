'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

function _invoke(body, then) {
  var result = body();if (result && result.then) {
    return result.then(then);
  }return then(result);
}
function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

function _async(f) {
  return function () {
    for (var args = [], i = 0; i < arguments.length; i++) {
      args[i] = arguments[i];
    }try {
      return Promise.resolve(f.apply(this, args));
    } catch (e) {
      return Promise.reject(e);
    }
  };
}function _await(value, then, direct) {
  if (direct) {
    return then ? then(value) : value;
  }value = Promise.resolve(value);return then ? value.then(then) : value;
}
var _require = require('graphql'),
    GraphQLObjectType = _require.GraphQLObjectType,
    GraphQLInputObjectType = _require.GraphQLInputObjectType,
    GraphQLList = _require.GraphQLList,
    GraphQLInt = _require.GraphQLInt,
    GraphQLNonNull = _require.GraphQLNonNull,
    GraphQLString = _require.GraphQLString,
    GraphQLBoolean = _require.GraphQLBoolean;

var _require2 = require('graphql-sequelize'),
    resolver = _require2.resolver,
    attributeFields = _require2.attributeFields,
    defaultListArgs = _require2.defaultListArgs,
    defaultArgs = _require2.defaultArgs,
    JSONType = _require2.JSONType;

var camelCase = require('camelcase');
var remoteSchema = require('./remoteSchema');

var _require3 = require('graphql-request'),
    GraphQLClient = _require3.GraphQLClient;

var _ = require('lodash');

var _require4 = require('dataloader-sequelize'),
    createContext = _require4.createContext,
    EXPECTED_OPTIONS_KEY = _require4.EXPECTED_OPTIONS_KEY;

var DataLoader = require('dataloader');
var dataloaderContext = void 0;

var options = {
  exclude: [],
  includeArguments: {},
  remote: {},
  dataloader: false,
  logger: function logger() {
    return Promise.resolve();
  },
  authorizer: function authorizer() {
    return Promise.resolve();
  },

  errorHandler: {
    'ETIMEDOUT': { statusCode: 503 }
  }
};

var defaultModelGraphqlOptions = {
  attributes: {
    exclude: [], // list attributes which are to be ignored in Model Input
    include: {}, // attributes in key:type format which are to be included in Model Input
    import: []
  },
  scopes: null,
  alias: {},
  bulk: [],
  mutations: {},
  excludeMutations: [],
  excludeQueries: [],
  extend: {},
  before: {},
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

var remoteResolver = _async(function (source, args, context, info, remoteQuery, remoteArguments, type) {

  var availableArgs = _.keys(remoteQuery.args);
  var pickedArgs = _.pick(remoteArguments, availableArgs);
  var queryArgs = [];
  var passedArgs = [];

  for (var arg in pickedArgs) {
    queryArgs.push('$' + arg + ':' + pickedArgs[arg].type);
    passedArgs.push(arg + ':$' + arg);
  };

  var fields = _.keys(type.getFields());

  var query = 'query ' + remoteQuery.name + '(' + queryArgs.join(', ') + '){\n    ' + remoteQuery.name + '(' + passedArgs.join(', ') + '){\n      ' + fields.join(', ') + '\n    }\n  }';

  var variables = _.pick(args, availableArgs);
  var key = remoteQuery.to || 'id';

  if (_.indexOf(availableArgs, key) > -1 && !variables.where) {
    variables[key] = source[remoteQuery.with];
  } else if (_.indexOf(availableArgs, 'where') > -1) {
    variables.where = variables.where || {};
    variables.where[key] = source[remoteQuery.with];
  }

  var headers = _.pick(context.headers, remoteQuery.headers);
  var client = new GraphQLClient(remoteQuery.endpoint, { headers: headers });
  return _await(client.request(query, variables), function (data) {

    return data[remoteQuery.name];
  });
});

var includeArguments = function includeArguments() {
  var includeArguments = {};
  for (var argument in options.includeArguments) {
    includeArguments[argument] = generateGraphQLField(options.includeArguments[argument]);
  }
  return includeArguments;
};

var execBefore = function execBefore(model, source, args, context, info, type, where) {
  if (model.graphql && model.graphql.hasOwnProperty('before') && model.graphql.before.hasOwnProperty(type)) {
    return model.graphql.before[type](source, args, context, info, where);
  } else {
    return Promise.resolve();
  }
};

var findOneRecord = function findOneRecord(model, where) {
  if (where) {
    return model.findOne({ where: where });
  } else {
    return Promise.resolve();
  }
};

var queryResolver = _async(function (model, inputTypeName, source, args, context, info) {

  var type = 'fetch';

  return _await(options.authorizer(source, args, context, info), function () {
    return model.graphql.overwrite.hasOwnProperty(type) ? model.graphql.overwrite[type](source, args, context, info) : _await(execBefore(model, source, args, context, info, type), function () {
      var _resolver;

      var before = function before(findOptions, args, context) {

        var orderArgs = args.order || '';
        var orderBy = [];

        if (orderArgs != "") {
          var orderByClauses = orderArgs.split(',');
          orderByClauses.forEach(function (clause) {
            if (clause.indexOf('reverse:') === 0) {
              orderBy.push([clause.substring(8), 'DESC']);
            } else {
              orderBy.push([clause, 'ASC']);
            }
          });

          findOptions.order = orderBy;
        }

        findOptions.paranoid = args.where && args.where.deletedAt && args.where.deletedAt.ne === null || args.paranoid === false ? false : model.options.paranoid;
        return findOptions;
      };

      var scope = Array.isArray(model.graphql.scopes) ? { method: [model.graphql.scopes[0], _.get(args, model.graphql.scopes[1], model.graphql.scopes[2] || null)] } : model.graphql.scopes;

      return _await(resolver(model.scope(scope), (_resolver = {}, _defineProperty(_resolver, EXPECTED_OPTIONS_KEY, dataloaderContext), _defineProperty(_resolver, 'before', before), _resolver))(source, args, context, info), function (data) {
        return model.graphql.extend.hasOwnProperty(type) ? model.graphql.extend[type](data, source, args, context, info) : data;
      });
    });
  });
});

var mutationResolver = _async(function (model, inputTypeName, source, args, context, info, type, where, isBulk) {
  return _await(options.authorizer(source, args, context, info), function () {
    return model.graphql.overwrite.hasOwnProperty(type) ? model.graphql.overwrite[type](source, args, context, info, where) : _await(execBefore(model, source, args, context, info, type, where), function () {
      return _await(findOneRecord(model, type === 'destroy' ? where : null), function (preData) {
        var operationType = isBulk && type === 'create' ? 'bulkCreate' : type;
        var validate = true;
        return _await(model[operationType](type === 'destroy' ? { where: where } : args[inputTypeName], { where: where, validate: validate }), function (data) {

          if (model.graphql.extend.hasOwnProperty(type)) {
            return model.graphql.extend[type](type === 'destroy' ? preData : data, source, args, context, info, where);
          }

          return operationType === 'bulkCreate' ? args[inputTypeName].length : data;
        });
      });
    });
  });
});

var sanitizeFieldName = function sanitizeFieldName(type) {
  var isRequired = type.indexOf('!') > -1 ? true : false;
  var isArray = type.indexOf('[') > -1 ? true : false;
  type = type.replace('[', '');
  type = type.replace(']', '');
  type = type.replace('!', '');

  return { type: type, isArray: isArray, isRequired: isRequired };
};

var generateGraphQLField = function generateGraphQLField(type) {

  var typeReference = sanitizeFieldName(type);

  type = typeReference.type.toLowerCase();

  var field = type === 'int' ? GraphQLInt : type === 'boolean' ? GraphQLBoolean : GraphQLString;

  if (typeReference.isArray) {
    field = new GraphQLList(field);
  }

  if (typeReference.isRequired) {
    field = GraphQLNonNull(field);
  }

  return { type: field };
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

  return { types: types, queries: queries };
};

/**
* Returns the association fields of an entity.
*
* It iterates over all the associations and produces an object compatible with GraphQL-js.
* BelongsToMany and HasMany associations are represented as a `GraphQLList` whereas a BelongTo
* is simply an instance of a type.
* @param {*} associations A collection of sequelize associations
* @param {*} types Existing `GraphQLObjectType` types, created from all the Sequelize models
*/
var generateAssociationFields = function generateAssociationFields(associations, types) {
  var isInput = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;

  var fields = {};

  var _loop = function _loop(associationName) {
    var relation = associations[associationName];

    if (!types[relation.target.name]) {
      return {
        v: fields
      };
    }

    // BelongsToMany is represented as a list, just like HasMany
    var type = relation.associationType === 'BelongsToMany' || relation.associationType === 'HasMany' ? new GraphQLList(types[relation.target.name]) : types[relation.target.name];

    fields[associationName] = { type: type };

    if (!isInput && !relation.isRemote) {
      // GraphQLInputObjectType do not accept fields with resolve
      fields[associationName].args = Object.assign(defaultArgs(relation), defaultListArgs(), includeArguments());
      fields[associationName].resolve = _async(function (source, args, context, info) {
        return _await(execBefore(relation.target, source, args, context, info, 'fetch'), function () {
          return _await(resolver(relation, _defineProperty({}, EXPECTED_OPTIONS_KEY, dataloaderContext))(source, args, context, info), function (data) {
            var _exit = false;
            return _invoke(function () {
              if (relation.target.graphql.extend.fetch && data.length) {
                return _await(relation.target.graphql.extend.fetch(data, source, args, context, info), function (item) {
                  _exit = true;
                  return [].concat(item);
                });
              }
            }, function (_result) {
              return _exit ? _result : data;
            });
          });
        });
      });
    } else if (!isInput && relation.isRemote) {
      fields[associationName].args = Object.assign({}, relation.query.args, defaultListArgs());
      fields[associationName].resolve = function (source, args, context, info) {
        return remoteResolver(source, args, context, info, relation.query, fields[associationName].args, types[relation.target.name]);
      };
    }
  };

  for (var associationName in associations) {
    var _ret = _loop(associationName);

    if ((typeof _ret === 'undefined' ? 'undefined' : _typeof(_ret)) === "object") return _ret.v;
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
var generateGraphQLType = function generateGraphQLType(model, types) {
  var isInput = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;
  var cache = arguments[3];

  var GraphQLClass = isInput ? GraphQLInputObjectType : GraphQLObjectType;
  var includeAttributes = {};
  if (model.graphql.attributes.include) {
    for (var attribute in model.graphql.attributes.include) {
      var type = types && types[model.graphql.attributes.include[attribute]] ? { type: types[model.graphql.attributes.include[attribute]] } : null;
      includeAttributes[attribute] = type || generateGraphQLField(model.graphql.attributes.include[attribute]);
    }
  }

  return new GraphQLClass({
    name: isInput ? model.name + 'Input' : model.name,
    fields: function fields() {
      return Object.assign(attributeFields(model, Object.assign({}, { allowNull: !!isInput, cache: cache })), generateAssociationFields(model.associations, types, isInput), includeAttributes);
    }
  });
};

var generateCustomGraphQLTypes = function generateCustomGraphQLTypes(model, types) {
  var isInput = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;


  var typeCreated = {};
  var customTypes = {};

  var getCustomType = function getCustomType(type, ignoreInputCheck) {

    var _fields2 = {};

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

        _fields2[fieldReference.type] = { type: customField };
      } else {
        typeCreated[type] = true;
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
    } else {
      if (!type.toUpperCase().endsWith('INPUT')) {
        return new GraphQLObjectType({
          name: type,
          fields: function fields() {
            return _fields2;
          }
        });
      }
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
  for (var modelName in models) {
    // Only our models, not Sequelize nor sequelize
    if (models[modelName].hasOwnProperty('name') && modelName !== 'Sequelize') {
      var cache = {};
      inputTypes = Object.assign(inputTypes, generateCustomGraphQLTypes(models[modelName], null, true));
      outputTypes = Object.assign(outputTypes, generateCustomGraphQLTypes(models[modelName], null, false));
      outputTypes[modelName] = generateGraphQLType(models[modelName], outputTypes, false, cache);
      inputTypes[modelName] = generateGraphQLType(models[modelName], inputTypes, true, cache);
    }
  }

  return { outputTypes: outputTypes, inputTypes: inputTypes };
};

var generateModelTypesFromRemote = function generateModelTypesFromRemote(context) {
  if (options.remote) {

    var promises = [];

    for (var opt in options.remote.import) {

      options.remote.import[opt].headers = options.remote.import[opt].headers || options.remote.headers;
      promises.push(remoteSchema(options.remote.import[opt], context));
    }

    return Promise.all(promises);
  } else {
    return Promise.resolve(null);
  }
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
      var queries = _defineProperty({}, modelType.name + 'Default', {
        type: GraphQLInt,
        description: 'An empty default Query.',
        resolve: function resolve() {
          return 1;
        }
      });

      var paranoidType = models[modelType.name].options.paranoid ? { paranoid: { type: GraphQLBoolean } } : {};

      var aliases = models[modelType.name].graphql.alias;

      if (models[modelType.name].graphql.excludeQueries.indexOf('query') === -1) {
        queries[camelCase(aliases.fetch || modelType.name + 'Get')] = {
          type: new GraphQLList(modelType),
          args: Object.assign(defaultArgs(models[modelType.name]), defaultListArgs(), includeArguments(), paranoidType),
          resolve: function resolve(source, args, context, info) {
            return queryResolver(models[modelType.name], modelType.name, source, args, context, info);
          }
        };
      };

      if (models[modelTypeName].graphql && models[modelTypeName].graphql.queries) {
        var _loop2 = function _loop2(query) {

          var isArray = false;
          var outPutType = GraphQLInt;
          var typeName = models[modelTypeName].graphql.queries[query].output;

          if (typeName) {
            if (typeName.startsWith('[')) {
              typeName = typeName.replace('[', '');
              typeName = typeName.replace(']', '');
              isArray = true;
            }

            if (isArray) {
              outPutType = new GraphQLList(outputTypes[typeName]);
            } else {
              outPutType = outputTypes[models[modelTypeName].graphql.queries[query].output];
            }
          }

          var inputArg = models[modelTypeName].graphql.queries[query].input ? _defineProperty({}, models[modelTypeName].graphql.queries[query].input, { type: inputTypes[models[modelTypeName].graphql.queries[query].input] }) : {};

          queries[camelCase(query)] = {
            type: outPutType,
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
      };

      return Object.assign(fields, queries);
    }, {})
  });
};

var generateMutationRootType = function generateMutationRootType(models, inputTypes, outputTypes) {

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
        mutations[camelCase(aliases.create || inputTypeName + 'Add')] = {
          type: outputTypes[inputTypeName], // what is returned by resolve, must be of type GraphQLObjectType
          description: 'Create a ' + inputTypeName,
          args: Object.assign(_defineProperty({}, inputTypeName, { type: inputType }), includeArguments()),
          resolve: function resolve(source, args, context, info) {
            return mutationResolver(models[inputTypeName], inputTypeName, source, args, context, info, 'create');
          }
        };
      }

      if (models[inputTypeName].graphql.excludeMutations.indexOf('update') === -1) {
        mutations[camelCase(aliases.update || inputTypeName + 'Edit')] = {
          type: outputTypes[inputTypeName] || GraphQLInt,
          description: 'Update a ' + inputTypeName,
          args: Object.assign(_defineProperty({}, inputTypeName, { type: inputType }), includeArguments()),
          resolve: function resolve(source, args, context, info) {
            var where = _defineProperty({}, key, args[inputTypeName][key]);
            return mutationResolver(models[inputTypeName], inputTypeName, source, args, context, info, 'update', where).then(function (boolean) {
              // `boolean` equals the number of rows affected (0 or 1)
              return resolver(models[inputTypeName], _defineProperty({}, EXPECTED_OPTIONS_KEY, dataloaderContext))(source, where, context, info);
            });
          }
        };
      }

      if (models[inputTypeName].graphql.excludeMutations.indexOf('destroy') === -1) {
        mutations[camelCase(aliases.destroy || inputTypeName + 'Delete')] = {
          type: GraphQLInt,
          description: 'Delete a ' + inputTypeName,
          args: Object.assign(_defineProperty({}, key, { type: new GraphQLNonNull(GraphQLInt) }), includeArguments()),
          resolve: function resolve(source, args, context, info) {
            var where = _defineProperty({}, key, args[key]);
            return mutationResolver(models[inputTypeName], inputTypeName, source, args, context, info, 'destroy', where);
          }
        };
      }

      if (models[inputTypeName].graphql.bulk.indexOf('create') > -1) {
        mutations[camelCase(aliases.create || inputTypeName + 'AddBulk')] = {
          type: GraphQLInt, // what is returned by resolve, must be of type GraphQLObjectType
          description: 'Create bulk ' + inputTypeName + ' and return number of rows created.',
          args: Object.assign(_defineProperty({}, inputTypeName, { type: new GraphQLList(inputType) }), includeArguments()),
          resolve: function resolve(source, args, context, info) {
            return mutationResolver(models[inputTypeName], inputTypeName, source, args, context, info, 'create', null, true);
          }
        };
      }

      if (models[inputTypeName].graphql && models[inputTypeName].graphql.mutations) {
        var _loop3 = function _loop3(mutation) {

          var isArray = false;
          var outPutType = GraphQLInt;
          var typeName = models[inputTypeName].graphql.mutations[mutation].output;

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

          mutations[camelCase(mutation)] = {
            type: outPutType,
            args: Object.assign(_defineProperty({}, models[inputTypeName].graphql.mutations[mutation].input, { type: inputTypes[models[inputTypeName].graphql.mutations[mutation].input] }), includeArguments()),
            resolve: function resolve(source, args, context, info) {
              var where = key && args[inputTypeName] ? _defineProperty({}, key, args[inputTypeName][key]) : {};
              return options.authorizer(source, args, context, info).then(function (_) {
                return models[inputTypeName].graphql.mutations[mutation].resolver(source, args, context, info, where);
              }).then(function (data) {
                return data;
              });
            }
          };
        };

        for (var mutation in models[inputTypeName].graphql.mutations) {
          _loop3(mutation);
        }
      };

      var toReturn = Object.assign(fields, mutations);

      return toReturn;
    }, {})
  });
};

// This function is exported
var generateSchema = function generateSchema(models, types, context) {

  Models = models;

  if (options.dataloader) dataloaderContext = createContext(models.sequelize);

  var availableModels = {};
  for (var modelName in models) {
    models[modelName].graphql = models[modelName].graphql || defaultModelGraphqlOptions;
    models[modelName].graphql.attributes = Object.assign({}, defaultModelGraphqlOptions.attributes, models[modelName].graphql.attributes);
    models[modelName].graphql = Object.assign({}, defaultModelGraphqlOptions, models[modelName].graphql || {});
    if (options.exclude.indexOf(modelName) === -1) {
      availableModels[modelName] = models[modelName];
    }
  }

  if (options.remote && options.remote.import) {

    return generateModelTypesFromRemote(context).then(function (result) {

      var remoteSchema = generateTypesFromObject(result);

      var _loop4 = function _loop4(_modelName) {
        if (availableModels[_modelName].graphql.import) {

          availableModels[_modelName].graphql.import.forEach(function (association) {

            for (var index = 0; index < remoteSchema.queries.length; index++) {
              if (remoteSchema.queries[index].output === association.from) {
                availableModels[_modelName].associations[association.as || association.from] = {
                  associationType: remoteSchema.queries[index].isList ? 'HasMany' : 'BelongsTo',
                  isRemote: true,
                  target: { name: association.from },
                  query: Object.assign({}, association, remoteSchema.queries[index])
                };
                break;
              }
            }
          });
        }
      };

      for (var _modelName in availableModels) {
        _loop4(_modelName);
      }

      var modelTypes = types || generateModelTypes(availableModels, remoteSchema.types);

      //modelTypes.outputTypes = Object.assign({}, modelTypes.outputTypes, remoteSchema.types);

      return {
        query: generateQueryRootType(availableModels, modelTypes.outputTypes, modelTypes.inputTypes),
        mutation: generateMutationRootType(availableModels, modelTypes.inputTypes, modelTypes.outputTypes)
      };
    });
  } else {

    var modelTypes = types || generateModelTypes(availableModels);

    return {
      query: generateQueryRootType(availableModels, modelTypes.outputTypes, modelTypes.inputTypes),
      mutation: generateMutationRootType(availableModels, modelTypes.inputTypes, modelTypes.outputTypes)
    };
  }
};

module.exports = function (_options) {
  options = Object.assign(options, _options);
  return {
    generateGraphQLType: generateGraphQLType,
    generateModelTypes: generateModelTypes,
    generateSchema: generateSchema,
    dataloaderContext: dataloaderContext,
    errorHandler: errorHandler
  };
};