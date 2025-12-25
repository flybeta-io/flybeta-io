const Airport = require("../models/airport");
const Flight = require("../models/flight");
const { Op } = require("sequelize");
const redisClient = require("../../config/redisClient");
const { SHORT_TERM_IN_SECONDS_REDIS, LONG_TERM_IN_SECONDS_REDIS } = require("../../config/env");


const getAirportsbyCity = async (city) => {

    try {
        const key = `${city.toLowerCase()}_airports`
        const value = await redisClient.get(key);

        if (value) {
            return JSON.parse(value)
        }

        const airports = await Airport.findAll({
          where: {
            city: {
              [Op.iLike]: city,
            },
          },
            distinct: true,
            raw: true
        });

        const valueInString = JSON.stringify(airports);
        await redisClient.set(
          key,
          valueInString,
          "EX",
          LONG_TERM_IN_SECONDS_REDIS
        );

        return airports
    } catch (error) {
        console.error(`Unable to fetch Airport data for ${city}: ${error}`);
        throw error;
    }
}

const getAirportsbyIATA = async (iata_code) => {
    try {
      const key = `${iata_code.toLowerCase()}_airport`;
      const value = await redisClient.get(key);

      if (value) {
        return JSON.parse(value);
      }

      const airport = await Airport.findOne({
        where: {
            iata_code: iata_code
        },
          distinct: true,
        raw: true
      });

      const valueInString = JSON.stringify(airport);
      await redisClient.set(
        key,
        valueInString,
        "EX",
        LONG_TERM_IN_SECONDS_REDIS
      );

      return airport;
    } catch (error) {
      console.error(`Unable to fetch Airport data for ${iata_code}: ${error}`);
      throw error;
    }
}
const refineDate = async (date) => {
  const [day, month, year] = date.split("/");
  const isoDateString = `${year}-${month}-${day}`;

  return isoDateString
}

const getFlightSchedulesbyIATA = async (origin, dest, departure_date) => {
    try {
        console.log(`Fetching Flight Schedules for ${origin} to ${dest} on ${departure_date}`);

        const isoDateString = await refineDate(departure_date);

        const startOfDay = new Date(isoDateString);
        startOfDay.setHours(0, 0, 0, 0);

        const endOfDay = new Date(isoDateString);
        endOfDay.setHours(23, 59, 59, 999);


        // Redis
        const key = `${origin.toUpperCase()}_${dest.toUpperCase()}_${departure_date.toUpperCase()}_flights`;
        const value = await redisClient.get(key);

        if (value) {
          return JSON.parse(value);
        }

        const flights = await Flight.findAll({
          where: {
                originAirportIata: origin.toUpperCase(),
                destinationAirportIata: dest.toUpperCase(),
                scheduledDepartureTime: {
                    [Op.between]: [startOfDay, endOfDay],
                },
            },
            distinct: true,
            order: [["scheduledDepartureTime", "ASC"]],
            raw: true
        });

        const valueInString = JSON.stringify(flights);
        await redisClient.set(
          key,
          valueInString,
          "EX",
          SHORT_TERM_IN_SECONDS_REDIS
        );

        return flights;
    } catch (error) {
        console.log(
          `Unable to retrieve Flight Schedules for ${origin}_${dest}: ${error}`
        );
        throw error;
    }
}


const mergeSchedules = async (originCity, destCity, departure_date) => {
  const flightSchedules = [];

  const key = `${originCity.toLowerCase()}_${destCity.toLowerCase()}_${departure_date.toUpperCase()}_all_flights`;
  const value = await redisClient.get(key);

  if (value) {
    return JSON.parse(value);
  }

  const resultOrigin = await getAirportsbyCity(originCity);
  const resultDest = await getAirportsbyCity(destCity);

  for (start of resultOrigin) {
    for (end of resultDest) {
      const origin = start.iata_code;
      const dest = end.iata_code;

      console.log(
        `Origin: ${origin} \nDest: ${dest} \nDeparture Date: ${departure_date}`
      );
      resultFlights = await getFlightSchedulesbyIATA(
        origin,
        dest,
        departure_date
      );

      for (let i = 0; i < resultFlights.length; i++) {
        // console.log(resultFlights);
        const data = resultFlights[i];
        const time = new Date(data.scheduledDepartureTime).toISOString().split("T")[1].split(".")[0].replace("Z", "");

        const originAirport = await getAirportsbyIATA(data.originAirportIata);
        const destAirport = await getAirportsbyIATA(
          data.destinationAirportIata
          );

          const flightData = {
            flightID: data.flightID,
            airlineName: data.airlineName,
            originAirport: originAirport.name,
            originAirportIata: originAirport.iata_code,
            destAirport: destAirport.name,
            destAirportIata: destAirport.iata_code,
            departureTime: time
          };

        flightSchedules.push(flightData);

      }
    }
  }
    const valueInString = JSON.stringify(flightSchedules);
    await redisClient.set(
      key,
      valueInString,
      "EX",
      SHORT_TERM_IN_SECONDS_REDIS
    );

    return flightSchedules;
};

module.exports = {
    getAirportsbyCity,
    getAirportsbyIATA,
    refineDate,
    getFlightSchedulesbyIATA,
    mergeSchedules
}
