const {
  GraphQLObjectType,
  GraphQLInputObjectType,
  GraphQLList,
  GraphQLInt,
  GraphQLNonNull,
  GraphQLString,
  GraphQLBoolean,
  GraphQLEnumType
} = require('graphql');
const {
  resolver,
  attributeFields,
  defaultListArgs,
  defaultArgs,
  argsToFindOptions,
  relay
} = require('graphql-sequelize');
const camelCase = require('camelcase');
const remoteSchema = require('./remoteSchema');
const { GraphQLClient } = require('graphql-request');
const _ = require('lodash');
const { createContext, EXPECTED_OPTIONS_KEY, resetCache } = require('dataloader-sequelize');
const DataLoader = require('dataloader');
const TRANSACTION_NAMESPACE = 'sequelize-graphql-schema';
const cls = require('cls-hooked');
const uuid = require('uuid/v4');
const sequelizeNamespace = cls.createNamespace(TRANSACTION_NAMESPACE);
let dataloaderContext;

let options = {
  exclude: [],
  includeArguments: { },
  remote: { },
  dataloader: false,
  transactionedMutations: true,
  privateMode: false,
  logger() {
    return Promise.resolve();
  },
  authorizer() {
    return Promise.resolve();
  },
  errorHandler: {
    'ETIMEDOUT': { statusCode: 503 }
  }
};

const defaultModelGraphqlOptions = {
  attributes: {
    exclude: [], // list attributes which are to be ignored in Model Input
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
  for (const name in options.errorHandler) {
    if (error.message.indexOf(name) > -1) {
      Object.assign(error, options.errorHandler[name]);
      break;
    }
  }

  return error;
};

const remoteResolver = async (source, args, context, info, remoteQuery, remoteArguments, type) => {

  const availableArgs = _.keys(remoteQuery.args);
  const pickedArgs = _.pick(remoteArguments, availableArgs);
  const queryArgs = [];
  const passedArgs = [];

  for (const arg in pickedArgs) {
    queryArgs.push(`$${arg}:${pickedArgs[arg].type}`);
    passedArgs.push(`${arg}:$${arg}`);
  }

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
  const client = new GraphQLClient(remoteQuery.endpoint, { headers });
  const data = await client.request(query, variables);

  return data[remoteQuery.name];

};

const includeArguments = () => {
  const includeArguments = {};

  for (const argument in options.includeArguments) {
    includeArguments[argument] = generateGraphQLField(options.includeArguments[argument]);
  }

return includeArguments;
};

const execBefore = (model, source, args, context, info, type, where) => {
  if (model.graphql && model.graphql.hasOwnProperty('before') && model.graphql.before.hasOwnProperty(type)) {
    return model.graphql.before[type](source, args, context, info, where);
  }

return Promise.resolve();

};

const findOneRecord = (model, where) => {
  if (where) {
    return model.findOne({ where });
  }

return Promise.resolve();

};

const queryResolver = async (model, inputTypeName, source, args, context, info) => {

  const type = 'fetch';

  await options.authorizer(source, args, context, info);

  if (model.graphql.overwrite.hasOwnProperty(type)) {
    return model.graphql.overwrite[type](source, args, context, info);
  }

  await execBefore(model, source, args, context, info, type);

  const before = (findOptions, args, context) => {

    const orderArgs = args.order || '';
    const orderBy = [];

    if (orderArgs != '') {
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

    findOptions.paranoid = ((args.where && args.where.deletedAt && args.where.deletedAt.ne === null) || args.paranoid === false) ? false : model.options.paranoid;

return findOptions;
  };

  const scope = Array.isArray(model.graphql.scopes) ? { method: [model.graphql.scopes[0], _.get(args, model.graphql.scopes[1], model.graphql.scopes[2] || null)] } : model.graphql.scopes;

  const data = await resolver(model.scope(scope), {
    [EXPECTED_OPTIONS_KEY]: dataloaderContext,
    before
  })(source, args, context, info);

  if (model.graphql.extend.hasOwnProperty(type)) {
    return model.graphql.extend[type](data, source, args, context, info);
  }

  return data;

};

const mutationResolver = async (model, inputTypeName, source, args, context, info, type, where, isBulk) => {

  await options.authorizer(source, args, context, info);

  if (model.graphql.overwrite.hasOwnProperty(type)) {
    return model.graphql.overwrite[type](source, args, context, info, where);
  }

  const resolveMutation = async () => {

    await execBefore(model, source, args, context, info, type, where);

    let data = null;
    const preData = await findOneRecord(model, type === 'destroy' ? where : null);
    const operationType = (isBulk && type === 'create') ? 'bulkCreate' : type;

    if (isBulk && type === 'update') {

      const keys = model.primaryKeyAttributes;
      const updatePromises = [];

      args[inputTypeName].forEach((input) => {
        updatePromises.push(
          model.update(input, { where: keys.reduce((all, key) => {
            all[key] = input[key];

return all;
          }, {}) })
        );
      });

      data = await Promise.all(updatePromises);

    } else {

      if (typeof isBulk === 'string' && args[inputTypeName].length && !args[inputTypeName][0][isBulk]) {

        const bulkAddId = uuid();

        args[inputTypeName].forEach((input) => {
          input[isBulk] = bulkAddId;
        });

      }

      const validate = true;

      data = await model[operationType](type === 'destroy' ? { where } : args[inputTypeName], { where, validate });

      if (typeof isBulk === 'string') {
        data = await model.findAll({ where: { [isBulk]: args[inputTypeName][0][isBulk] } });
      }

    }

    if (model.graphql.extend.hasOwnProperty(type)) {
      data = await model.graphql.extend[type](type === 'destroy' ? preData : data, source, args, context, info, where);
    }

    if (operationType === 'bulkCreate' && isBulk === true) return data.length;

    await options.logger(data, source, args, context, info);

    return data;

  };

  if (options.transactionedMutations) {

    return Models.sequelize.transaction((transaction) => {
      context.transaction = transaction;

return resolveMutation();
    });

  }

return resolveMutation();


};

const sanitizeFieldName = (type) => {
  const isRequired = type.indexOf('!') > -1;
  const isArray = type.indexOf('[') > -1;

  type = type.replace('[', '');
  type = type.replace(']', '');
  type = type.replace('!', '');

  return { type, isArray, isRequired };
};

const generateGraphQLField = (type) => {

  const typeReference = sanitizeFieldName(type);

  type = typeReference.type.toLowerCase();

  let field = type === 'int' ? GraphQLInt : type === 'boolean' ? GraphQLBoolean : GraphQLString;

  if (typeReference.isArray) {
    field = new GraphQLList(field);
  }

  if (typeReference.isRequired) {
    field = GraphQLNonNull(field);
  }

  return { type: field };
};

const toGraphQLType = function(name, schema) {

  const fields = {};

  for (const field in schema) {
    fields[field] = generateGraphQLField(schema[field]);
  }

  return new GraphQLObjectType({
    name,
    fields: () => fields
  });

};

const generateTypesFromObject = function(remoteData) {

  const types = {};
  let queries = [];

  remoteData.forEach((item) => {

    for (const type in item.types) {
      types[type] = toGraphQLType(type, item.types[type]);
    }
    item.queries.forEach((query) => {
      const args = {};

      for (const arg in query.args) {
        args[arg] = generateGraphQLField(query.args[arg]);
      }
      query.args = args;
    });
    queries = queries.concat(item.queries);
  });

  return { types, queries };

};

function getBulkOption(options, key) {
  const bulkOption = options.filter((option) => (Array.isArray(option) ? option[0] == key : option == key));

return bulkOption.length ? (Array.isArray(bulkOption[0]) ? bulkOption[0][1] : true) : false;
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
const generateAssociationFields = (associations, types, isInput = false) => {
  const fields = {}

  for (const associationName in associations) {
    const relation = associations[associationName];

    if (!types[relation.target.name]) {
      return fields;
    }

    // BelongsToMany is represented as a list, just like HasMany
    const type = relation.associationType === 'BelongsToMany' ||
    relation.associationType === 'HasMany'
    ? new GraphQLList(types[relation.target.name])
    : types[relation.target.name];

    fields[associationName] = { type };

    if (!isInput && !relation.isRemote) {
      // GraphQLInputObjectType do not accept fields with resolve
      fields[associationName].args = Object.assign(defaultArgs(relation), defaultListArgs(), includeArguments());
      fields[associationName].resolve = async (source, args, context, info) => {

        await execBefore(relation.target, source, args, context, info, 'fetch');
        const data = await resolver(relation, { [EXPECTED_OPTIONS_KEY]: dataloaderContext })(source, args, context, info);

        if (relation.target.graphql.extend.fetch && data.length) {
          const item = await relation.target.graphql.extend.fetch(data, source, args, context, info);

return [].concat(item);
        }

        return data;

      };

    } else if (!isInput && relation.isRemote) {
      fields[associationName].args = Object.assign({}, relation.query.args, defaultListArgs());
      fields[associationName].resolve = (source, args, context, info) => {
        return remoteResolver(source, args, context, info, relation.query, fields[associationName].args, types[relation.target.name]);
      }

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
const generateGraphQLType = (model, types, isInput = false, cache) => {
  const GraphQLClass = isInput ? GraphQLInputObjectType : GraphQLObjectType;
  const includeAttributes = {};

  if (model.graphql.attributes.include) {
    for (const attribute in model.graphql.attributes.include) {
      const type = types && types[model.graphql.attributes.include[attribute]] ? { type: types[model.graphql.attributes.include[attribute]] } : null;

      includeAttributes[attribute] = type || generateGraphQLField(model.graphql.attributes.include[attribute]);
    }
  }

  return new GraphQLClass({
    name: isInput ? `${model.name}Input` : model.name,
    fields: () => Object.assign(attributeFields(model, Object.assign({}, { allowNull: Boolean(isInput), cache })), generateAssociationFields(model.associations, types, isInput), includeAttributes)
  });
};

const generateCustomGraphQLTypes = (model, types, isInput = false) => {

  const typeCreated = {};
  const customTypes = {};

  const getCustomType = (type, ignoreInputCheck) => {

    const fields = {};

    //Enum
    if (Array.isArray(model.graphql.types[type])) {
      model.graphql.types[type].forEach((value) => {
        if (Array.isArray(value)) {
          fields[value[0]] = { value: value[1] };
        } else {
          fields[value] = { value: value };
        }
      });

      return new GraphQLEnumType({
        name: type,
        values: fields
      });
    }

    for (const field in model.graphql.types[type]) {

      const fieldReference = sanitizeFieldName(model.graphql.types[type][field]);

      if (customTypes[fieldReference.type] !== undefined || model.graphql.types[fieldReference.type] != undefined) {
        typeCreated[fieldReference.type] = true;

        let customField = customTypes[fieldReference.type] || getCustomType(fieldReference.type, true);

        if (fieldReference.isArray) {
          customField = new GraphQLList(customField);
        }

        if (fieldReference.isRequired) {
          customField = GraphQLNonNull(customField);
        }

        fields[fieldReference.type] = { type: customField };

      } else {
        typeCreated[type] = true;
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
    } else if (!type.toUpperCase().endsWith('INPUT')) {
        return new GraphQLObjectType({
          name: type,
          fields: () => fields
        });
      }

  };

  if (model.graphql && model.graphql.types) {

    for (const type in model.graphql.types) {

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

  for (const modelName in models) {
    // Only our models, not Sequelize nor sequelize
    if (models[modelName].hasOwnProperty('name') && modelName !== 'Sequelize') {
      const cache = {};

      inputTypes = Object.assign(inputTypes, generateCustomGraphQLTypes(models[modelName], null, true));
      outputTypes = Object.assign(outputTypes, generateCustomGraphQLTypes(models[modelName], null, false));
      outputTypes[modelName] = generateGraphQLType(models[modelName], outputTypes, false, cache);
      inputTypes[modelName] = generateGraphQLType(models[modelName], inputTypes, true, cache);
    }

  }

  return { outputTypes, inputTypes };
};

const generateModelTypesFromRemote = (context) => {
  if (options.remote) {

    const promises = [];

    for (const opt in options.remote.import) {

      options.remote.import[opt].headers = options.remote.import[opt].headers || options.remote.headers;
      promises.push(remoteSchema(options.remote.import[opt], context));

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
const generateQueryRootType = (models, outputTypes, inputTypes) => {

  const createQueriesFor = {};

  for (const outputTypeName in outputTypes) {
    if (models[outputTypeName]) {
      createQueriesFor[outputTypeName] = outputTypes[outputTypeName];
    }
  }

  return new GraphQLObjectType({
    name: 'Root_Query',
    fields: Object.keys(createQueriesFor).reduce((fields, modelTypeName) => {

      const modelType = outputTypes[modelTypeName];
      const queries = {
        [modelType.name + 'Default']: {
          type: GraphQLInt,
          description: 'An empty default Query.',
          resolve: () => 1
        }
      };
      const paranoidType = models[modelType.name].options.paranoid ? { paranoid: { type: GraphQLBoolean } } : {};

      const aliases = models[modelType.name].graphql.alias;

      if (models[modelType.name].graphql.excludeQueries.indexOf('query') === -1) {
        queries[camelCase(aliases.fetch || (modelType.name + 'Get'))] = {
          type: new GraphQLList(modelType),
          args: Object.assign(defaultArgs(models[modelType.name]), defaultListArgs(), includeArguments(), paranoidType),
          resolve: (source, args, context, info) => {
            return queryResolver(models[modelType.name], modelType.name, source, args, context, info);
          }
        }
      }

      if (models[modelTypeName].graphql && models[modelTypeName].graphql.queries) {

        for (const query in models[modelTypeName].graphql.queries) {

          let isArray = false;
          let isRequired = false;
          let outPutType = GraphQLInt;
          let inPutType = GraphQLInt;
          let typeName = models[modelTypeName].graphql.queries[query].output;
          let inputTypeNameField = models[modelTypeName].graphql.queries[query].input;

          if (typeName) {

            const typeReference = sanitizeFieldName(typeName);

            typeName = typeReference.type;
            isArray = typeReference.isArray;
            isRequired = typeReference.isRequired;

            if (isArray) {
              outPutType = new GraphQLList(outputTypes[typeName]);
            } else {
              outPutType = outputTypes[models[modelTypeName].graphql.queries[query].output];
            }

          }

          if (inputTypeNameField) {

            const typeReference = sanitizeFieldName(inputTypeNameField);

            inputTypeNameField = typeReference.type;

            if (typeReference.isArray) {
              inPutType = new GraphQLList(inputTypes[inputTypeNameField]);
            } else {
              inPutType = inputTypes[inputTypeNameField];
            }

            if (typeReference.isRequired) {
              inPutType = GraphQLNonNull(inPutType);
            }
          }

          const inputArg = models[modelTypeName].graphql.queries[query].input ? { [inputTypeNameField]: { type: inPutType } } : {};

          queries[camelCase(query)] = {
            type: outPutType,
            args: Object.assign(inputArg, defaultListArgs(), includeArguments(), paranoidType),
            resolve: (source, args, context, info) => {
              return options.authorizer(source, args, context, info).then((_) => {
                return models[modelTypeName].graphql.queries[query].resolver(source, args, context, info);
              });
            }
          };
        }

      }

      return Object.assign(fields, queries);

    }, { })
  });
};

const generateMutationRootType = (models, inputTypes, outputTypes) => {

  const createMutationFor = {};

  for (const inputTypeName in inputTypes) {
    if (models[inputTypeName]) {
      createMutationFor[inputTypeName] = inputTypes[inputTypeName];
    }
  }

  return new GraphQLObjectType({
    name: 'Root_Mutations',
    fields: Object.keys(createMutationFor).reduce((fields, inputTypeName) => {

      const inputType = inputTypes[inputTypeName];
      const key = models[inputTypeName].primaryKeyAttributes[0];
      const aliases = models[inputTypeName].graphql.alias;

      const mutations = {
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
          args: Object.assign({ [inputTypeName]: { type: inputType } }, includeArguments()),
          resolve: (source, args, context, info) => mutationResolver(models[inputTypeName], inputTypeName, source, args, context, info, 'create')
        };
      }

      if (models[inputTypeName].graphql.excludeMutations.indexOf('update') === -1) {
        mutations[camelCase(aliases.update || (inputTypeName + 'Edit'))] = {
          type: outputTypes[inputTypeName] || GraphQLInt,
          description: 'Update a ' + inputTypeName,
          args: Object.assign({ [inputTypeName]: { type: inputType } }, includeArguments()),
          resolve: (source, args, context, info) => {
            const where = { [key]: args[inputTypeName][key] };

return mutationResolver(models[inputTypeName], inputTypeName, source, args, context, info, 'update', where).
            then((boolean) => {
              // `boolean` equals the number of rows affected (0 or 1)
              return resolver(models[inputTypeName], { [EXPECTED_OPTIONS_KEY]: dataloaderContext })(source, where, context, info);
            });
          }
        };
      }

      if (models[inputTypeName].graphql.excludeMutations.indexOf('destroy') === -1) {
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

      const hasBulkOptionCreate = getBulkOption(models[inputTypeName].graphql.bulk, 'create');
      const hasBulkOptionEdit = getBulkOption(models[inputTypeName].graphql.bulk, 'edit');

      if (hasBulkOptionCreate) {
        mutations[camelCase(aliases.create || (inputTypeName + 'AddBulk'))] = {
          type: (typeof hasBulkOptionCreate === 'string') ? new GraphQLList(outputTypes[inputTypeName]) : GraphQLInt, // what is returned by resolve, must be of type GraphQLObjectType
          description: 'Create bulk ' + inputTypeName + ' and return number of rows or created rows.',
          args: Object.assign({ [inputTypeName]: { type: new GraphQLList(inputType) } }, includeArguments()),
          resolve: (source, args, context, info) => mutationResolver(models[inputTypeName], inputTypeName, source, args, context, info, 'create', null, hasBulkOptionCreate)
        };
      }

      if (hasBulkOptionEdit) {

        mutations[camelCase(aliases.edit || (inputTypeName + 'EditBulk'))] = {
          type: outputTypes[inputTypeName] ? new GraphQLList(outputTypes[inputTypeName]) : GraphQLInt, // what is returned by resolve, must be of type GraphQLObjectType
          description: 'Update bulk ' + inputTypeName + ' and return number of rows modified or updated rows.',
          args: Object.assign({ [inputTypeName]: { type: new GraphQLList(inputType) } }, includeArguments()),
          resolve: async (source, args, context, info) => {
            const whereClause = { [key]: { [Models.Sequelize.Op.in]: args[inputTypeName].map((input) => input[key]) } };

            await mutationResolver(models[inputTypeName], inputTypeName, source, args, context, info, 'update', null, hasBulkOptionEdit);

            return resolver(models[inputTypeName], { [EXPECTED_OPTIONS_KEY]: dataloaderContext })(source, whereClause, context, info);
          }
        };
      }

      if (models[inputTypeName].graphql && models[inputTypeName].graphql.mutations) {

        for (const mutation in models[inputTypeName].graphql.mutations) {

          let isArray = false;
          let isRequired = false;
          let outPutType = GraphQLInt;
          let inPutType = GraphQLInt;
          let typeName = models[inputTypeName].graphql.mutations[mutation].output;
          let inputTypeNameField = models[inputTypeName].graphql.mutations[mutation].input;

          if (typeName) {

            const typeReference = sanitizeFieldName(typeName);

            typeName = typeReference.type;
            isArray = typeReference.isArray;
            isRequired = typeReference.isRequired;

            if (isArray) {
              outPutType = new GraphQLList(outputTypes[typeName]);
            } else {
              outPutType = outputTypes[typeName];
            }

          }

          if (inputTypeNameField) {

            const typeReference = sanitizeFieldName(inputTypeNameField);

            inputTypeNameField = typeReference.type;

            if (typeReference.isArray) {
              inPutType = new GraphQLList(inputTypes[inputTypeNameField]);
            } else {
              inPutType = inputTypes[inputTypeNameField];
            }

            if (typeReference.isRequired) {
              inPutType = GraphQLNonNull(inPutType);
            }
          }

          mutations[camelCase(mutation)] = {
            type: outPutType,
            args: Object.assign({ [inputTypeNameField]: { type: inPutType } }, includeArguments()),
            resolve: (source, args, context, info) => {
              const where = key && args[inputTypeName] ? { [key]: args[inputTypeName][key] } : { };

return options.authorizer(source, args, context, info).then((_) => {
                return models[inputTypeName].graphql.mutations[mutation].resolver(source, args, context, info, where);
              }).then((data) => {
                return options.logger(data, source, args, context, info).then(() => data);
              });
            }
          };
        }

      }

      const toReturn = Object.assign(fields, mutations);

      return toReturn;

    }, { })
  });
};

// This function is exported
const generateSchema = (models, types, context, Sequelize) => {

  Models = models;
  Sequelize = models.Sequelize || Sequelize;

  if (options.dataloader) dataloaderContext = createContext(models.sequelize);
  if (Sequelize) {
    Sequelize.useCLS(sequelizeNamespace);
  } else {
    console.warn('Sequelize not found at Models.Sequelize or not passed as argument. Automatic tranasctions for mutations are disabled.');
    options.transactionedMutations = false;
  }

  const availableModels = {};

  for (const modelName in models) {
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
        mutation: generateMutationRootType(availableModels, modelTypes.inputTypes, modelTypes.outputTypes)
      };

    });

  }

    const modelTypes = types || generateModelTypes(availableModels);

    return {
      query: generateQueryRootType(availableModels, modelTypes.outputTypes, modelTypes.inputTypes),
      mutation: generateMutationRootType(availableModels, modelTypes.inputTypes, modelTypes.outputTypes)
    };


};

module.exports = (_options) => {
  options = Object.assign(options, _options);

return {
    generateGraphQLType,
    generateModelTypes,
    generateSchema,
    dataloaderContext,
    errorHandler,
    TRANSACTION_NAMESPACE,
    resetCache
  };
};
