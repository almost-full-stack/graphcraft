const { GraphQLEnumType } = require('graphql');

const { GenerateGraphQLField } = require('./GenerateGraphQLField');
const constants = require('../../../constants');

const JOINS = constants.JOINS.get();
const OPS = constants.OPS.get();

const JoinTypeEnum = new GraphQLEnumType({
  name: 'SequelizeJoinType',
  description: 'Defines the type of SQL join between parent and child models. Supported values include LEFT, RIGHT, and INNER joins.',
  values: GenerateGraphQLField(JOINS)
});

const OperationTypeEnum = new GraphQLEnumType({
  name: 'OperationType',
  description: 'Defines the operation to perform on an object. Possible values include KEEP, CREATE, UPDATE, and DELETE. Defaults to KEEP.',
  values: GenerateGraphQLField(OPS)
});


module.exports = {
  JoinTypeEnum,
  OperationTypeEnum
};