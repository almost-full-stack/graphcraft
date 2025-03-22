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

module.exports = {
  validateModels,
  getSequelizeConnection
};