'use strict';

module.exports = (sequelize, DataTypes) => {

  const ProductAttribute = sequelize.define('ProductAttribute', {
    value: {
      type: DataTypes.STRING,
      allowNull: true
    }
  });

  return ProductAttribute;

};
