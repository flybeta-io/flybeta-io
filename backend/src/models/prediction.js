const { DataTypes } = require("sequelize");
const sequelize = require("../../config/sequelize");


const Prediction = sequelize.define(
  "prediction",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    unique_key: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    timestamp: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    stage: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    prediction: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  },
  {
    indexes: [
      {
        unique: true,
        fields: ["unique_key", "timestamp"],
      },
    ],
  }
);

module.exports = Prediction;
