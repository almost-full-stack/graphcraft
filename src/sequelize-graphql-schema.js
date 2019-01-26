const {
  GraphQLObjectType,
  GraphQLInputObjectType,
  GraphQLList,
  GraphQLInt,
  GraphQLNonNull,
  GraphQLString,
  GraphQLBoolean
} = require('graphql');
const {
  resolver,
  defaultListArgs,
  defaultArgs,
  JSONType,
  relay
} = require('graphql-sequelize');

const Sequelize = require("sequelize");

const attributeFields = require("./graphql-sequelize/attributeFields");

const {
  sequelizeConnection
} = relay;

const camelCase = require('camelcase');
const remoteSchema = require('./remoteSchema');
const { GraphQLClient } = require('graphql-request');
const _ = require('lodash');
const {createContext, EXPECTED_OPTIONS_KEY} = require('dataloader-sequelize');
const DataLoader = require('dataloader');
let dataloaderContext;

let options = {
  exclude: [],
  includeArguments: { },
  remote: { },
  dataloader: false,
  customTypes: [],
  logger(){
    return Promise.resolve();
  },
  authorizer(){
    return Promise.resolve();
  },
  errorHandler: {
    'ETIMEDOUT': {statusCode: 503}
  }
};

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
  alias: { },
  bulk: [],
  mutations: { },
  excludeMutations: [],
  excludeQueries: [],
  extend: { },
  before: { },
  overwrite: { }
};

let Models = {};

const errorHandler = (error) => {
  for(let name in options.errorHandler){
    if(error.message.indexOf(name) > -1) {
      Object.assign(error, options.errorHandler[name]);
      break;
    }
  }

  return error;
};

const remoteResolver = async (source, args, context, info, remoteQuery, remoteArguments, type) => {

  const availableArgs = _.keys(remoteQuery.args);
  const pickedArgs = _.pick(remoteArguments, availableArgs);
  let queryArgs = [];
  let passedArgs = [];

  for(const arg in pickedArgs){
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

  if(_.indexOf(availableArgs, key) > -1 && !variables.where){
    variables[key] = source[remoteQuery.with];
  }else if(_.indexOf(availableArgs, 'where') > -1){
    variables.where = variables.where || {};
    variables.where[key] = source[remoteQuery.with];
  }

  const headers = _.pick(context.headers, remoteQuery.headers);
  const client = new GraphQLClient(remoteQuery.endpoint, { headers });
  const data = await client.request(query, variables);

  return data[remoteQuery.name];

};

const includeArguments = () => {
  let includeArguments = {};
  for(let argument in options.includeArguments){
    includeArguments[argument] = generateGraphQLField(options.includeArguments[argument]);
  }
  return includeArguments;
};

const execBefore = (model, source, args, context, info, type, where) => {
  if(model.graphql && model.graphql.hasOwnProperty('before') && model.graphql.before.hasOwnProperty(type)){
    return model.graphql.before[type](source, args, context, info, where);
  }else{
    return Promise.resolve();
  }
};

const findOneRecord = (model, where) => {
  if(where){
    return model.findOne({ where });
  }else{
    return Promise.resolve();
  }
};

const queryResolver = (model, isAssoc = false, field = null) => {
  return async (source, args, context, info) => {
    var _model = field || !isAssoc ? model : model.target;
    const type = 'fetch';
  
    if (!isAssoc) // authorization should not be executed for nested queries
      await options.authorizer(source, args, context, info);
  
    if(_model.graphql.overwrite.hasOwnProperty(type)){
      return _model.graphql.overwrite[type](source, args, context, info);
    }
  
    await execBefore(_model, source, args, context, info, type);
  
    const before = (findOptions, args, context) => {
  
      const orderArgs = args.order || '';
      const orderBy = [];
  
      if(orderArgs != ""){
        const orderByClauses = orderArgs.split(',');
        orderByClauses.forEach((clause) => {
          if(clause.indexOf('reverse:') === 0){
            orderBy.push([clause.substring(8), 'DESC']);
          }else{
            orderBy.push([clause, 'ASC']);
          }
        });
  
        findOptions.order = orderBy;
      }
  
      findOptions.paranoid = ((args.where && args.where.deletedAt && args.where.deletedAt.ne === null) || args.paranoid === false) ? false : _model.options.paranoid;
      return findOptions;
    };
  
    const scope = Array.isArray(_model.graphql.scopes) ? { method: [_model.graphql.scopes[0], _.get(args, _model.graphql.scopes[1], _model.graphql.scopes[2] || null)] } : _model.graphql.scopes;
  
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
  
    if(_model.graphql.extend.hasOwnProperty(type)){
      return _model.graphql.extend[type](data, source, args, context, info);
    }
  
    return data;
  
  };
}

const mutationResolver = async (model, inputTypeName, source, args, context, info, type, where, isBulk) => {

  await options.authorizer(source, args, context, info);

  if(model.graphql.overwrite.hasOwnProperty(type)){
    return model.graphql.overwrite[type](source, args, context, info, where);
  }

  await execBefore(model, source, args, context, info, type, where);

  const preData = await findOneRecord(model, type === 'destroy' ? where : null);
  const operationType = (isBulk && type === 'create') ? 'bulkCreate' : type;
  const validate = true;
  const data = await model[operationType](type === 'destroy' ? { where } : args[inputTypeName], { where, validate });

  if(model.graphql.extend.hasOwnProperty(type)){
    return model.graphql.extend[type](type === 'destroy' ? preData : data, source, args, context, info, where);
  }

  if(operationType === 'bulkCreate'){
    return args[inputTypeName].length;
  }

  return data;

};

function fixIds(
  model,
  fields,
) {
  const newId= (modelName, allowNull = false)=> {return {
      name: 'id',
      description: `The ID for ${modelName}`,
      type: allowNull ? GraphQLInt : new GraphQLNonNull(GraphQLInt)
  }}

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
          fields[key] = newId(modelName, attr.allowNull);
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

  return { type, isArray, isRequired };
};

const generateGraphQLField = (type) => {

  const typeReference = sanitizeFieldName(type);

  type = typeReference.type.toLowerCase();

  let field = type === 'int' ? GraphQLInt 
            : type === 'boolean' ? GraphQLBoolean 
            : options.customTypes[typeReference.type] ? options.customTypes[typeReference.type] 
            : GraphQLString;

  if(typeReference.isArray){
    field = new GraphQLList(field);
  }

  if(typeReference.isRequired){
    field = GraphQLNonNull(field);
  }

  return { type: field };
};

const toGraphQLType = function(name, schema){

  let fields = {};

  for(const field in schema){
    fields[field] = generateGraphQLField(schema[field]);
  }

  return new GraphQLObjectType({
    name,
    fields: () => fields
  });

};

const generateTypesFromObject = function(remoteData){

  const types = {};
  let queries = [];

  remoteData.forEach((item) => {

    for(const type in item.types){
      types[type] = toGraphQLType(type, item.types[type]);
    }
    item.queries.forEach((query) => {
      let args = {};
      for(const arg in query.args){
        args[arg] = generateGraphQLField(query.args[arg]);
      }
      query.args = args;
    });
    queries = queries.concat(item.queries);
  });

  return { types, queries };

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
const generateAssociationFields = (model, associations, types, cache, isInput = false) => {
  let fields = {}

  for (let associationName in associations) {
    const relation = associations[associationName];

    if (!types[relation.target.name]) {
      return fields;
    }

    // BelongsToMany is represented as a list, just like HasMany
    const type = relation.associationType === 'BelongsToMany' ||
      relation.associationType === 'HasMany' ?
      new GraphQLList(types[relation.target.name]) :
      types[relation.target.name];

    fields[associationName] = {
      type
    };

    if (!isInput) {
      if (!relation.isRemote) {
        // 1:1 doesn't need connectionFields
        if (["BelongsTo", "hasOne"].indexOf(relation.associationType) < 0) {
          if (relation.associationType === "BelongsToMany") {
            const aModel = relation.through.model;

            var exclude = aModel.graphql.attributes.exclude;
            exclude = Array.isArray(exclude) ? exclude : exclude["fetch"];

            var only = aModel.graphql.attributes.only;
            only = Array.isArray(only) ? only : only["fetch"];

            edgeFields = Object.assign(attributeFields(aModel, {
              exclude,
              only,
              commentToDescription: true,
              cache
            }), types[relation.target.name].args);

            // Pass Through model to resolve function
            _.each(edgeFields, (edgeField, field) => {
              edgeField.resolve = queryResolver(aModel, true, field)
            });
          }

          let connection = sequelizeConnection({
            name: model.name + associationName,
            nodeType: types[relation.target.name],
            target: relation,
            connectionFields: {
              total: {
                type: new GraphQLNonNull(GraphQLInt),
                description: `Total count of ${type.name} results associated with ${relation.target.name}.`,
                resolve: (source, args, context, info) => {
                  return source.edges.length;
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
          fields[associationName].args = Object.assign(defaultArgs(relation), defaultListArgs(), types[relation.target.name].args);
          fields[associationName].resolve = queryResolver(relation, true);
        }
      } else {
        fields[associationName].args = Object.assign({}, relation.query.args, defaultListArgs());
        fields[associationName].resolve = (source, args, context, info) => {
          return remoteResolver(source, args, context, info, relation.query, fields[associationName].args, types[relation.target.name]);
        }
      }
    }
  }

  return fields;
};

const generateIncludeAttributes = (model, types, isInput = false) => {
  let includeAttributes = {};
  if(model.graphql.attributes.include){
    for(let attribute in model.graphql.attributes.include){
      var type = null;
      if (types) {
        if (isInput && types[model.graphql.attributes.include[attribute]+"Input"])
          type = { type: types[model.graphql.attributes.include[attribute]+"Input"] };
        else if (types[model.graphql.attributes.include[attribute]])
          type = { type: types[model.graphql.attributes.include[attribute]] }
      }

      includeAttributes[attribute] = type || generateGraphQLField(model.graphql.attributes.include[attribute]);
    }
  }

  return includeAttributes;
}

/**
* Returns a new `GraphQLObjectType` created from a sequelize model.
*
* It creates a `GraphQLObjectType` object with a name and fields. The
* fields are generated from its sequelize associations.
* @param {*} model The sequelize model used to create the `GraphQLObjectType`
* @param {*} types Existing `GraphQLObjectType` types, created from all the Sequelize models
*/
const generateGraphQLType = (model, types, cache, isInput = false, isUpdate = false) => {
  const GraphQLClass = isInput ? GraphQLInputObjectType : GraphQLObjectType;

  var exclude = model.graphql.attributes.exclude;
  exclude = Array.isArray(exclude) ? exclude : exclude[!isInput ? "fetch" : isUpdate ? "update" : "create"];

  var only = model.graphql.attributes.only;
  only = Array.isArray(only) ? only : only[!isInput ? "fetch" : isUpdate ? "update" : "create"];

  var fields=Object.assign(
    attributeFields(model, Object.assign({}, { 
      exclude,
      only, 
      allowNull: !isInput || isUpdate,
      checkDefaults: isInput,
      commentToDescription: true,
      cache 
    })), 
    !isInput ? generateAssociationFields(model, model.associations, types, cache, isInput) : {}, 
    generateIncludeAttributes(model,types,isInput)
  );

  if (isInput) {
    fixIds(model, fields);

    // FIXME: Handle timestamps
    // console.log('_timestampAttributes', Model._timestampAttributes);
    delete fields.createdAt;
    delete fields.updatedAt;
  }

  return new GraphQLClass({
    name: isInput ? model.name+(isUpdate? "Edit" : "")+"Input" : model.name,
    fields: () => fields
  });
};

const generateCustomGraphQLTypes = (model, types, isInput = false) => {

  const typeCreated = {};
  const customTypes = {};

  const getCustomType = (type, ignoreInputCheck) => {

    const fields = {};

    for(let field in model.graphql.types[type]){

      const fieldReference = sanitizeFieldName(model.graphql.types[type][field]);

      if(customTypes[fieldReference.type] !== undefined || model.graphql.types[fieldReference.type] != undefined){
        typeCreated[fieldReference.type] = true;

        let customField = customTypes[fieldReference.type] || getCustomType(fieldReference.type, true);

        if(fieldReference.isArray){
          customField = new GraphQLList(customField);
        }

        if(fieldReference.isRequired){
          customField = GraphQLNonNull(customField);
        }

        fields[fieldReference.type] = { type: customField };

      }else{
        typeCreated[type] = true;
        fields[field] = generateGraphQLField(model.graphql.types[type][field]);
      }

    }

    if(isInput && !ignoreInputCheck){
      if(type.toUpperCase().endsWith('INPUT')){
        return new GraphQLInputObjectType({
          name: type,
          fields: () => fields
        });
      }
    }else{
      if(!type.toUpperCase().endsWith('INPUT')){
        return new GraphQLObjectType({
          name: type,
          fields: () => fields
        });
      }
    }

  };

  if(model.graphql && model.graphql.types){

    for(let type in model.graphql.types){

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
const generateModelTypes = (models, remoteTypes) => {
  let outputTypes = remoteTypes || {};
  let inputTypes = {};
  let inputUpdateTypes = {};
  for (let modelName in models) {
    // Only our models, not Sequelize nor sequelize
    if (models[modelName].hasOwnProperty('name') && modelName !== 'Sequelize') {
      const cache = {};
      outputTypes = Object.assign(outputTypes, generateCustomGraphQLTypes(models[modelName], null, false));
      inputTypes = Object.assign(inputTypes, generateCustomGraphQLTypes(models[modelName], null, true));
      outputTypes[modelName] = generateGraphQLType(models[modelName], outputTypes,  cache, false);
      inputTypes[modelName] = generateGraphQLType(models[modelName], inputTypes, cache, true);
      inputUpdateTypes[modelName] = generateGraphQLType(models[modelName], inputTypes, cache, true, true);
    }
  }

  return { outputTypes, inputTypes, inputUpdateTypes };
};

const generateModelTypesFromRemote = (context) => {
  if(options.remote){

    let promises = [];

    for(let opt in options.remote.import){

      options.remote.import[opt].headers = options.remote.import[opt].headers || options.remote.headers;
      promises.push(remoteSchema(options.remote.import[opt], context));

    }

    return Promise.all(promises);

  }else{
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

  for(let outputTypeName in outputTypes){
    if(models[outputTypeName]){
      createQueriesFor[outputTypeName] = outputTypes[outputTypeName];
    }
  }

  return new GraphQLObjectType({
    name: 'Root_Query',
    fields: Object.keys(createQueriesFor).reduce((fields, modelTypeName) => {

      const modelType = outputTypes[modelTypeName];
      let queries = {
        [modelType.name + 'Default']: {
          type: GraphQLInt,
          description: 'An empty default Query.',
          resolve: () => 1
        }
      };

      const paranoidType = models[modelType.name].options.paranoid ? { paranoid: { type: GraphQLBoolean } } : {};

      const aliases = models[modelType.name].graphql.alias;

      if(models[modelType.name].graphql.excludeQueries.indexOf('query') === -1){
        queries[camelCase(aliases.fetch || (modelType.name + 'Get'))] = {
          type: new GraphQLList(modelType),
          args: Object.assign(defaultArgs(models[modelType.name]), defaultListArgs(), includeArguments(), paranoidType),
          resolve: queryResolver(models[modelType.name])
        }
      };

      if(models[modelTypeName].graphql && models[modelTypeName].graphql.queries){

        for(let query in models[modelTypeName].graphql.queries){

          let isArray = false;
          let outPutType = GraphQLInt;
          let typeName = models[modelTypeName].graphql.queries[query].output;

          if(typeName){
            if(typeName.startsWith('[')){
              typeName = typeName.replace('[', '');
              typeName = typeName.replace(']', '');
              isArray = true;
            }

            if(isArray){
              outPutType = new GraphQLList(outputTypes[typeName]);
            }else{
              outPutType = outputTypes[models[modelTypeName].graphql.queries[query].output];
            }
          }

          const inputArg = models[modelTypeName].graphql.queries[query].input ? { [models[modelTypeName].graphql.queries[query].input]: { type: inputTypes[models[modelTypeName].graphql.queries[query].input] } } : {};

          queries[camelCase(query)] = {
            type: outPutType,
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

    }, { })
  });
};

const generateMutationRootType = (models, inputTypes, inputUpdateTypes, outputTypes) => {

  let createMutationFor = {};

  for(let inputTypeName in inputTypes){
    if(models[inputTypeName]){
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

      if(models[inputTypeName].graphql.excludeMutations.indexOf('create') === -1){
        mutations[camelCase(aliases.create || (inputTypeName + 'Add'))] = {
          type: outputTypes[inputTypeName], // what is returned by resolve, must be of type GraphQLObjectType
          description: 'Create a ' + inputTypeName,
          args: Object.assign({ [inputTypeName]: { type: inputType } }, includeArguments()),
          resolve: (source, args, context, info) => mutationResolver(models[inputTypeName], inputTypeName, source, args, context, info, 'create')
        };
      }

      if(models[inputTypeName].graphql.excludeMutations.indexOf('update') === -1){
        mutations[camelCase(aliases.update || (inputTypeName + 'Edit'))] = {
          type: outputTypes[inputTypeName] || GraphQLInt,
          description: 'Update a ' + inputTypeName,
          args: Object.assign({ [inputTypeName]: { type: inputUpdateType } }, includeArguments()),
          resolve: (source, args, context, info) => {
            const where = { [key]: args[inputTypeName][key] };
            return mutationResolver(models[inputTypeName], inputTypeName, source, args, context, info, 'update', where)
            .then(boolean => {
              // `boolean` equals the number of rows affected (0 or 1)
              return resolver(models[inputTypeName], {[EXPECTED_OPTIONS_KEY]: dataloaderContext})(source, where, context, info);
            });
          }
        };
      }

      if(models[inputTypeName].graphql.excludeMutations.indexOf('destroy') === -1){
        mutations[camelCase(aliases.destroy || (inputTypeName + 'Delete'))] = {
          type: GraphQLInt,
          description: 'Delete a ' + inputTypeName,
          args: Object.assign({ [key]: { type: new GraphQLNonNull(GraphQLInt) } }, includeArguments()),
          resolve: (source, args, context, info) => {
            const where = { [key]: args[key] };
            return mutationResolver(models[inputTypeName], inputTypeName, source, args, context, info, 'destroy', where);
          }
        };
      }

      if(models[inputTypeName].graphql.bulk.indexOf('create') > -1){
        mutations[camelCase(aliases.create || (inputTypeName + 'AddBulk'))] = {
          type: GraphQLInt, // what is returned by resolve, must be of type GraphQLObjectType
          description: 'Create bulk ' + inputTypeName + ' and return number of rows created.',
          args: Object.assign({ [inputTypeName]: { type: new GraphQLList(inputType) } }, includeArguments()),
          resolve: (source, args, context, info) => mutationResolver(models[inputTypeName], inputTypeName, source, args, context, info, 'create', null, true)
        };
      }

      if(models[inputTypeName].graphql && models[inputTypeName].graphql.mutations){

        for(let mutation in models[inputTypeName].graphql.mutations){

          let isArray = false;
          let outPutType = GraphQLInt;
          let typeName = models[inputTypeName].graphql.mutations[mutation].output;

          if(typeName){
            if(typeName.startsWith('[')){
              typeName = typeName.replace('[', '');
              typeName = typeName.replace(']', '');
              isArray = true;
            }

            if(isArray){
              outPutType = new GraphQLList(outputTypes[typeName]);
            }else{
              outPutType = outputTypes[typeName];
            }
          }

          mutations[camelCase(mutation)] = {
            type: outPutType,
            args: Object.assign({ [models[inputTypeName].graphql.mutations[mutation].input]: { type: inputTypes[models[inputTypeName].graphql.mutations[mutation].input] } }, includeArguments()),
            resolve: (source, args, context, info) => {
              const where = key && args[inputTypeName] ? { [key]: args[inputTypeName][key] } : { };
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

    }, { })
  });
};

// This function is exported
const generateSchema = (models, types, context) => {

  Models = models;

  if(options.dataloader) dataloaderContext = createContext(models.sequelize);

  let availableModels = {};
  for (let modelName in models){
    models[modelName].graphql = models[modelName].graphql || defaultModelGraphqlOptions;
    models[modelName].graphql.attributes = Object.assign({}, defaultModelGraphqlOptions.attributes, models[modelName].graphql.attributes);
    models[modelName].graphql = Object.assign({}, defaultModelGraphqlOptions, models[modelName].graphql || {});
    if(options.exclude.indexOf(modelName) === -1){
      availableModels[modelName] = models[modelName];
    }
  }

  if(options.remote && options.remote.import){

    return generateModelTypesFromRemote(context).then((result) => {

      const remoteSchema = generateTypesFromObject(result);

      for(const modelName in availableModels){
        if(availableModels[modelName].graphql.import){

          availableModels[modelName].graphql.import.forEach((association) => {

            for(let index = 0; index < remoteSchema.queries.length; index ++){
                if(remoteSchema.queries[index].output === association.from){
                    availableModels[modelName].associations[(association.as || association.from)] = {
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

      }

      const modelTypes = types || generateModelTypes(availableModels, remoteSchema.types);

      //modelTypes.outputTypes = Object.assign({}, modelTypes.outputTypes, remoteSchema.types);

      return {
        query: generateQueryRootType(availableModels, modelTypes.outputTypes, modelTypes.inputTypes),
        mutation: generateMutationRootType(availableModels, modelTypes.inputTypes, modelTypes.inputUpdateTypes, modelTypes.outputTypes)
      };

    });

  }else{

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
    errorHandler
  };
};
