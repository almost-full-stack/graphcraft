module.exports = {
  'name': 'sequelize-graphql-schema',
  'testEnvironment': 'node',
  'testMatch': [
    '<rootDir>/src/**/__tests__/*.test.js',
    '<rootDir>/src/__tests__/*.test.js'
  ],
  'collectCoverageFrom': [
    'src/**/*.js',
    'src/*.js'

  ],
  'coverageDirectory': 'coverage',
  'coverageReporters': ['html', 'text-summary']
};
