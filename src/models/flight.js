const sequelize = require("../../config/sequelize");
const { DataTypes } = require("sequelize");
const Airport = require("./Airport");

const Flight = sequelize.define(
  "flight",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    flightID: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    airlineName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    airlineIataCode: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    scheduledDepartureTime: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    actualDepartureTime: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    scheduledArrivalTime: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    originAirportIata: {
      //Iata code
      type: DataTypes.STRING,
      allowNull: false,
    },
    destinationAirportIata: {
      //Iata code
      type: DataTypes.STRING,
      allowNull: false,
    },
    delay: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  },
  {
    timestamps: true,
    indexes: [
      {
        unique: true,
        name: "unique_flight_per_schedule",
        fields: [
          "flightID",
          "scheduledDepartureTime",
          "originAirportIata",
          "destinationAirportIata",
        ],
      },
    ],
  }
);

//Foreign key relationship
Flight.belongsTo(Airport, {
  as: "origin",
  foreignKey: "originAirportIata",
  targetKey: "iata_code",
});
Flight.belongsTo(Airport, {
  as: "destination",
  foreignKey: "destinationAirportIata",
  targetKey: "iata_code",
});

Airport.hasMany(Flight, {
  as: "departingFlights",
  foreignKey: "originAirportIata",
  sourceKey: "iata_code",
});
Airport.hasMany(Flight, {
  as: "arrivingFlights",
  foreignKey: "destinationAirportIata",
  sourceKey: "iata_code",
});

module.exports = Flight;
