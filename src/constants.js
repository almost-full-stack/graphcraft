const {
  GraphQLInt,
  GraphQLBoolean,
  GraphQLFloat,
  GraphQLString,
  GraphQLID
} = require('graphql');
const { JSONType, DateType } = require('graphql-sequelize');

module.exports.JOINS = {
  LEFT: 'LEFT',
  RIGHT: 'RIGHT',
  INNER: 'INNER',
  get() {
    Object.keys(this).filter((key) => key != 'get').map((key) => key);
  }
};

module.exports.OPS = {
  CREATE: 'CREATE',
  DELETE: 'DELETE',
  UPDATE: 'UPDATE',
  KEEP: 'KEEP',
  get() {
    Object.keys(this).filter((key) => key != 'get').map((key) => key);
  }
};

module.exports.STRINGTOTYPEMAP = {
  int: GraphQLInt,
  boolean: GraphQLBoolean,
  string: GraphQLString,
  float: GraphQLFloat,
  id: GraphQLID,
  json: JSONType,
  date: DateType
};