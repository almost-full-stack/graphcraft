"use strict";

function asyncGeneratorStep(gen, resolve, reject, _next, _throw, key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { Promise.resolve(value).then(_next, _throw); } }

function _asyncToGenerator(fn) { return function () { var self = this, args = arguments; return new Promise(function (resolve, reject) { var gen = fn.apply(self, args); function _next(value) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "next", value); } function _throw(err) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "throw", err); } _next(undefined); }); }; }

var _require = require('graphql-request'),
    GraphQLClient = _require.GraphQLClient;

var _ = require('lodash');

module.exports =
/*#__PURE__*/
function () {
  var _ref = _asyncToGenerator(
  /*#__PURE__*/
  regeneratorRuntime.mark(function _callee(options, context) {
    var defaultOptions, IgnoreTypes, introspectionQuery, getTypes, headers, client, data, schema, queryTypeName, Types, AllTypes, QueriesToImport, TypesToImport, index, queryType, FilteredTypes, FilteredQueries;
    return regeneratorRuntime.wrap(function _callee$(_context) {
      while (1) {
        switch (_context.prev = _context.next) {
          case 0:
            getTypes = function _ref2(type, AllTypes, array) {
              // eslint-disable-line no-unused-vars
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
            };

            defaultOptions = {
              // eslint-disable-line no-unused-vars
              endpoint: null,
              queries: [],
              headers: null
            };
            IgnoreTypes = ['Int', 'SequelizeJSON', 'String', 'Boolean'];
            introspectionQuery = "query IntrospectionQuery {\n      __schema {\n        queryType { name }\n        mutationType { name }\n        subscriptionType { name }\n        types {\n          ...FullType\n        }\n        directives {\n          name\n          description\n          locations\n          args {\n            ...InputValue\n          }\n        }\n      }\n    }\n    fragment FullType on __Type {\n      kind\n      name\n      description\n      fields(includeDeprecated: true) {\n        name\n        description\n        args {\n          ...InputValue\n        }\n        type {\n          ...TypeRef\n        }\n        isDeprecated\n        deprecationReason\n      }\n      inputFields {\n        ...InputValue\n      }\n      interfaces {\n        ...TypeRef\n      }\n      enumValues(includeDeprecated: true) {\n        name\n        description\n        isDeprecated\n        deprecationReason\n      }\n      possibleTypes {\n        ...TypeRef\n      }\n    }\n    fragment InputValue on __InputValue {\n      name\n      description\n      type { ...TypeRef }\n      defaultValue\n    }\n    fragment TypeRef on __Type {\n      kind\n      name\n      ofType {\n        kind\n        name\n        ofType {\n          kind\n          name\n          ofType {\n            kind\n            name\n            ofType {\n              kind\n              name\n              ofType {\n                kind\n                name\n                ofType {\n                  kind\n                  name\n                  ofType {\n                    kind\n                    name\n                  }\n                }\n              }\n            }\n          }\n        }\n      }\n    }";
            headers = context ? _.pick(context.headers, options.headers) : {};
            headers['graphql-introspection'] = true;
            client = new GraphQLClient(options.endpoint, {
              headers: headers
            });
            _context.next = 9;
            return client.request(introspectionQuery);

          case 9:
            data = _context.sent;
            schema = data.__schema;
            queryTypeName = schema.queryType.name;
            Types = schema.types;
            AllTypes = {};
            QueriesToImport = [];
            TypesToImport = [];

            for (index = 0; index < Types.length; index++) {
              AllTypes[Types[index].name] = Types[index];
            }

            queryType = AllTypes[queryTypeName];
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
            FilteredTypes = {};
            FilteredQueries = [];
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
              var obj = {
                args: {},
                name: query.name,
                endpoint: options.endpoint,
                headers: options.headers,
                output: query.outputName,
                isList: query.type.kind === 'LIST',
                options: options.options
              };
              query.args.forEach(function (arg) {
                obj.args[arg.name] = arg.type.name;
              });
              FilteredQueries.push(obj);
            });
            return _context.abrupt("return", {
              types: FilteredTypes,
              queries: FilteredQueries
            });

          case 24:
          case "end":
            return _context.stop();
        }
      }
    }, _callee);
  }));

  return function (_x, _x2) {
    return _ref.apply(this, arguments);
  };
}();