module.exports = (options) => ({
  query: require('./query')(options),
  mutation: require('./mutation')(options)
});