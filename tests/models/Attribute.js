'use strict';
module.exports = (sequelize, DataTypes) => {

  const Attribute = sequelize.define('Attribute', {
    key: {
      type: DataTypes.STRING,
      allowNull: false
    },
    value: DataTypes.STRING
  }, { });

  Attribute.associate = function (models) {
    Attribute.belongsTo(models.Product);
  };

  // extensions to replace or extend existing graphql implementations (available options would be create, destroy, update, query)
  Attribute.graphql = {
    before: {
      fetch: (source, args, context, info) => {
        return Promise.resolve(source);
      }
    },
    extend: {
      fetch: (data, source, args, context, info) => {
        data.key = "Added by extension.";
        return Promise.resolve(data);
      }
    }
  };

  return Attribute;

};
