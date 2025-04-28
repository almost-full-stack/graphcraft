const { Model } = require('sequelize');

/**
 * Validates that all provided models in an object are Sequelize models.
 *
 * @param {Object} models - An object where keys are model names and values are Sequelize models.
 * @returns {Object} - An object containing `isValid` (boolean) and `invalidModels` (array of invalid model names).
 */
function validateModels(models) {
  const invalidModels = Object.entries(models).
    filter(([_, model]) => !model || !(model.prototype instanceof Model)).
    map(([name]) => name);

  return {
    isValid: invalidModels.length === 0,
    invalidModels
  };
}

/**
 * Extracts the Sequelize connection instance from the provided models.
 *
 * @param {Object} models - An object where keys are model names and values are Sequelize models.
 * @returns {Sequelize} - The Sequelize instance used by the models.
 * @throws {Error} - If no valid Sequelize connection is found.
 */
function getSequelizeConnection(models) {
  const firstModel = Object.values(models)[0];

  if (firstModel && firstModel.sequelize) {
    return firstModel.sequelize;
  }

  throw new Error('No valid Sequelize connection found in the provided models.');
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Deeply copies missing properties from a source object into a target object.
 * - Does NOT overwrite existing properties in the target.
 * - Recursively copies nested objects and arrays.
 * - Handles nulls safely.
 *
 * @param {Object} target - The object to copy properties into.
 * @param {Object} source - The object to copy missing properties from.
 * @returns {Object} - The updated target object.
 */
function copyMissing(target, source) {
  if (!isObject(target) || !isObject(source)) {
      return target;
  }
  for (const key in source) {
      const sourceValue = source[key];

      if (!(key in target)) {
          target[key] = Array.isArray(sourceValue)
              ? sourceValue.map((item) => (isObject(item) ? copyMissing({}, item) : item))
              : (isObject(sourceValue) ? copyMissing({}, sourceValue) : sourceValue);
      } else if (isObject(sourceValue) && isObject(target[key])) {
          copyMissing(target[key], sourceValue);
      }
  }

return target;
}

module.exports = {
  validateModels,
  getSequelizeConnection,
  copyMissing
};