const newFlight  = require("../models/newFlight");
const axios = require("axios");
require("dotenv").config();

const API_KEY = process.env.FLIGHT_RADAR_API_KEY;
const BASE_URL = `https://fr24api.flightradar24.com/api/flight-summary/full`;
const REQUEST_DELAY_MS = 500; // rate-limit delay between API calls
const DB_BATCH_SIZE = 1000;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/* ------------------------- Helper Utility Functions ------------------------ */

//Save multiple fetched flight records in bulk
const saveNewFlighData = async (newFlightData) => {
  try {
    console.log(" Saving new flight data...");
    if (!Array.isArray(newFlightData) || newFlightData.length === 0) {
      console.warn("No flight data to save:", newFlightData);
      return;
    }
    await newFlight.bulkCreate(newFlightData, { ignoreDuplicates: true });
    console.log(`✅ Saved ${newFlightData.length} flight records.`);
  } catch (error) {
    console.error(" Error saving flight data:", error.message);
  }
};


// // Get the last saved date for IATA Code
const getLastSavedNewFlightDate = async (originAirportIata) => {
  try {
    const record = await newFlight.findOne({
      where: { originAirportIata },
      order: [["firstSeen", "DESC"]],
      attributes: ["firstSeen"],
    });
    return record ? new Date(record.firstSeen) : null;
  } catch (err) {
    console.error(
      ` Error fetching last saved date for ${iata_code}:`,
      err.message
    );
    return null;
  }
};

const formatDate = (value) => {
  if (!value) return null;
  return new Date(value).toISOString().split(".")[0];
};


/* --------------------------- Core Fetching Logic --------------------------- */

// // Fetch and Save flight data for a single airport (by IATA)
exports.fetchandSaveNewFlights = async (
  icao_code,
  iata_code,
  iataCodesInDB,
  chunks
) => {
  let newFlightData = [];
  let fetchedFlights = 0;

  //Check that end is atleast 4 days before today in this format (2025-10-20)
  const today = new Date();
  const fourDaysAgo = new Date();
  fourDaysAgo.setDate(today.getDate() - 4);

  const fourDaysAgoStr = fourDaysAgo.toISOString().split("T")[0];
  console.log(" Four days ago date:", fourDaysAgoStr);

  // Determine resume point
  const lastSavedDate = await getLastSavedNewFlightDate(iata_code);
  if (lastSavedDate) {
    console.log(`⏩ Resuming ${iata_code} from ${lastSavedDate.toISOString()}`);
  }

  for (let { start, end } of chunks) {

      // Convert chunkStart/end to Date for comparison
      const chunkStartDate = new Date(start);
      const endDate = new Date(end);

      if (chunkStartDate > fourDaysAgo) {
        console.log(
          ` Skipping chunk starting ${start} as it exceeds 4 days ago limit.`
        );
        continue;
      }
      if (endDate > fourDaysAgo) {
        end = fourDaysAgoStr;
      }

      if (lastSavedDate && new Date(end) <= lastSavedDate) continue;

      const chunkStart =
        lastSavedDate && new Date(start) < lastSavedDate
          ? lastSavedDate.toISOString().split('.')[0]
        : start;

      // Construct API URL
      const url = `${BASE_URL}?flight_datetime_from=${encodeURIComponent(formatDate(chunkStart))}&flight_datetime_to=${encodeURIComponent(formatDate(end))}&airports=outbound:${iata_code}&limit=20000`;
      console.log(
        ` Fetching newFlights for ${iata_code}  (${chunkStart.split('T')[0]} → ${end})...`
      );
    // console.log("→ URL:", url);

      try {
        let config = {
          method: "get",
          maxBodyLength: Infinity,
          url: url,
          headers: {
            Accept: "application/json",
            "Accept-Version": "v1",
            Authorization: `Bearer ${API_KEY}`,
          },
        };
        const response = await axios.request(config);
        const flights = response.data?.data;

        // console.log(`  → Fetched ${flights.length} flights.`);

        fetchedFlights += flights.length;

        for (const flight of flights) {
          if (!flight.dest_iata) {
            // console.log(`Skipping due to incomplete Airport codes`)
            continue;
          }

          //Skip if destination ICAO code is missing in Airport DB
          if (iataCodesInDB.has(flight.dest_iata.toUpperCase())) {
            const newFlightRecord = {
              flightID: flight.flight,
              aircaftTailNum: flight.reg,
              airlineIcaoCode_operating_as: flight.operating_as,
              airlineIcaoCode_painted_as: flight.painted_as,
              actualDepartureTime: flight.datetime_takeoff,
              actualArrivalTime: flight.datetime_landed,
              originAirportIata: flight.orig_iata,
              originAirportIcao: flight.orig_icao,
              destinationAirportIata: flight.dest_iata,
              destinationAirportIcao: flight.dest_icao,
              firstSeen: flight.first_seen,
              lastSeen: flight.last_seen,
              flightEnded: flight.flightEnded,
            };
            newFlightData.push(newFlightRecord);
          } else {
            continue;
          }
        }

        console.log(`Total Valid Flights: ${newFlightData.length}/${fetchedFlights}`);

        if (newFlightData.length >= DB_BATCH_SIZE) {
          console.log(`Valid Unsaved newFlightData: ${newFlightData.length} > DB_BATCH_SIZE: ${DB_BATCH_SIZE}`);
          await saveNewFlighData(newFlightData);
          newFlightData = [];
          fetchedFlights = 0;
        }

        await delay(REQUEST_DELAY_MS); // avoid API throttling
      } catch (error) {
        console.error(
          `  Error fetching flights for ${iata_code}:`,
          error.message
        );
        console.error("Error fetching:", error.response?.status, error.response?.data);

        if (newFlightData.length > 0) {
          console.log(` ##.......... Saving remaining records.`);
          console.log(
            `Remaining newFlightData: ${newFlightData.length}`
          );
          await saveNewFlighData(newFlightData);
          newFlightData = [];
          fetchedFlights = 0;
        }

        if (error.response?.status === 429) {
          console.log("⏳ Too many requests, waiting 15 seconds...");
          await delay(15000);
        }

        console.error(`------- Skipping ${iata_code}`);
        break;
      };

      await delay(REQUEST_DELAY_MS);
  }

  if (newFlightData.length > 0) {
    console.log('##... Saving final records ............');
    console.log(`Final newFlightData: ${newFlightData.length}`);
    await saveNewFlighData(newFlightData);
    newFlightData = [];
    fetchedFlights = 0;
  }

}
