const { kafka } = require('../../config/kafka');
const { saveWeatherData } = require('../utils/weatherData');
const consumer = kafka.consumer({ groupId: 'weather-data-group' });
const maxWaitTimeInMs = 30 * 1000; // 30 seconds


const runWeatherConsumer = async (topic) => {
    await consumer.connect();
    await consumer.subscribe({ topic, fromBeginning: false });

    console.log(`Weather Consumer subscribed to topic: ${topic}`);

    await consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
            try {
                const weatherData = JSON.parse(message.value.toString());
                console.log(`Received ${weatherData.length} weather records from topic ${topic}`);
                await saveWeatherData(weatherData);
            } catch (error) {
                console.error("Error processing weather data message:", error);
            }
        }
    });
};



// const runWeatherConsumer = async (topic) => {
//   await consumer.connect();
//   await consumer.subscribe({ topic, fromBeginning: false });

//   console.log(`Weather Consumer subscribed to topic: ${topic}`);
//     await consumer.run({
//       maxWaitTimeInMs: maxWaitTimeInMs,
//     // 1. Use eachBatch instead of eachMessage
//     eachBatch: async ({ batch, resolveOffset, heartbeat, isRunning }) => {
//         if (!isRunning()) return;


//       const messages = batch.messages;
//       console.log(`Received batch of ${messages.length} messages`);

//       const weatherData = [];

//       for (let message of messages) {
//         try {
//           const rawData = JSON.parse(message.value.toString());
//           // Handle both single objects and arrays
//           const data = Array.isArray(rawData) ? rawData : [rawData];
//           weatherData.push(...data);
//         } catch (e) {
//           console.error("Skipping bad message", e);
//         }
//       }

//       // 2. Bulk insert to DB
//       if (weatherData.length > 0) {
//         await saveWeatherData(weatherData);
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





// const runWeatherConsumer = async (topic) => {
//   await consumer.connect();
//   await consumer.subscribe({ topic, fromBeginning: false });

//   console.log(`Weather Consumer subscribed to topic: ${topic}`);

//   await consumer.run({
//     // Fetch settings
//     autoCommit: false,
//     maxWaitTimeInMs: TIME_IN_MS,
//     eachBatchAutoResolve: false,
//     readUncommitted: false,

//     eachBatch: async ({ batch, resolveOffset, heartbeat, isRunning }) => {
//       if (!isRunning()) return;

//       console.log(`Received batch of ${batch.messages.length} messages`);
//       console.log(
//         `Processing ${batch.messages.length} messages from topic ${batch.topic}`
//       );

//       const weatherData = [];

//       for (const msg of batch.messages) {
//         if (!msg.value) continue;
//         try {
//           // Parse and add to our array
//           const parsed = JSON.parse(msg.value.toString());
//           Array.isArray(parsed)
//             ? weatherData.push(...parsed)
//             : weatherData.push(parsed);
//         } catch (e) {
//           console.error(`Failed to parse message offset ${msg.offset}:`, e);
//           // Optional: resolveOffset(msg.offset) here if you want to skip bad JSON
//         }
//       }

//       if (weatherData.length > 0) {
//         try {
//           console.log(`Saving ${weatherData.length} records...`);

//           // 2. Bulk Insert
//           await saveWeatherData(weatherData);

//           // 3. Mark the last message as processed
//           const lastOffset = batch.messages[batch.messages.length - 1].offset;
//           resolveOffset(lastOffset);

//           await consumer.commitOffsets([
//             {
//               topic: batch.topic,
//               partition: batch.partition,
//               offset: (Number(lastOffset) + 1).toString(),
//             },
//           ]);

//           // 4. Heartbeat ensures the broker knows we are still alive during long DB saves
//           await heartbeat();
//         } catch (error) {
//           console.error("Error saving weather data batch:", error);
//           throw error; // Rethrow to avoid committing offsets
//         }
//       }
//     },
//   });
// };



module.exports = { runWeatherConsumer };
