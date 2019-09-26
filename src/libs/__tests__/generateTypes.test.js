/* eslint-disable no-undef */
const {
  GraphQLInt,
  GraphQLBoolean,
  GraphQLFloat,
  GraphQLString,
  GraphQLID,
  GraphQLList,
  GraphQLNonNull
} = require('graphql');
const { JSONType, DateType } = require('graphql-sequelize');
const { generateModelTypes, generateGraphQLField } = require('../generateTypes');

describe('Type Generators', () => {
  it('Should generate graphQL Field Types.', () => {
    expect(generateGraphQLField('string')).toEqual(GraphQLString);
    expect(generateGraphQLField('String')).toEqual(GraphQLString);
    expect(generateGraphQLField('int')).toEqual(GraphQLInt);
    expect(generateGraphQLField('INT')).toEqual(GraphQLInt);
    expect(generateGraphQLField('boolean')).toEqual(GraphQLBoolean);
    expect(generateGraphQLField('float')).toEqual(GraphQLFloat);
    expect(generateGraphQLField('id')).toEqual(GraphQLID);
    expect(generateGraphQLField('json')).toEqual(JSONType);
    expect(generateGraphQLField('date')).toEqual(DateType);
    expect(generateGraphQLField('[string]')).toEqual(new GraphQLList(GraphQLString));
    expect(generateGraphQLField('string!')).toEqual(GraphQLNonNull(GraphQLString));
    expect(generateGraphQLField('[string]!')).toEqual(GraphQLNonNull(new GraphQLList(GraphQLString)));
    expect(generateGraphQLField('[string!]')).toEqual(new GraphQLList(GraphQLNonNull(GraphQLString)));
  });

  it('Should generate types from models and custom types.', () => {

    const models = {
      test: {
        name: 'TestModel',
        graphql: {
          attributes: { include: {} },
          types: {
            'typeA': {
              stringField: 'string',
              intField: 'int',
              booleanField: 'boolean',
              idField: 'id',
              floatField: 'float',
              nonNullField: 'string!',
              listField: '[string]',
              nonNullListField: '[string]!',
              listNonNullField: '[string!]'
            },
            'typeAInput': { fieldA: 'float', fieldB: 'json' },
            'typeB': { fieldA: 'string', fieldB: 'int' },
          },
          mutations: { testMutation: { input: 'typeB' } },
          queries: { testQuery: { input: 'typeAInput' } },
        }
      }
    };

    const types = generateModelTypes(models);

    // eslint-disable-next-line no-console
    console.log(types);
  });
});