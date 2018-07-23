'use strict';

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

var _require = require('graphql'),
    GraphQLObjectType = _require.GraphQLObjectType,
    GraphQLInputObjectType = _require.GraphQLInputObjectType,
    GraphQLList = _require.GraphQLList,
    GraphQLInt = _require.GraphQLInt,
    GraphQLNonNull = _require.GraphQLNonNull,
    GraphQLString = _require.GraphQLString;

var _require2 = require('graphql-sequelize'),
    resolver = _require2.resolver,
    attributeFields = _require2.attributeFields,
    defaultListArgs = _require2.defaultListArgs,
    defaultArgs = _require2.defaultArgs;

var camelCase = require('camelcase');

var options = {
  exclude: [],
  includeArguments: {},
  authorizer: function authorizer() {
    return Promise.resolve();
  }
};

var defaultModelGraphqlOptions = {
  attributes: {
    exclude: [],
    include: {}
  },
  alias: {},
  mutations: {},
  excludeMutations: [],
  excludeQueries: [],
  extend: {},
  before: {},
  overwrite: {}
};

var Models = {};

var resolverWrapper = function resolverWrapper(source, args, context, info) {
  return resolver(source, args, context, info);
};

var includeArguments = function includeArguments() {
  var includeArguments = {};
  for (var argument in options.includeArguments) {
    includeArguments[argument] = { type: options.includeArguments[argument] === 'int' ? GraphQLInt : GraphQLString };
  }
  return includeArguments;
};

var execBefore = function execBefore(model, source, args, context, info, type, where) {
  return new Promise(function (resolve, reject) {
    if (model.graphql && model.graphql.hasOwnProperty('before') && model.graphql.before.hasOwnProperty(type)) {
      return model.graphql.before[type](source, args, context, info, where).then(function (src) {
        resolve(src);
      });
    } else {
      resolve(source);
    }
  });
};

var findOneRecord = function findOneRecord(model, where) {
  if (where) {
    return model.findOne({ where: where }).then(function (data) {
      return data;
    });
  } else {
    return Promise.resolve();
  }
};

var queryResolver = function queryResolver(model, inputTypeName, source, args, context, info) {

  var type = 'fetch';

  return options.authorizer(source, args, context, info).then(function (_) {
    if (model.graphql.overwrite.hasOwnProperty(type)) {
      return model.graphql.overwrite[type](source, args, context, info);
    } else {
      return execBefore(model, source, args, context, info, type).then(function (src) {

        return resolver(model)(source, args, context, info).then(function (data) {
          if (model.graphql.extend.hasOwnProperty(type)) {
            return model.graphql.extend[type](data, source, args, context, info);
          } else {
            return data;
          }
        }).then(function (data) {
          return data;
        });
      });
    }
  });
};

var mutationResolver = function mutationResolver(model, inputTypeName, source, args, context, info, type, where) {

  return options.authorizer(source, args, context, info).then(function (_) {
    if (model.graphql.overwrite.hasOwnProperty(type)) {
      return model.graphql.overwrite[type](source, args, context, info, where);
    } else {
      return execBefore(model, source, args, context, info, type, where).then(function (src) {
        source = src;
        return findOneRecord(model, type === 'destroy' ? where : null).then(function (preData) {
          //console.log("I am here");
          return model[type](type === 'destroy' ? { where: where } : args[inputTypeName], { where: where }).then(function (data) {
            if (model.graphql.extend.hasOwnProperty(type)) {
              return model.graphql.extend[type](type === 'destroy' ? preData : data, source, args, context, info, where);
            } else {
              return data;
            }
          });
        });
      });
    }
  });
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
    // BelongsToMany is represented as a list, just like HasMany
    var type = relation.associationType === 'BelongsToMany' || relation.associationType === 'HasMany' ? new GraphQLList(types[relation.target.name]) : types[relation.target.name];

    fields[associationName] = { type: type };
    if (!isInput) {
      // GraphQLInputObjectType do not accept fields with resolve
      fields[associationName].args = Object.assign(defaultArgs(relation), defaultListArgs(), includeArguments());
      fields[associationName].resolve = function (source, args, context, info) {
        return execBefore(relation.target, source, args, context, info, 'fetch').then(function (_) {
          return resolver(relation)(source, args, context, info).then(function (result) {
            if (relation.target.graphql.extend.fetch && result.length) {
              return relation.target.graphql.extend.fetch(result[0], source, args, context, info).then(function (item) {
                return [].concat(item);
              });
            } else {
              return result;
            }
          });
        });
      };
    }
  };

  for (var associationName in associations) {
    _loop(associationName);
  }

  return fields;
};

var generateGraphQLField = function generateGraphQLField(type) {
  var isRequired = type.indexOf('!') > -1 ? true : false;
  type = type.replace('!', '');
  var field = type === 'int' ? GraphQLInt : GraphQLString;
  if (isRequired) {
    field = GraphQLNonNull(field);
  }
  return { type: field };
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
  var method = arguments[3];

  var GraphQLClass = isInput ? GraphQLInputObjectType : GraphQLObjectType;
  var includeAttributes = {};
  if (isInput && model.graphql.attributes.include) {
    for (var attribute in model.graphql.attributes.include) {
      includeAttributes[attribute] = generateGraphQLField(model.graphql.attributes.include[attribute]);
    }
  }

  return new GraphQLClass({
    name: isInput ? model.name + 'Input' : model.name,
    fields: function fields() {
      return Object.assign(attributeFields(model, Object.assign({}, { allowNull: !!isInput })), generateAssociationFields(model.associations, types, isInput), includeAttributes);
    }
  });
};

var generateCustomGraphQLTypes = function generateCustomGraphQLTypes(model, types) {
  var isInput = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;


  var customTypes = {};

  if (model.graphql && model.graphql.types) {
    var _loop2 = function _loop2(type) {

      var fields = {};

      for (var field in model.graphql.types[type]) {
        fields[field] = generateGraphQLField(model.graphql.types[type][field]);
      }

      if (isInput) {
        if (type.toUpperCase().endsWith('INPUT')) {
          customTypes[type] = new GraphQLInputObjectType({
            name: type,
            fields: function (_fields) {
              function fields() {
                return _fields.apply(this, arguments);
              }

              fields.toString = function () {
                return _fields.toString();
              };

              return fields;
            }(function () {
              return fields;
            })
          });
        }
      } else {
        if (!type.toUpperCase().endsWith('INPUT')) {
          customTypes[type] = new GraphQLObjectType({
            name: type,
            fields: function (_fields2) {
              function fields() {
                return _fields2.apply(this, arguments);
              }

              fields.toString = function () {
                return _fields2.toString();
              };

              return fields;
            }(function () {
              return fields;
            })
          });
        }
      }
    };

    for (var type in model.graphql.types) {
      _loop2(type);
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
var generateModelTypes = function generateModelTypes(models) {
  var outputTypes = {};
  var inputTypes = {};
  for (var modelName in models) {
    // Only our models, not Sequelize nor sequelize
    if (models[modelName].hasOwnProperty('name') && modelName !== 'Sequelize') {
      outputTypes[modelName] = generateGraphQLType(models[modelName], outputTypes);
      inputTypes[modelName] = generateGraphQLType(models[modelName], inputTypes, true);
      inputTypes = Object.assign(inputTypes, generateCustomGraphQLTypes(models[modelName], null, true));
      outputTypes = Object.assign(outputTypes, generateCustomGraphQLTypes(models[modelName], null, false));
    }
  }

  return { outputTypes: outputTypes, inputTypes: inputTypes };
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

      if (models[modelType.name].graphql.excludeQueries.indexOf('query') === -1) {
        queries[camelCase(modelType.name + 'Get')] = {
          type: new GraphQLList(modelType),
          args: Object.assign(defaultArgs(models[modelType.name]), defaultListArgs(), includeArguments()),
          resolve: function resolve(source, args, context, info) {
            return queryResolver(models[modelType.name], modelType.name, source, args, context, info);
          }
        };
      };

      if (models[modelTypeName].graphql && models[modelTypeName].graphql.queries) {
        var _loop3 = function _loop3(query) {
          queries[camelCase(query)] = {
            type: outputTypes[models[modelTypeName].graphql.queries[query].output] || GraphQLInt,
            args: Object.assign(_defineProperty({}, models[modelTypeName].graphql.queries[query].input, { type: inputTypes[models[modelTypeName].graphql.queries[query].input] }), includeArguments()),
            resolve: function resolve(source, args, context, info) {
              return options.authorizer(source, args, context, info).then(function (_) {
                return models[modelTypeName].graphql.queries[query].resolver(source, args, context, info);
              });
            }
          };
        };

        for (var query in models[modelTypeName].graphql.queries) {
          _loop3(query);
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
          type: outputTypes[inputTypeName],
          description: 'Update a ' + inputTypeName,
          args: Object.assign(_defineProperty({}, inputTypeName, { type: inputType }), includeArguments()),
          resolve: function resolve(source, args, context, info) {
            var where = _defineProperty({}, key, args[inputTypeName][key]);
            return mutationResolver(models[inputTypeName], inputTypeName, source, args, context, info, 'update', where).then(function (boolean) {
              // `boolean` equals the number of rows affected (0 or 1)
              return resolver(models[inputTypeName])(source, where, context, info);
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

      if (models[inputTypeName].graphql && models[inputTypeName].graphql.mutations) {
        var _loop4 = function _loop4(mutation) {
          mutations[camelCase(mutation)] = {
            type: outputTypes[models[inputTypeName].graphql.mutations[mutation].output] || GraphQLInt,
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
          _loop4(mutation);
        }
      };

      var toReturn = Object.assign(fields, mutations);

      return toReturn;
    }, {})
  });
};

// This function is exported
var generateSchema = function generateSchema(models, types) {

  Models = models;

  var availableModels = {};
  for (var modelName in models) {
    models[modelName].graphql = models[modelName].graphql || defaultModelGraphqlOptions;
    models[modelName].graphql.attributes = Object.assign({}, defaultModelGraphqlOptions.attributes, models[modelName].graphql.attributes);
    models[modelName].graphql = Object.assign({}, defaultModelGraphqlOptions, models[modelName].graphql || {});
    if (options.exclude.indexOf(modelName) === -1) {
      availableModels[modelName] = models[modelName];
    }
  }

  var modelTypes = types || generateModelTypes(availableModels);
  return {
    query: generateQueryRootType(availableModels, modelTypes.outputTypes, modelTypes.inputTypes),
    mutation: generateMutationRootType(availableModels, modelTypes.inputTypes, modelTypes.outputTypes)
  };
};

module.exports = function (_options) {
  options = Object.assign(options, _options);
  return {
    generateGraphQLType: generateGraphQLType,
    generateModelTypes: generateModelTypes,
    generateSchema: generateSchema
  };
};