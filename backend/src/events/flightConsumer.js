const { kafka } = require('../../config/kafka');
const { saveFlightData } = require('../utils/flightData');
const consumer = kafka.consumer({ groupId: 'flight-data-group' });
const maxWaitTimeInMs = 30 * 1000;

const runFlightConsumer = async (topic) => {
    await consumer.connect();
    await consumer.subscribe({ topic, fromBeginning: false });

    console.log(`Flight Consumer subscribed to topic: ${topic}`);
    await consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
            try {
                const flightData = JSON.parse(message.value.toString());
                console.log(
                  `                    Received ${flightData.length} flight records from topic ${topic}`
                );
                await saveFlightData(flightData);
            } catch (error) {
                console.error(
                  "                    Error processing flight message:",
                  error
                );
            }
        },
    });
};


// const runFlightConsumer = async (topic) => {
//   await consumer.connect();
//   await consumer.subscribe({ topic, fromBeginning: false });

//   console.log(`Flight Consumer subscribed to topic: ${topic}`);
//     await consumer.run({
//       maxWaitTimeInMs: maxWaitTimeInMs,
//     // 1. Use eachBatch instead of eachMessage
//     eachBatch: async ({ batch, resolveOffset, heartbeat, isRunning }) => {
//         if (!isRunning()) return;


//       const messages = batch.messages;
//       console.log(`Received batch of ${messages.length} messages`);

//       const flightData = [];

//       for (let message of messages) {
//         try {
//           const rawData = JSON.parse(message.value.toString());
//           // Handle both single objects and arrays
//           const data = Array.isArray(rawData) ? rawData : [rawData];
//           flightData.push(...data);
//         } catch (e) {
//           console.error("Skipping bad message", e);
//         }
//       }

//       // 2. Bulk insert to DB
//       if (flightData.length > 0) {
//         await saveFlightData(flightData);
//       }

//       // 3. Manually commit offsets (Safe!)
//       // We tell Kafka: "We are done with this specific batch"
//       for (let message of messages) {
//         resolveOffset(message.offset);
//       }

//       // 4. Send heartbeat to keep connection alive during long DB saves
//       await heartbeat();
//     },
//   });
// };


// const runFlightConsumer = async (topic) => {
//   await consumer.connect();
//   await consumer.subscribe({ topic, fromBeginning: false });

//   console.log(`Flight Consumer subscribed to topic: ${topic}`);

//   await consumer.run({
//     eachBatch: async ({ batch }) => {
//       // Limit batch size to 50 messages per processing
//       const messagesToProcess = batch.messages.slice(0, 50);

//       const payloads = messagesToProcess.map((msg) =>
//         JSON.parse(msg.value.toString())
//       );

//       const flightData = payloads.flat();

//       console.log(
//         `                    Processing ${flightData.length} messages from topic ${batch.topic}`
//       );

//       await saveFlightData(flightData);
//     },
//     // Fetch settings
//     autoCommit: true,
//     autoCommitInterval: TIME_IN_MS,
//     eachBatchAutoResolve: true,
//     readUncommitted: false,
//   });
// };

module.exports = { runFlightConsumer };
