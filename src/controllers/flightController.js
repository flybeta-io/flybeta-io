const { fetchandSaveDepartureFlightsForEachAirport} = require("../utils/flightData");
// const {
//   fetchAllAirportsICAOandIATAcodesfromDB,
// } = require("../utils/airportData");
const { generateDailyChunk, generateDynamicYearChunks } = require("../utils/generic");
// const { allAirportsICAOCodeInDB } = require('../utils/generic');
const { fetchAirportsDatafromDB } = require('../utils/airportData');
const { getAirportsCache } = require('../utils/cache');


/* ----------------------------- Main Controller ----------------------------- */

/**
 * Fetch and save departure flights for all airports.
 */
exports.fetchFlightsDataAndSaveToDB = async ({ days = null, years = null }) => {
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

    const icaoCodesInDB = new Set(airports.map((a) => a.icao_code));
    console.log(`Loaded ${icaoCodesInDB.size} ICAO codes into memory.`);


    // Sequentially process each airport code
    for (const { icao_code, iata_code } of airports) {
        try {
            console.log(`Fetching flight data for IATA Code: ${iata_code}`);
            await fetchandSaveDepartureFlightsForEachAirport(icao_code, iata_code, icaoCodesInDB, chunks);

        } catch (err) {
            console.error(
                `❌ Failed fetching flights for ${iata_code}: ${err.message}`
            );
            continue;
        }
    }

    console.log("✅ All flight data fetched and saved successfully.");
};
