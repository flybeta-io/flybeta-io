const { kafka } = require('../../config/kafka');
const { saveFlightData } = require('../utils/flightData');
const consumerFlight = kafka.consumer({ groupId: 'flight-data-group' });
const consumerHistorical = kafka.consumer({ groupId: "historical-flight-data-group" });
// const maxWaitTimeInMs = 30 * 1000;


const runFlightConsumer = async (topic) => {
    await consumerFlight.connect();
    await consumerFlight.subscribe({ topic, fromBeginning: false });

    console.log(`Flight Consumer subscribed to topic: ${topic}`);
    await consumerFlight.run({
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

const runHistoricalFlightConsumer = async (topic) => {
  await consumerHistorical.connect();
  await consumerHistorical.subscribe({ topic, fromBeginning: false });

  console.log(`Flight Consumer subscribed to topic: ${topic}`);
  await consumerHistorical.run({
    eachMessage: async ({ topic, partition, message }) => {
      try {
        const flightData = JSON.parse(message.value.toString());
        console.log(
          `                    Received ${flightData.length} historical flight records from topic ${topic}`
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


module.exports = {
    runFlightConsumer,
    runHistoricalFlightConsumer
};
