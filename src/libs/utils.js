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

module.exports = {
  whereQueryVarsToValues
};