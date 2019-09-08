module.exports = (options) => ({
  queries: require('./queries')(options),
  mutations: require('./mutations')(options),
  associations: require('./associations')(options),
  types: require('./types')
});