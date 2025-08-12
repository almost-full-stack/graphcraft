'use strict';

module.exports = {
  async up (qi, Sequelize) {
    await qi.createTable('PermissionAssignments', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      roleId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Roles', key: 'id' },
        onDelete: 'CASCADE'
      },
      resourceRn: { type: Sequelize.STRING, allowNull: false },
      permission: { type: Sequelize.STRING, allowNull: false },
      allow: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') }
    });
    await qi.addIndex('PermissionAssignments', ['roleId']);
    await qi.addIndex('PermissionAssignments', ['resourceRn']);
    await qi.addIndex('PermissionAssignments', ['permission']);
    await qi.addIndex('PermissionAssignments', ['roleId', 'resourceRn', 'permission']);
  },
  async down (qi) {
    await qi.dropTable('PermissionAssignments');
  }
};
