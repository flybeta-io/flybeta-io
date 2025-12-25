const { kafka } = require('../../config/kafka.js');
const admin = kafka.admin();
const { RETENTION_DAYS_LENGTH_IN_MS } = require("../../config/env.js");


// const storageInMilliseconds = (7 * 24 * 60 * 60 * 1000).toString()  //7 days

const checkTopic = async (topics) => {
    await admin.connect();
    console.log("Kafka Admin connected");

    const existingTopics = await admin.listTopics();
    for(const topic of topics) {
        if (!existingTopics.includes(topic)) {
                await admin.createTopics({
                  topics: [
                    {
                      topic,
                      numPartitions: 1,
                      replicationFactor: 1,
                      configEntries: [
                        {
                          name: "retention.ms",
                          value: RETENTION_DAYS_LENGTH_IN_MS,
                        },
                      ],
                    },
                  ],
                });
            console.log(`Topic ${topic} created`);
        } else {
            console.log(`Topic ${topic} already exists`);
        }
    }

    await admin.disconnect();
};

module.exports = {
    checkTopic
};
