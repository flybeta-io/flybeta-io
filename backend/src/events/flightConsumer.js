const { kafka } = require('../../config/kafka');
const { saveFlightData } = require('../utils/flightData');
const consumer = kafka.consumer({ groupId: 'flight-data-group' });
const TIME_IN_MS = 60 * 1000;

// const runFlightConsumer = async (topic) => {
//     await consumer.connect();
//     await consumer.subscribe({ topic, fromBeginning: false });

//     console.log(`Flight Consumer subscribed to topic: ${topic}`);

//     await consumer.run({
//         eachMessage: async ({ topic, partition, message }) => {
//             try {
//                 const flightData = JSON.parse(message.value.toString());
//                 console.log(`Received ${flightData.length} flight records from topic ${topic}`);
//                 await saveFlightData(flightData);
//             } catch (error) {
//                 console.error("Error processing flight message:", error);
//             }
//         },
//     });
// };


const runFlightConsumer = async (topic) => {
  await consumer.connect();
  await consumer.subscribe({ topic, fromBeginning: false });

  console.log(`Flight Consumer subscribed to topic: ${topic}`);

  await consumer.run({
    eachBatch: async ({ batch }) => {
      // Limit batch size to 50 messages per processing
      const messagesToProcess = batch.messages.slice(0, 50);

      const payloads = messagesToProcess.map((msg) =>
        JSON.parse(msg.value.toString())
      );

      const flightData = payloads.flat();

      console.log(
        `                    Processing ${flightData.length} messages from topic ${batch.topic}`
      );

      await saveFlightData(flightData);
    },
    // Fetch settings
    autoCommit: true,
    autoCommitInterval: TIME_IN_MS,
    eachBatchAutoResolve: true,
    readUncommitted: false,
  });
};

module.exports = { runFlightConsumer };
