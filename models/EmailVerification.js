// models/EmailVerification.js

module.exports = (sequelize, DataTypes) => {
  const EmailVerification = sequelize.define('EmailVerification', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    code: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    verified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    participant_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'participant',
        key: 'participant_id'
      }
    },
    parent_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'parent',
        key: 'parent_id'
      }
    }
  }, {
    validate: {
      onlyOneReference() {
        if ((this.participant_id && this.parent_id) || (!this.participant_id && !this.parent_id)) {
          throw new Error('EmailVerification must belong to either a participant OR a parent, not both or neither');
        }
      }
    }
  });

  EmailVerification.associate = (models) => {
    EmailVerification.belongsTo(models.participant, {
      foreignKey: 'participant_id',
      onDelete: 'CASCADE',
    });
    
    EmailVerification.belongsTo(models.Parent, {
      foreignKey: 'parent_id',
      onDelete: 'CASCADE',
    });
  };

  return EmailVerification;
};
  