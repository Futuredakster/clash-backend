const Sequelize = require('sequelize');

module.exports = function(sequelize, DataTypes) {
  const participant = sequelize.define('participant', {
    participant_id: {
      autoIncrement: true,
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    date_of_birth: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },
    belt_color: {
      type: DataTypes.STRING(50),
      allowNull: false
    },

    email: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    created_at: { // Add the created_at field
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: Sequelize.NOW
    },
    modified_at: { // Add the modified_at field
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: Sequelize.NOW
    }
  }, {
    sequelize,
    tableName: 'participant',
     freezeTableName: true, 
    timestamps: true, // Enable automatic timestamps
    createdAt: 'created_at', // Specify the name of the createdAt field
    updatedAt: 'modified_at', // Specify the name of the updatedAt field
    indexes: [
      {
        name: "PRIMARY",
        unique: true,
        using: "BTREE",
        fields: [
          { name: "id" },
        ]
      },
    ]
  });

  participant.associate = function(models) {
    // Define many-to-many association with Divisions
    participant.belongsToMany(models.Divisions, {
      through: 'ParticipantDivision',
      foreignKey: 'participant_id',
      otherKey: 'division_id'
    });
    participant.hasOne(models.EmailVerification, {
      foreignKey: 'participant_id',
    });    
  };

  

  /*/participant.belongsToMany(sequelize.models.Divisions, {
    through: 'ParticipantDivision',
    foreignKey: 'participant_id',
    otherKey: 'division_id'
  });*/

  

  return participant;
};

