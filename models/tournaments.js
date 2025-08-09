const Sequelize = require('sequelize');
module.exports = function(sequelize, DataTypes) {
  const tournaments= sequelize.define('tournaments', {
    tournament_id: {
      autoIncrement: true,
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true
    },
    tournament_name: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    start_date: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    end_date: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    account_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'accounts',
        key: 'account_id'
      }
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    logo_url: {
      type: DataTypes.STRING(1000),
      allowNull: true
    },
    is_published: {
      type: DataTypes.BOOLEAN, // or use TINYINT(1) if you prefer
      allowNull: false, // or true if you want it to be nullable
      defaultValue: false, // or true if you want to set a default value
    },
    image_filename: {
      type: DataTypes.STRING(255), // Adjust the size based on your needs
      allowNull: true // Allow the field to be nullable if an image is optional
    }
  }, {
    sequelize,
    tableName: 'tournaments',
    timestamps: false,
    indexes: [
      {
        name: "PRIMARY",
        unique: true,
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
  return tournaments;
};
