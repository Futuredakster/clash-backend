const Sequelize = require('sequelize');
module.exports = function(sequelize, DataTypes) {
  const attendees= sequelize.define('attendees', {
    attendee_id: {
      autoIncrement: true,
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'users',
        key: 'user_id'
      }
    },
    tournament_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'tournaments',
        key: 'tournament_id'
      }
    },
    account_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'accounts',
        key: 'account_id'
      }
    }
  }, {
    sequelize,
    tableName: 'attendees',
    timestamps: false,
    indexes: [
      {
        name: "PRIMARY",
        unique: true,
        using: "BTREE",
        fields: [
          { name: "attendee_id" },
        ]
      },
      {
        name: "user_id",
        using: "BTREE",
        fields: [
          { name: "user_id" },
        ]
      },
      {
        name: "tournament_id",
        using: "BTREE",
        fields: [
          { name: "tournament_id" },
        ]
      },
      {
        name: "account_id",
        using: "BTREE",
        fields: [
          { name: "account_id" },
        ]
      },
    ]
  });
  return attendees;
};
