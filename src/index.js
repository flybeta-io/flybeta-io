require("dotenv").config();
const express = require("express");
const sequelize = require("../config/sequelize");
const {
  fetchWeatherDataAndSaveToDB,
} = require("./controllers/weatherController");

const PORT = process.env.PORT || 5000;

const app = express();
app.use(express.json());

const airportRoutes = require("./routes/airportsRoutes");
app.use("/airports", airportRoutes);


app.listen(PORT, async () => {
  try {
    await sequelize.sync({ force: false });
    console.log("Database connection has been established successfully");
    console.log(`Server is listening on port ${PORT}`);

    app.use("/airports", airportRoutes);


    // Fetch past 5 years of data on startup in the background
    (async () => {
      try {
        console.log(" Starting 5-year weather data fetch in background...");
        await fetchWeatherDataAndSaveToDB({ years: 5 });
        console.log("Weather data fetch completed successfully");
      } catch (err) {
        console.error(" Weather data fetch failed:", err.message);
      }
    })();

    // Fetch past 1 day of data
    // (async () => {
    //   try {
    //     console.log(" Fetching past 1 day of weather data...");
    //     await fetchWeatherDataAndSaveToDB({ days: 1 });
    //     console.log("1-day weather data fetch completed successfully");
    //   } catch (err) {
    //     console.error(" 1-day weather data fetch failed:", err.message);
    //   }
    // })();


  } catch (error) {
    console.error(`Unable to connect to the database ${error}`);
  }
});
