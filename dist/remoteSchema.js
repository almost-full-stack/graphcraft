'use strict';

function _async(f) {
  return function () {
    for (var args = [], i = 0; i < arguments.length; i++) {
      args[i] = arguments[i];
    } try {
      return Promise.resolve(f.apply(this, args));
    } catch (e) {
      return Promise.reject(e);
    }
  };
} function _await(value, then, direct) {
  if (direct) {
    return then ? then(value) : value;
  }value = Promise.resolve(value);

return then ? value.then(then) : value;
}
const _require = require('graphql-request'),
    GraphQLClient = _require.GraphQLClient;

const _ = require('lodash');

module.exports = _async((options, context) => {

  const defaultOptions = {
    endpoint: null,
    queries: [],
    headers: null
  };

  const IgnoreTypes = ['Int', 'SequelizeJSON', 'String', 'Boolean'];

  function getTypes(type, AllTypes, array) {

    array = array || [];

    type.fields.forEach((field) => {

      if (options.queries.indexOf(field.name) > -1) {
        QueriesToImport.push(field);

        field.args.forEach((arg) => {
          if (IgnoreTypes.indexOf(arg.type.name || arg.type.ofType.name) == -1) {
            array.push(AllTypes[arg.type.name || arg.type.ofType.name]);
          }
        });

        if (IgnoreTypes.indexOf(field.type.name || field.type.ofType.name) == -1) {
          array.push(AllTypes[field.type.name || field.type.ofType.name]);
        }
      }
    });

    return array;
  }

  const introspectionQuery = 'query IntrospectionQuery {\n      __schema {\n        queryType { name }\n        mutationType { name }\n        subscriptionType { name }\n        types {\n          ...FullType\n        }\n        directives {\n          name\n          description\n          locations\n          args {\n            ...InputValue\n          }\n        }\n      }\n    }\n    fragment FullType on __Type {\n      kind\n      name\n      description\n      fields(includeDeprecated: true) {\n        name\n        description\n        args {\n          ...InputValue\n        }\n        type {\n          ...TypeRef\n        }\n        isDeprecated\n        deprecationReason\n      }\n      inputFields {\n        ...InputValue\n      }\n      interfaces {\n        ...TypeRef\n      }\n      enumValues(includeDeprecated: true) {\n        name\n        description\n        isDeprecated\n        deprecationReason\n      }\n      possibleTypes {\n        ...TypeRef\n      }\n    }\n    fragment InputValue on __InputValue {\n      name\n      description\n      type { ...TypeRef }\n      defaultValue\n    }\n    fragment TypeRef on __Type {\n      kind\n      name\n      ofType {\n        kind\n        name\n        ofType {\n          kind\n          name\n          ofType {\n            kind\n            name\n            ofType {\n              kind\n              name\n              ofType {\n                kind\n                name\n                ofType {\n                  kind\n                  name\n                  ofType {\n                    kind\n                    name\n                  }\n                }\n              }\n            }\n          }\n        }\n      }\n    }'; const headers = context ? _.pick(context.headers, options.headers) : {};

  headers['graphql-introspection'] = true;

  const client = new GraphQLClient(options.endpoint, { headers: headers });

return _await(client.request(introspectionQuery), (data) => {
    const schema = data.__schema;
    const queryTypeName = schema.queryType.name;
    const Types = schema.types;
    const AllTypes = {};
    const QueriesToImport = [];
    const TypesToImport = [];

    for (let index = 0; index < Types.length; index++) {
      AllTypes[Types[index].name] = Types[index];
    }

    const queryType = AllTypes[queryTypeName];

    queryType.fields.forEach((field) => {

      if (options.queries[field.name]) {

        let outputName = null;

        field.args.forEach((arg) => {
          if (IgnoreTypes.indexOf(arg.type.name || arg.type.ofType.name) == -1) {
            const tempType = AllTypes[arg.type.name || arg.type.ofType.name];

            tempType.name = options.queries[field.name].as || tempType.name;
            TypesToImport.push(tempType);
          }
        });

        if (IgnoreTypes.indexOf(field.type.name || field.type.ofType.name) == -1) {
          const tempType = AllTypes[field.type.name || field.type.ofType.name];

          tempType.name = options.queries[field.name].as || tempType.name;
          outputName = tempType.name;
          TypesToImport.push(tempType);
        }

        field.outputName = outputName;
        QueriesToImport.push(field);
      }
    });

    const FilteredTypes = {};
    const FilteredQueries = [];

    TypesToImport.forEach((type) => {

      const obj = {};

      type.fields.forEach((field) => {
        if (field.type.kind == 'SCALAR' || field.type.ofType.kind == 'SCALAR') {
          obj[field.name] = field.type.name || field.type.ofType.name;
        }
      });

      FilteredTypes[type.name] = obj;
    });

    QueriesToImport.forEach((query) => {

      const obj = { args: {}, name: query.name, endpoint: options.endpoint, headers: options.headers, output: query.outputName, isList: query.type.kind === 'LIST', options: options.options };

      query.args.forEach((arg) => {
        obj.args[arg.name] = arg.type.name;
      });

      FilteredQueries.push(obj);
    });

    return { types: FilteredTypes, queries: FilteredQueries };
  });
});