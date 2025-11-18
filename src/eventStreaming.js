const { Partitioners } = require('kafkajs');
const {kafka} = require('../config/kafka');

const admin = kafka.admin();
const producer = kafka.producer({
    createPartitioner: Partitioners.LegacyPartitioner
});
const consumer = kafka.consumer({ groupId: "test-group" });


exports.run = async () => {
    // Check if topic exists or create it
    await admin.connect();
    const existingTopics = await admin.listTopics();
    const topics = ["test-topic"];

    for (const topic of topics ){
        if (!existingTopics.includes(topic)) {
            await admin.createTopics({
                topics: [{ topic , numPartitions: 1, replicationFactor: 1 }],
            });
            console.log(`Created topic: ${topic}`);
        }
    }

    await admin.disconnect();

  // Connect consumer
    await consumer.connect();
    for (const topic of topics) {
          await consumer.subscribe({ topic: "test-topic", fromBeginning: true });
    }

  // Start consuming messages
  await
  consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      console.log(`Received: ${message.value.toString()}`);
    },
  });

  // Connect producer
  await producer.connect();
  console.log("Producer & consumer running...");

  // Send a test message every 5 seconds
  setInterval(async () => {
    await producer.send({
      topic: "test-topic",
      messages: [
        { key: "1", value: `Hello from host at ${new Date().toISOString()}` },
      ],
    });
    console.log("Message sent");
  }, 5000);
};
