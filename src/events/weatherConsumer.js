const { kafka } = require('../../config/kafka');
const { saveWeatherData } = require('../utils/weatherData');
const consumer = kafka.consumer({ groupId: 'weather-data-group' });

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

module.exports = { runWeatherConsumer };
