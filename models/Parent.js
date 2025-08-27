const Sequelize = require('sequelize');

module.exports = function(sequelize, DataTypes) {
  const Parent = sequelize.define('Parent', {
    parent_id: {
      autoIncrement: true,
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: Sequelize.NOW
    },
    modified_at: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: Sequelize.NOW
    }
  }, {
    sequelize,
    tableName: 'parent',
    freezeTableName: true, 
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'modified_at',
    indexes: [
      {
        name: "PRIMARY",
        unique: true,
        using: "BTREE",
        fields: [
          { name: "parent_id" },
        ]
      },
      {
        name: "email_unique",
        unique: true,
        using: "BTREE",
        fields: [
          { name: "email" },
        ]
      }
    ]
  });

  Parent.associate = function(models) {
    // Parent has many participants (children)
    Parent.hasMany(models.participant, {
      foreignKey: 'parent_id',
      as: 'children'
    });
    
    // If you want email verification for parents too
    Parent.hasOne(models.EmailVerification, {
      foreignKey: 'parent_id',
    });
  };

  return Parent;
};