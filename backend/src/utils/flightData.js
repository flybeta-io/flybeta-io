const Flight = require("../models/flight");
const axios = require("axios");
require("dotenv").config();
const { Op, Sequelize } = require("sequelize");
const { sendMessage } = require('../events/producer');
const { flightTopic } = require("../../config/kafka");


/* ------------------------- Configuration Constants ------------------------- */

const API_KEY = process.env.AVIATION_EDGE_API_KEY;
const FLIGHTS_HISTORY_BASE_URL = `https://aviation-edge.com/v2/public/flightsHistory?key=${API_KEY}`;
const REQUEST_DELAY_MS = 1500; // rate-limit delay between API calls
const BackdateHoursInMS = 24 * 60 * 60 * 1000; // backdate to avoid overlaps


const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));


/* ------------------------- Helper Utility Functions ------------------------ */

exports.fetchFlightDatafromDB = async () => {
  try {
    const flights = await Flight.findAll({
      attributes: [
        "airlineIcaoCode",
        [Sequelize.literal('ANY_VALUE("airlineIataCode")'), "airlineIataCode"],
      ],
      where: {
        airlineIcaoCode: { [Op.ne]: null },
        airlineIataCode: { [Op.ne]: null },
      },
      group: ["airlineIcaoCode"],
      raw: true,
    });

    return flights;
  } catch (error) {
    console.error("                    Error fetching flight data:", error);
    return [];
  }
};


// Function that takes in (2025-10-17t11:20:00.000) and returns new Date(2025-10-17 11:20:00.000)
const refineDate = async (value) => {
  if (!value) return null;
  const [datePart, timePart] = value.split("t");
  const refinedDateStr = `${datePart} ${timePart}`;
  return new Date(refinedDateStr);
};

// Get the last saved date for IATA Code
const getLastSavedFlightDateForIATA = async (originAirportIata) => {
  try {
    const record = await Flight.findOne({
      where: { originAirportIata },
      order: [["scheduledDepartureTime", "DESC"]],
      attributes: ["scheduledDepartureTime"],
    });
    return record ? new Date(record.scheduledDepartureTime) : null;
  } catch (err) {
    console.error(
      `                    Error fetching last saved date for ${iata_code}:`,
      err.message
    );
    return null;
  }
};

/* --------------------- Saving Script -------------------------------------------*/

//Save multiple fetched flight records in bulk
exports.saveFlightData = async (flightData) => {
  try {
    // console.log(" Saving flight data...");
    if (!Array.isArray(flightData) || flightData.length === 0) {
      console.warn("                    No flight data to save:", flightData);
      return;
    }
    await Flight.bulkCreate(flightData, { ignoreDuplicates: true });
    console.log(
      `                    ✅ Saved ${flightData.length} flight records.`
    );
  } catch (error) {
    console.error(
      "                    Error saving flight data:",
      error.message
    );
  }
};

/* --------------------------- Core Fetching Logic --------------------------- */

// // Fetch and Save flight data for a single airport (by IATA)
exports.fetchSingleAirportFlightData = async (
  icao_code,
  iata_code,
  iataCodesInDB,
  chunks
) => {
  let flightData = [];
  let fetchedFlights = 0;
  //Check that end is atleast 4 days before today in this format (2025-10-20)
  const today = new Date();
  const fourDaysAgo = new Date();
  fourDaysAgo.setDate(today.getDate() - 4);

  const fourDaysAgoStr = fourDaysAgo.toISOString().split("T")[0];
  console.log("                    Four days ago date:", fourDaysAgoStr);

  // Determine resume point
  const lastSavedDate = await getLastSavedFlightDateForIATA(iata_code);
  if (lastSavedDate) {
    lastSavedDate.setTime(lastSavedDate.getTime() - BackdateHoursInMS);
    console.log(
      `                    ⏩ Resuming ${iata_code} from ${lastSavedDate.toISOString()}`
    );
  }

  for (let { start, end } of chunks) {

    // Convert chunkStart/end to Date for comparison
    const chunkStartDate = new Date(start);
    const endDate = new Date(end);

    if (chunkStartDate > fourDaysAgo) {
      console.log(
        `                    Skipping chunk starting ${start} as it exceeds 4 days ago limit.`
      );
      continue;
    }
    if (endDate > fourDaysAgo) {
      end = fourDaysAgoStr;
    }

    if (lastSavedDate && new Date(end) <= lastSavedDate) continue;

    const chunkStart =
      lastSavedDate && new Date(start) < lastSavedDate
        ? lastSavedDate.toISOString().split("T")[0]
        : start;

    // Construct API URL
    const url = `${FLIGHTS_HISTORY_BASE_URL}&code=${iata_code}&type=departure&date_from=${chunkStart}&date_to=${end}`;
    console.log(
      `                    Fetching flights for ${iata_code}  (${chunkStart} → ${end})...`
    );
    // console.log("→ URL:", url);

    try {
      const response = await axios.get(url);
      const flights = response.data;

      fetchedFlights += flights.length;
      // console.log(`  → Fetched ${flights.length} flights.`);

      for (const flight of flights) {
        //Skip if destination ICAO code is missing in Airport DB
        if (iataCodesInDB.has(flight.arrival.iataCode.toUpperCase())) {
          const flightRecord = {
            flightID: flight.flight.iataNumber.toUpperCase(),
            airlineName: flight.airline.name.toUpperCase(),
            airlineIcaoCode: flight.airline.icaoCode.toUpperCase(),
            airlineIataCode: flight.airline.iataCode.toUpperCase(),
            scheduledDepartureTime:
              (await refineDate(flight.departure.scheduledTime)),
            actualDepartureTime:
              (await refineDate(flight.departure.actualTime)) || null,
            scheduledArrivalTime:
              (await refineDate(flight.arrival.scheduledTime)) || null,
            actualArrivalTime:
              (await refineDate(flight.arrival.actualTime)) || null,
            originAirportIata: flight.departure.iataCode.toUpperCase(),
            destinationAirportIata:
              flight.arrival.iataCode.toUpperCase(),
            delay: flight.departure.delay || null,
            status: flight.status || null,
          };
          flightData.push(flightRecord);
        } else {
          continue;
        }
      }

      if (flightData.length > 0){
        // Send flight data to Kafka topic
        await sendMessage(flightTopic, flightData);
        console.log(
          `                    → Sent ${flightData.length} / ${fetchedFlights} valid flights to Kafka topic.`
        );
        flightData = []; // Clear after sending
      }

      await delay(REQUEST_DELAY_MS); // avoid API throttling
    } catch (error) {
      console.error(
        `                    Error fetching flights for ${iata_code}:`,
        error.message
      );
       console.error(
         `                    Error fetching flight data for ${iata_code}:`,
         error.response?.status,
         error.response?.data
       );
       console.error(`                    Skipping ${iata_code}`);

      if (flightData.length > 0) {
        // Send flight data to Kafka topic
        await sendMessage(flightTopic, flightData);
        console.log(
          `                    → Sent ${flightData.length} / ${fetchedFlights} valid flights to Kafka topic.`
        );
        flightData = []; // Clear after sending
      }
      break;
    }

    await delay(REQUEST_DELAY_MS);
  }

  if (flightData.length > 0) {
    // Send flight data to Kafka topic
    await sendMessage(flightTopic, flightData);
    console.log(
      `                    → Sent ${flightData.length} / ${fetchedFlights} valid flights to Kafka topic.`
    );
    flightData = []; // Clear after sending
  }

};
