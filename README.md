# sequelize-graphql-schema

A helper library that lets you focus on business logic by automatically generates `GraphQLSchema` and manages graphQL from Sequelize model.

## Installation

```bash
npm install sequelize-graphql-schema
```

## Prerequisites

This package assumes you have `graphql` and `sequelize` already installed (both packages are declared as `peerDependencies`).

## Options

| option           | type     | example                      | description                                                                                                                     |
|------------------|----------|------------------------------|---------------------------------------------------------------------------------------------------------------------------------|
| authorizer       | Function |                              | Your custom authorization mechanism goes here, all queries and mutations will be called after this. This must return a promise. |
| exclude          | Array    | ```['MODEL_NAME', 'MODEL_NAME']``` | Pass in model names to exclude from graphql schema.                                                                             |
| includeArguments | Object   | ```{ 'customArgument', 'int' }```  | These arguments will be included in all queries and mutations.                                                                  |
| remote           | Object   | See Remote Options           | Import queries from external graphql schema.                                                                                    |

## Model Options



## Usage

```javascript
const {generateModelTypes, generateSchema} = require('sequelize-graphql-schema')(options);
const models = require('./models')
const schema = generateSchema(models) // Generates the schema
// OR
const types = generateModelTypes(models)
const schema = generateSchema(models, types) // Generates the schema by reusing the types
```

### Example with Express

```javascript
const { GraphQLSchema } = require('graphql');
const express = require('express');
const graphqlHTTP = require('express-graphql');
const {generateSchema} = require('../src/sequelize-graphql-schema')(options);

const models = require('./models');

const app = express();

app.use(
  '/graphql',
  graphqlHTTP({
    schema: new GraphQLSchema(generateSchema(models)),
    graphiql: true
  })
)

app.listen(8080, function() {
  console.log('RUNNING ON 8080')
})
```
