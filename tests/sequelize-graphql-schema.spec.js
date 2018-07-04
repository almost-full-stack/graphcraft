var { GraphQLSchema } = require('graphql')
const express = require('express')
const graphqlHTTP = require('express-graphql')
const {generateSchema} = require('../src/sequelize-graphql-schema')({
    exclude: [ ],
    includeArguments: {
        scopeId: 'int'
    },
    authorizer: () => {
        return new Promise((resolve, reject) => {
            throw new Error("No auth");
        });
    }
});
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
