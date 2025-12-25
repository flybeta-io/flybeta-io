const redisClient = require("../../config/redisClient");
const { USER_STATE_MANAGEMENT_IN_SECONDS } = require("../../config/env");


const getUserState = async (phone) => {
    try {
        // Get the user state from Redis or set to default
        const state = await redisClient.get(`session:${phone}`);
        return state ? JSON.parse(state) : { step: 'IDLE', data: {} };
    } catch (err) {
        console.error("Error getting user state from Redis:", err);
        return { step: 'IDLE', data: {} };
    }
}

const setUserState = async (phone, step, newData = {}) => {
    try {
        const currentState = await getUserState(phone);

        currentState.step = step;
        currentState.data = { ...currentState.data, ...newData };

        await redisClient.set(
          `session:${phone}`,
          JSON.stringify(currentState),
          "EX",
          USER_STATE_MANAGEMENT_IN_SECONDS
        );

        console.log(`💾 State updated for ${phone}: ${step}`)
    } catch (err) {
      console.error("Redis Save Error:", err);
    }
}

module.exports = {
    getUserState,
    setUserState
}
