// cache.js
const NodeCache = require("node-cache");
const airportCache = new NodeCache({ stdTTL: 86400 }); // 24 hour TTL

exports.getAirportsCache = async (fetchFn) => {
  let cached = airportCache.get("airports");
  if (!cached) {
    console.log("⏳ Loading airport data into memory...");
    cached = await fetchFn;
    airportCache.set("airports", cached);
    console.log(`✅ Cached ${cached.length} airports.`);
  } else {
    console.log("⚡ Using cached airport data.");
  }
  return cached;
};
