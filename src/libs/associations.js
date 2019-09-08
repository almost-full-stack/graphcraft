const {
  GraphQLList
} = require('graphql');
const {
  defaultListArgs,
  defaultArgs
} = require('graphql-sequelize');
const { resolver } = require('graphql-sequelize');
const { EXPECTED_OPTIONS_KEY } = require('dataloader-sequelize');
const { includeArguments } = require('../utils');
const hooks = require('../resolvers/hooks');

/**
* Returns the association fields of an entity.
*
* It iterates over all the associations and produces an object compatible with GraphQL-js.
* BelongsToMany and HasMany associations are represented as a `GraphQLList` whereas a BelongTo
* is simply an instance of a type.
* @param {*} associations A collection of sequelize associations
* @param {*} types Existing `GraphQLObjectType` types, created from all the Sequelize models
*/
module.exports = (options) => {

  const { dataloaderContext } = options;
  const remoteResolver = require('../resolvers/remote')(options);

  return (associations, types, isInput = false) => {
    const fields = {}

    for (const associationName in associations) {
      if (associations[associationName]) {
        const relation = associations[associationName];

        if (!types[relation.target.name]) {
          return fields;
        }

        // BelongsToMany is represented as a list, just like HasMany
        const type = relation.associationType === 'BelongsToMany' ||
          relation.associationType === 'HasMany'
          ? new GraphQLList(types[relation.target.name])
          : types[relation.target.name];

        fields[associationName] = { type };

        if (!isInput && !relation.isRemote) {
          // GraphQLInputObjectType do not accept fields with resolve
          fields[associationName].args = Object.assign(defaultArgs(relation), defaultListArgs(), includeArguments());
          fields[associationName].resolve = async (source, args, context, info) => {

            await hooks.before(relation.target, source, args, context, info, 'fetch');
            const data = await resolver(relation, { [EXPECTED_OPTIONS_KEY]: dataloaderContext })(source, args, context, info);

            if (relation.target.graphql.extend.fetch && data.length) {
              const item = await relation.target.graphql.extend.fetch(data, source, args, context, info);

              return [].concat(item);
            }

            return data;

          };

        } else if (!isInput && relation.isRemote) {
          fields[associationName].args = Object.assign({}, relation.query.args, defaultListArgs());
          fields[associationName].resolve = (source, args, context, info) => {
            return remoteResolver(source, args, context, info, relation.query, fields[associationName].args, types[relation.target.name]);
          }

        }

      }
    }

    return fields;
  }

};