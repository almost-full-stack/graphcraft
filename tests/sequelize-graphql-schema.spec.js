var { GraphQLSchema } = require('graphql')
const express = require('express')
const graphqlHTTP = require('express-graphql')
const {generateSchema} = require('../src/sequelize-graphql-schema')();
const models = require('./models')

var app = express()

app.use(
  '/',
  graphqlHTTP({
    schema: new GraphQLSchema(generateSchema(models)),
    graphiql: true
  })
)

app.listen(3000, function() {
  console.log('RUNNING ON 8080')
})
