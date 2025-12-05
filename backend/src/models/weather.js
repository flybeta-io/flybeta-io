const { DataTypes } = require("sequelize");
const sequelize = require("../../config/sequelize");
const Airport = require("./airport.js");

const Weather = sequelize.define(
  "weather",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    location: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    icao_code: {
      type: DataTypes.STRING(4),
      allowNull: false,
    },
    iata_code: {
      type: DataTypes.STRING(3),
      allowNull: false,
    },
    datetime: {
      type: DataTypes.DATE,
      allowNull: false, // the exact hour from Visual Crossing
    },
    visibility: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    precipitation: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    precipitation_probability: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    wind_speed: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    wind_direction: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    temperature: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    humidity: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    pressure: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    cloud_cover: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
  },
  {
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ["location", "icao_code", "iata_code", "datetime"],
      },
    ],
  }
);

// Associations
Airport.hasMany(Weather, { foreignKey: "icao_code", sourceKey: "icao_code" });
Airport.hasMany(Weather, { foreignKey: "iata_code", sourceKey: "iata_code" });

Weather.belongsTo(Airport, { foreignKey: "icao_code", targetKey: "icao_code" });
Weather.belongsTo(Airport, { foreignKey: "iata_code", targetKey: "iata_code" });

module.exports = Weather;
