require("dotenv").config();
const express = require("express");
const sequelize = require('../config/sequelize');
const PORT = process.env.PORT || 5000;


const app = express();
app.use(express.json());

// Import Routes
const airportRoutes = require('./routes/airportsRoutes')
app.use("/airports", airportRoutes);

app.listen(PORT, async () => {
  try {
    await sequelize.sync({ force: false });
    console.log("Database connection has been established successfully");
    console.log(`Server is listening on port ${PORT}`);
  } catch (error) {
    console.error(`Unable to connect to the database ${error}`);
  };
});
