const { fetchandSaveNewFlights } = require("../utils/newFlightData");
const { generateDailyChunk, generateDynamicYearChunks } = require("../utils/generic");
const { fetchAirportsDatafromDB } = require('../utils/airportData');
const { getAirportsCache } = require('../utils/cache');


/* ----------------------------- Main Controller ----------------------------- */

/**
 * Fetch and save departure flights for all airports.
 */
exports.fetchAndSaveNewFlights = async ({ days = null, years = null }) => {
    // const airports = await fetchAllAirportsICAOandIATAcodesfromDB();
    console.log(`Fetching Airports Data for Flights Operation`);
    const airports = (
      await getAirportsCache(fetchAirportsDatafromDB())
    );

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

    const iataCodesInDB = new Set(airports.map((a) => a.iata_code));
    console.log(`Loaded ${iataCodesInDB.size} IATA codes into memory.`);


    // Sequentially process each airport code
    for (const { icao_code, iata_code } of airports) {
        try {
            console.log(`Fetching newFlight data for IATA Code: ${iata_code}`);
            await fetchandSaveNewFlights(
              icao_code,
              iata_code,
              iataCodesInDB,
              chunks
            );

        } catch (error) {
            console.error(
                `❌ Failed fetching newFlights for ${iata_code}: ${error.message}`
            );
            continue;
        }
    }

    console.log("✅ All newFlight data fetched and saved successfully.");
};
