require("dotenv").config();
const express = require("express");
const sequelize = require("../config/sequelize");
const PORT = process.env.PORT || 5000;

const { checkTopic } = require("./events/admin");
const { connectProducer } = require("./events/producer");
const { runFlightConsumer } = require("./events/flightConsumer");
const { runWeatherConsumer } = require("./events/weatherConsumer");
const {
  fetchAllAirportsWeatherData,
} = require("./controllers/weatherController");
const {
  fetchAllAirportsFlightsData,
} = require("./controllers/flightController");
const { weatherTopic } = require("../config/kafka");
const { flightTopic } = require("../config/kafka");

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

    (async () => {
      console.time(" duration");

      //Start counting time for the completion of this process
      console.log("Initializing Kafka setup");

      // Setup Kafka Topics
      console.log("Setting up Kafka topics");
      await checkTopic([weatherTopic, flightTopic]);

      // Start Kafka Consumers
      console.log("Starting Kafka Consumers");
      await runWeatherConsumer(weatherTopic);
      await runFlightConsumer(flightTopic);

      // Connect Kafka Producer
      console.log("Connecting Kafka Producer");
      await connectProducer();

      // Data fetching
      console.log("Performing data fetch");
      // Fetch weather data for all airports for the past 1 year
      (async () => await fetchAllAirportsWeatherData({ years: 1 }))();

      // Fetch flight data for all airports for the past 360 days
      (async () => await fetchAllAirportsFlightsData({ days: 360 }))();

      console.log("Data fetch operation completed");

      
      console.timeEnd("Process duration");
    })();

  } catch (error) {
    console.error(`Unable to connect to the database ${error}`);
  }
});
