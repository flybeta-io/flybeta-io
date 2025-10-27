const fs = require("fs");
const csv = require("csv-parser");
const Airport = require("../models/Airport");
const { Op } = require("sequelize");
const { default: axios } = require("axios");
require("dotenv").config();
const {
  allAirportsICAOCodeInDB,
  allAirportsIATACodeInDB,
} = require("./generic");

const Api_key = process.env.AVIATION_EDGE_API_KEY;
const airportsBaseUrl = "https://aviation-edge.com/v2/public/airportDatabase";

const REQUEST_DELAY_MS = 500;
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// --- Validation ---
const validateAirportData = (airportData) => {
  const errors = [];
  const { name, icao_code, iata_code, latitude_deg, longitude_deg, type } =
    airportData;

  if (!name?.trim()) errors.push("Name is required");
  if (!icao_code?.trim()) errors.push("ICAO code is required");
  if (!iata_code?.trim()) errors.push("IATA code is required");

  if (latitude_deg === undefined || latitude_deg === null)
    errors.push("Latitude is required");
  else if (latitude_deg < -90 || latitude_deg > 90)
    errors.push("Latitude must be between -90 and 90");

  if (longitude_deg === undefined || longitude_deg === null)
    errors.push("Longitude is required");
  else if (longitude_deg < -180 || longitude_deg > 180)
    errors.push("Longitude must be between -180 and 180");

  if (!type?.trim()) errors.push("Type is required");

  return errors;
};

// --- Ensure uploads folder exists ---
if (!fs.existsSync("uploads")) fs.mkdirSync("uploads");

// uploadAirport function to handle file upload and parsing
exports.uploadAirportsToDB = async (req, res) => {
  const filePath = req.file?.path;
  if (!filePath) throw new Error("No file uploaded");

  const fileExtension = req.file.originalname.toLowerCase().split(".").pop();
  const results = [];
  const errors = [];

  try {
    if (fileExtension === "csv") {
      await new Promise((resolve, reject) => {
        fs.createReadStream(filePath)
          .pipe(
            csv({
              mapHeaders: ({ header }) =>
                header.toLowerCase().trim().replace(/\s+/g, "_"),
            })
          )
          .on("data", (data) => {
            const airportData = {
              name: data.name?.trim(),
              icao_code: data.icao_code?.trim(),
              iata_code: data.iata_code?.trim(),
              latitude_deg: parseFloat(data.latitude_deg),
              longitude_deg: parseFloat(data.longitude_deg),
              type: data.type?.trim(),
            };

            const validationErrors = validateAirportData(airportData);
            if (validationErrors.length === 0) {
              results.push(airportData);
            } else {
              errors.push({ data: airportData, errors: validationErrors });
            }
          })
          .on("end", resolve)
          .on("error", reject);
      });
    } else if (fileExtension === "json") {
      const jsonData = JSON.parse(fs.readFileSync(filePath, "utf8"));
      const dataArray = Array.isArray(jsonData) ? jsonData : [jsonData];
      for (const data of dataArray) {
        const airportData = {
          name: data.name?.trim(),
          icao_code: data.icao_code?.trim(),
          iata_code: data.iata_code?.trim(),
          latitude_deg: parseFloat(data.latitude_deg),
          longitude_deg: parseFloat(data.longitude_deg),
          type: data.type?.trim(),
        };
        const validationErrors = validateAirportData(airportData);
        if (validationErrors.length === 0) {
          results.push(airportData);
        } else {
          errors.push({ data: airportData, errors: validationErrors });
        }
      }
    } else {
      throw new Error("Unsupported file format");
    }

    // Save valid airports to the database
    const savedAirports = [];
    for (const airport of results) {
      try {
        const saved = await Airport.create(airport);
        savedAirports.push(saved);
      } catch (dbError) {
        console.warn(`Skipping ${airport.name}: ${dbError.message}`);
      }
    }

    fs.unlinkSync(filePath);
    return { savedAirports, errors };
  } catch (error) {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    // throw new Error(error.message);
    console.error("Error processing airport data: ", error);
    return res
      .status(500)
      .json({ message: "Error saving airport data", error });
  }
};

// Fetch all Airports relevant details - icao_code, iata_code, lat, long - from DB
exports.fetchAirportsDatafromDB = async () => {
  try {
    const airports = await Airport.findAll({
      attributes: ["icao_code", "iata_code", "latitude_deg", "longitude_deg"],
      raw: true,
    });
    return airports;
  } catch (error) {
    console.error("Error fetching airport data: ", error);
    return [];
  }
}

// //Fetch Airport ICAO codes and IATA codes from the database
// exports.fetchAllAirportsICAOandIATAcodesfromDB = async () => {
//   try {
//     const airports = await Airport.findAll({
//       attributes: ["icao_code", "iata_code"],
//       raw: true,
//     });
//     return airports;
//   } catch (error) {
//     console.error("Error fetching ICAO codes: ", error);
//     return [];
//   }
// };

// // Fetch Airport Coordinates from the database by ICAO codes
// exports.fetchAirportCoordinatesByICAO = async (icao_codes) => {
//   //Pass in an array of multiple icao_codes and return an array - Query Data
//   try {
//     if (!Array.isArray(icao_codes) || icao_codes.length === 0) {
//       console.log("No ICAO codes provided");
//       return [];
//     }

//     const airports = await Airport.findAll({
//       where: {
//         icao_code: { [Op.in]: icao_codes },
//       },
//       attributes: ["icao_code", "latitude_deg", "longitude_deg"],
//       raw: true,
//     });

//     if (!airports.length) {
//       console.log("No airports found");
//       return [];
//     }
//     return airports;
//   } catch (error) {
//     console.error("Error fetching coordinates: ", error);
//   }
// };

// //Fetch Airport Coordinates from the database by IATA codes
// exports.fetchAirportCoordinatesByIATA = async (iata_codes) => {
//   //Pass in an array of multiple iata_codes and return an array - Query Data
//   try {
//     if (!Array.isArray(iata_codes) || iata_codes.length === 0) {
//       console.log("No IATA codes provided");
//       return [];
//     }

//     const airports = await Airport.findAll({
//       where: {
//         iata_code: {
//           [Op.in]: iata_codes,
//         },
//       },
//       attributes: ["iata_code", "latitude_deg", "longitude_deg"],
//       raw: true,
//     });

//     if (!airports.length) {
//       console.log("No airports found");
//       return [];
//     }
//     return airports;
//   } catch (error) {
//     console.error("Error fetching coordinates: ", error);
//   }
// };

// Save all fetched airport records in bulk
const saveAirportData = async (airportData) => {
  try {
    const savedAirports = await Airport.bulkCreate(airportData, {
      validate: true,
    });
    console.log(`Successfully saved ${savedAirports.length} airports.`);
    return savedAirports;
  } catch (error) {
    console.error("Error saving airport data: ", error);
    throw new Error("Error saving airport data");
  }
};

// Fetch airports by Iso2Country and save to DB
exports.fetchandSaveAirportsToDB = async (Iso2Country) => {
  try {
    const url = `${airportsBaseUrl}?key=${Api_key}&codeIso2Country=${Iso2Country}`;
    const response = await axios.get(url);
    const airports = response.data;

    const icaoCodesfromDB = await allAirportsICAOCodeInDB();
    const iataCodesfromDB = await allAirportsIATACodeInDB();
    let airportsData = [];

    for (const airport of airports) {
      if (
        icaoCodesfromDB.includes(airport.codeIcaoAirport) ||
        iataCodesfromDB.includes(airport.codeIataAirport)
      ) {
        console.log(`Skipping existing airport ${airport.nameAirport}`);
        continue;
      }

      if (
        !(
          airport.nameAirport &&
          airport.codeIataAirport &&
          airport.codeIcaoAirport &&
          airport.latitudeAirport &&
          airport.longitudeAirport &&
          airport.Iso2Country
        )
      ) {
        console.log(`Skipping incomplete airport ${airport.nameAirport}`);
        continue;
      }

      const airportRecord = {
        name: airport.nameAirport,
        icao_code: airport.codeIcaoAirport.toUpperCase(),
        iata_code: airport.codeIataAirport.toUpperCase(),
        latitude_deg: airport.latitudeAirport,
        longitude_deg: airport.longitudeAirport,
        country_code: airport.codeIso2Country.toUpperCase(),
      };

      airportsData.push(airportRecord);
    }

    await saveAirportData(airportsData);
    airportsData = [];
    await delay(REQUEST_DELAY_MS);
  } catch (error) {
    console.error(`Error Saving Airports for ${Iso2Country}:`, error.message);
  }
};


// exports.fetchandSaveCountryISO2CountryCode = async () => {
//   try {
//     const iataCodes = await allAirportsIATACodeInDB();
//     console.log("IATA Codes: ", iataCodes);

//     const nullCodes = [];   //Code that fail

//     for (const code of iataCodes) {
//       try {
//         const url = `${airportsBaseUrl}?key=${Api_key}&codeIataAirport=${code}`;
//         const response = await axios.get(url);
//         const airportData = response.data?.[0];

//         if (!airportData) {
//           console.warn(`No airport data found for IATA code: ${code}`);
//           continue;
//         }

//         let countryCode = airportData.codeIso2Country
//         console.log(`Saving Country for Airport: ${code}`);
//         await Airport.update({ country_code: `${countryCode}` },
//           {where: {iata_code: code}}
//         );
//         console.log(`Successfully Saved ${countryCode} to ${code}`);

//         await delay(1000); // avoid hitting API rate limits
//       } catch (err) {
//         console.error(`Error processing IATA code ${code}:`, err.message);
//         nullCodes.push(code)
//         continue; // move on to next airport
//       }
//     }
//     console.log(nullCodes);
//   } catch (err) {
//     console.error("Unexpected error fetching IATA codes:", err.message);
//   }
// };
