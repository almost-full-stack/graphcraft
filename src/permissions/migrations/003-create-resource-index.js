'use strict';

module.exports = {
  async up (qi, Sequelize) {
    await qi.createTable('ResourceIndices', {
      resourceRn: { type: Sequelize.STRING, primaryKey: true, allowNull: false },
      model: { type: Sequelize.STRING, allowNull: false },
      ownerUserId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Users', key: 'id' },
        onDelete: 'CASCADE'
      },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') }
    });
    await qi.addIndex('ResourceIndices', ['ownerUserId']);
    await qi.addIndex('ResourceIndices', ['model']);
  },
  async down (qi) {
    await qi.dropTable('ResourceIndices');
  }
};
