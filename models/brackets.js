const Sequelize = require('sequelize');

module.exports = function(sequelize, DataTypes) {
  const brackets = sequelize.define('brackets', {
    bracket_id: {
      autoIncrement: true,
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true
    },
    division_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'Divisions',
        key: 'division_id'
      }
    },
    user1: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    user2: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    participant_id1: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'Participants',
        key: 'participant_id'
      }
    },
    participant_id2: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'Participants',
        key: 'participant_id'
      }
    },
    points_user1: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false
    },
    points_user2: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false
    },
    win_user1: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false
    },
    win_user2: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false
    },
    round: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1
    },
    time: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 5
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
     is_complete: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    }
  }, {
    sequelize,
    tableName: 'brackets',
     freezeTableName: true, 
    timestamps: false,
    indexes: [
      {
        name: "PRIMARY",
        unique: true,
        using: "BTREE",
        fields: [
          { name: "bracket_id" },
        ]
      },
      {
        name: "division_id",
        using: "BTREE",
        fields: [
          { name: "division_id" },
        ]
      },
    ]
  });

  
  brackets.associate = function (models) {
    brackets.hasMany(models.StreamToken, {
      foreignKey: 'bracket_id',
      onDelete: 'CASCADE',
    });
  };

  return brackets;
};
  
