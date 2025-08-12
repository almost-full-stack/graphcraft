'use strict';

module.exports = {
  async up (qi, Sequelize) {
    await qi.createTable('Users', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      username: { type: Sequelize.STRING, allowNull: false, unique: true },
      roleId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Roles', key: 'id' },
        onDelete: 'RESTRICT'
      },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') }
    });
    await qi.addIndex('Users', ['roleId']);
  },
  async down (qi) {
    await qi.dropTable('Users');
  }
};
