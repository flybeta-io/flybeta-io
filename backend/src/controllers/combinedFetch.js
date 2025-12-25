const fs = require('fs');
const { fetchAirportsDatafromDB } = require("../utils/airportData");
const {
  generateDailyChunk,
  generateDynamicYearChunks,
} = require("../utils/generic");
const { fetchSingleAirportWeatherData } = require("../utils/weatherData");
const { fetchDailyFlightSchedule } = require("../utils/flightData");
const { fetchAllHistoricalFlightsData } = require("../controllers/flightController");
const { flagPath, delay } = require("../../config/env");
const { createDoneFlag } = require("../events/flag_creator");


const BATCH_SIZE = 100;
let j = 0;


const fetchAllData = async ({days = null, years = null }) => {
  console.log(
    `Fetching Airports Data for Coombined Operation`
  );
  const airports = await fetchAirportsDatafromDB();
  console.log(
    `✅Loaded ${airports.length} airports for for combined operation`
  );

  if (!airports.length) {
    console.warn("No IATA codes found in database.");
    return;
  }

  let chunks = [];
  if (days) {
    chunks = generateDailyChunk(days);
    console.log(`               → Mode: Past ${days} days`);
  } else if (years) {
    chunks = generateDynamicYearChunks(years);
    console.log(
      `               → Mode: Past ${years} year(s) (chunked by month)`
    );
  } else {
    throw new Error("                    Specify either { days } or { years }");
  }

  const iataCodesInDB = new Set(airports.map((a) => a.iata_code));
  console.log(
    `Loaded ${iataCodesInDB.size} IATA codes into memory.`
  );
  console.log(`👀 Watcher started. Target: ${flagPath}`);



  // =========================
  // FLAG WATCHER LOOP
  // ========================
  while (true) {
    try {

      if (fs.existsSync(flagPath)) {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] ⏳ Flag found. Flink is busy. Waiting...`);

      } else {

        console.log(`\n\n\n[${new Date().toISOString()}] ✅ Path clear!`);


        // ===========================
        // NEW BATCH
        // ===========================
        const batchTimeStart = Date.now();
        console.log(
          `Batch process started at ${new Date(batchTimeStart).toISOString()}`
        );
        const batch = airports.slice(j, j + BATCH_SIZE);

        // Stop if we ran out of airports
        if (batch.length === 0) {
            console.log("✅ All airports processed. Exiting.");
            break;
        }
        console.log(`🚀 Processing batch ${j} to ${j + batch.length}...`);

        for (const { icao_code, iata_code, latitude_deg, longitude_deg } of batch) {
          await Promise.all([
            fetchSingleAirportWeatherData(
              icao_code,
              iata_code,
              latitude_deg,
              longitude_deg,
              chunks
            ),
            fetchDailyFlightSchedule(icao_code, iata_code, iataCodesInDB),
          ]);
        }
        createDoneFlag(batchTimeStart);
        j += BATCH_SIZE
        // if (j > airports.length) break;
      }

    } catch (err) {
      console.error("❌ Error in orchestrator loop:", err);
    }

    //Wait 10 seconds before checking again
    await delay(10000);

  }
};




// ==========================================
// RUN PERIODIC JOB
// ==========================================

const TWO_HOURS_MS = 2 * 60 * 60 * 1000; // 2 hours in milliseconds
let cycle = 0;

exports.runPeriodicJob = async () => {
  console.log("🚀 Starting Periodic Job Service...");

  while (true) {
    try {
      console.log(`\n\n[${new Date().toISOString()}] Starting new cycle (${cycle}) for combined data fetch...`);
      console.time("Combined data fetch duration");

      await fetchAllData({ years: 1 });

      console.log(`✅ Cycle completed ${cycle} successfully.`);
      console.timeEnd("Combined data fetch duration");
    } catch (err) {

      console.error(`❌ Error during fetch cycle ${cycle}:`, err);
    }

    console.log("\n\n💤 Sleeping for 2 hours...");
    cycle += 1;
    (async () => {
      console.time("Historical Fight Data Fetch")
      await fetchAllHistoricalFlightsData({ days: 360 });
      console.timeEnd("Historical Fight Data Fetch");
    })();
    await delay(TWO_HOURS_MS);
  }
};
