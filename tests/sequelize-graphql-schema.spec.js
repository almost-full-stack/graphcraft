const { GraphQLSchema, introspectionQuery } = require('graphql');
const express = require('express');
const graphqlHTTP = require('express-graphql');
const { generateSchema } = require('../src/index')({
  exclude: [],
  dataloader: false,
  nestedMutations: true,
  fetchDeleted: true,
  limits: {
    default: 0,
    max: 0,
  },
  types: {
    customGlobalType: { id: 'id', key: 'string', value: 'string' }
  },
  queries: {
    customGlobalQuery: { input: 'customGlobalType', output: '[customGlobalType]', resolver: () => { return [{ key: '1', value: '2' }]; } }
  },
  mutations: {
    customGlobalMutation: { input: 'customGlobalType', output: 'int', resolver: () => 1 }
  },
  globalHooks: {
    before: {
      create: () => {
        console.log('before global');
        return Promise.resolve();
      }
    },
    extend: {
      create: () => {
        console.log('extend global');
        return Promise.resolve();
      }
    }
  }
});

const app = express();
const models = require('./models');

app.use('/', async (req, res) => {
  
  const schema = await generateSchema(models, req);

  return graphqlHTTP({
    schema: new GraphQLSchema(schema),
    graphiql: true
  })(req, res);


});

app.listen(3000, () => {
  console.log('RUNNING ON 3000');
});
