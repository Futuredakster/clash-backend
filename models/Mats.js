const Sequelize = require('sequelize');
module.exports = function(sequelize, DataTypes) {
  const Mats = sequelize.define('Mats', {
    mat_id: {
      autoIncrement: true,
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true
    },
    tournament_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'tournaments',
        key: 'tournament_id'
      },
      onDelete: 'CASCADE'
    },
    mat_name: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
    },
    modified_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      onUpdate: Sequelize.literal('CURRENT_TIMESTAMP')
    }
  }, {
    sequelize,
    tableName: 'Mats',
    timestamps: false,
    indexes: [
      {
        name: "PRIMARY",
        unique: true,
        using: "BTREE",
        fields: [
          { name: "mat_id" },
        ]
      },
      {
        name: "unique_mat_name",
        unique: true,
        using: "BTREE",
        fields: [
          { name: "tournament_id" },
          { name: "mat_name" }
        ]
      },
      {
        name: "tournament_id",
        using: "BTREE",
        fields: [
          { name: "tournament_id" },
        ]
      }
    ]
  });

  // Hooks for updating timestamps
  Mats.beforeCreate((mat, options) => {
    mat.created_at = new Date();
    mat.modified_at = new Date();
  });

  Mats.beforeUpdate((mat, options) => {
    mat.modified_at = new Date();
  });

  Mats.associate = function(models) {
    // Mat belongs to Tournament
    Mats.belongsTo(models.tournaments, {
      foreignKey: 'tournament_id',
      as: 'tournament'
    });

    // Mat has many divisions (currently assigned divisions)
    Mats.hasMany(models.Divisions, {
      foreignKey: 'mat_id',
      as: 'divisions'
    });
  };

  return Mats;
};