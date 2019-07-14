const _ = require('lodash');

const whereQueryVarsToValues = (sourceObject, targetValues) => {

  const newObject = _.cloneDeep(sourceObject);

  [
    ...Object.getOwnPropertyNames(newObject),
    ...Object.getOwnPropertySymbols(newObject)
  ].forEach((key) => {
    if (_.isFunction(newObject[key])) {
      newObject[key] = newObject[key](targetValues);

      return;
    }
    if (_.isObject(newObject[key])) {
      whereQueryVarsToValues(newObject[key], targetValues);
    }
  });

  return newObject;
};

const sanitizeFieldName = (type) => {

  const isRequired = type.indexOf('!') > -1;
  const isArray = type.indexOf('[') > -1;

  type = type.replace('[', '');
  type = type.replace(']', '');
  type = type.replace('!', '');

  return {
    type,
    isArray,
    isRequired
  };
};

const checkIfGeneratorRequired = (model, isMutation) => {

  const exclude = model.graphql[isMutation ? 'excludeMutations' : 'excludeQueries'];
  const custom = model.graphql[isMutation ? 'mutations' : 'queries'];

  if (isMutation) return exclude.length < 3 || custom.length;

  return exclude.length === 0 || custom.length;

};

module.exports = {
  whereQueryVarsToValues,
  sanitizeFieldName,
  checkIfGeneratorRequired
};