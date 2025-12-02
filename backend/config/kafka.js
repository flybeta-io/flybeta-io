const { Kafka } = require("kafkajs");

const kafka = new Kafka({
  clientId: "flybeta-app",
  brokers: ["localhost:29092"], // connects to Docker Kafka
  requestTimeout: 60000,
  retry: {
    retries: 3
  }
});
// brokers: ["kafka:29092"], // connects to Docker Kafka if running node in Docker
// brokers: ["localhost:29092"], // connects to Docker Kafka if running node locally

const weatherTopic = "weather-data-topic";
const flightTopic = "flight-data-topic";

module.exports = {
  kafka,
  weatherTopic,
  flightTopic,
};
