require("dotenv").config();
const express = require("express");
const sequelize = require("../config/sequelize");
const { fetchAndSaveWeather } = require("./controllers/weatherController");
const { fetchAndSaveFlights } = require("./controllers/flightController");
const { fetchAndSaveNewFlights } = require("./controllers/newFlightController");

const PORT = process.env.PORT || 5000;

// Middleware
const app = express();
app.use(express.json());

// Router
const airportRoutes = require("./routes/airportsRoutes");
app.use("/airports", airportRoutes);



app.listen(PORT, async () => {
  try {
    await sequelize.sync();
    console.log("Database connection has been established successfully");
    console.log(`Server is listening on port ${PORT}`);

    // Saving missing ICAO codes

    (async () => {
      try {
        console.log("Starting sequential background data fetch...");

        // // 1️⃣ Fetch past 1 year of weather data first
        // console.log("Starting 1-year weather data fetch...");
        // await fetchAndSaveWeather({ years: 1 });
        // console.log("1-year weather data fetch completed successfully");

        // 2️⃣ Then fetch flight data for past 360 days
        console.log("Fetching past 360 days of flight data...");
        await fetchAndSaveFlights({ days: 360 });
        console.log(" ✅ 360-day flight data fetch completed successfully");

        // //
        // console.log("Fetching newFlights past 1 year data");
        // await fetchAndSaveNewFlights({ days: 365 });
        // console.log("✅ 1-year newFlight date fetch completed successfully");

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
