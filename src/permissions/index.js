'use strict';

const migrations = require('./migrations');
const service = require('./service');

module.exports = {
  migrations,
  ...service
};
