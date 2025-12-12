const { kafka } = require('../../config/kafka');
const { saveWeatherData } = require('../utils/weatherData');
const consumer = kafka.consumer({ groupId: 'weather-data-group' });
const TIME_IN_MS = 60 * 1000;

// const runWeatherConsumer = async (topic) => {
//     await consumer.connect();
//     await consumer.subscribe({ topic, fromBeginning: false });

//     console.log(`Weather Consumer subscribed to topic: ${topic}`);

//     await consumer.run({
//         eachMessage: async ({ topic, partition, message }) => {
//             try {
//                 const weatherData = JSON.parse(message.value.toString());
//                 console.log(`Received ${weatherData.length} weather records from topic ${topic}`);
//                 await saveWeatherData(weatherData);
//             } catch (error) {
//                 console.error("Error processing weather data message:", error);
//             }
//         }
//     });
// };

const runWeatherConsumer = async (topic) => {
  await consumer.connect();
  await consumer.subscribe({ topic, fromBeginning: false });

  console.log(`Weather Consumer subscribed to topic: ${topic}`);

  await consumer.run({
    eachBatch: async ({ batch }) => {
      // Limit batch size to 50 messages per processing
      const messagesToProcess = batch.messages.slice(0, 50);

      const payloads = messagesToProcess.map((msg) =>
        JSON.parse(msg.value.toString())
      );
      const weatherData = payloads.flat();

      console.log(
        `Processing ${weatherData.length} messages from topic ${batch.topic}`
      );

      await saveWeatherData(weatherData);
    },
    // Fetch settings
    autoCommit: true,
    autoCommitInterval: TIME_IN_MS,
    eachBatchAutoResolve: true,
    readUncommitted: false,
  });
};

module.exports = { runWeatherConsumer };
