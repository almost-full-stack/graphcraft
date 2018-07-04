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
    // associations can be defined here
    };

    // extensions to replace or extend existing graphql implementations (available options would be create, destroy, update, query)
    Product.graphql = {
        attributes: {
            exclude: ['description']
        },
        alias: {
          create: 'instrumentStatus'
        },
        excludeMutations: [],
        excludeQueries: [],
        types: {
            InstrumentStatusInput: { id: 'int', scopeId: 'int', isApproved: 'string' }
        },
        mutations: {
          updateStatus: {
            input: 'InstrumentStatusInput',
            output: 'Product',
            resolver: function(){}
          }
        },
        // this will be executed after mutations/queries
        extend: {
            create: (data, source, args, context, info) => {
                console.log(data.toJSON());
                console.log('Running extension.');
                return data;
            },
            fetch: (data, source, args, context, info) => {
                console.log('Running extension.');
                return data;
            }
        }
    };

    return Product;

};
