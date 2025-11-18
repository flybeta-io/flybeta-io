const { Kafka } = require("kafkajs");

exports.kafka = new Kafka({
  clientId: "flybeta-app",
  brokers: ["localhost:29092"], // connects to Docker Kafka
});
// brokers: ["kafka:29092"], // connects to Docker Kafka if running node in Docker
// brokers: ["localhost:29092"], // connects to Docker Kafka if running node locally
