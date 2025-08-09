const Sequelize = require('sequelize');
module.exports = function(sequelize, DataTypes) {
 const schedule= sequelize.define('schedule', {
    schedule_id: {
      autoIncrement: true,
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true
    },
    tournament_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'tournaments',
        key: 'tournament_id'
      }
    },
    match_date: {
      type: DataTypes.DATE,
      allowNull: true
    },
    location: {
      type: DataTypes.STRING(100),
      allowNull: true
    }
  }, {
    sequelize,
    tableName: 'schedule',
    timestamps: false,
    indexes: [
      {
        name: "PRIMARY",
        unique: true,
        using: "BTREE",
        fields: [
          { name: "schedule_id" },
        ]
      },
      {
        name: "tournament_id",
        using: "BTREE",
        fields: [
          { name: "tournament_id" },
        ]
      },
    ]
  });
  return schedule;
};
