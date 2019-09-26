/* eslint-disable no-undef */
const {
  GraphQLInt,
  GraphQLBoolean,
  GraphQLFloat,
  GraphQLString,
  GraphQLID,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLInputObjectType
} = require('graphql');
const { JSONType, DateType } = require('graphql-sequelize');
const stringifier = require('stringifier')({ maxDepth: 10, indent: '  ' })
const { generateModelTypes, generateGraphQLField, generateGraphQLTypeFromJson } = require('../generateTypes');

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

  it('Should generate types from custom types.', () => {

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
            'typeC': { fieldA: 'typeB' }
          },
          mutations: { testMutation: { input: 'typeB' } },
          queries: { testQuery: { input: 'typeAInput' } },
        }
      }
    };

    const typeAInput = new GraphQLInputObjectType({
      name: 'typeAInput',
      fields: () => ({
        fieldA: {
          type: GraphQLFloat
        },
        fieldB: {
          type: JSONType
        }
      })
    });

    const typeB = new GraphQLObjectType({
      name: 'typeB',
      fields: () => ({
        fieldA: {
          type: GraphQLString
        },
        fieldB: {
          type: GraphQLInt
        }
      })
    });

    const typeC = new GraphQLObjectType({
      name: 'typeC',
      fields: () => ({
        fieldA: {
          type: typeB
        }
      })
    });

    const types = {
      typeAInput: generateGraphQLTypeFromJson({
        name: 'typeAInput',
        type: { fieldA: 'float', fieldB: 'json' }
      }, {}, true),
      typeB: generateGraphQLTypeFromJson({
        name: 'typeB',
        type: { fieldA: 'string', fieldB: 'int' }
      }),
      typeC: generateGraphQLTypeFromJson({
        name: 'typeC',
        type: { fieldA: 'typeB' }
      }, { typeB: this.typeB })
    };

    expect(stringifier(types.typeAInput)).toEqual(stringifier(typeAInput));
    expect(stringifier(types.typeB)).toEqual(stringifier(typeB));
    expect(stringifier(types.typeC)).toEqual(stringifier(typeC));
  });
});