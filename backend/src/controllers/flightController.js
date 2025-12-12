const { fetchSingleAirportFlightData } = require("../utils/flightData");
const { generateDailyChunk, generateDynamicYearChunks } = require("../utils/generic");
const { fetchAirportsDatafromDB } = require('../utils/airportData');
const { getAirportsCache } = require('../utils/cache');
const Flight = require("../models/flight");
const { fetchFlightDatafromDB } = require("../utils/flightData");



// Save the missing airport IcaoCodes in DB
exports.saveMissingIcaoCodes = async () => {
  console.log('Saving Missing Flight Icao Codes');
  const flights = await getAirportsCache(fetchFlightDatafromDB());

  if (!flights.length) {
    console.warn(" No flight found in database.");
    return;
  }

  for (const flight of flights) {
    try {
      console.log(`Saving ICAO code: ${flight.airlineIcaoCode}`);
      await Flight.update(
        { airlineIcaoCode: `${flight.airlineIcaoCode}` },
        { where: { airlineIataCode: `${flight.airlineIataCode}` } }
      );
    } catch (error) {
      console.error(
        `Error saving ICAO code: ${flight.airlineIcaoCode} => ${error}`
      );
    }
  }

  console.log(`All ICAO codes saved successfully`);

}





/* ----------------------------- Main Controller ----------------------------- */

/**
 * Fetch and save departure flights for all airports.
 */
exports.fetchAllAirportsFlightsData = async ({ days = null, years = null }) => {
  console.log(`                      Fetching Airports Data for Flights Operation`);
  const airports = await getAirportsCache(fetchAirportsDatafromDB());

  if (!airports.length) {
    console.warn("                    No IATA codes found in database.");
    return;
  }

  let chunks = [];
  if (days) {
    chunks = generateDailyChunk(days);
    console.log(`               → Mode: Past ${days} days`);
  } else if (years) {
    chunks = generateDynamicYearChunks(years);
    console.log(`               → Mode: Past ${years} year(s) (chunked by month)`);
  } else {
    throw new Error("                    Specify either { days } or { years }");
  }

  const iataCodesInDB = new Set(airports.map((a) => a.iata_code));
  console.log(`                  Loaded ${iataCodesInDB.size} IATA codes into memory.`);

  // Sequentially process each airport code
  for (const { icao_code, iata_code } of airports) {
    try {
      console.log(
        `                        Fetching flight data for IATA Code: ${iata_code}`
      );
      await fetchSingleAirportFlightData(
        icao_code,
        iata_code,
        iataCodesInDB,
        chunks
      );
    } catch (err) {
      console.error(
        `                        ❌ Failed fetching flights for ${iata_code}: ${err.message}`
      );
      continue;
    }
  }

  console.log("                  ✅ All flight data fetched and saved successfully.");
};
