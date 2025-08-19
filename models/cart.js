const Sequelize = require('sequelize');

module.exports = function(sequelize, DataTypes) {
  const cart = sequelize.define('cart', {
    cart_id: {
      autoIncrement: true,
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true
    },
    participant_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'participant', // Must match your Participant model name
        key: 'participant_id'
      },
      onDelete: 'CASCADE'
    },
    division_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'Divisions', // Must match your Divisions model name
        key: 'division_id'
      },
      onDelete: 'CASCADE'
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null
    },
    modified_at: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null
    }
  }, {
    sequelize,
    tableName: 'cart',
    freezeTableName: true,
    timestamps: false,
    indexes: [
      {
        name: "PRIMARY",
        unique: true,
        using: "BTREE",
        fields: [
          { name: "cart_id" },
        ]
      },
      {
        name: "participant_id_index",
        using: "BTREE",
        fields: [
          { name: "participant_id" },
        ]
      },
      {
        name: "division_id_index",
        using: "BTREE",
        fields: [
          { name: "division_id" },
        ]
      }
    ]
  });

  cart.associate = function(models) {
    cart.belongsTo(models.participant, { foreignKey: 'participant_id' });
    cart.belongsTo(models.Divisions, { foreignKey: 'division_id' });
  };

  // Hooks for timestamps
  cart.beforeCreate((cart, options) => {
    cart.created_at = new Date();
    cart.modified_at = new Date();
  });

  cart.beforeUpdate((cart, options) => {
    cart.modified_at = new Date();
  });

  return cart;
};
