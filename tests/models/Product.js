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
      }
  }, {
    paranoid: true
  });

  Product.associate = (models) => {
    Product.belongsToMany(models.Attribute, {through: models.ProductAttribute, foreignKey: 'productId'});
    Product.hasMany(models.Image);
  };

  Product.graphql = {
    bulk: ['destroy'],
    paranoid: true,
    joins: true,
    types: {
      customProduct: {id: 'int'}
    },
    queries: {
      ProductQuery: { input: 'customProduct', output: 'Product', resolver: () => Promise.resolve({}) }
    },
    mutations: {
      ProductMutation: {input: 'Product', output: 'Product', resolver: () => Promise.resolve({}) }
    }
  };

  return Product;

};
