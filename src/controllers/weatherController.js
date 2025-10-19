const {
  fetchandSaveWeatherDataForEachAirport,
} = require("../utils/weatherData");
const {
  fetchAllAirportsICAOandIATAcodesfromDB,
} = require("../utils/airportData");
const { generateDailyChunk, generateDynamicYearChunks } = require("../utils/generic");


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
    console.log(`→ Mode: Past ${years} year(s) (chunked by month)`);
  } else {
    throw new Error("Specify either { days } or { years }");
  }

  // Sequentially process each airport code
  for (const { icao_code, iata_code } of codes) {
    await fetchandSaveWeatherDataForEachAirport(icao_code, iata_code, chunks);
  }

  console.log("✅ All weather data fetched and saved successfully.");
};
