const Sequelize = require('sequelize');

module.exports = function (sequelize, DataTypes) {
  const StreamToken = sequelize.define('StreamToken', {
    id: {
      autoIncrement: true,
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
    },
    token: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    bracket_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'brackets', // 🔗 This must match your brackets table name
        key: 'bracket_id',
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    },
    role: {
      type: DataTypes.ENUM('host', 'viewer'),
      allowNull: false,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
    },
  }, {
    sequelize,
    tableName: 'StreamTokens',
    timestamps: true,
    indexes: [
      {
        name: 'PRIMARY',
        unique: true,
        using: 'BTREE',
        fields: [{ name: 'id' }],
      },
      {
        name: 'token_unique',
        unique: true,
        using: 'BTREE',
        fields: [{ name: 'token' }],
      },
      {
        name: 'bracket_id_index',
        using: 'BTREE',
        fields: [{ name: 'bracket_id' }],
      },
      {
        name: 'role_index',
        using: 'BTREE',
        fields: [{ name: 'role' }],
      },
    ],
  });

  
  StreamToken.associate = function (models) {
    StreamToken.belongsTo(models.brackets, {
      foreignKey: 'bracket_id',
      onDelete: 'CASCADE',
    });
  };

  return StreamToken;
};
