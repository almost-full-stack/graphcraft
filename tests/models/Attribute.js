'use strict';
module.exports = (sequelize, DataTypes) => {

    const Attribute = sequelize.define('Attribute', {
        key: DataTypes.STRING,
        value: DataTypes.STRING
    }, { });

    Attribute.associate = function(models) {
      Attribute.belongsTo(models.Product);
    };

    // extensions to replace or extend existing graphql implementations (available options would be create, destroy, update, query)
    Attribute.graphql = {
        extend: {
            fetch: (data, source, args, context, info) => {
                console.log('Running Attribute extension.');
                data.key = "Added by extension.";
                return Promise.resolve(data);
            }
        }
    };

    return Attribute;

};
