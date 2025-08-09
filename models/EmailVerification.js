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
    });
  
    EmailVerification.associate = (models) => {
      EmailVerification.belongsTo(models.participant, {
        foreignKey: 'participant_id',
        onDelete: 'CASCADE',
      });
    };
  
    return EmailVerification;
  };
  