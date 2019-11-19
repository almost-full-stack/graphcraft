'use strict';

module.exports = (sequelize, DataTypes) => {

    const Product = sequelize.define('Product', {
        name: {
          type: DataTypes.STRING,
          allowNull: false
        },
        price: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 0
        },
        barcode: {
          type: DataTypes.STRING,
          unique: true
        },
        isActive: {
          type: DataTypes.BOOLEAN,
          defaultValue: true,
          allowNull: false
        },
        scopeId: DataTypes.INTEGER
    }, {
      paranoid: false,
      scopes: {
        scope(value) {
          return { where: { scopeId: value } };
        }
      }
    });

    Product.associate = function(models) {
      Product.belongsToMany(models.Attribute, {through: models.ProductAttribute, foreignKey: 'productId', direction: ['product']});
      Product.hasMany(models.Image);
    };

    Product.graphql = {
      associationDirection: {
        Attribute: 'Product'
      },
      queries: {
        ProductQuery: { output: 'Product', resolver: () => Promise.resolve({}) }
      }
    };

    return Product;

};
