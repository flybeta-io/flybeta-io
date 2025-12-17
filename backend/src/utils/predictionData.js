const Prediction = require("../models/prediction");

exports.savePredictionData = async (predictionData) => {
    try {
        if (!Array.isArray(predictionData) || predictionData.length === 0) {
            console.warn("No prediction data to save.");
            return;
        }
        await Prediction.bulkCreate(predictionData, { ignoreDuplicates: true });
        console.log(`✅ Saved ${predictionData.length} prediction records.`);
    } catch (error) {
        console.error(" Error saving prediction data:", error.message);
    }
};
