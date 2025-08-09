const Sequelize = require('sequelize');
module.exports = function(sequelize, DataTypes) {
  const accounts= sequelize.define('accounts', {
    account_id: {
      autoIncrement: true,
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true
    },
    account_type: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    account_name: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    account_description: {
      type: DataTypes.STRING(1000),
      allowNull: true
    }
  }, 
  {
    sequelize,
    tableName: 'accounts',
    timestamps: false,
    indexes: [
      {
        name: "PRIMARY",
        unique: true,
        using: "BTREE",
        fields: [
          { name: "account_id" },
        ]
      },
    ]
  });
  return accounts;
};
