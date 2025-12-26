require("dotenv").config();
const express = require("express");
const sequelize = require("../config/sequelize");
const PORT = process.env.BACKEND_PORT || 5000;

const { checkTopic } = require("./events/admin");
const { connectProducer } = require("./events/producer");
const { runFlightConsumer, runHistoricalFlightConsumer } = require("./events/flightConsumer");
const { runWeatherConsumer } = require("./events/weatherConsumer");
const { runPredictionConsumer } = require("./events/predictionConsumer");

const { fetchAllData, runPeriodicJob } = require("./controllers/combinedFetch");
// const { fetchAllHistoricalFlightsData } = require("./controllers/flightController");
// const { fetchAllAirportsWeatherData } = require("../src/controllers/weatherController");
const { weatherTopic, flightTopic, predictionTopic, historicalFlightTopic, delay } = require("../config/env");
const { createDoneFlag } = require("./events/flag_creator");

// Middleware
const app = express();
app.use(express.json());

// Router
const airportRoutes = require("./routes/airportsRoutes");
app.use("/airports", airportRoutes);



app.listen(PORT, async () => {
  try {
    await sequelize.sync();
    console.log("Backend Server is Connected to Database");
    console.log(`Server is listening on port ${PORT}`);

    (async () => {

      // const batchTimeStart = Date.now();
      // console.log(`Batch process started at ${new Date(batchTimeStart).toISOString()}`);

      //Start counting time for the completion of this process
      console.log("Initializing Kafka setup");

      // Setup Kafka Topics
      console.log("Setting up Kafka topics");
      await checkTopic([weatherTopic, flightTopic, predictionTopic, historicalFlightTopic]);

      // Start Kafka Consumers
      console.log("Starting Kafka Consumers");
      await runWeatherConsumer(weatherTopic);
      await runFlightConsumer(flightTopic);
      await runHistoricalFlightConsumer(historicalFlightTopic);
      await runPredictionConsumer(predictionTopic);

      // Connect Kafka Producer
      console.log("Connecting Kafka Producer");
      await connectProducer();

      // Data fetching

      // console.log("Performing data fetch");
      // console.time("Combined data fetch duration");
      // await fetchAllData({years: 1});
      // console.log("✅ Both data fetches completed.");
      // console.timeEnd("Combined data fetch duration");

      // createDoneFlag(batchTimeStart);

      // (async () => {
      //   await runPeriodicJob({ years: 1 });
      // })();

      // (async () => {
      //   await fetchAllHistoricalFlightsData({ days: 360 });
      // })();

      await runPeriodicJob();

    })();

  } catch (error) {
    console.error(`An error occured: ${error}`);
  }
});
