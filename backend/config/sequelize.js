const { Sequelize } = require('sequelize');
require('dotenv').config();


const POSTGRES_DB_URL = process.env.POSTGRES_DB_URL;

const sequelize = new Sequelize(POSTGRES_DB_URL, {
  dialect: "postgres",
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false,
    },
  },
  pool: {
    max: 20,
    min: 0,
    acquire: 30000,
    idle: 60000,
  },
  logging: false,
});

// Test connection
sequelize
  .authenticate()
  .then(() => console.log("Connected to Cloud SQL (Postgres)"))
  .catch((err) => console.error("Connection error:", err.message));

module.exports = sequelize;
