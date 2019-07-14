module.exports = (options) => ({
  queries: require('./queries').generator(options),
  types: require('./types').generator(options)
});