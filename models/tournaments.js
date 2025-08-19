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
    },
    signup_duedate: {
      type: DataTypes.DATEONLY,
      allowNull: true
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


// Create a new column role for users. When creating an account the user will be a host by default.
// This will then allow the host premission to make a stripe account.
// After if they signe dup we will have a green button saying they did so they have an account id
// Or else we will have a button saying they need to sign up.
// There are two diffrent api routes so we will just make one a parthenr and one a host
// default value is null 