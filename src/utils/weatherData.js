const {
  fetchAirportCoordinatesByICAO,
  fetchAllAirportsICAOandIATAcodesfromDB,
} = require("../utils/airportData");
const axios = require("axios");
const Weather = require("../models/weather");
require("dotenv").config();

const API_KEY = process.env.VISUAL_CROSSING_API_KEY;
const BASE_URL =
  "https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline";

  // Specify required weather elements explicitly
const elements = [
  "visibility",
  "precip",
  "windspeed",
  "winddir",
  "temp",
  "pressure",
  "cloudceiling",
  "cloudcover",
].join(",");

const DB_BATCH_SIZE = 500; // safe batch insert size
const REQUEST_DELAY_MS = 2000; // rate-limit delay between API calls

/* ------------------------- Helper Utility Functions ------------------------ */

/** Sleep for rate limiting */
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Save multiple fetched weather records in bulk */
const saveWeatherData = async (weatherData) => {
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
}

/** Generate a single date chunk for the past N days */
exports.generateDailyChunk = (days) => {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - days);
  return [
    {
      start: start.toISOString().split("T")[0],
      end: end.toISOString().split("T")[0],
    },
  ];
}

/** Generate yearly chunks going backward from today */
exports.generateDynamicYearChunks = (yearsBack) => {
  const currentYear = new Date().getFullYear();
  const chunks = [];

  for (let i = yearsBack - 1; i >= 0; i--) {
    const year = currentYear - i;
    const start = new Date(`${year}-01-01`);
    const end = year === currentYear ? new Date() : new Date(`${year}-12-31`);
    chunks.push({
      start: start.toISOString().split("T")[0],
      end: end.toISOString().split("T")[0],
    });
  }

  return chunks;
}

/** Get the most recent saved datetime for a specific ICAO code */
const getLastSavedDateForICAO = async (icao_code) => {
  try {
    const record = await Weather.findOne({
      where: { icao_code },
      order: [["datetime", "DESC"]],
      attributes: ["datetime"],
    });

    return record ? new Date(record.datetime) : null;
  } catch (err) {
    console.error(` Error fetching last saved date for ${icao_code}:`, err.message);
    return null;
  }
}

/* --------------------------- Core Fetching Logic --------------------------- */

/** Fetch weather data for a single airport (by ICAO) */
exports.fetchandSaveWeatherDataForEachAirport = async (icao_code, iata_code, chunks) => {
  const coords = await fetchAirportCoordinatesByICAO([icao_code]);
  if (!coords || !coords.length) {
    console.warn(` No coordinates found for ICAO code: ${icao_code}`);
    return;
  }

  // Determine resume point
  const lastSavedDate = await getLastSavedDateForICAO(icao_code);
  if (lastSavedDate) {
    console.log(`⏩ Resuming ${icao_code} from ${lastSavedDate.toISOString()}`);
  }

  for (const { latitude_deg, longitude_deg } of coords) {
    const location = `${latitude_deg},${longitude_deg}`;
    let weatherData = [];

    for (const { start, end } of chunks) {
      if (lastSavedDate && new Date(end) <= lastSavedDate) continue;

      const chunkStart =
        lastSavedDate && new Date(start) < lastSavedDate
          ? lastSavedDate.toISOString().split("T")[0]
          : start;

      start = chunkStart;

      const url = `${BASE_URL}/${location}/${start}/${end}?unitGroup=metric&include=hours&key=${API_KEY}&elements=${elements}`;
      console.log(` Fetching ${icao_code} (${start} → ${end})...`);

      try {
        const { data } = await axios.get(url);
        if (!data.days) continue;

        for (const day of data.days) {
          for (const hour of day.hours) {
            weatherData.push({
              location: data.resolvedAddress,
              iata_code,
              icao_code,
              datetime: `${day.datetime}T${hour.datetime}`,
              visibility: hour.visibility,
              precipitation: hour.precip,
              wind_speed: hour.windspeed,
              wind_direction: hour.winddir,
              temperature: hour.temp,
              pressure: hour.pressure,
              cloud_ceiling: hour.cloudceiling,
              cloud_cover: hour.cloudcover,
            });
          }
        }

        if (weatherData.length >= DB_BATCH_SIZE) {
          await saveWeatherData(weatherData);
          weatherData = [];
        }

        await delay(REQUEST_DELAY_MS); // avoid API throttling
      } catch (err) {
        console.error(
          ` Error fetching ${icao_code} (${start}–${end}):`,
          err.message
        );
      }
    }

    if (weatherData.length > 0) {
      await saveWeatherData(weatherData);
      console.log(` Remaining records saved for ${icao_code}`);
    }
  }
}
