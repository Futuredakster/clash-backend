const Sequelize = require('sequelize');

module.exports = function(sequelize, DataTypes) {
  const ParticipantDivision = sequelize.define('ParticipantDivision', {
    participant_division_id: {
      autoIncrement: true,
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true
    },
    participant_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'participant', // Ensure this matches the name of your Participant model
        key: 'participant_id'
      },
      onDelete: 'CASCADE'
    },
    division_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'Divisions', // Ensure this matches the name of your Divisions model
        key: 'division_id'
      },
      onDelete: 'CASCADE'
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
    tableName: 'participant_division',
    timestamps: false,
    indexes: [
      {
        name: "PRIMARY",
        unique: true,
        using: "BTREE",
        fields: [
          { name: "participant_division_id" },
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

  ParticipantDivision.associate = function(models) {
    ParticipantDivision.belongsTo(models.participant, { foreignKey: 'participant_id' });
    ParticipantDivision.belongsTo(models.Divisions, { foreignKey: 'division_id' });
  };

  // Hooks for updating timestamps
  ParticipantDivision.beforeCreate((participantDivision, options) => {
    participantDivision.created_at = new Date();
    participantDivision.modified_at = new Date();
  });

  ParticipantDivision.beforeUpdate((participantDivision, options) => {
    participantDivision.modified_at = new Date();
  });

  return ParticipantDivision;
};
