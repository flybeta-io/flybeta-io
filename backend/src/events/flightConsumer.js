const { kafka } = require('../../config/kafka');
const { saveFlightData } = require('../utils/flightData');
const consumer = kafka.consumer({ groupId: 'flight-data-group' });

const runFlightConsumer = async (topic) => {
    await consumer.connect();
    await consumer.subscribe({ topic, fromBeginning: false });

    console.log(`Flight Consumer subscribed to topic: ${topic}`);

    await consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
            try {
                const flightData = JSON.parse(message.value.toString());
                console.log(`Received ${flightData.length} flight records from topic ${topic}`);
                await saveFlightData(flightData);
            } catch (error) {
                console.error("Error processing flight message:", error);
            }
        },
    });
};

module.exports = { runFlightConsumer };
