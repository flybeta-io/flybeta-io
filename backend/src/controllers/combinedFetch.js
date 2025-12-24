const { fetchAirportsDatafromDB } = require("../utils/airportData");
// const { getAirportsCache } = require("../utils/cache");
const {
  generateDailyChunk,
  generateDynamicYearChunks,
} = require("../utils/generic");
// const { fetchSingleAirportWeatherData } = require("../utils/weatherData");
// const {
//   fetchDailyFlightSchedule
// } = require("../utils/flightData");
const { fetchAllDailyFlights } = require("../controllers/flightController");
const { fetchAllAirportsWeatherData } = require("../controllers/weatherController");


// const CONCURRENCY_NUMBER = 10;
// const CONCURRENCY_DELAY_MS = 2000; // delay between batches
// const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));


exports.fetchAllData = async () => {
  (async () => {
    // await fetchAllDailyFlights();
  })();

  // await fetchAllAirportsWeatherData({ years: 1 });
}
