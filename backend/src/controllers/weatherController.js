const { fetchSingleAirportWeatherData } = require("../utils/weatherData");
const { generateDailyChunk, generateDynamicYearChunks } = require("../utils/generic");
const { fetchAirportsDatafromDB } = require("../utils/airportData");
const { getAirportsCache } = require('../utils/cache');



/* ----------------------------- Main Controller ----------------------------- */

/**
 * Fetch weather data for all ICAO codes.
 * Supports both { days } and { years } modes.
 */
exports.fetchAllAirportsWeatherData = async ({ days = null, years = null }) => {
  try {
    console.log(`Fetching Airports Data for Weather Operation`);
    const airports = await getAirportsCache(fetchAirportsDatafromDB());

    if (!airports.length) {
      console.warn(" No ICAO codes found in database.");
      return;
    }

    console.log(` Fetching weather for ${airports.length} airports...`);

    // Determine chunks
    let chunks = [];
    if (days) {
      chunks = generateDailyChunk(days);
      console.log(`→ Mode: Past ${days} days`);
    } else if (years) {
      chunks = generateDynamicYearChunks(years);
      console.log(`→ Mode: Past ${years} year(s) (chunked by month)`);
    } else {
      throw new Error("Specify either { days } or { years }");
    }

    try {
      // Sequentially process each airport code
      for (const {
        icao_code,
        iata_code,
        latitude_deg,
        longitude_deg,
      } of airports) {
        console.log(`Processing Weather Data for ICAO Code: ${icao_code}`);
        await fetchSingleAirportWeatherData(
          icao_code,
          iata_code,
          latitude_deg,
          longitude_deg,
          chunks
        );
      }
    } catch (err) {
      console.error(`Error processing weather data for ${icao_code}`);
    }

    console.log("✅ All weather data fetched and saved successfully.");
  } catch (error) {
    console.error(`Error in Weather Operation:`, error);
  }
};
