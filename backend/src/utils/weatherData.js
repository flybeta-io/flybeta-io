const axios = require("axios");
const Weather = require("../models/weather");
require("dotenv").config();
const { sendMessage } = require('../events/producer');
const { weatherTopic } = require("../../config/kafka");


const API_KEY = process.env.VISUAL_CROSSING_API_KEY;
const BASE_URL =
  "https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline";
const REQUEST_DELAY_MS = 1500; // rate-limit delay between API calls
const BackdateHoursInMS = 24 * 60 * 60 * 1000; // backdate to avoid overlaps



/* ------------------------- Helper Utility Functions ------------------------ */

/** Sleep for rate limiting */
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));


/** Get the most recent saved datetime for a specific ICAO code */
const getLastSavedWeatherDateForICAO = async (icao_code) => {
  try {
    const record = await Weather.findOne({
      where: { icao_code },
      order: [["datetime", "DESC"]],
      attributes: ["datetime"],
    });

    return record ? new Date(record.datetime) : null;
  } catch (err) {
    console.error(
      ` Error fetching last saved date for ${icao_code}:`,
      err.message
    );
    return null;
  }
};


/* --------------------- Saving Script -------------------------------------------*/

exports.saveWeatherData = async (weatherData) => {
  try {
    if (!Array.isArray(weatherData) || weatherData.length === 0) {
      console.warn("No weather data to save.");
      return;
    }
    await Weather.bulkCreate(weatherData, { ignoreDuplicates: true });
    console.log(`✅ Saved ${weatherData.length} weather records.`);
  } catch (error) {
    console.error(" Error saving weather data:", error.message);
  }
};


/* --------------------------- Core Fetching Logic --------------------------- */

/** Fetch and Save weather data for a single airport (by ICAO) */
exports.fetchSingleAirportWeatherData = async (
  icao_code,
  iata_code,
  latitude_deg,
  longitude_deg,
  chunks
) => {

  let weatherData = [];

  // Determine resume point. Backdate by 24 hours
  const lastSavedDate = await getLastSavedWeatherDateForICAO(icao_code);
  if (lastSavedDate) {
    lastSavedDate.setTime(lastSavedDate.getTime() - BackdateHoursInMS);
    console.log(`⏩ Resuming ${icao_code} from ${lastSavedDate.toISOString()}`);
  }

  const location = `${latitude_deg},${longitude_deg}`;

  for (const { start, end } of chunks) {


    if (lastSavedDate && new Date(end) <= lastSavedDate) continue;

    const chunkStart =
      lastSavedDate && new Date(start) < lastSavedDate
        ? lastSavedDate.toISOString().split("T")[0]
        : start;

    // Construct API URL
    const url = `${BASE_URL}/${location}/${chunkStart}/${end}?unitGroup=metric&include=hours&key=${API_KEY}`;
    console.log(` Fetching ${icao_code} (${chunkStart} → ${end})...`);

    try {
      const { data } = await axios.get(url);
      if (!data.days) continue;

      for (const day of data.days) {
        for (const hour of day.hours) {
          const newRecord = {
            location: data.resolvedAddress,
            iata_code,
            icao_code,
            datetime: new Date(`${day.datetime} ${hour.datetime}`), // hourly precision
            visibility: hour.visibility ?? null,
            precipitation: hour.precip ?? null,
            precipitation_probability: hour.precipprob ?? null,
            wind_speed: hour.windspeed ?? null,
            wind_direction: hour.winddir ?? null,
            temperature: hour.temp ?? null,
            humidity: hour.humidity ?? null,
            pressure: hour.pressure ?? null,
            cloud_cover: hour.cloudcover ?? null,
          };

          weatherData.push(newRecord);
        }
      }

      console.log(`  → Sending weather data of length ${weatherData.length} to topic.`);
      if (weatherData.length > 0) {
        // Send weather data to Kafka topic
        await sendMessage(weatherTopic, weatherData);
        console.log(`  → Sent ${weatherData.length} valid weather records to Kafka topic.`);
        weatherData = []; // Clear after sending
      }

      await delay(REQUEST_DELAY_MS); // avoid API throttling
    } catch (err) {
      console.error(
        ` Error fetching ${icao_code} (${start}→${end}):`,
        err.message
      );

      console.error(
        `Error fetching weather data for ${icao_code}:`,
        err.response?.status,
        err.response?.data
      );

      if (weatherData.length > 0) {
        // Send weather data to Kafka topic
        await sendMessage(weatherTopic, weatherData);
        console.log(
          `  → Sent ${weatherData.length} valid weather records to Kafka topic.`
        );
        weatherData = []; // Clear after sending
      }

      if (err.response?.status === 429) {
        console.log("⏳ Too many requests, waiting 30 seconds...");
        await delay(30000);
      }

      console.error(`------- Skipping ${icao_code}`);
      break;
    };

    await delay(REQUEST_DELAY_MS);
  }

  if (weatherData.length > 0) {
    // Send weather data to Kafka topic
    await sendMessage(weatherTopic, weatherData);
    console.log(
      `  → Sent ${weatherData.length} valid weather records to Kafka topic.`
    );
    weatherData = []; // Clear after sending
  }

};
