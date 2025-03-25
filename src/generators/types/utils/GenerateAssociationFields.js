const { defaultArgs, defaultListArgs } = require('graphql-sequelize');

const constants = require('../../../constants');
const { JoinTypeEnum, OperationTypeEnum } = require('./helpers');

const JOINS = constants.JOINS.get();

/**
 * Generates GraphQL fields for Sequelize model associations.
 *
 * Handles association types like `HasMany`, `BelongsToMany`, and `BelongsTo` for both input and output types.
 * Also supports nested mutations, join options, and dataloader-based custom resolvers.
 *
 * @param {Object} associations - Sequelize model associations.
 * @param {Object} existingTypes - Previously generated GraphQL types, keyed by model name.
 * @param {boolean} [isInput=false] - Whether the generated fields are for an input type.
 * @returns {Object} - A map of GraphQL fields derived from associations.
 */
function GenerateAssociationFields(associations, existingTypes = {}, isInput = false) {
  const fields = {};
  const { nestedMutations, dataloader } = options;

  for (const associationName in associations) {
    const relation = associations[associationName];
    const targetModel = relation.target;

    // Skip if the target GraphQL type has not been generated yet
    if (!existingTypes[targetModel.name]) continue;

    // Determine type: lists for HasMany and BelongsToMany
    const baseType = existingTypes[targetModel.name];
    const isList = ['BelongsToMany', 'HasMany'].includes(relation.associationType);
    const type = isList ? new GraphQLList(baseType) : baseType;

    const isBelongsTo = relation.associationType === 'BelongsTo';

    // Input type filtering
    if (!isInput || (nestedMutations && !isBelongsTo)) {
      fields[associationName] = { type };
    }

    // Add through table type (for BelongsToMany)
    if (relation.associationType === 'BelongsToMany') {
      const throughModelName = relation.through.model.name;
      if (existingTypes[throughModelName]) {
        fields[throughModelName] = { type: existingTypes[throughModelName] };
      }
    }

    // Add `_Op` field for relation-level mutation operators (input only)
    if (isInput) {
      fields._Op = {
        type: OperationTypeEnum,
        description: 'Used when mutating relations in update mutations.'
      };
      continue; // skip resolver setup for input
    }

    // Skip remote associations or non-object output types
    if (relation.isRemote) continue;

    // Dataloader-specific resolver for BelongsToMany
    if (relation.associationType === 'BelongsToMany' && dataloader) {
      fields[relation.through.model.name].resolve = (source, args, ctx) => {
        const keysToMatch = {};
        const parentModel = source.constructor.name;
        const grandParentModel = ctx.GrandParent?.constructor?.name;

        // Determine foreign key mappings between source and GrandParent
        for (const key in relation.source.associations) {
          const assoc = relation.source.associations[key];
          if (assoc.target.name === grandParentModel) {
            keysToMatch[assoc.foreignKey] = source[assoc.targetKey];
            break;
          }
        }

        for (const key in relation.target.associations) {
          const assoc = relation.target.associations[key];
          if (assoc.target.name === parentModel) {
            keysToMatch[assoc.foreignKey] = ctx.GrandParent[assoc.targetKey];
            break;
          }
        }

        // Match through model instance using includeMap
        const includeMap = source._options?.includeMap || {};
        for (const key in includeMap) {
          const includeModel = includeMap[key];
          if (includeModel.model.name === relation.through.model.name) {
            const data = source[key];
            for (const item of data || []) {
              const json = item.toJSON();
              const isMatch = Object.entries(keysToMatch).every(
                ([fk, val]) => json[fk] == val
              );
              if (isMatch) return item;
            }
          }
        }
      };
    }

    // Add resolver and args for association field
    const joinArgs = relation.source.graphql?.joins
      ? { join: { type: JoinTypeEnum } }
      : {};
    const throughArgs = relation.associationType === 'BelongsToMany'
      ? { throughWhere: defaultListArgs().where }
      : {};

    fields[associationName].args = {
      ...defaultArgs(relation),
      ...defaultListArgs(),
      ...throughArgs,
      ...joinArgs
    };

    fields[associationName].resolve = (source, args, context, info) => {
      context.GrandParent = source;

      if (args.join && JOINS.includes(args.join)) {
        return source[associationName];
      }

      return queryResolver(options)(relation, source, args, context, info);
    };
  }

  return fields;
}

module.exports = GenerateAssociationFields;