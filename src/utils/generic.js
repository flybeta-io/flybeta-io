/** Generate a single date chunk for the past N days */
exports.generateDailyChunk = (days) => {
  const end = new Date();
  let start = new Date();
  start.setDate(end.getDate() - days);
  return [
    {
      start: start.toISOString().split("T")[0],
      end: end.toISOString().split("T")[0],
    },
  ];
};

/** Generate yearly chunks going backward from today */
exports.generateDynamicYearChunks = (yearsBack) => {
  const now = new Date();
  const endDate = now;
  const startDate = new Date(now);
  startDate.setFullYear(now.getFullYear() - yearsBack);

  const chunks = [];
  let current = new Date(startDate);

  while (current < endDate) {
    const start = new Date(current);
    const next = new Date(current);
    next.setMonth(current.getMonth() + 4); // move forward 3 months

    // make sure we don't go beyond "now"
    const end = next > endDate ? endDate : next;

    chunks.push({
      start: start.toISOString().split("T")[0],
      end: end.toISOString().split("T")[0],
    });

    current = next;
  }

  return chunks;
};
