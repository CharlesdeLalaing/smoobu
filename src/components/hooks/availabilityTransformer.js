/**
 * Enhanced transformer to match Smoobu's calendar behavior
 * Removes special case for April dates
 *
 * @param {Object} apiData - The original API response data
 * @returns {Object} - Enhanced data with check-in/checkout days correctly marked
 */
export const enhanceAvailabilityData = (apiData) => {
  if (!apiData || !apiData.data) return apiData;

  const result = { ...apiData };

  // Process each room's data
  Object.keys(result.data).forEach((roomId) => {
    const roomData = result.data[roomId];
    const dates = Object.keys(roomData).sort();

    // First pass: Identify booking blocks (consecutive unavailable dates)
    const bookingBlocks = [];
    let currentBlock = null;

    for (let i = 0; i < dates.length; i++) {
      const currentDate = dates[i];
      const currentData = roomData[currentDate];

      // Skip if no data
      if (!currentData) continue;

      // Check if date is unavailable
      if (currentData.available === 0) {
        if (!currentBlock) {
          // Start a new block
          currentBlock = { start: currentDate, end: currentDate };
        } else {
          // Extend current block
          currentBlock.end = currentDate;
        }
      } else {
        // End of block
        if (currentBlock) {
          bookingBlocks.push(currentBlock);
          currentBlock = null;
        }
      }
    }

    // Don't forget the last block if it exists
    if (currentBlock) {
      bookingBlocks.push(currentBlock);
    }


    // Second pass: Mark checkout days (day before block start) and check-in days (day after block end)
    bookingBlocks.forEach((block) => {
      // Find the day before the block starts (checkout day)
      const blockStartDate = new Date(block.start);
      blockStartDate.setDate(blockStartDate.getDate() - 1);
      const checkoutDay = blockStartDate.toISOString().split("T")[0];

      // Find the day after the block ends (check-in day)
      const blockEndDate = new Date(block.end);
      blockEndDate.setDate(blockEndDate.getDate() + 1);
      const checkinDay = blockEndDate.toISOString().split("T")[0];

      // Mark checkout day if it exists in our data and is available
      if (roomData[checkoutDay] && roomData[checkoutDay].available > 0) {
        result.data[roomId][checkoutDay] = {
          ...roomData[checkoutDay],
          checkoutOnly: true,
        };
      }

      // Mark check-in day if it exists in our data and is available
      if (roomData[checkinDay] && roomData[checkinDay].available > 0) {
        result.data[roomId][checkinDay] = {
          ...roomData[checkinDay],
          checkinOnly: true,
        };
      }
    });

    // Another common pattern: if a date is both checkinOnly and checkoutOnly
    // (which can happen with single-day gaps), prioritize based on surrounding context
    dates.forEach((dateStr) => {
      const dateData = result.data[roomId][dateStr];
      if (!dateData) return;

      if (dateData.checkinOnly && dateData.checkoutOnly) {
        // Get the day before and after
        const date = new Date(dateStr);

        const prevDate = new Date(date);
        prevDate.setDate(prevDate.getDate() - 1);
        const prevDateStr = prevDate.toISOString().split("T")[0];

        const nextDate = new Date(date);
        nextDate.setDate(nextDate.getDate() + 1);
        const nextDateStr = nextDate.toISOString().split("T")[0];

        // If previous day is unavailable and next day is available, prioritize check-in
        if (
          roomData[prevDateStr]?.available === 0 &&
          roomData[nextDateStr]?.available > 0
        ) {
          delete dateData.checkoutOnly;
        }
        // If previous day is available and next day is unavailable, prioritize checkout
        else if (
          roomData[prevDateStr]?.available > 0 &&
          roomData[nextDateStr]?.available === 0
        ) {
          delete dateData.checkinOnly;
        }
      }
    });
  });

  return result;
};
