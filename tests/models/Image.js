'use strict';

module.exports = (sequelize, DataTypes) => {

    const Image = sequelize.define('Image', {
        url: {
          type: DataTypes.STRING,
          allowNull: false
        }
    }, {
      paranoid: false,
      scopes: {
        scope(value) {
          return { where: { scopeId: value } };
        }
      }
    });

    Image.associate = function(models) {
      Image.belongsTo(models.Product);
    };

    return Image;

};
