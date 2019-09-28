require("./jsdoc.def.js")
const Sequelize = require("sequelize")

/**
 * This function will monkey-patch a Sequelize Model injecting the graphql property 
 * for sequelize-graphql-schema library
 * @instance
 * @param {Sequelize.Model} model - The sequelize model to monkey patch.
 * @param {SeqGraphQL} opt - object with all information needed for sequelize-graphql-schema and our node-platform lib.
 */
function define(model, opt = defOpt) {
    model.graphql = opt.graphql;
}

module.exports = {
    define
}
