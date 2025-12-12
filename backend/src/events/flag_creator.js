const fs = require("fs");
const path = require("path");

const createDoneFlag = (batchTimeStart) => {
  const flagPath = "/opt/flags/batch_done.txt";
  fs.writeFileSync(flagPath, batchTimeStart.toString());
  console.log(`Batch DONE flag created at ${flagPath}`);
};

module.exports = { createDoneFlag };
