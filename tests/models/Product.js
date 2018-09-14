'use strict';
module.exports = (sequelize, DataTypes) => {

    const Product = sequelize.define('Product', {
        name: {
          type: DataTypes.STRING,
          include: ['create', 'modify']
        },
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
            include: { modelPortfolioId: 'int' },
        },
        import: [ { from: 'RemoteProduct', as: 'Instrument', with: 'portfolioId', to: 'id' } ],
        excludeMutations: [],
        excludeQueries: [],
        types: {
          myObj: { id: 'int' }
        },
        mutations: {
          myMutation: { input: 'Product', output: '[myObj]', resolver: () => { return 1; }}
        },
        queries: {
          myQuery: { input: 'Product', output: '[myObj]', resolver: () => { return 1; } }
        },
        // this will be executed after mutations/queries
        before: {
          create: (source, args, context, info) => {
            return Promise.resolve();
          }
        },
        overwrite: {

        },
        extend: {
            create: (data, source, args, context, info) => {
                return Promise.resolve(data);
            },
            fetch: (data, source, args, context, info) => {
                //console.log('Running extension.');
                return data;
            }
        }
    };

    return Product;

};
