const models = require('./models');

models.sequelize.sync({ force: true }).then(() => {
  // eslint-disable-next-line no-console
  console.log('Database reset.');
});