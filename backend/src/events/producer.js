const { kafka } = require('../../config/kafka');
const { Partitioners } = require('kafkajs');

const producer = kafka.producer({
    createPartitioner: Partitioners.LegacyPartitioner
});


const connectProducer = async () => {
    await producer.connect();
    console.log("Kafka Producer connected");
}

const sendMessage = async (topic, message) => {

    await producer.send({
        topic: topic,
        messages: [
            { value: JSON.stringify(message) },
        ],
    });
    console.log(`Message sent to topic ${topic}`);
}

module.exports = {
    connectProducer,
    sendMessage
};
