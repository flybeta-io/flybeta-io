require("dotenv").config();
const express = require("express");
const sequelize = require("../config/sequelize");
const {
  fetchWeatherDataAndSaveToDB,
} = require("./controllers/weatherController");
const {
  fetchFlightsDataAndSaveToDB,
} = require("./controllers/flightController");


const PORT = process.env.PORT || 5000;


const app = express();
app.use(express.json());

const airportRoutes = require("./routes/airportsRoutes");
app.use("/airports", airportRoutes);

app.listen(PORT, async () => {
  try {
    await sequelize.sync();
    console.log("Database connection has been established successfully");
    console.log(`Server is listening on port ${PORT}`);

    // (async () => {
    //   try {
    //     console.log("Starting 1-year weather data fetch...");
    //   await fetchWeatherDataAndSaveToDB({ years: 1 });
    //   console.log("✅ 1-year weather data fetch completed successfully");
    //   } catch (err) {
    //     console.error("❌ Weather data fetch failed: ", err.message);
    //   }
    // })();

    (async () => {
      try {
        console.log("Starting sequential background data fetch...");

        // 1️⃣ Fetch past 1 year of weather data first
        console.log("Starting 1-year weather data fetch...");
        await fetchWeatherDataAndSaveToDB({ years: 1 });
        console.log("1-year weather data fetch completed successfully");

        // 2️⃣ Then fetch flight data for past 360 days
        console.log("Fetching past 360 days of flight data...");
        await fetchFlightsDataAndSaveToDB({ days: 360 });
        console.log(" ✅ 360-day flight data fetch completed successfully");

        console.log("✅ All background fetches completed successfully.");
      } catch (err) {
        // console.error("❌ Flight data fetch failed: ", err.message);
        console.error("❌ Background data fetch sequence failed:", err.message);
      }
    })();


  } catch (error) {
    console.error(`Unable to connect to the database ${error}`);
  }
});
