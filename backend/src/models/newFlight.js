const sequelize = require("../../config/sequelize");
const { DataTypes } = require("sequelize");
const Airport = require("./airport.js");

const newFlight = sequelize.define(
  "newFlight",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    flightID: {
      // flight
      type: DataTypes.STRING,
      allowNull: true,
    },
    aircraftTailNum: {
      //Reg
      type: DataTypes.STRING,
      allowNull: true,
    },
    airlineIcaoCode_operating_as: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    airlineIcaoCode_painted_as: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    actualDepartureTime: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    actualArrivalTime: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    originAirportIata: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    originAirportIcao: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    destinationAirportIata: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    destinationAirportIcao: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    firstSeen: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    lastSeen: {
        type: DataTypes.DATE,
        allowNull: true
    },
    flightEnded: {
        type: DataTypes.BOOLEAN,
        allowNull: true
    }
  },
  {
    timestamps: true,
    indexes: [
      {
        unique: true,
        name: "unique_flight_per",
        fields: [
          "flightID",
            "actualDepartureTime",
          "actualArrivalTime",
          "originAirportIata",
          "destinationAirportIata",
        ],
      },
    ],
  }
);

//Foreign key relationship
newFlight.belongsTo(Airport, {
  as: "origin_new_flight",
  foreignKey: "originAirportIata",
  targetKey: "iata_code",
});
newFlight.belongsTo(Airport, {
  as: "destination_new_flight",
  foreignKey: "destinationAirportIata",
  targetKey: "iata_code",
});

Airport.hasMany(newFlight, {
  as: "departingFlights_new_flight",
  foreignKey: "originAirportIata",
  sourceKey: "iata_code",
});
Airport.hasMany(newFlight, {
  as: "arrivingFlights_new_flight",
  foreignKey: "destinationAirportIata",
  sourceKey: "iata_code",
});

module.exports = newFlight;
