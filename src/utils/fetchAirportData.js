const Airport = require("../models/airport");


// Input an array of multiple iata_codes and return an array - Query Flights
exports.fetchAirportCoordinatesByIATA = async (iata_codes) => {
    try {
        if (!Array.isArray(iata_codes) || iata_codes.length === 0) {
          console.log("No IATA codes provided");
          return [];
        }

        const airports = await Airport.findAll({
            where: {
                iata_code: {
              [Op.in]: iata_codes,
                },
            },
          attributes: [
            "iata_code",
            "latitude_deg",
            "longitude_deg",
          ],
        });

        if (!airports.length) {
          console.log("No airports found");
          return [];
        }

        const result = airports.map((a) => a.dataValues);
        console.log(result);
        return result;

    } catch (error) {
        console.error("Error fetching coordinates: ", error);
    }
}

// Input an array of multiple icao_codes and return an aray  - Query Data
exports.fetchAirportCoordinatesByICAO = async (icao_codes) => {
    try {
        if (!Array.isArray(icao_codes) || icao_codes.length === 0) {
          console.log("No ICAO codes provided");
          return [];
        }

        const airports = await Airport.findAll({
            where: {
                icao_code: icao_codes
            },
          attributes: [
            "icao_code",
            "latitude_deg",
            "longitude_deg",
          ],
        });

        if (!airports.length) {
          console.log("No airports found");
          return [];
        }

        const result = airports.map((a) => a.dataValues);
        // console.log(result);
        return result;

    } catch (error) {
        console.error("Error fetching coordinates: ", error);
    }
}

//Convert the retrieved coordinates to an Array of Locations
exports.convertCoordinatesToArray = async (retrievedCoordinates) => {
    const resultSet = new Set();
    retrievedCoordinates.forEach((element) => {
      resultSet.add(`${element.latitude_deg},${element.longitude_deg}`);
    });

    return Array.from(resultSet);
};
