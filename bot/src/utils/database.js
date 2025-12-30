const Airport = require("../models/airport");
const Flight = require("../models/flight");
const Prediction = require("../models/prediction");
const { Op } = require("sequelize");
const redisClient = require("../../config/redisClient");
const {
  SHORT_TERM_IN_SECONDS_REDIS,
  LONG_TERM_IN_SECONDS_REDIS,
} = require("../../config/env");



// =========== GET TODAY DATE ===============
const getDateToday = () => {
  const now = new Date().toISOString();
  const date = now.split("T")[0];

  return date;
};

const getHoursandMin = (timeStr) => {
  // const newTime = time.split(".")[0];
  const [hours, minutes, seconds] = timeStr.split(":");
  return `${hours}:${minutes}`;
}


// ========== COMPARE TIME ==================
const compareTime = (timeStr) => {
  const now = new Date();

  const flightTime = new Date();
  const [hours, minutes] = timeStr.split(":");
  flightTime.setHours(hours, minutes, 0, 0);


  if (flightTime > now) {
    return timeStr;
  }

  return null;

}



// ==========================================
// FETCH AIRPORT DETAILS BY IATA
//==========================================
const getAirportsbyIata = async (iata_code) => {
  try {
    const key = `airport_details_for_${iata_code}`;
    const value = await redisClient.get(key);

    if (value) {
      return JSON.parse(value);
    }

    const airport = await Airport.findOne({
      where: {
        iata_code,
      },
      raw: true,
    });

    const valueInString = JSON.stringify(airport);
    await redisClient.set(key, valueInString, "EX", LONG_TERM_IN_SECONDS_REDIS);

    return airport;
  } catch (error) {
    console.error(`An error occured: ${error}`);
  }
};




// ======================================
// FETCH ALL CITIES IN AIRPORTS DB
//======================================
const getNigerianAirportsInDB = async () => {
  try {
    const key = `all_Nigerian_cities_in_airports_db`;
    const value = await redisClient.get(key);

    if (value) {
      return JSON.parse(value);
    }

    const airports = await Airport.findAll({
      where: {
        country_code: "NG",
      },
      distinct: true,
      order: [["city", "ASC"]],
      raw: true,
    });

    const valueInString = JSON.stringify(airports);
    await redisClient.set(key, valueInString, "EX", LONG_TERM_IN_SECONDS_REDIS);

    return airports;
  } catch (error) {
    console.error(`Unable to fetch Airport data: ${error}`);
    throw error;
  }
};


// ========== EXTRACT CITIES FROM FETCHED NIGERIAN AIRPORTS ============
const citiesToArr = async () => {
  try {
    const key = `all_Nigerian_cities_in_airports_db_to_array`;
    const value = await redisClient.get(key);

    if (value) {
      return JSON.parse(value);
    }

    const airports = await getNigerianAirportsInDB();

    const cities = [...new Set(airports.map((a) => a.city))];


    const POPULARITY_RANK = {
      "Lagos": 1,
      "Abuja": 2,
      "Port Harcourt": 3,
      "Kano": 4,
      "Enugu": 5,
      "Owerri": 6,
      "Benin": 7,
      "Uyo": 8,
      "Asaba": 9,
      "Ibadan": 10,
      "Yola": 11,
      "Calabar": 12,
      "Kaduna": 13,
    };

    cities.sort((a, b) => {
      // Get rank or default to 100 if not in list
      const rankA = POPULARITY_RANK[a] || 100;
      const rankB = POPULARITY_RANK[b] || 100;

      // If ranks are different, sort by rank (Ascending)
      if (rankA !== rankB) {
        return rankA - rankB;
      }

      // If ranks are the same, sort Alphabetically
      return a.localeCompare(b);
    });

    const valueInString = JSON.stringify(cities);
    await redisClient.set(key, valueInString, "EX", LONG_TERM_IN_SECONDS_REDIS);

    return cities;
  } catch (error) {
    console.error(`An error occured: ${error}`);
    throw error;
  }
};



// ==================================
// FETCH ALL AIRPORTS IN A CITY
// ==================================
const getAirportsbyCity = async (city) => {
  try {
    const key = `all_airports_in_${city}`;
    const value = await redisClient.get(key);

    if (value) {
      return JSON.parse(value);
    }

    const airports = await Airport.findAll({
      where: {
        city: {
          [Op.iLike]: city,
        },
      },
      distinct: true,
      raw: true,
    });

    const valueInString = JSON.stringify(airports);
    await redisClient.set(key, valueInString, "EX", LONG_TERM_IN_SECONDS_REDIS);

    return airports;
  } catch (error) {
    console.error(`Unable to fetch Airport data for ${city}: ${error}`);
    throw error;
  }
};



// ======== EXTRACT THE IATA CODES OF THE FETCHED AIRPORTS TO AN ARRAY ==============
const airportsIataArray = async (city) => {
  try {
    const key = `iata_of_all_airports_in_${city}_to_array`;
    const value = await redisClient.get(key);

    if (value) {
      return JSON.parse(value);
    }

    const results = await getAirportsbyCity(city);
    const arr = results.map((a) => a.iata_code.toUpperCase());

    const valueInString = JSON.stringify(arr);
    await redisClient.set(key, valueInString, "EX", LONG_TERM_IN_SECONDS_REDIS);

    return arr;
  } catch (error) {
    console.error("An error occured", error);
    throw error;
  }
};




// =============================================================
// FETCH ALL FLIGHT SCHEDULES BETWEEN AN ORIGIN AND A DESTINATION
// =============================================================
const getFlightSchedulesbyIATA = async (origin, dest, date) => {
  // Pass in origin and dest as arrays
  try {
    console.log(
      `Fetching Today's (${date}) Flight Schedules from ${origin} to ${dest}`
    );

    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const flights = await Flight.findAll({
      where: {
        originAirportIata: { [Op.in]: origin },
        destinationAirportIata: { [Op.in]: dest },
        scheduledDepartureTime: {
          [Op.between]: [startOfDay, endOfDay],
        },
      },
      order: [["scheduledDepartureTime", "ASC"], ["airlineName", "ASC"]],
      raw: true,
    });

    return flights;
  } catch (error) {
    console.log(`Unable to retrieve Flight Schedules: ${error}`);
    throw error;
  }
};

// ================= COMBINE ALL FLIGHT SCHEDULES =================
const allFlightSchedules = async (originCity, destCity) => {
  try {
    const flightSchedules = [];
    const departure_date = getDateToday();

    const key = `all_flights_from${originCity}_to_${destCity}_on_${departure_date}`;
    const value = await redisClient.get(key);

    if (value) {
      return JSON.parse(value);
    }

    const originIataArr = await airportsIataArray(originCity);
    const destIataArr = await airportsIataArray(destCity);

    console.log(`Origin IATA: ${originIataArr} \nDestination IATA: ${destIataArr}\nDeparture Date: ${departure_date}`);

    const results = await getFlightSchedulesbyIATA(
      originIataArr,
      destIataArr,
      departure_date
    );

    // console.log(`\n\nFlight Results: ${results}`)

    for (data of results) {
      const flightData = {
        flightID: data.flightID,
        airlineName: data.airlineName,
        airlineIataCode: data.airlineIataCode,
        originAirport: (await getAirportsbyIata(data.originAirportIata)).name,
        originAirportIata: data.originAirportIata,
        destAirport: (await getAirportsbyIata(data.destinationAirportIata))
          .name,
        destAirportIata: data.destinationAirportIata,
        scheduledDepartureTime: data.scheduledDepartureTime
          .toISOString()
          .split("T")[1]
          .split("Z")[0],
      };

      flightSchedules.push(flightData);
    }

    const filterdFlightSchedules = flightSchedules.filter((a) => {
      compareTime(a.scheduledDepartureTime) != null;
    })

    const valueInString = JSON.stringify(filterdFlightSchedules);
    await redisClient.set(
      key,
      valueInString,
      "EX",
      SHORT_TERM_IN_SECONDS_REDIS
    );

    return filterdFlightSchedules;

  } catch (error) {
    console.error(`An error occured while retrieving flight schedules: ${error}`);
    throw error;
  }
};

// ==================== EXTRACT ALL AIRLINE FOR A FLIGHT ROUTE ================
const getAirlines = async (originCity, destCity) => {
  try {
    const key = `all_airlines_from${originCity}_to_${destCity}`;
    const value = await redisClient.get(key);

    if (value) {
      return JSON.parse(value);
    }

    const flightSchedules = await allFlightSchedules(originCity, destCity);

    // console.log(flightSchedules);

    const airlines = [...new Set(flightSchedules.map((a) => a.airlineName))];

    const valueInString = JSON.stringify(airlines);
    await redisClient.set(key, valueInString, "EX", LONG_TERM_IN_SECONDS_REDIS);

    return airlines;
  } catch (error) {
    console.error(`Error fetching airlines details: ${error}`);
  }
};

const fetchDatewithAirline = async (originCity, destCity, airline) => {
  try {
    const flightSchedules = await allFlightSchedules(originCity, destCity);

    const times = [
      ...new Set(
        flightSchedules
          .filter((a) => a.airlineName === airline)
          .map((a) => {
            return getHoursandMin(a.scheduledDepartureTime);
          })
      )
      ];

    return times;
  } catch (error) {
    console.error(`An error occured while fetching date: ${error}`);
    throw error;
  }
};




// ======================================
// FETCH USER QUERY
// ======================================
const fetchUserQuery = async (originCity, destCity, airline, time) => {
  try {
    const today = getDateToday();
    const dateTime = `${today}T${time}:00Z`;
    const timeStr = `${time}:00.000`;
    let userQuery;

    const flightSchedules = await allFlightSchedules(originCity, destCity);

    for (flight of flightSchedules) {
      if (
        flight.airlineName === airline &&
        flight.scheduledDepartureTime === timeStr
      ) {
        userQuery = flight;
        break;
      }
    }
    const uniqueKey = `${userQuery.airlineIataCode}_${dateTime}_${userQuery.originAirportIata}_${userQuery.destAirportIata}`;
    console.log(uniqueKey);

    const prediction = await Prediction.findOne({
      where: {
        unique_key: { [Op.iLike]: uniqueKey },
      },
      raw: true,
    });

    // console.log(userQuery);

    return [userQuery, prediction];
  } catch (error) {
    console.error(`An error occured with the user query: ${error}`);
    throw error;
  }
};

const getFinalMessage = (prediction) => {
  let message = `Expect the flight to depart ON TIME!`;

  if (prediction.stage === 2) {
    if (prediction.prediction === 0) {
      message = `Flight departure will be *DELAYED* by less than 30 minutes`;
    }
    message = `Expect atleast 30 minutes *DELAY* in flight departure`;
  }
  return message;
}


module.exports = {
  citiesToArr,
  getAirlines,
  fetchDatewithAirline,
  fetchUserQuery,
  getHoursandMin,
  getFinalMessage,
};
