const { GraphQLSchema } = require('graphql');
const express = require('express');
const graphqlHTTP = require('express-graphql');
const { JSONType } = require('graphql-sequelize');

const { generateSchema } = require('../src/index')({
  exclude: [],
  dataloader: true,
  nestedMutations: true,
  restoreDeleted: true,
  limits: {
    default: 0,
    max: 0,
  },
  naming: {
    input: 'input',
  },
  findOneQueries: true,
  importTypes: {
    ImportCustomType: JSONType.default,
  },
  types: {
    customGlobalType: { id: 'id', key: 'string', value: 'string' },
  },
  permissions: () => {
    return Promise.resolve({
      rules: {
        fetch: [
          {
            model: 'Product',
            fields: ['id', 'name'],
            associations: ['Media'],
            enable: true,
            conditions: [
              { field: 'isActive', value: true }
            ],
            count: false,
            findOne: false
          },
          {
            model: 'ProductMedia',
            fields: ['imageId']
          },
        ],
        create: [
          {
            model: 'Product',
            set: {
              field: 'isActive', value: true
            }
          },
          {
            model: 'ProductMedia',
            enable: false
          },
        ],
        update: [
          {
            model: 'Product',
            fields: ['name'],
            associations: ['Media'],
            conditions: [
              { field: 'isActive', value: true }
            ],
          },
        ],
        delete: [
          {
            model: 'Product',
            conditions: [
              { field: 'isActive', value: false }
            ],
          },
          {
            model: 'ProductMedia',
            enable: false
          },
        ],
      },
    });
  },
  queries: {
    customGlobalQuery: {
      input: 'customGlobalType',
      output: '[customGlobalType]',
      resolver: () => {
        return [{ key: '1', value: '2' }];
      },
    },
  },
  mutations: {
    customGlobalMutation: {
      input: 'customGlobalType',
      output: 'ImportCustomType',
      resolver: () => 1,
    },
  },
  globalHooks: {
    before: {
      create: () => {
        // eslint-disable-next-line no-console
        console.log('before global');

        return Promise.resolve();
      },
    },
    extend: {
      create: () => {
        // eslint-disable-next-line no-console
        console.log('extend global');

        return Promise.resolve();
      },
    },
  },
});

const app = express();
const models = require('./models');

app.use('/', async (req, res) => {
  const schema = await generateSchema(models, req);

  await graphqlHTTP({
    schema: new GraphQLSchema(schema),
    graphiql: true,
  })(req, res);
});

app.listen(3000, () => {
  // eslint-disable-next-line no-console
  console.log('RUNNING ON 3000');
});
