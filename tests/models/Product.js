/*'use strict';
module.exports = (sequelize, DataTypes) => {

    const Product = sequelize.define('Product', {
        name: {
          type: DataTypes.STRING,
          include: ['create', 'modify']
        },
        accountId: DataTypes.INTEGER,   // Cash account id
        clientId: DataTypes.INTEGER,    // Client who created/opened the Product
        scopeId: DataTypes.INTEGER,   // Tennant managing account of client, required since one Client can have links with multiple tennants.
        portfolioId: DataTypes.INTEGER,
        //sdescription: DataTypes.STRING,
        states: {
          type: DataTypes.ENUM,
          values: ['active', 'pending', 'deleted']
        }
    }, {
      paranoid: false,
      scopes: {
        test(value){
          return { where: { scopeId: value } };
        }
      }
    });

    Product.associate = function(models) {
      //Product.hasMany(models.Attribute);
    };

    // extensions to replace or extend existing graphql implementations (available options would be create, destroy, update, query)
    Product.graphql = {
        attributes: {
            exclude: ['description'],
            include: { modelPortfolioId: 'int', obj: 'myObj' },
        },
        scopes: ['test', 'scopeId'],
        bulk: ['create'],
        alias: { fetch: 'myProduct' },
        import: [ { from: 'RemoteProduct', as: 'Instrument', with: 'portfolioId', to: 'id' } ],
        excludeMutations: [],
        excludeQueries: [],
        'types': {
          'myObj': { 'id': '[int]', 'name': 'string', 'mySecObj': '[secObj]' },
          'secObj': { 'id': 'int', 'name': 'string', 'myThirdObj': 'thirdObj!'},
          'thirdObj': { 'id': 'int', 'name': 'string'}
        },
        mutations: {
          myMutation: { input: 'Product', output: 'cddMonitorSwitchOutput', resolver: () => { return 1; }}
        },
        queries: {
          myQuery: { output: 'cddGetOutput', input: 'Product', resolver: () => { return 1; } },
          myQuery1: { output: 'myObj', input: 'Product', resolver: () => { return 1; } }
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
              return data;
            }
        }
    };

    return Product;

};*/
