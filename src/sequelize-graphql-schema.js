const {
  GraphQLObjectType,
  GraphQLInputObjectType,
  GraphQLList,
  GraphQLInt,
  GraphQLNonNull,
  GraphQLString
} = require('graphql');
const {
  resolver,
  attributeFields,
  defaultListArgs,
  defaultArgs
} = require('graphql-sequelize');

const camelCase = require('camelcase');

let options = {
  exclude: [ ],
  includeArguments: { },
  authorizer: function(){
    return Promise.resolve();
  }
};

const defaultModelGraphqlOptions = {
  attributes: {
    exclude: [],
    include: {}
  },
  alias: { },
  mutations: { },
  excludeMutations: [],
  excludeQueries: [],
  extend: { },
  before: { },
  overwrite: { }
};

let Models = {};

const resolverWrapper = (source, args, context, info) => {
  return resolver(source, args, context, info);
};

const includeArguments = () => {
  let includeArguments = {};
  for(let argument in options.includeArguments){
    includeArguments[argument] = { type: options.includeArguments[argument] === 'int' ? GraphQLInt : GraphQLString };
  }
  return includeArguments;
};

const execBefore = function(model, source, args, context, info, type, where){
  return new Promise((resolve, reject) => {
    if(model.graphql && model.graphql.hasOwnProperty('before') && model.graphql.before.hasOwnProperty(type)){
      return model.graphql.before[type](source, args, context, info, where).then(src => {
        resolve(src);
      });
    }else{
      resolve(source);
    }
  });
};

const findOneRecord = (model, where) => {
  if(where){
    return model.findOne({ where }).then(data => data);
  }else{
    return Promise.resolve();
  }
};

const queryResolver = (model, inputTypeName, source, args, context, info) => {

  const type = 'fetch';

  return options.authorizer(source, args, context, info).then(_ => {
    if(model.graphql.overwrite.hasOwnProperty(type)){
      return model.graphql.overwrite[type](source, args, context, info);
    }else{
      return execBefore(model, source, args, context, info, type)
      .then(src => {

        return resolver(model)(source, args, context, info)
        .then(data => {
          if(model.graphql.extend.hasOwnProperty(type)){
            return model.graphql.extend[type](data, source, args, context, info);
          }else{
            return data;
          }
        })
        .then(data => {
          return data;
          //return associationExtend(data, model, source, args, context, info);
        });

      });
    }
  });

};

const mutationResolver = (model, inputTypeName, source, args, context, info, type, where) => {

  return options.authorizer(source, args, context, info).then(_ => {
    if(model.graphql.overwrite.hasOwnProperty(type)){
      return model.graphql.overwrite[type](source, args, context, info, where);
    }else{
      return execBefore(model, source, args, context, info, type, where).then(src => {
        source = src;
        return findOneRecord(model, type === 'destroy' ? where : null).then(preData => {
          //console.log("I am here");
          return model[type](type === 'destroy' ? { where } : args[inputTypeName], { where }).then(data => {
            if(model.graphql.extend.hasOwnProperty(type)){
              return model.graphql.extend[type](type === 'destroy' ? preData : data, source, args, context, info, where);
            }else{
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
const generateAssociationFields = (associations, types, isInput = false) => {
  let fields = {}
  for (let associationName in associations) {
    const relation = associations[associationName];
    // BelongsToMany is represented as a list, just like HasMany
    const type = relation.associationType === 'BelongsToMany' ||
    relation.associationType === 'HasMany'
    ? new GraphQLList(types[relation.target.name])
    : types[relation.target.name];

    fields[associationName] = { type };
    if (!isInput) {
      // GraphQLInputObjectType do not accept fields with resolve
      fields[associationName].args = Object.assign(defaultArgs(relation), defaultListArgs(), includeArguments());
      fields[associationName].resolve = (source, args, context, info) => {
        return resolver(relation)(source, args, context, info).then(result => {
          if(relation.target.graphql.extend.fetch && result.length){
            return relation.target.graphql.extend.fetch(result[0], source, args, context, info).then(item => {
              return [].concat(item);
            });
          }else{
            return result;
          }
        });
      }
    }
  }

  return fields;
};

const generateGraphQLField = (type) => {
  let isRequired = type.indexOf('!') > -1 ? true : false;
  type = type.replace('!', '');
  let field = type === 'int' ? GraphQLInt : GraphQLString;
  if(isRequired){
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
const generateGraphQLType = (model, types, isInput = false, method) => {
  const GraphQLClass = isInput ? GraphQLInputObjectType : GraphQLObjectType;
  let includeAttributes = {};
  if(isInput && model.graphql.attributes.include){
    for(let attribute in model.graphql.attributes.include){
      includeAttributes[attribute] = generateGraphQLField(model.graphql.attributes.include[attribute]);
    }
  }

  return new GraphQLClass({
    name: isInput ? `${model.name}Input` : model.name,
    fields: () => Object.assign(attributeFields(model, Object.assign({}, { allowNull: !!isInput })), generateAssociationFields(model.associations, types, isInput), includeAttributes)
  });
};

const generateCustomGraphQLTypes = (model, types, isInput = false) => {

  let customTypes = {};

  if(model.graphql && model.graphql.types){

    for(let type in model.graphql.types){

      let fields = {};

      for(let field in model.graphql.types[type]){
        fields[field] = generateGraphQLField(model.graphql.types[type][field]);
      }

      if(isInput){
        if(type.toUpperCase().endsWith('INPUT')){
          customTypes[type] = new GraphQLInputObjectType({
            name: type,
            fields: () => fields
          });
        }
      }else{
        if(!type.toUpperCase().endsWith('INPUT')){
          customTypes[type] = new GraphQLObjectType({
            name: type,
            fields: () => fields
          });
        }
      }

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
const generateModelTypes = models => {
  let outputTypes = {};
  let inputTypes = {};
  for (let modelName in models) {
    // Only our models, not Sequelize nor sequelize
    if (models[modelName].hasOwnProperty('name') && modelName !== 'Sequelize') {
      outputTypes[modelName] = generateGraphQLType(models[modelName], outputTypes);
      inputTypes[modelName] = generateGraphQLType(models[modelName], inputTypes, true);
      inputTypes = Object.assign(inputTypes, generateCustomGraphQLTypes(models[modelName], null ,true));
      outputTypes = Object.assign(outputTypes, generateCustomGraphQLTypes(models[modelName], null, false));
    }

  }

  return { outputTypes, inputTypes };
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

      if(models[modelType.name].graphql.excludeQueries.indexOf('query') === -1){
        queries[camelCase(modelType.name + 'Get')] = {
          type: new GraphQLList(modelType),
          args: Object.assign(defaultArgs(models[modelType.name]), defaultListArgs(), includeArguments()),
          resolve: (source, args, context, info) => {
            return queryResolver(models[modelType.name], modelType.name, source, args, context, info);
          }
        }
      };

      if(models[modelTypeName].graphql && models[modelTypeName].graphql.queries){

        for(let query in models[modelTypeName].graphql.queries){
          queries[camelCase(query)] = {
            type: outputTypes[models[modelTypeName].graphql.queries[query].output] || GraphQLInt,
            args: Object.assign({ [models[modelTypeName].graphql.queries[query].input]: { type: inputTypes[models[modelTypeName].graphql.queries[query].input] } }, includeArguments()),
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

const generateMutationRootType = (models, inputTypes, outputTypes) => {

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
          type: outputTypes[inputTypeName],
          description: 'Update a ' + inputTypeName,
          args: Object.assign({ [inputTypeName]: { type: inputType } }, includeArguments()),
          resolve: (source, args, context, info) => {
            const where = { [key]: args[inputTypeName][key] };
            return mutationResolver(models[inputTypeName], inputTypeName, source, args, context, info, 'update', where)
            .then(boolean => {
              // `boolean` equals the number of rows affected (0 or 1)
              return resolver(models[inputTypeName])(source, where, context, info);
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

      if(models[inputTypeName].graphql && models[inputTypeName].graphql.mutations){

        for(let mutation in models[inputTypeName].graphql.mutations){
          mutations[camelCase(mutation)] = {
            type: outputTypes[models[inputTypeName].graphql.mutations[mutation].output] || GraphQLInt,
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
const generateSchema = (models, types) => {

  Models = models;

  let availableModels = {};
  for (let modelName in models){
    models[modelName].graphql = models[modelName].graphql || defaultModelGraphqlOptions;
    models[modelName].graphql.attributes = Object.assign({}, defaultModelGraphqlOptions.attributes, models[modelName].graphql.attributes);
    models[modelName].graphql = Object.assign({}, defaultModelGraphqlOptions, models[modelName].graphql || {});
    if(options.exclude.indexOf(modelName) === -1){
      availableModels[modelName] = models[modelName];
    }
  }

  const modelTypes = types || generateModelTypes(availableModels);
  return {
    query: generateQueryRootType(availableModels, modelTypes.outputTypes, modelTypes.inputTypes),
    mutation: generateMutationRootType(availableModels, modelTypes.inputTypes, modelTypes.outputTypes)
  };
};

module.exports = _options => {
  options = Object.assign(options, _options);
  return {
    generateGraphQLType,
    generateModelTypes,
    generateSchema
  };
};
