const {
  generateDailyChunk,
  generateDynamicYearChunks,
  fetchandSaveWeatherDataForEachAirport,
} = require("../utils/weatherData");
const {
  fetchAllAirportsICAOandIATAcodesfromDB,
} = require("../utils/airportData");

const CONCURRENT_AIRPORTS = 2; // max concurrent ICAO fetches

/* ----------------------------- Main Controller ----------------------------- */

/**
 * Fetch weather data for all ICAO codes.
 * Supports both { days } and { years } modes.
 */
exports.fetchWeatherDataAndSaveToDB = async ({ days = null, years = null }) => {
  const codes = await fetchAllAirportsICAOandIATAcodesfromDB();
  if (!codes.length) {
    console.warn(" No ICAO codes found in database.");
    return;
  }

  console.log(` Fetching weather for ${codes.length} airports...`);

  // Determine chunks
  let chunks = [];
  if (days) {
    chunks = generateDailyChunk(days);
    console.log(`→ Mode: Past ${days} days`);
  } else if (years) {
    chunks = generateDynamicYearChunks(years);
    console.log(`→ Mode: Past ${years} year(s) (chunked by year)`);
  } else {
    throw new Error("Specify either { days } or { years }");
  }

  // Concurrency handling — process airports in batches
  const airportQueue = [...codes];
  while (airportQueue.length > 0) {
    const batch = airportQueue.splice(0, CONCURRENT_AIRPORTS);
    await Promise.all(
      batch.map(({ icao_code, iata_code }) =>
        fetchandSaveWeatherDataForEachAirport(icao_code, iata_code, chunks)
      )
    );
  }

  console.log("✅ All weather data fetched and saved successfully.");
};
