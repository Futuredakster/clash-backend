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
      allowNull: true
    },
    belt_color: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    parent_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'parent',
        key: 'parent_id'
      }
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: true
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
    tableName: 'participant',
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
          { name: "participant_id" },
        ]
      },
    ],
    validate: {
      emailRequiredForIndependentParticipants() {
        // Only validate if parent_id or email fields are being changed or for new records
        if (this.isNewRecord || this.changed('parent_id') || this.changed('email')) {
          if (!this.parent_id && !this.email) {
            throw new Error('Email is required when parent_id is not provided');
          }
        }
      }
    }
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
    
    // Participant belongs to Parent (optional)
    participant.belongsTo(models.Parent, {
      foreignKey: 'parent_id',
      as: 'parent'
    });
  };

  return participant;
};