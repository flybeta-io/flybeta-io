const sequelize = require("../config/database");
const { DataTypes } = require("sequelize");
const Airport = require("./Airport");

const Flight = sequelize.define("flight", {
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
    allowNull: false
    },
  airlineCode: {
    type: DataTypes.STRING,
    allowNull: false
  },
  scheduledDeparture: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  actualDeparture: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  scheduledArrival: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  actualArrival: {
    type: DataTypes.DATE,
    allowNull: true,
    },
  originAirport: {  //Iata code
    type: DataTypes.STRING,
    allowNull: false,
    },
  destinationAirport: {   //Iata code
    type: DataTypes.STRING,
      allowNull: false,
    },
  airCraftTailNumber: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  delay: {
    type: DataTypes.INTEGER,
      allowNull: false,
    defaultValue: 0,
  },
}, {
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['flightID', 'scheduledDeparture', 'originAirport', 'destinationAirport']
    }
  ]
});

//Foreign key relationship
Flight.belongsTo(Airport, { as: 'origin', foreignKey: 'originAirport', targetKey: 'iata_code' });
Flight.belongsTo(Airport, { as: 'destination', foreignKey: 'destinationAirport', targetKey: 'iata_code' });

Airport.hasMany(Flight, { as: 'departingFlights', foreignKey: 'originAirport', sourceKey: 'iata_code' });
Airport.hasMany(Flight, { as: 'arrivingFlights', foreignKey: 'destinationAirport', sourceKey: 'iata_code' });

module.exports = Flight;
