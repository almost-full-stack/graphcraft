var { GraphQLSchema, introspectionQuery } = require('graphql');
const express = require('express');
const graphqlHTTP = require('express-graphql');
const {generateSchema} = require('../src/sequelize-graphql-schema')({
  exclude: [ ],
  /*remote: {
    import: {
      'Instrument': {
        endpoint: 'http://localhost:3000/graphiql',
        queries: { 'productGet': { as: 'RemoteProduct' } },
        headers: ['authorization', 'accesstoken']
      },
      'Shop': {
        endpoint: 'http://localhost:3000/graphiql',
        queries: { 'productGet': { as: 'RemoteShop' } },
        headers: ['authorization', 'accesstoken']
      }
    },
    headers: [ 'authorization', 'accessToken' ]
  },*/
  includeArguments: {
    scopeId: 'int!',
    test: '[int]'
  }
});

const app = express();
const models = require('./models');

app.use('/', (req, res) => {
  const schemaPromise = generateSchema(models, null, req);
  if(schemaPromise.then){

    return schemaPromise.then(schema => {
      return graphqlHTTP({
        schema: new GraphQLSchema(schema),
        graphiql: true
      })(req, res);
    });

  }else{
    return graphqlHTTP({
      schema: new GraphQLSchema(schemaPromise),
      graphiql: true
    })(req, res);

  }

});

app.listen(3000, function() {
  console.log('RUNNING ON 3000');
});
