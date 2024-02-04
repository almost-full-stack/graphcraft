const { GraphQLSchema } = require('graphql');
const express = require('express');
const { createHandler } = require('graphql-http/lib/use/express');
const expressPlayground = require('graphql-playground-middleware-express').
  default;
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
    rootQueries: 'RootQueryType',
    rootMutations: 'RootMutationType',
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
        mutations: [
          {
            name: 'customGlobalMutation',
            enable: true,
            set: {
              field: 'isActive', value: true
            }
          },
        ],
        queries: [
          {
            name: 'customGlobalQuery',
            enable: false,
          },
        ],
        fetch: [
          {
            model: 'Product',
            fields: [],
            associations: ['Media'],
            enable: true,
            conditions: [{ field: 'isActive', value: true }],
            count: false,
            findOne: false,
          },
          {
            model: 'ProductMedia',
            fields: ['imageId'],
          },
        ],

        /*create: [
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
        ],*/
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

app.get('/', expressPlayground({ endpoint: '/' }));

app.all('/', async (req, res) => {
  const schema = await generateSchema(models, req);

  const handler = createHandler({
    schema: new GraphQLSchema(schema),
    graphiql: true,
    context: {
      req,
    },
  });

  handler(req, res);
});

app.listen(3000, () => {
  // eslint-disable-next-line no-console
  console.log('RUNNING ON 3000');
});
