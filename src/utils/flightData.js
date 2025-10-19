const Airport = require('../models/Airport');
const Flight = require('../models/flight');
const {
    fetchAllAirportsICAOandIATAcodesfromDB
} = require('../utils/airportData');
const axios = require('axios');
require('dotenv').config();

const API_KEY = process.env.AVIATION_EDGE_API_KEY;
const FLIGHTS_HISTORY_BASE_URL = `https://aviation-edge.com/v2/public/flightsHistory?key=${API_KEY}`;
const elementsForFlightHistory = `&code=${iata_code}&type=departure&date_from=${startDate}&date_to=${endDate}`;


const DB_BATCH_SIZE = 100; // safe batch insert size
const REQUEST_DELAY_MS = 10000; // rate-limit delay between API calls

/* ------------------------- Helper Utility Functions ------------------------ */

//Save multiple fetched flight records in bulk
const saveFlightData = async (flightData) => {
    try {
        if (!Array.isArray(flightData) || flightData.length === 0) {
            console.warn("No flight data to save.");
            return;
        }
        await Flight.bulkCreate(flightData, { ignoreDuplicates: true });
        console.log(` Saved ${flightData.length} flight records.`);
    } catch (error) {
        console.error(" Error saving flight data:", error.message);
    }
};


// // Fetch and Save flight data for a single airport (by IATA)
// const fetchandSaveAllDepartureFlights = async (icao_code, iata_code, chunks) => {
//     const iataCodes = await fetchAllAirportsICAOandIATAcodesfromDB();
//     if (!iataCodes || iataCodes.length === 0) {
//         console.warn("No IATA codes available for fetching flight data.");
//         return;
//     }

//     for (const {iata_code, icao_code} of iataCodes) {
//         console.log(` Fetching flight data for IATA: ${iata_code}`);
//         let flightData = [];

//         for (const {startDate, endDate} of chunks) {
//             const url = `${FLIGHTS_HISTORY_BASE_URL}${elementsForFlightHistory}`;
//             try {
//                 const response = await axios.get(url);

//         }
