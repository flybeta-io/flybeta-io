const { Kafka } = require("kafkajs");

const kafka = new Kafka({
  clientId: "flybeta-app",
  brokers: ["kafka:9092"], // connects to Docker Kafka
  requestTimeout: 60000,
  retry: {
    retries: 3,
  },
  maxInFlightRequests: 1,
  enforceRequestTimeout: true,
  maxRequestSize: 20000000,
});
// brokers: ["kafka:29092"], // connects to Docker Kafka if running node in Docker
// brokers: ["localhost:29092"], // connects to Docker Kafka if running node locally

const weatherTopic = "weather_data_topic";
const flightTopic = "flight_data_topic";
const predictionTopic = "prediction_topic";

module.exports = {
  kafka,
  weatherTopic,
  flightTopic,
  predictionTopic,
};
