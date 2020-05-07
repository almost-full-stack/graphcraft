'use strict';

module.exports = (sequelize, DataTypes) => {

  const Product = sequelize.define('Product', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      allowNull: false,
      primaryKey: true,
      autoIncrement: false
    },
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
    Product.belongsToMany(models.Image, {through: models.ProductMedia, as: 'Media', foreignKey: 'productId'});
    Product.belongsToMany(models.Image, {through: models.ProductImage, foreignKey: 'productId'});
  };

  Product.graphql = {
    //restoreDeleted: true,
    bulk: ['destroy', 'update'],
    readonly: false,
    joins: true,
    types: {
      customProduct: {id: 'int'},
      customNestedTye: {
        image: 'Image'
      }
    },
    queries: {
      ProductQuery: { input: 'customNestedTye', output: 'Product', resolver: () => Promise.resolve({}) }
    },
    mutations: {
      ProductMutation: {input: 'Product', output: 'Product', resolver: () => Promise.resolve({}) }
    }
  };

  return Product;

};
