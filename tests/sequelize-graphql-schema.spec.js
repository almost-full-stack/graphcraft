var { GraphQLSchema, introspectionQuery } = require('graphql');
const express = require('express');
const graphqlHTTP = require('express-graphql');
const {generateSchema} = require('../src/sequelize-graphql-schema')({
    exclude: [ ],
    includeArguments: {
        scopeId: 'int'
    }
});
const models = require('./models');
const schema = new GraphQLSchema(generateSchema(models));

var app = express();

app.use(
  '/',
  graphqlHTTP({
    schema: schema,
    graphiql: true
  })
)

app.listen(3000, function() {
  console.log('RUNNING ON 8080')
})
