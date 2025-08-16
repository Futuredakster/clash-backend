// models/recordings.js
const Sequelize = require('sequelize');

module.exports = function(sequelize, DataTypes) {
  const recordings = sequelize.define('recordings', {
    recording_id: {
      autoIncrement: true,
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true
    },
    bracket_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'brackets',
        key: 'bracket_id'
      },
      onDelete: 'CASCADE'
    },
    cloudinary_public_id: {
      type: DataTypes.STRING(255),
      allowNull: true  // null until uploaded
    },
    cloudinary_url: {
      type: DataTypes.STRING(1000),
      allowNull: true  // null until uploaded
    },
    original_filename: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    file_size: {
      type: DataTypes.BIGINT,  // in bytes
      allowNull: true
    },
    duration: {
      type: DataTypes.INTEGER,  // in seconds
      allowNull: true
    },
    recording_status: {
      type: DataTypes.ENUM('recording', 'completed', 'uploading', 'uploaded', 'failed'),
      allowNull: false,
      defaultValue: 'recording'
    },
    started_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
    },
    completed_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    uploaded_at: {
      type: DataTypes.DATE,
      allowNull: true
    }
  }, {
    sequelize,
    tableName: 'recordings',
    freezeTableName: true,
    timestamps: true,
    indexes: [
      {
        name: "PRIMARY",
        unique: true,
        using: "BTREE",
        fields: [{ name: "recording_id" }]
      },
      {
        name: "bracket_id_index",
        using: "BTREE",
        fields: [{ name: "bracket_id" }]
      },
      {
        name: "status_index",
        using: "BTREE",
        fields: [{ name: "recording_status" }]
      }
    ]
  });

  recordings.associate = function(models) {
    recordings.belongsTo(models.brackets, {
      foreignKey: 'bracket_id',
      onDelete: 'CASCADE'
    });
  };

  return recordings;
};