/** Generate a single date chunk for the past N days */
exports.generateDailyChunk = (daysBack) => {
  const now = new Date();
  const endDate = now;
  let startDate = new Date(now);
  startDate.setDate(now.getDate() - daysBack);

  const chunks = [];
  let current = new Date(startDate);

  while (current < endDate) {
    const start = new Date(current);
    const next = new Date(current);
    next.setDate(current.getDate() + 30); // 30-day chunk

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

/** Generate monthly chunks going backward from today */
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
    next.setMonth(current.getMonth() + 12); // move forward 12 months

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
