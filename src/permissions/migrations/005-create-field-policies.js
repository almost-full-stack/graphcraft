'use strict';

module.exports = {
  async up (qi, Sequelize) {
    await qi.createTable('FieldPolicies', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      roleId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Roles', key: 'id' },
        onDelete: 'CASCADE'
      },
      model: { type: Sequelize.STRING, allowNull: false },
      resourceRn: { type: Sequelize.STRING, allowNull: false },
      field: { type: Sequelize.STRING, allowNull: false },
      action: { type: Sequelize.ENUM('read', 'write'), allowNull: false },
      allow: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') }
    });
    await qi.addIndex('FieldPolicies', ['roleId']);
    await qi.addIndex('FieldPolicies', ['model']);
    await qi.addIndex('FieldPolicies', ['resourceRn']);
    await qi.addIndex('FieldPolicies', ['field']);
    await qi.addIndex('FieldPolicies', ['action']);
    await qi.addIndex('FieldPolicies', ['roleId', 'model', 'resourceRn', 'action']);
  },
  async down (qi) {
    await qi.dropTable('FieldPolicies');
  }
};
