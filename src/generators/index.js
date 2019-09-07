module.exports = (options) => ({
  queries: require('./queries')(options),
  mutations: require('./mutations')(options),
  types: require('./types')
});