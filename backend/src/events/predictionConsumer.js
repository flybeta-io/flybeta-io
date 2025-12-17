const { kafka } = require("../../config/kafka");
const { savePredictionData } = require("../utils/predictionData");
const consumer = kafka.consumer({ groupId: "prediction-data-group" });
const BATCH_SIZE = 100;
const maxWaitTimeInMs = 10000;


// const runPredictionConsumer = async (topic) => {
//     await consumer.connect();
//     await consumer.subscribe({ topic, fromBeginning: false });

//     const bulkMessages = [];

//     console.log(`Prediction Consumer subscribed to topic: ${topic}`);
//     await consumer.run({
//         eachMessage: async ({ topic, partition, message }) => {
//             try {
//                 const rawData = JSON.parse(message.value.toString());

//                 // Ensure it is always an array
//                 const predictionData = Array.isArray(rawData)
//                   ? rawData
//                   : [rawData];
//                 console.log(`Received ${predictionData.length} prediction records from topic ${topic}`);
//                 bulkMessages.push(...predictionData);

//                 // If bulkMessages reach a certain size, save them
//                 if (bulkMessages.length >= BATCH_SIZE) {
//                     await savePredictionData(bulkMessages.splice(0, bulkMessages.length));
//                     bulkMessages.length = 0; // Clear the array
//                 }
//             } catch (error) {
//                 console.error("Error processing prediction message:", error);
//             }
//         },
//     });
// };


const runPredictionConsumer = async (topic) => {
  await consumer.connect();
  await consumer.subscribe({ topic, fromBeginning: false });

  console.log(`Prediction Consumer subscribed to topic: ${topic}`);

    await consumer.run({
      maxWaitTimeInMs: maxWaitTimeInMs,
    // 1. Use eachBatch instead of eachMessage
    eachBatch: async ({ batch, resolveOffset, heartbeat, isRunning }) => {
        if (!isRunning()) return;


      const messages = batch.messages;
      console.log(`Received batch of ${messages.length} messages`);

      const validPredictions = [];

      for (let message of messages) {
        try {
          const rawData = JSON.parse(message.value.toString());
          // Handle both single objects and arrays
          const data = Array.isArray(rawData) ? rawData : [rawData];
          validPredictions.push(...data);
        } catch (e) {
          console.error("Skipping bad message", e);
        }
      }

      // 2. Bulk insert to DB
      if (validPredictions.length > 0) {
        await savePredictionData(validPredictions);
      }

      // 3. Manually commit offsets (Safe!)
      // We tell Kafka: "We are done with this specific batch"
      for (let message of messages) {
        resolveOffset(message.offset);
      }

      // 4. Send heartbeat to keep connection alive during long DB saves
      await heartbeat();
    },
  });
};



module.exports = { runPredictionConsumer };
