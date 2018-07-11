'use strict';
module.exports = (sequelize, DataTypes) => {

    const Product = sequelize.define('Product', {
        name: DataTypes.STRING,
        accountId: DataTypes.INTEGER,   // Cash account id
        clientId: DataTypes.INTEGER,    // Client who created/opened the Product
        scopeId: DataTypes.INTEGER,   // Tennant managing account of client, required since one Client can have links with multiple tennants.
        portfolioId: DataTypes.INTEGER
    }, { });

    Product.associate = function(models) {
      Product.hasMany(models.Attribute);
    };

    // extensions to replace or extend existing graphql implementations (available options would be create, destroy, update, query)
    Product.graphql = {
        attributes: {
            exclude: ['description'],
            include: { modelPortfolioId: 'int' }
        },
        excludeMutations: [],
        excludeQueries: [],
        // this will be executed after mutations/queries
        overwrite: {

        },
        extend: {
            create: (data, source, args, context, info) => {
                //console.log(data.toJSON());
                //console.log('Running extension.');
                return data;
            },
            fetch: (data, source, args, context, info) => {
                //console.log('Running extension.');
                return data;
            }
        }
    };

    return Product;

};
