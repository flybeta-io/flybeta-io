const { Sequelize } = require('sequelize');
require('dotenv').config();

const DB_URL = process.env.POSTGRES_DB_URL || "";

const sequelize = new Sequelize(DB_URL, {
  dialect: 'postgres',
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false,
    }
  },
  pool: {
    max: 20,
    min: 0,
    acquire: 30000,
    idle: 10000
  },
  logging: false
});

// Test connection
sequelize.authenticate()
  .then(() => {
    console.log('Connected to TimescaleDB with Sequelize');
  })
  .catch(err => {
    console.error('TimescaleDB connection error:', err);
  });

module.exports = sequelize;
