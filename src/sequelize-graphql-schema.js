const {
  GraphQLObjectType,
  GraphQLInputObjectType,
  GraphQLList,
  GraphQLInt,
  GraphQLNonNull,
  GraphQLString,
  GraphQLBoolean
} = require('graphql')
const {
  resolver,
  defaultListArgs,
  defaultArgs,
  argsToFindOptions,
  relay
} = require('graphql-sequelize')

const Sequelize = require('sequelize')

require("./jsdoc.def")
const attributeFields = require('./graphql-sequelize/attributeFields')

const {
  sequelizeConnection
} = relay

const camelCase = require('camelcase')
const remoteSchema = require('./remoteSchema')
const {
  GraphQLClient
} = require('graphql-request')
const _ = require('lodash')
const {
  createContext,
  EXPECTED_OPTIONS_KEY
} = require('dataloader-sequelize')
const DataLoader = require('dataloader')
let dataloaderContext

let options = {
  exclude: [],
  includeArguments: {},
  remote: {},
  dataloader: false,
  customTypes: [],
  logger() {
    return Promise.resolve();
  },
  authorizer() {
    return Promise.resolve();
  },
  errorHandler: {
    'ETIMEDOUT': {
      statusCode: 503
    }
  }
};

/** @type {SeqGraphQL} */
const defaultModelGraphqlOptions = {
  attributes: {
    exclude: { // list attributes which are to be ignored in Model Input (exclusive filter)
      create: [],
      update: [],
      fetch: []
    },
    only: { // allow to use only listed attributes (inclusive filter, it ignores exclude option)
      create: null,
      update: null,
      fetch: null
    },
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

let Models = {};

const errorHandler = (error) => {
  for (let name in options.errorHandler) {
    if (error.message.indexOf(name) > -1) {
      Object.assign(error, options.errorHandler[name]);
      break;
    }
  }

  return error;
};

const whereQueryVarsToValues = (o, vals) => {
  [
    ...Object.getOwnPropertyNames(o),
    ...Object.getOwnPropertySymbols(o)
  ].forEach(k => {
    if (_.isFunction(o[k])) {
      o[k] = o[k](vals);
      return;
    }
    if (_.isObject(o[k])) {
      whereQueryVarsToValues(o[k], vals);
    }
  });
}

const getTypeByString = (type) => {
  lType = type.toLowerCase();

  return lType === 'int' ? GraphQLInt :
    lType === 'boolean' ? GraphQLBoolean :
    lType === 'string' ? GraphQLString :
    options.customTypes[type] ? options.customTypes[type] :
    null;
}

/**
 * @typedef Name
 * @property {string} singular
 * @property {string} plural 
 */

/**
 * @param {Name} name
 * @returns string
 */
const assocSuffix = (model, plural = false, asName = null) => {
  return _.upperFirst(asName ? asName : (plural && !model.options.freezeTableName ? model.options.name.plural : model.options.name.singular));
}

const remoteResolver = async (source, args, context, info, remoteQuery, remoteArguments, type) => {

  const availableArgs = _.keys(remoteQuery.args);
  const pickedArgs = _.pick(remoteArguments, availableArgs);
  let queryArgs = [];
  let passedArgs = [];

  for (const arg in pickedArgs) {
    queryArgs.push(`$${arg}:${pickedArgs[arg].type}`);
    passedArgs.push(`${arg}:$${arg}`);
  };

  const fields = _.keys(type.getFields());

  const query = `query ${remoteQuery.name}(${queryArgs.join(', ')}){
    ${remoteQuery.name}(${passedArgs.join(', ')}){
      ${fields.join(', ')}
    }
  }`;

  const variables = _.pick(args, availableArgs);
  const key = remoteQuery.to || 'id';

  if (_.indexOf(availableArgs, key) > -1 && !variables.where) {
    variables[key] = source[remoteQuery.with];
  } else if (_.indexOf(availableArgs, 'where') > -1) {
    variables.where = variables.where || {};
    variables.where[key] = source[remoteQuery.with];
  }

  const headers = _.pick(context.headers, remoteQuery.headers);
  const client = new GraphQLClient(remoteQuery.endpoint, {
    headers
  });
  const data = await client.request(query, variables);

  return data[remoteQuery.name];

};

const getTypeName = (model, isInput, isUpdate, isAssoc) => {
  return isInput ? model.name + (isUpdate ? "Edit" : "Add") + "Input" + (isAssoc ? "Connection" : "") : model.name
}

const includeArguments = () => {
  let includeArguments = {};
  for (let argument in options.includeArguments) {
    includeArguments[argument] = generateGraphQLField(options.includeArguments[argument]);
  }
  return includeArguments;
};

const defaultMutationArgs = () => {
  return {
    set: {
      type: GraphQLBoolean,
      description: "If true, all relations use 'set' operation instead of 'add', destroying existing"
    },
    transaction: {
      type: GraphQLBoolean,
      description: "Enable transaction for this operation and all its nested"
    },
  };
}

const execBefore = (model, source, args, context, info, type, where) => {
  if (model.graphql && model.graphql.hasOwnProperty('before') && model.graphql.before.hasOwnProperty(type)) {

    return model.graphql.before[type](source, args, context, info, where);
  } else {
    return Promise.resolve();
  }
};

const findOneRecord = (model, where) => {
  if (where) {
    return model.findOne({
      where
    });
  } else {
    return Promise.resolve();
  }
};

const queryResolver = (model, isAssoc = false, field = null) => {
  return async (source, args, context, info) => {
    if (args.where)
      whereQueryVarsToValues(args.where, info.variableValues);

    var _model = !field && isAssoc && model.target ? model.target : model;
    const type = 'fetch';

    if (!isAssoc) // authorization should not be executed for nested queries
      await options.authorizer(source, args, context, info);

    if (_model.graphql.overwrite.hasOwnProperty(type)) {
      return _model.graphql.overwrite[type](source, args, context, info);
    }

    await execBefore(_model, source, args, context, info, type);

    const before = (findOptions, args, context) => {

      const orderArgs = args.order || '';
      const orderBy = [];

      if (orderArgs != "") {
        const orderByClauses = orderArgs.split(',');
        orderByClauses.forEach((clause) => {
          if (clause.indexOf('reverse:') === 0) {
            orderBy.push([clause.substring(8), 'DESC']);
          } else {
            orderBy.push([clause, 'ASC']);
          }
        });

        findOptions.order = orderBy;
      }

      findOptions.paranoid = ((args.where && args.where.deletedAt && args.where.deletedAt.ne === null) || args.paranoid === false) ? false : _model.options.paranoid;
      return findOptions;
    };

    const scope = Array.isArray(_model.graphql.scopes) ? {
      method: [_model.graphql.scopes[0], _.get(args, _model.graphql.scopes[1], _model.graphql.scopes[2] || null)]
    } : _model.graphql.scopes;

    var data;
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

    if (_model.graphql.extend.hasOwnProperty(type)) {
      return _model.graphql.extend[type](data, source, args, context, info);
    }

    return data;

  };
}

const mutationResolver = async (model, inputTypeName, source, args, context, info, type, where, isBulk) => {
  if (args.where)
    whereQueryVarsToValues(args.where, info.variableValues);

  if (where)
    whereQueryVarsToValues(where, info.variableValues);

  await options.authorizer(source, args, context, info);

  const preData = await findOneRecord(model, type === 'destroy' ? where : null);
  const operationType = (isBulk && type === 'create') ? 'bulkCreate' : type;
  const validate = true;

  var data = {};

  const operation = async function (opType, _model, _source, _args, name, assocInst, sourceInst, transaction, toDestroy = null) {
    let hookType = opType == "set" ? "update" : type;

    if (_model.graphql && _model.graphql.overwrite.hasOwnProperty(hookType)) {
      return _model.graphql.overwrite[hookType](_source, _args, context, info, where);
    }

    await execBefore(_model, _source, _args, context, info, hookType, where);

    const finalize = async (res) => {
      let _data = {};
      if ((opType === "create" || opType === "update") && !isBulk) {
        _data = await createAssoc(_model, res, _args[name], transaction);
      }

      if (_model.graphql.extend.hasOwnProperty(hookType)) {
        return _model.graphql.extend[hookType](type === 'destroy' ? preData : res, _source, _args, context, info, where);
      }

      return Object.assign(res, _data);
    }

    let res;
    if (opType == "add" || opType == "set") {
      let _op, _name;
      if (_source.through && _source.through.model) {
        delete _args[name][_source.target.name];
        delete _args[name][_source.foreignIdentifierField];
        _name = assocSuffix(_source.target, ["BelongsTo", "HasOne"].indexOf(_source.associationType) < 0, _source.as);
        _op = opType + _name;
      } else {
        _name = assocSuffix(_model, ["BelongsTo", "HasOne"].indexOf(_source.associationType) < 0, _source.as);
        _op = opType + _name;
      }

      res = await sourceInst[_op](assocInst, opType == "add" ? {
        through: _args[name],
        transaction
      } : {
        transaction
      })
      return await finalize(res);

    } else {
      // allow destroy on instance if specified
      let _inst = toDestroy && opType == 'destroy' ? toDestroy : _model;
      res = await _inst[opType](opType === 'destroy' ? {
        where,
        transaction
      } : _args[name], {
        where,
        validate,
        transaction
      });

      if (opType != "create" && opType != "destroy")
        return await finalize(await _model.findOne({
          where,
          transaction
        }))

      return await finalize(res);
    }
  };

  const createAssoc = async (_source, _sourceInst, _args, transaction) => {
    let _data = {}

    const processAssoc = async (aModel, name, fields, isList) => {
      if (typeof fields === "object" && aModel) {

        let _a = {
          [name]: fields,
          transaction
        }

        if (aModel.associationType === 'BelongsToMany') {
          const _model = aModel.through.model;

          let fkName = aModel.foreignIdentifierField;
          let crObj = fields[aModel.target.name];
          let fkVal = fields[fkName];


          if (crObj && fkVal) {
            return Promise.reject(`Cannot define both foreignKey for association (${fkVal}) AND Instance for creation (${crObj}) in your mutation!`);
          } else if (!crObj && !fkVal) {
            return Promise.reject(`You must specify foreignKey for association (${fkName}) OR Instance for creation (${aModel.target.name}) in your mutation!`);
          }

          if (crObj) {
            let _at = {
              [aModel.target.name]: crObj,
              transaction
            }
            let node = await operation("create", aModel.target, _model, _at, aModel.target.name, null, _sourceInst, transaction);
            let data = await operation("add", _model, aModel, _a, name, node, _sourceInst, transaction);
            let edge = data[0][0];
            edge[aModel.target.name] = node;
            return {
              [_model.name]: edge
            }
          } else {
            let data = await operation("add", _model, aModel, _a, name, fkVal, _sourceInst, transaction);
            return {
              [_model.name]: data[0][0]
            }
          }
        } else {
          const _model = aModel.target
          let newInst = await operation("create", _model, aModel.target, _a, name, {}, _sourceInst, transaction);
          await operation("add", _model, aModel, _a, name, newInst, _sourceInst, transaction);
          return newInst;
        }
      }

      return null;
    }

    for (let name in _args) {
      if (!_source.associations)
        continue;

      var aModel = _source.associations[name];
      if (Array.isArray(_args[name])) {
        _data[name] = []

        if (args["set"] == true) {
          let _refModel = _source.through && _source.through.model ? _source.target : aModel.target;
          let _name = assocSuffix(_refModel, true, aModel.as);
          if (aModel.associationType === 'HasMany' || aModel.associationType === 'HasOne') {
            // we cannot use set() to remove because of a bug: https://github.com/sequelize/sequelize/issues/8588
            let _getOp = "get" + _name;
            let assoc = await _sourceInst[_getOp]({
              transaction
            });
            if (assoc) {
              if (_.isArray(assoc)) {
                for (var k in assoc) {
                  var v = assoc[k];
                  await operation("destroy", aModel.target, _source, [], null, null, _sourceInst, transaction, v)
                }
              } else {
                await operation("destroy", aModel.target, _source, [], null, null, _sourceInst, transaction, v)
              }
            }
          } else {
            let _op = "set" + _name;
            await _sourceInst[_op]([], {
              transaction
            });
          }
        }

        for (let p in _args[name]) {
          obj = _args[name][p];
          let newInst = await processAssoc(aModel, name, obj, true);
          if (newInst) {
            _data[name].push(newInst);
          }
        }
      } else {
        let newInst = await processAssoc(aModel, name, _args[name], false);
        if (newInst) {
          _data[name] = newInst;
        }
      }
    };

    return _data;
  }

  if (args["transaction"])
    data = await model.sequelize.transaction(async (transaction) => {
      return await operation(operationType, model, source, args, inputTypeName, null, null, transaction);
    })
  else
    data = await operation(operationType, model, source, args, inputTypeName, null, null);

  if (operationType === 'bulkCreate') {
    return args[inputTypeName].length;
  }

  return type == "destroy" ? parseInt(data) : data;
};

function fixIds(
  model,
  fields,
  assoc,
  source,
  isUpdate
) {
  const newId = (modelName, allowNull = false) => {
    return {
      name: 'id',
      description: `The ID for ${modelName}`,
      type: allowNull ? GraphQLInt : new GraphQLNonNull(GraphQLInt)
    }
  }

  // Fix Relay ID
  const rawAttributes = model.rawAttributes;
  _.each(Object.keys(rawAttributes), (key) => {
    if (key === "clientMutationId") {
      return;
    }
    // Check if reference attribute
    const attr = rawAttributes[key];
    if (!attr) {
      return;
    }
    if (attr.references) {
      const modelName = attr.references.model;
      fields[key] = newId(modelName, isUpdate || (assoc || attr.allowNull));
    } else if (attr.autoIncrement) {
      // Make autoIncrement fields optional (allowNull=True)
      fields[key] = newId(model.name, true);
    }
  });
}

const sanitizeFieldName = (type) => {
  let isRequired = type.indexOf('!') > -1 ? true : false;
  let isArray = type.indexOf('[') > -1 ? true : false;
  type = type.replace('[', '');
  type = type.replace(']', '');
  type = type.replace('!', '');

  return {
    type,
    isArray,
    isRequired
  };
};

const generateGraphQLField = (type) => {

  const typeReference = sanitizeFieldName(type);

  let field = getTypeByString(typeReference.type);

  if (!field)
    field = GraphQLString;

  if (typeReference.isArray) {
    field = new GraphQLList(field);
  }

  if (typeReference.isRequired) {
    field = GraphQLNonNull(field);
  }

  return {
    type: field
  };
};

const toGraphQLType = function (name, schema) {

  let fields = {};

  for (const field in schema) {
    fields[field] = generateGraphQLField(schema[field]);
  }

  return new GraphQLObjectType({
    name,
    fields: () => fields
  });

};

const generateTypesFromObject = function (remoteData) {

  const types = {};
  let queries = [];

  remoteData.forEach((item) => {

    for (const type in item.types) {
      types[type] = toGraphQLType(type, item.types[type]);
    }
    item.queries.forEach((query) => {
      let args = {};
      for (const arg in query.args) {
        args[arg] = generateGraphQLField(query.args[arg]);
      }
      query.args = args;
    });
    queries = queries.concat(item.queries);
  });

  return {
    types,
    queries
  };

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
const generateAssociationFields = (model, associations, types, cache, isInput = false, isUpdate = false, assoc = null, source = null) => {
  let fields = {}

  const buildAssoc = (assocModel, relation, associationType, associationName, foreign = false) => {
    if (!types[assocModel.name]) {
      //if (assocModel != source) { // avoid circular loop
      types[assocModel.name] = generateGraphQLType(assocModel, types, cache, isInput, isUpdate, assocModel, source)
      //} else 
      //  return fields;
    }

    if (!associationName) // edge case
      return false;

    // BelongsToMany is represented as a list, just like HasMany
    const type = associationType === 'BelongsToMany' ||
      associationType === 'HasMany' ?
      new GraphQLList(types[assocModel.name]) :
      types[assocModel.name];

    fields[associationName] = {
      type
    };

    if (isInput) {
      if (associationType === "BelongsToMany") {
        const aModel = relation.through.model;
        if (!aModel.graphql)
          aModel.graphql = defaultModelGraphqlOptions;
        // if n:m join table, we have to create the connection input type for it
        const _name = getTypeName(aModel, isInput, false, true);
        if (!types[_name]) {
          const gqlType = generateGraphQLType(aModel, types, cache, isInput, false, assocModel, model)
          gqlType.name = _name;
          types[_name] = new GraphQLList(gqlType);
        }
        fields[associationName].type = types[_name];
      }
    } else {
      if (!relation.isRemote) {
        // 1:1 doesn't need connectionFields
        if (["BelongsTo", "HasOne"].indexOf(associationType) < 0) {
          var edgeFields = {}
          if (associationType === "BelongsToMany") {
            const aModel = relation.through.model;
            if (!aModel.graphql)
              aModel.graphql = defaultModelGraphqlOptions;

            var exclude = aModel.graphql.attributes.exclude;
            exclude = Array.isArray(exclude) ? exclude : exclude["fetch"];

            var only = aModel.graphql.attributes.only;
            only = Array.isArray(only) ? only : only["fetch"];

            edgeFields = Object.assign(attributeFields(aModel, {
              exclude,
              only,
              commentToDescription: true,
              cache
            }), types[assocModel.name].args);

            // Pass Through model to resolve function
            _.each(edgeFields, (edgeField, field) => {
              edgeField.resolve = queryResolver(aModel, true, field)
            });
          }

          let connection = sequelizeConnection({
            name: model.name + associationName,
            nodeType: types[assocModel.name],
            target: relation,
            connectionFields: {
              total: {
                type: new GraphQLNonNull(GraphQLInt),
                description: `Total count of ${assocModel.name} results associated with ${model.name} with all filters applied.`,
                resolve: (source, args, context, info) => {
                  return source.edges.length;
                }
              },
              count: {
                type: new GraphQLNonNull(GraphQLInt),
                description: `Total count of ${assocModel.name} results associated with ${model.name} without limits applied.`,
                resolve: (source, args, context, info) => {
                  if (!source.__parent)
                    return 0;

                  let _args = argsToFindOptions.default(source.__args);
                  let where = _args["where"];
                  let suffix = assocSuffix(assocModel, ["BelongsTo", "HasOne"].indexOf(associationType) < 0, associationName);
                  return source.__parent["count" + suffix]({
                    where
                  })
                }
              }
            },
            edgeFields
          });

          connection.resolve = queryResolver(relation, true)

          fields[associationName].type = connection.connectionType;
          fields[associationName].args = Object.assign(defaultArgs(relation), defaultListArgs(), connection.connectionArgs);
          fields[associationName].resolve = connection.resolve;
        } else {
          // GraphQLInputObjectType do not accept fields with resolve
          fields[associationName].args = Object.assign(defaultArgs(relation), defaultListArgs(), types[assocModel.name].args);
          fields[associationName].resolve = queryResolver(relation, true);
        }
      } else {
        fields[associationName].args = Object.assign({}, relation.query.args, defaultListArgs());
        fields[associationName].resolve = (source, args, context, info) => {
          return remoteResolver(source, args, context, info, relation.query, fields[associationName].args, types[assocModel.name]);
        }
      }
    }

    return false;
  }

  for (let associationName in associations) {
    const relation = associations[associationName]
    res = buildAssoc(relation.target, relation, relation.associationType, associationName)
    if (res)
      return res;
  }

  //Discovers hidden relations that are implicit created
  // (for example for join table in n:m case)
  const rawAttributes = model.rawAttributes;
  for (let key in rawAttributes) {
    if (key === "clientMutationId") {
      return;
    }

    const attr = rawAttributes[key];
    if (attr && attr.references) {
      const modelName = attr.references.model;
      const assocModel = model.sequelize.modelManager.getModel(modelName, {
        attribute: "tableName"
      });

      // TODO: improve it or ask sequelize community to fix it
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
      if (!model.associations[assocModel.name] ) {
        model.belongsTo(assocModel, {
          foreignKey: attr.field
        });
      }

      const reference = model.associations[assocModel.name];

      buildAssoc(assocModel, reference, "BelongsTo", reference.name || reference.as, true);
    }
  }

  return fields;
};

const generateIncludeAttributes = (model, types, isInput = false) => {
  let includeAttributes = {};
  if (model.graphql.attributes.include) {
    for (let attribute in model.graphql.attributes.include) {
      var type = null;
      var typeName = model.graphql.attributes.include[attribute] + (isInput ? "Input" : "");
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
}

const generateGraphQLFields = (model, types, cache, isInput = false, isUpdate = false, assoc = null, source = null) => {
  var exclude = model.graphql.attributes.exclude;
  exclude = Array.isArray(exclude) ? exclude : exclude[!isInput ? "fetch" : isUpdate ? "update" : "create"];

  var only = model.graphql.attributes.only;
  only = Array.isArray(only) ? only : only[!isInput ? "fetch" : isUpdate ? "update" : "create"];

  var fields = Object.assign(
    attributeFields(model, Object.assign({}, {
      exclude,
      only,
      allowNull: !isInput || isUpdate,
      checkDefaults: isInput,
      commentToDescription: true,
      cache
    })),
    generateAssociationFields(model, model.associations, types, cache, isInput, isUpdate, assoc, source),
    generateIncludeAttributes(model, types, isInput)
  );

  if (assoc && ((model.name == assoc.name && model.associations[assoc.name]) || model.name != assoc.name)) {

    if (!types[assoc.name]) {
      types[assoc.name] = generateGraphQLType(assoc, types, cache, isInput, isUpdate, assoc, source)
    }

    fields[assoc.name] = {
      name: getTypeName(assoc, isInput, isUpdate, false),
      type: types[assoc.name]
    };
  }

  if (isInput) {
    fixIds(model, fields, assoc, source, isUpdate);

    // FIXME: Handle timestamps
    // console.log('_timestampAttributes', Model._timestampAttributes);
    delete fields.createdAt;
    delete fields.updatedAt;
  }

  return fields;
}

/**
 * Returns a new `GraphQLObjectType` created from a sequelize model.
 *
 * It creates a `GraphQLObjectType` object with a name and fields. The
 * fields are generated from its sequelize associations.
 * @param {*} model The sequelize model used to create the `GraphQLObjectType`
 * @param {*} types Existing `GraphQLObjectType` types, created from all the Sequelize models
 */
const generateGraphQLType = (model, types, cache, isInput = false, isUpdate = false, assoc = null, source = null) => {
  const GraphQLClass = isInput ? GraphQLInputObjectType : GraphQLObjectType;

  const thunk = () => {
    return generateGraphQLFields(model, types, cache, isInput, isUpdate, assoc, source);
  }

  var fields = assoc ? thunk : thunk()

  let name = getTypeName(model, isInput, isUpdate, assoc);
  // can be already created by generateGraphQLFields recursion
  if (types[model.name] && types[model.name].name == name)
    return types[model.name];

  return new GraphQLClass({
    name,
    fields
  });
};

const getCustomType = (model, type, customTypes, isInput, ignoreInputCheck = false) => {

  const fields = {};

  if (typeof model.graphql.types[type] === "string") {
    return generateGraphQLField(model.graphql.types[type]);
  }

  for (let field in model.graphql.types[type]) {

    const fieldReference = sanitizeFieldName(model.graphql.types[type][field]);

    if (customTypes[fieldReference.type] !== undefined || model.graphql.types[fieldReference.type] != undefined) {
      let customField = customTypes[fieldReference.type] || getCustomType(model, fieldReference.type, customTypes, isInput, true);

      if (fieldReference.isArray) {
        customField = new GraphQLList(customField);
      }

      if (fieldReference.isRequired) {
        customField = GraphQLNonNull(customField);
      }

      fields[fieldReference.type] = {
        type: customField
      };

    } else {
      fields[field] = generateGraphQLField(model.graphql.types[type][field]);
    }

  }

  if (isInput && !ignoreInputCheck) {
    if (type.toUpperCase().endsWith('INPUT')) {
      return new GraphQLInputObjectType({
        name: type,
        fields: () => fields
      });
    }
  } else {
    if (!type.toUpperCase().endsWith('INPUT')) {
      return new GraphQLObjectType({
        name: type,
        fields: () => fields
      });
    }
  }

};

const generateCustomGraphQLTypes = (model, types, isInput = false) => {
  const customTypes = {};

  if (model.graphql && model.graphql.types) {

    for (let type in model.graphql.types) {
      if (typeof model.graphql.types[type] !== "string")
        customTypes[type] = getCustomType(model, type, customTypes, isInput);
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
const generateModelTypes = (models, remoteTypes) => {
  let outputTypes = remoteTypes || {};
  let inputTypes = {};
  let inputUpdateTypes = {};
  const cache = {};
  for (let modelName in models) {
    // Only our models, not Sequelize nor sequelize
    if (models[modelName].hasOwnProperty('name') && modelName !== 'Sequelize') {
      outputTypes = Object.assign(outputTypes, generateCustomGraphQLTypes(models[modelName], null, false));
      inputTypes = Object.assign(inputTypes, generateCustomGraphQLTypes(models[modelName], null, true));
      outputTypes[modelName] = generateGraphQLType(models[modelName], outputTypes, cache, false, false, null, models[modelName]);
      inputTypes[modelName] = generateGraphQLType(models[modelName], inputTypes, cache, true, false, null, models[modelName]);
      inputUpdateTypes[modelName] = generateGraphQLType(models[modelName], inputTypes, cache, true, true, null, models[modelName]);
    }
  }

  return {
    outputTypes,
    inputTypes,
    inputUpdateTypes
  };
};

const generateModelTypesFromRemote = (context) => {
  if (options.remote) {

    let promises = [];

    for (let opt in options.remote.import) {

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
const generateQueryRootType = (models, outputTypes, inputTypes) => {

  let createQueriesFor = {};

  for (let outputTypeName in outputTypes) {
    if (models[outputTypeName]) {
      createQueriesFor[outputTypeName] = outputTypes[outputTypeName];
    }
  }

  return new GraphQLObjectType({
    name: 'Root_Query',
    fields: Object.keys(createQueriesFor).reduce((fields, modelTypeName) => {

      const modelType = outputTypes[modelTypeName];
      let queries = {
        [camelCase(modelType.name + 'Default')]: {
          type: GraphQLString,
          description: 'An empty default Query. Can be overwritten for metadata.',
          resolve: () => "1"
        },
        [camelCase(modelType.name + 'Count')]: {
          type: GraphQLInt,
          args: {
            where: defaultListArgs().where
          },
          resolve: async (source, {
            where
          }) => {
            return models[modelTypeName].count({
              where
            })
          },
          description: `A count of the total number of objects in this connection, ignoring pagination.`
        }
      };

      const paranoidType = models[modelType.name].options.paranoid ? {
        paranoid: {
          type: GraphQLBoolean
        }
      } : {};

      const aliases = models[modelType.name].graphql.alias;

      if (models[modelType.name].graphql.excludeQueries.indexOf('query') === -1) {
        queries[camelCase(aliases.fetch || (modelType.name + 'Get'))] = {
          type: new GraphQLList(modelType),
          args: Object.assign(defaultArgs(models[modelType.name]), defaultListArgs(), includeArguments(), paranoidType),
          resolve: queryResolver(models[modelType.name])
        }
      };

      if (models[modelTypeName].graphql && models[modelTypeName].graphql.queries) {

        for (let query in models[modelTypeName].graphql.queries) {

          let outPutType = (queries[camelCase(query)] && queries[camelCase(query)].type) || GraphQLInt;
          let description = models[modelTypeName].graphql.queries[query].description || (queries[camelCase(query)] && queries[camelCase(query)].description) || null;
          let typeName = models[modelTypeName].graphql.queries[query].output;

          if (typeName) {
            const typeReference = sanitizeFieldName(typeName);

            let field = getTypeByString(typeReference.type);

            if (typeReference.isArray) {
              outPutType = new GraphQLList(field || outputTypes[typeReference.type]);
            } else {
              outPutType = field || outputTypes[typeReference.type];
            }
          }

          const inputArg = models[modelTypeName].graphql.queries[query].input ? {
            [models[modelTypeName].graphql.queries[query].input]: {
              type: inputTypes[models[modelTypeName].graphql.queries[query].input]
            }
          } : {};

          queries[camelCase(query)] = {
            type: outPutType,
            description,
            args: Object.assign(inputArg, defaultListArgs(), includeArguments(), paranoidType),
            resolve: (source, args, context, info) => {
              return options.authorizer(source, args, context, info).then(_ => {
                return models[modelTypeName].graphql.queries[query].resolver(source, args, context, info);
              });
            }
          };
        }

      };

      return Object.assign(fields, queries);

    }, {})
  });
};

const generateMutationRootType = (models, inputTypes, inputUpdateTypes, outputTypes) => {

  let createMutationFor = {};

  for (let inputTypeName in inputTypes) {
    if (models[inputTypeName]) {
      createMutationFor[inputTypeName] = inputTypes[inputTypeName];
    }
  }

  return new GraphQLObjectType({
    name: 'Root_Mutations',
    fields: Object.keys(createMutationFor).reduce((fields, inputTypeName) => {

      const inputType = inputTypes[inputTypeName];
      const inputUpdateType = inputUpdateTypes[inputTypeName];
      const key = models[inputTypeName].primaryKeyAttributes[0];
      const aliases = models[inputTypeName].graphql.alias;

      let mutations = {
        [inputTypeName + 'Default']: {
          type: GraphQLInt,
          description: 'An empty default Mutation.',
          resolve: () => 1
        }
      };

      if (models[inputTypeName].graphql.excludeMutations.indexOf('create') === -1) {
        mutations[camelCase(aliases.create || (inputTypeName + 'Add'))] = {
          type: outputTypes[inputTypeName], // what is returned by resolve, must be of type GraphQLObjectType
          description: 'Create a ' + inputTypeName,
          args: Object.assign({
            [inputTypeName]: {
              type: inputType
            }
          }, includeArguments(), defaultMutationArgs()),
          resolve: (source, args, context, info) => mutationResolver(models[inputTypeName], inputTypeName, source, args, context, info, 'create')
        };
      }

      if (models[inputTypeName].graphql.excludeMutations.indexOf('update') === -1) {
        mutations[camelCase(aliases.update || (inputTypeName + 'Edit'))] = {
          type: outputTypes[inputTypeName] || GraphQLInt,
          description: 'Update a ' + inputTypeName,
          args: Object.assign({
            where: defaultListArgs().where,
            [key]: {
              type: new GraphQLNonNull(GraphQLInt)
            },
            [inputTypeName]: {
              type: inputUpdateType
            }
          }, includeArguments(), defaultMutationArgs()),
          resolve: (source, args, context, info) => {
            const where = {
              ...args["where"],
              [key]: args[key]
            };
            return mutationResolver(models[inputTypeName], inputTypeName, source, args, context, info, 'update', where)
              .then(boolean => {
                // `boolean` equals the number of rows affected (0 or 1)
                return resolver(models[inputTypeName], {
                  [EXPECTED_OPTIONS_KEY]: dataloaderContext
                })(source, where, context, info);
              });
          }
        };
      }

      if (models[inputTypeName].graphql.excludeMutations.indexOf('destroy') === -1) {
        mutations[camelCase(aliases.destroy || (inputTypeName + 'Delete'))] = {
          type: GraphQLInt,
          description: 'Delete a ' + inputTypeName,
          args: Object.assign({
            [key]: {
              type: new GraphQLNonNull(GraphQLInt)
            },
            where: defaultListArgs().where
          }, includeArguments(), defaultMutationArgs()),
          resolve: (source, args, context, info) => {
            const where = {
              ...args["where"],
              [key]: args[key]
            };
            return mutationResolver(models[inputTypeName], inputTypeName, source, args, context, info, 'destroy', where);
          }
        };
      }

      if (models[inputTypeName].graphql.bulk.indexOf('create') > -1) {
        mutations[camelCase(aliases.create || (inputTypeName + 'AddBulk'))] = {
          type: GraphQLInt, // what is returned by resolve, must be of type GraphQLObjectType
          description: 'Create bulk ' + inputTypeName + ' and return number of rows created.',
          args: Object.assign({
            [inputTypeName]: {
              type: new GraphQLList(inputType)
            }
          }, includeArguments(), defaultMutationArgs()),
          resolve: (source, args, context, info) => mutationResolver(models[inputTypeName], inputTypeName, source, args, context, info, 'create', null, true)
        };
      }

      if (models[inputTypeName].graphql && models[inputTypeName].graphql.mutations) {

        for (let mutation in models[inputTypeName].graphql.mutations) {

          let isArray = false;
          let outPutType = GraphQLInt;
          let typeName = models[inputTypeName].graphql.mutations[mutation].output;

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
            args: Object.assign({
              [models[inputTypeName].graphql.mutations[mutation].input]: {
                type: inputTypes[models[inputTypeName].graphql.mutations[mutation].input]
              }
            }, includeArguments()),
            resolve: (source, args, context, info) => {
              const where = key && args[inputTypeName] ? {
                [key]: args[inputTypeName][key]
              } : {};
              return options.authorizer(source, args, context, info).then(_ => {
                return models[inputTypeName].graphql.mutations[mutation].resolver(source, args, context, info, where);
              }).then(data => {
                return data;
              });
            }
          };
        }

      };

      const toReturn = Object.assign(fields, mutations);

      return toReturn;

    }, {})
  });
};

// This function is exported
const generateSchema = (models, types, context) => {

  Models = models;

  if (options.dataloader) dataloaderContext = createContext(models.sequelize);

  let availableModels = {};
  for (let modelName in models) {
    models[modelName].graphql = models[modelName].graphql || defaultModelGraphqlOptions;
    models[modelName].graphql.attributes = Object.assign({}, defaultModelGraphqlOptions.attributes, models[modelName].graphql.attributes);
    models[modelName].graphql = Object.assign({}, defaultModelGraphqlOptions, models[modelName].graphql || {});
    if (options.exclude.indexOf(modelName) === -1) {
      availableModels[modelName] = models[modelName];
    }
  }

  if (options.remote && options.remote.import) {

    return generateModelTypesFromRemote(context).then((result) => {

      const remoteSchema = generateTypesFromObject(result);

      for (const modelName in availableModels) {
        if (availableModels[modelName].graphql.import) {

          availableModels[modelName].graphql.import.forEach((association) => {

            for (let index = 0; index < remoteSchema.queries.length; index++) {
              if (remoteSchema.queries[index].output === association.from) {
                availableModels[modelName].associations[(association.as || association.from)] = {
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

      }

      const modelTypes = types || generateModelTypes(availableModels, remoteSchema.types);

      //modelTypes.outputTypes = Object.assign({}, modelTypes.outputTypes, remoteSchema.types);

      return {
        query: generateQueryRootType(availableModels, modelTypes.outputTypes, modelTypes.inputTypes),
        mutation: generateMutationRootType(availableModels, modelTypes.inputTypes, modelTypes.inputUpdateTypes, modelTypes.outputTypes)
      };

    });

  } else {

    const modelTypes = types || generateModelTypes(availableModels);

    return {
      query: generateQueryRootType(availableModels, modelTypes.outputTypes, modelTypes.inputTypes),
      mutation: generateMutationRootType(availableModels, modelTypes.inputTypes, modelTypes.inputUpdateTypes, modelTypes.outputTypes)
    };
  }

};

module.exports = _options => {
  options = Object.assign(options, _options);
  return {
    generateGraphQLType,
    generateModelTypes,
    generateSchema,
    dataloaderContext,
    errorHandler,
    whereQueryVarsToValues
  };
};