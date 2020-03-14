### This repository and package is renamed to graphcraft.

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


```javascript
const options = {
  exclude: ["payments"],
  authorizer: function authorizer(source, args, context, info) {
    const { fieldName } = info; // resource name

    return Promise.resolve();
  }
};

const { generateSchema } = require("sequelize-graphql-schema")(options);
```

## Model Options

| option           | type   | example                                                                                                                 | description                                                                                                                                         |
|------------------|--------|-------------------------------------------------------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------|
| attributes       | Object | ```{exclude: ['ATTRIBUTE_NAME'], include: { customAttributeName: 'int' }}```                                            | Model attributes in exclude will be excluded from graphql types. Non-Model custom attributes will be added in graphql type from include.            |
| bulk             | Array  | ```['create', 'destroy']```                                                                                             | Create mutations for bulk create or destroy operations.                                                                                             |
| alias            | Object | ```{ count: 'myCountQuery', fetch: 'myQuery', create: 'myCreateMutation', destroy: 'myDeleteMutation, update: 'myUpdateMutation' }```          | Rename default queries and mutations with alias.                                                                                                    |
| excludeMutations | Array  | ```[ 'create', 'update', 'destroy' ]```                                                                                 | Exclude default mutations.                                                                                                                                                    |
| excludeQueries   | Array  | ```[ 'count', 'fetch' ]```                                                                                              | Exclude default queries.                                                                                                                                                 |
| excludeSubscriptions | Array | ```[ 'create', 'update', 'destroy' ]```                                                                   | Exclude default subscriptions.
| types            | Object | ```{myType: { id: '[int]' }, myTypeInput: { id: 'int' }}```                                                             | Create custom types. Add Input postfix to convert to input type.                                                                                    |
| mutations        | Object | ```{myMutation: { input: 'myTypeInput', output: '[myType]', resolver: customResolver}}```                               | Custom mutations to be created. input or output can refer to a custom input type or default graphql types.                                          |
| queries          | Object | ```{myQuery: { output: '[myType]', resolver: customResolver }}```                                                       | Custom queries to be created. input or output can refer to a custom input type or default graphql types.                                                                                                                                                  |
| subscriptions    | Object | ```{mySubs: { output: '[myType]', resolver: customResolver, subscriber: customSubscriber }}```                          | Custom subscriptions to be created. input or output can refer to a custom input type or default graphql type                                        |
| subsFilter       | Object | ```{create: (payload, variables, context, info) => { return Promise.resolve(); }}```                                    | To run before subscription executes. Available options are default, create, fetch, destroy and update. Functions must return a promise or boolean.
| before           | Object | ```{create: (source, args, context, info) => { return Promise.resolve(); }}```                                          | To run before default query or mutation executes. Available options are `create`, `fetch`, `destroy` and `update`. Functions must return a promise. |
| overwrite        | Object | same as before                                                                                                          | This will overwrite default query or mutation.                                                                                                      |
| extend           | Object | same as before with data coming from default passed to this function: ```create: (data, source, args, context, info)``` | To extend default functionality.                                                                                                                    |
| import           | Array  | see remote options                                                                                                      | Associations with remote schema.                                                                                                                    |

```javascript
Product.graphql = {
    attributes: {
        exclude: ['description'],
        include: { modelPortfolioId: 'int', obj: 'myObj' },
    }
};
```

## Remote Options

| option  |  type  |                                                                                                                                 example | description                                                                                      |
|---------|:------:|----------------------------------------------------------------------------------------------------------------------------------------:|--------------------------------------------------------------------------------------------------|
| import  | Object | ```{'RemoteData': {endpoint: 'http://garphql-endpoint.com',queries: { 'myQuery': { as: 'RemoteQuery' } },headers: ['authorization']}``` | Remote graphql data to import given queries, alias of query and headers to pass when calling it. |
| headers |  Array |                                                                                                               ```[ 'authorization' ]``` | Common headers passed to all endpoints.                                                          |

## Model Import Options

| option |  type  | example | description                     |
|--------|:------:|--------:|---------------------------------|
| from   | String |         | Remote schema name from Import. |
| as     | String |         | alias for remote schema.        |
| with   | String |         | foreign key from model.         |
| to     | String |         | target key from remote model.   |

```javascript
Product.graphql = {
  'import': [{
    from: 'RemoteProduct',
    as: 'Instrument',
    with: 'portfolioId',
    to: 'id'
  }],
}
```

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

var options = {
  exclude: ["Users"]
}

const {generateSchema} = require('sequelize-graphql-schema')(options);

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
  console.log('RUNNING ON 8080. Graphiql http://localhost:8080/graphql')
})
```

### Credits

This library is inspired and was initiated from https://github.com/rpellerin/graphql-sequelize-schema-generator.
