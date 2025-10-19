const { fetchAirportCoordinatesByICAO } = require("../utils/airportData");
const axios = require("axios");
const Weather = require("../models/weather");
require("dotenv").config();

const API_KEY = process.env.VISUAL_CROSSING_API_KEY;
const BASE_URL =
  "https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline";

const REQUEST_DELAY_MS = 500; // rate-limit delay between API calls

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
};

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
    console.error(
      ` Error fetching last saved date for ${icao_code}:`,
      err.message
    );
    return null;
  }
};

/* --------------------------- Core Fetching Logic --------------------------- */

/** Fetch and Save weather data for a single airport (by ICAO) */
exports.fetchandSaveWeatherDataForEachAirport = async (
  icao_code,
  iata_code,
  chunks
) => {
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

      // Construct API URL
      const url = `${BASE_URL}/${location}/${chunkStart}/${end}?unitGroup=metric&include=hours&key=${API_KEY}`;
      console.log(` Fetching ${icao_code} (${chunkStart} → ${end})...`);

      try {
        const { data } = await axios.get(url);
        if (!data.days) continue;

        // console.log("🔍 Sample day data:", data.days?.[0]);

        for (const day of data.days) {
          for (const hour of day.hours) {
            // console.log("🔍 Sample hour data:", hour);

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
        await saveWeatherData(weatherData);
        weatherData = [];

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

    await delay(REQUEST_DELAY_MS); // avoid API throttling between coords
  }
};
