'use strict';

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

var _require = require('graphql'),
    GraphQLObjectType = _require.GraphQLObjectType,
    GraphQLInputObjectType = _require.GraphQLInputObjectType,
    GraphQLList = _require.GraphQLList,
    GraphQLInt = _require.GraphQLInt,
    GraphQLNonNull = _require.GraphQLNonNull;

var _require2 = require('graphql-sequelize'),
    resolver = _require2.resolver,
    attributeFields = _require2.attributeFields,
    defaultListArgs = _require2.defaultListArgs,
    defaultArgs = _require2.defaultArgs;

var options = {
    exclude: [],
    includeAttributes: []
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
    for (var associationName in associations) {
        var relation = associations[associationName];
        // BelongsToMany is represented as a list, just like HasMany
        var type = relation.associationType === 'BelongsToMany' || relation.associationType === 'HasMany' ? new GraphQLList(types[relation.target.name]) : types[relation.target.name];

        fields[associationName] = { type: type };
        if (!isInput) {
            // GraphQLInputObjectType do not accept fields with resolve
            fields[associationName].resolve = resolver(relation);
        }
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

    var GraphQLClass = isInput ? GraphQLInputObjectType : GraphQLObjectType;
    return new GraphQLClass({
        name: isInput ? model.name + 'Input' : model.name,
        fields: function fields() {
            return Object.assign(attributeFields(model, Object.assign({ allowNull: !!isInput }, model.graphql.attributes || {})), generateAssociationFields(model.associations, types, isInput));
        }
    });
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
var generateQueryRootType = function generateQueryRootType(models, outputTypes) {
    return new GraphQLObjectType({
        name: 'Root_Query',
        fields: Object.keys(outputTypes).reduce(function (fields, modelTypeName) {

            var modelType = outputTypes[modelTypeName];
            return Object.assign(fields, _defineProperty({}, modelType.name, {
                type: new GraphQLList(modelType),
                args: Object.assign(defaultArgs(models[modelType.name]), defaultListArgs()),
                resolve: resolver(models[modelType.name])
            }));
        }, {})
    });
};

var mutationResolver = function mutationResolver(model, inputTypeName, source, args, context, info, type, where) {

    var execBefore = function execBefore() {
        return new Promise(function (resolve, reject) {
            if (model.graphql && model.graphql.hasOwnProperty('before') && model.graphql.before.hasOwnProperty(type)) {
                return model.graphql.before[type](source, args, context, info).then(function (src) {
                    resolve(src);
                });
            } else {
                resolve(source);
            }
        });
    };

    if (model.graphql && model.graphql.hasOwnProperty('overwrite') && model.graphql.overwrite.hasOwnProperty(type)) {
        return model.graphql.overwrite[type](source, args, context, info);
    } else {
        return execBefore().then(function (src) {
            source = src;
            return model[type](type === 'destroy' ? { where: where } : args[inputTypeName], { where: where }).then(function (data) {
                if (model.graphql && model.graphql.hasOwnProperty('extend') && model.graphql.extend.hasOwnProperty(type)) {
                    return model.graphql.extend[type](data, source, args, context, info);
                } else {
                    return data;
                }
            });
        });
    }
};

var generateMutationRootType = function generateMutationRootType(models, inputTypes, outputTypes) {
    return new GraphQLObjectType({
        name: 'Root_Mutations',
        fields: Object.keys(inputTypes).reduce(function (fields, inputTypeName) {
            var inputType = inputTypes[inputTypeName];
            var key = models[inputTypeName].primaryKeyAttributes[0];

            var mutations = {};

            if (models[inputTypeName].graphql.excludeMutations.indexOf('create') === -1) {
                mutations[inputTypeName + 'Create'] = {
                    type: outputTypes[inputTypeName], // what is returned by resolve, must be of type GraphQLObjectType
                    description: 'Create a ' + inputTypeName,
                    args: _defineProperty({}, inputTypeName, { type: inputType }),
                    resolve: function resolve(source, args, context, info) {
                        return mutationResolver(models[inputTypeName], inputTypeName, source, args, context, info, 'create');
                    }
                };
            }

            if (models[inputTypeName].graphql.excludeMutations.indexOf('update') === -1) {
                mutations[inputTypeName + 'Update'] = {
                    type: outputTypes[inputTypeName],
                    description: 'Update a ' + inputTypeName,
                    args: _defineProperty({}, inputTypeName, { type: inputType }),
                    resolve: function resolve(source, args, context, info) {
                        var where = _defineProperty({}, key, args[inputTypeName][key]);
                        return mutationResolver(models[inputTypeName], inputTypeName, source, args, context, info, 'update', where).then(function (boolean) {
                            // `boolean` equals the number of rows affected (0 or 1)
                            return resolver(models[inputTypeName])(source, where, context, info);
                        });
                    }
                };
            }

            if (models[inputTypeName].graphql.excludeMutations.indexOf('delete') === -1) {
                mutations[inputTypeName + 'Delete'] = {
                    type: GraphQLInt,
                    description: 'Delete a ' + inputTypeName,
                    args: _defineProperty({}, key, { type: new GraphQLNonNull(GraphQLInt) }),
                    resolve: function resolve(value, where) {
                        return models[inputTypeName].destroy({ where: where });
                    } // Returns the number of rows affected (0 or 1)
                };
            }

            var toReturn = Object.assign(fields, mutations);

            return toReturn;
        }, {})
    });
};

// This function is exported
var generateSchema = function generateSchema(models, types) {
    var modelTypes = types || generateModelTypes(models);
    return {
        query: generateQueryRootType(models, modelTypes.outputTypes),
        mutation: generateMutationRootType(models, modelTypes.inputTypes, modelTypes.outputTypes)
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
