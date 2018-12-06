'use strict';

function _async(f) {
  return function () {
    for (var args = [], i = 0; i < arguments.length; i++) {
      args[i] = arguments[i];
    }try {
      return Promise.resolve(f.apply(this, args));
    } catch (e) {
      return Promise.reject(e);
    }
  };
}function _await(value, then, direct) {
  if (direct) {
    return then ? then(value) : value;
  }value = Promise.resolve(value);return then ? value.then(then) : value;
}
var _require = require('graphql-request'),
    GraphQLClient = _require.GraphQLClient;

var _ = require('lodash');

module.exports = _async(function (options, context) {

  var defaultOptions = {
    endpoint: null,
    queries: [],
    headers: null
  };

  var IgnoreTypes = ['Int', 'SequelizeJSON', 'String', 'Boolean'];

  function getTypes(type, AllTypes, array) {

    array = array || [];

    type.fields.forEach(function (field) {

      if (options.queries.indexOf(field.name) > -1) {
        QueriesToImport.push(field);

        field.args.forEach(function (arg) {
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

  var introspectionQuery = 'query IntrospectionQuery {\n      __schema {\n        queryType { name }\n        mutationType { name }\n        subscriptionType { name }\n        types {\n          ...FullType\n        }\n        directives {\n          name\n          description\n          locations\n          args {\n            ...InputValue\n          }\n        }\n      }\n    }\n    fragment FullType on __Type {\n      kind\n      name\n      description\n      fields(includeDeprecated: true) {\n        name\n        description\n        args {\n          ...InputValue\n        }\n        type {\n          ...TypeRef\n        }\n        isDeprecated\n        deprecationReason\n      }\n      inputFields {\n        ...InputValue\n      }\n      interfaces {\n        ...TypeRef\n      }\n      enumValues(includeDeprecated: true) {\n        name\n        description\n        isDeprecated\n        deprecationReason\n      }\n      possibleTypes {\n        ...TypeRef\n      }\n    }\n    fragment InputValue on __InputValue {\n      name\n      description\n      type { ...TypeRef }\n      defaultValue\n    }\n    fragment TypeRef on __Type {\n      kind\n      name\n      ofType {\n        kind\n        name\n        ofType {\n          kind\n          name\n          ofType {\n            kind\n            name\n            ofType {\n              kind\n              name\n              ofType {\n                kind\n                name\n                ofType {\n                  kind\n                  name\n                  ofType {\n                    kind\n                    name\n                  }\n                }\n              }\n            }\n          }\n        }\n      }\n    }';var headers = context ? _.pick(context.headers, options.headers) : {};

  headers['graphql-introspection'] = true;

  var client = new GraphQLClient(options.endpoint, { headers: headers });
  return _await(client.request(introspectionQuery), function (data) {
    var schema = data.__schema;
    var queryTypeName = schema.queryType.name;
    var Types = schema.types;
    var AllTypes = {};
    var QueriesToImport = [];
    var TypesToImport = [];

    for (var index = 0; index < Types.length; index++) {
      AllTypes[Types[index].name] = Types[index];
    }

    var queryType = AllTypes[queryTypeName];

    queryType.fields.forEach(function (field) {

      if (options.queries[field.name]) {

        var outputName = null;

        field.args.forEach(function (arg) {
          if (IgnoreTypes.indexOf(arg.type.name || arg.type.ofType.name) == -1) {
            var tempType = AllTypes[arg.type.name || arg.type.ofType.name];
            tempType.name = options.queries[field.name].as || tempType.name;
            TypesToImport.push(tempType);
          }
        });

        if (IgnoreTypes.indexOf(field.type.name || field.type.ofType.name) == -1) {
          var tempType = AllTypes[field.type.name || field.type.ofType.name];
          tempType.name = options.queries[field.name].as || tempType.name;
          outputName = tempType.name;
          TypesToImport.push(tempType);
        }

        field.outputName = outputName;
        QueriesToImport.push(field);
      }
    });

    var FilteredTypes = {};
    var FilteredQueries = [];

    TypesToImport.forEach(function (type) {

      var obj = {};

      type.fields.forEach(function (field) {
        if (field.type.kind == 'SCALAR' || field.type.ofType.kind == 'SCALAR') {
          obj[field.name] = field.type.name || field.type.ofType.name;
        }
      });

      FilteredTypes[type.name] = obj;
    });

    QueriesToImport.forEach(function (query) {

      var obj = { args: {}, name: query.name, endpoint: options.endpoint, headers: options.headers, output: query.outputName, isList: query.type.kind === 'LIST' ? true : false, options: options.options };

      query.args.forEach(function (arg) {
        obj.args[arg.name] = arg.type.name;
      });

      FilteredQueries.push(obj);
    });

    return { types: FilteredTypes, queries: FilteredQueries };
  });
});