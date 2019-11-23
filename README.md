[![npm version](https://badge.fury.io/js/sequelize-graphql-schema.svg)](https://badge.fury.io/js/sequelize-graphql-schema)

# sequelize-graphql-schema

Rapildy build and extend GraphQL API based on [Sequelize](https://github.com/sequelize/sequelize "Sequelize") models. This library helps you focus on business logic while taking care of GraphQL schema automatically.
[https://almost-full-stack.github.io/sequelize-graphql-schema/](https://almost-full-stack.github.io/sequelize-graphql-schema/http:// "https://almost-full-stack.github.io/sequelize-graphql-schema/")

If you are updating from a previous version to `1.0` read notes at the end to fix breaking changes it will cause.

## Installation

```bash
npm install sequelize-graphql-schema
```

## Prerequisites

This package assumes you have `graphql` and `sequelize` already installed (both packages are declared as `peerDependencies`).

This library uses two set of configurations, **Library Options** and **Model Options**.

## Library Options
These options are defined globally and are applied throughout schema and all models.
```javascript
/**
 * naming convention for mutations/queries and types.
 * {name} = Model Name or type name
 * {type} = Get | Create | Update | Delete
 * {bulk} = Bulk for bulk operations only
 * */
   
naming: {
  pascalCase: true, // applied everywhere
  queries: '{name}', // applied to auto generated queries
  mutations: '{name}{type}{bulk}', // applied to auto generated mutations
  input: '{name}', // applied to all input types
  rootQueries: 'RootQueries',
  rootMutations: 'RootMutations',
  // {type} and {bulk} will be replaced with one of the following
  type: {
    create: 'Create',
    update: 'Update',
    delete: 'Delete',
    get: '',
    bulk: 'Bulk'
  }
}
```
```javascript
// default limit to be applied on find queries.
limits: {
  default: 50,
  max: 100 // maximum allowed limit. use 0 for unlimited
},
// nested objects can be passed and will be mutated automatically. Only hasMany and belongsTo relation supported.
nestedMutations: true, // doesn't work with add bulk mutation
```
```javascript
/**
 * update modes when sending nested association objects
 * UPDATE_ONLY > update only incoming records
 * UPDATE_ADD > update existing records and add new ones i.e [{id: 1, name: 'test'}, {name: 'test2'}] record[0] will be updated and record[1] will be added
 * UPDATE_ADD_DELETE > not recommended: update existing records, add new ones and delete non-existent records i.e [{id: 1, name: 'test'}, {name: 'test2'}] record[0] will be updated, record[1] will be added, anything else will be deleted
 * MIXED > i.e [{id: 1, name: 'test'}, {id:2}, {name: 'test2'}], record[0] will be updated, record[1] will be deleted and record[2] will be added
 * IGNORE > ignore nested update
 */

nestedUpdateMode: 'MIXED',
```
```javascript
// applied globaly on both auto-generated and custom queries/mutations.
// only specified queries/ and mutations would be exposed via api
exposeOnly: {
  queries: [], // ['Product'] this will only generate Product query
  mutations: [] // ['ProductUpdate'] this will only generate ProductUpdate mutation
},
```
```javascript
// these models will be excluded from graphql schema
exclude: [], // ['Product'] this will exclude all queries/mutations for Product model.
```
```javascript
// include these arguments to all queries/mutations
includeArguments: {}, // {'scopeId': 'int'} this will add scopeId in arguments for all queries and mutations
```
```javascript
// enabled/disable dataloader for nested queries
dataloader: false, // use dataloader for queries. Uses dataloader-sequelize
```
```javascript
// mutations are run inside transactions. Transactions are accessible in extend hook.
transactionedMutations: true,
```
```javascript
// generic or those types/queries/mutations which are not model specific
// custom graphql types
types: {},
// custom queries
queries: {},
// custom mutations
mutations: {},
```
```javascript
// data, source, args, context, info are passed as function arguments
// executes after all queries/mutations
logger() {
  return Promise.resolve();
},
```
```javascript
// your custom authorizer
// executes before all queries/mutations
authorizer() {
  return Promise.resolve();
},
```
```javascript
// these error messages are used when certain exceptions are thrown
// must be used with errorHandler function exposed via library
errorHandler: {
  'ETIMEDOUT': { statusCode: 503 }
}
```


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
Following options are model specific options, must be accessible via `model.graphql` property.

```javascript
// manipulate your model attributes
attributes: {
// list attributes which are to be ignored in Model Input
  exclude: [], // ['id', 'createdAt'], these fields will be excluded from GraphQL Schema
// attributes in key:type format which are to be included in Model Input
  include: {}, // {'customKey': 'string'} this extra field will be added in GraphQL schema
},
```
```javascript
// scope usage is highy recommended.
// common scope to be applied on all find/update/destroy operations
scopes: null, 
// 'scopes': ['scope', 'args.scopeId'] this will pass value of args.scopeId to model scope
// values can be either picked from args or context
```
```javascript
// rename default queries/mutations to specified custom name
alias: {},
// {'fetch': 'productGet', 'create': 'productAdd', 'update': ..., 'destroy': ....}
```
```javascript
bulk: { // OR bulk: ['create', 'destroy', ....]
  enabled: [], // enable bulk options ['create', 'destroy', 'update']
  // Use bulkColumn when using bulk option for 'create' and using returning true to increase efficiency.
  bulkColumn: false, // bulk identifier column, when bulk creating this column will be auto filled with a uuid and later used to fetch added records 'columnName' or ['columnName', true] when using a foreign key as bulk column
  returning: true // This will return all created/updated items, doesn't use sequelize returning option.
}
```
```javascript
types: {}, // user defined custom types
mutations: {}, // user defined custom mutations
queries: {}, // user defined custom queries
```
```javascript
// exclude one or more default mutations ['create', 'destroy', 'update']
excludeMutations: [],
excludeQueries: [], // exclude one or more default queries ['fetch']
```
```javascript
// HOOKS
// each hook must return a promise.
// extend/after hook default queries/mutations behavior {fetch, create, destroy, update}
// (data, source, args, context, info) are passed to extend
extend: {},
// before hook for default queries/mutations behavior {fetch, create, destroy, update}
// (source, args, context, info) arguments are passed to before
before: {},
// overwrite default queries/mutations behavior {fetch, create, destroy, update}
// overwrite hooks are passed (source, args, context, info) arguments
overwrite: {}
```

```javascript
Product.graphql = {
    attributes: {
        exclude: ['description'],
        include: { modelPortfolioId: 'int', obj: 'myObj' },
    }
};
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
