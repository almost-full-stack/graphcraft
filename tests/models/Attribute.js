'use strict';

module.exports = (sequelize, DataTypes) => {

  const Attribute = sequelize.define('Attribute', {
    name: {
      type: DataTypes.STRING,
      allowNull: false
    }
  }, { });

  Attribute.associate = function (models) {
    Attribute.belongsToMany(models.Product, {through: models.ProductAttribute, foreignKey: 'attributeId'});
  };

  return Attribute;

};
