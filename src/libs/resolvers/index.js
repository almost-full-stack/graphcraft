module.exports = (options, EXPECTED_OPTIONS_KEY, dataloaderContext) => ({
  query: require('./query')(options, EXPECTED_OPTIONS_KEY, dataloaderContext)
});