const { fetchandSaveDepartureFlightsForEachAirport} = require("../utils/flightData");
const {
  fetchAllAirportsICAOandIATAcodesfromDB,
} = require("../utils/airportData");
const { generateDailyChunk, generateDynamicYearChunks } = require("../utils/generic");


/* ----------------------------- Main Controller ----------------------------- */

/**
 * Fetch and save departure flights for all airports.
 */
exports.fetchFlightsDataAndSaveToDB = async ({ days = null, years = null }) => {
    const airports = await fetchAllAirportsICAOandIATAcodesfromDB();
    if (!airports.length) {
        console.warn(" No IATA codes found in database.");
        return;
    }

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
    for (const { icao_code, iata_code } of airports) {
        await fetchandSaveDepartureFlightsForEachAirport(icao_code, iata_code, chunks);
    }

    console.log("✅ All flight data fetched and saved successfully.");
};
