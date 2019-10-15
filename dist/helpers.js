"use strict";

require("./jsdoc.def.js");

var Sequelize = require("sequelize");
/**
 * This function will monkey-patch a Sequelize Model injecting the graphql property 
 * for sequelize-graphql-schema library
 * @instance
 * @param {Sequelize.Model} model - The sequelize model to monkey patch.
 * @param {SeqGraphQL} opt - object with all information needed for sequelize-graphql-schema and our node-platform lib.
 */


function define(model) {
  var opt = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : defOpt;
  model.graphql = opt.graphql;
}

module.exports = {
  define: define
};