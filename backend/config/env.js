require("dotenv").config();
const path = require('path');

// Mounted Volume
const raw_path = process.env.FLAG_PATH;
exports.flagPath = path.resolve(raw_path);


// Redis
exports.SHORT_TERM_IN_SECONDS_REDIS = 1 * 60 * 60;
exports.LONG_TERM_IN_SECONDS_REDIS = 24 * 60 * 60;
exports.REQUEST_DELAY_MS = 1500;


// General Data fetch
exports.BACKDATE_HOURS_IN_MS = 24 * 60 * 60 * 1000;  //24 hours
exports.delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));


// Flght data
const AV_EDGE_API_KEY = process.env.AVIATION_EDGE_API_KEY;
exports.FLIGHTS_HISTORY_BASE_URL = `https://aviation-edge.com/v2/public/flightsHistory?key=${AV_EDGE_API_KEY}`;
exports.TODAY_FLIGHTS_BASE_URL = `https://aviation-edge.com/v2/public/timetable?key=${AV_EDGE_API_KEY}`;
exports.AIRPORTS_DATABASE_BASE_URL = `https://aviation-edge.com/v2/public/airportDatabase?key=${AV_EDGE_API_KEY}`;


// Weather Data
exports.VC_API_KEY = process.env.VISUAL_CROSSING_API_KEY;
exports.VC_BASE_URL = `https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline`;


// Kafka
exports.weatherTopic = process.env.WEATHER_TOPIC;
exports.flightTopic = process.env.FLIGHT_TOPIC;
exports.predictionTopic = process.env.PREDICTION_TOPIC;
exports.historicalFlightTopic = process.env.HISTORICAL_FLIGHT_TOPIC;
exports.RETENTION_DAYS_LENGTH_IN_MS = (7 * 24 * 60 * 60 * 1000).toString();   //7 days
