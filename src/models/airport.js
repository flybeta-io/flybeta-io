const { DataTypes } = require('sequelize');
const sequelize = require('../../config/sequelize');

// Define Airport model
const Airport = sequelize.define(
  "airport",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
    },
    icao_code: {
      type: DataTypes.STRING(4),
      allowNull: false,
      unique: true,
    },
    iata_code: {
      type: DataTypes.STRING(3),
      allowNull: false,
      unique: true,
    },
    latitude_deg: {
      type: DataTypes.FLOAT,
      allowNull: false,
      validate: {
        min: -90,
        max: 90,
      },
    },
    longitude_deg: {
      type: DataTypes.FLOAT,
      allowNull: false,
      validate: {
        min: -180,
        max: 180,
      },
    },
    type: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
  },
  {
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

module.exports = Airport;
