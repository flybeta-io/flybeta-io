const { fetchAirportsDatafromDB } = require("../utils/airportData");
const { getAirportsCache } = require("../utils/cache");
const {
  generateDailyChunk,
  generateDynamicYearChunks,
} = require("../utils/generic");
const { fetchSingleAirportWeatherData } = require("../utils/weatherData");
const { fetchSingleAirportFlightData } = require("../utils/flightData");


const CONCURRENCY_NUMBER = 10;
const CONCURRENCY_DELAY_MS = 2000; // delay between batches
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));


exports.fetchAllData = async ({days = null, year = null}) => {
    console.log(`Fetching Airports Data for Weather and Flights Operation`);
    const airports = await getAirportsCache(fetchAirportsDatafromDB());

    if (!airports.length) {
      console.warn(" No ICAO codes found in database.");
      return;
    }

    console.log(` Fetching data for ${airports.length} airports...`);



    let chunksFlight = generateDailyChunk(days);
    let chunksWeather = generateDynamicYearChunks(year);

    const iataCodesInDB = new Set(airports.map((a) => a.iata_code));
    console.log(
      `                  Loaded ${iataCodesInDB.size} IATA codes into memory.`
    );

  //   // Using concurrency to limit simultaneous requests
  // const airportChunks = [];

  // for (let i = 0; i < airports.length; i += CONCURRENCY_NUMBER) {
  //   airportChunks.push(airports.slice(i, i + CONCURRENCY_NUMBER));

  //   for (const chunk of airportChunks) {
  //     await Promise.all(
  //       chunk.map(async ({
  //         icao_code,
  //         iata_code,
  //         latitude_deg,
  //         longitude_deg,
  //       }) => {
  //         try {
  //           console.log(
  //             `                  Fetching flight data for IATA Code: ${iata_code}`
  //           );
  //           await fetchSingleAirportFlightData(
  //             icao_code,
  //             iata_code,
  //             iataCodesInDB,
  //             chunksFlight
  //           );
  //         } catch (err) {
  //           console.error(
  //             `                  ❌ Failed fetching flights for ${iata_code}: ${err.message}`
  //           );
  //           continue;
  //         }

  //         try {
  //           console.log(
  //             `Processing Weather Data for ICAO Code: ${icao_code}`
  //           );
  //           await fetchSingleAirportWeatherData(
  //             icao_code,
  //             iata_code,
  //             latitude_deg,
  //             longitude_deg,
  //             chunksWeather
  //           );
  //         } catch (err) {
  //           console.error(
  //                 `Error processing weather data for ${icao_code}`
  //             );
  //             continue;
  //         }
  //       })
  //     );
  //     await delay(CONCURRENCY_DELAY_MS); // 3 second delay between chunks
  //   }
  // }
  

    // Sequentially process each airport code
    for (const {
            icao_code,
            iata_code,
            latitude_deg,
            longitude_deg,
        } of airports) {
            try {
                console.log(
                  `                  Fetching flight data for IATA Code: ${iata_code}`
                );
                await fetchSingleAirportFlightData(
                    icao_code,
                    iata_code,
                    iataCodesInDB,
                    chunksFlight
              );

              } catch (err) {
                console.error(
                  `                  ❌ Failed fetching flights for ${iata_code}: ${err.message}`
                );
                continue;
            }

            try {
              console.log(
                `Processing Weather Data for ICAO Code: ${icao_code}`
              );
              await fetchSingleAirportWeatherData(
                icao_code,
                iata_code,
                latitude_deg,
                longitude_deg,
                chunksWeather
              );
            } catch (err) {
              console.error(
                    `Error processing weather data for ${icao_code}`
                );
                continue;
            }
    }
    console.log(`✅ All combined data fetched and saved successfully.`);
}
