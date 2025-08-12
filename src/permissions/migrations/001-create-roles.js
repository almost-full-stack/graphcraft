'use strict';

module.exports = {
  async up (qi, Sequelize) {
    await qi.createTable('Roles', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      name: { type: Sequelize.STRING, allowNull: false, unique: true },
      rank: { type: Sequelize.INTEGER, allowNull: false },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') }
    });
    await qi.addIndex('Roles', ['rank']);
  },
  async down (qi) {
    await qi.dropTable('Roles');
  }
};
