// Enhanced room availability utility functions with check-in/checkout logic

/**
 * Checks if a room is available for the given date range
 * Takes into account both fully available and partially available dates
 *
 * @param {string} roomId - The ID of the room to check
 * @param {Date} startDate - The check-in date
 * @param {Date} endDate - The check-out date
 * @param {Object} availableDates - The availability data object
 * @param {boolean} hasSearched - Flag indicating if a search has been performed
 * @returns {boolean} - Whether the room is available for the date range
 */
export const isRoomAvailable = (
  roomId,
  startDate,
  endDate,
  availableDates,
  hasSearched = false
) => {
  // If we haven't searched yet, consider all rooms available
  if (!hasSearched) {
    return true;
  }

  // Basic validation
  if (!availableDates || !startDate || !endDate) {
    return false;
  }

  const roomData = availableDates[roomId];
  if (!roomData) {
    return false;
  }

  // Create a copy of the end date and subtract one day
  // This is because the checkout date doesn't need to be fully available
  const endDateTimeForChecking = new Date(endDate);
  endDateTimeForChecking.setDate(endDateTimeForChecking.getDate() - 1);
  const endForChecking = formatDate(endDateTimeForChecking);

  console.log(
    `Checking availability from ${formatDate(
      startDate
    )} to ${endForChecking} (excluding checkout)`
  );

  // Check availability for all dates EXCEPT the checkout date
  let currentDate = new Date(startDate);
  const lastDateToCheck = new Date(endDateTimeForChecking);

  while (currentDate <= lastDateToCheck) {
    const dateStr = formatDate(currentDate);
    const dayData = roomData[dateStr];

    // If we don't have data for this date or it's explicitly unavailable
    if (!dayData || dayData.available === 0) {
      return false;
    }

    currentDate.setDate(currentDate.getDate() + 1);
  }

  // All dates in the range (excluding checkout) are available
  return true;
};

/**
 * Format date to YYYY-MM-DD consistently
 * Helper function used by multiple methods
 *
 * @param {Date} date - The date to format
 * @returns {string} - Formatted date string
 */
export const formatDate = (date) => {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(d.getDate()).padStart(2, "0")}`;
};

/**
 * Checks if a date is partially available (either check-in or checkout)
 * This is a general check that doesn't distinguish the type
 *
 * @param {Date} date - The date to check
 * @param {string} roomId - The ID of the room
 * @param {Object} availableDates - The availability data object
 * @returns {boolean} - Whether the date is partially available
 */
export const isDatePartiallyAvailable = (date, roomId, availableDates) => {
  // Check if it's either check-in only or checkout only
  return (
    isDateCheckinOnly(date, roomId, availableDates) ||
    isDateCheckoutOnly(date, roomId, availableDates)
  );
};

/**
 * Checks if a date is check-in only (can be used as arrival date but not departure)
 *
 * @param {Date} date - The date to check
 * @param {string} roomId - The ID of the room
 * @param {Object} availableDates - The availability data object
 * @returns {boolean} - Whether the date is check-in only
 */
export const isDateCheckinOnly = (date, roomId, availableDates) => {
  if (!roomId || !availableDates || !availableDates[roomId]) return false;

  const dateStr = formatDate(date);
  const roomData = availableDates[roomId];

  // Don't process dates we have no data for
  if (!(dateStr in roomData) || !roomData[dateStr]) return false;

  // If this date is not available, it can't be a check-in day
  if (roomData[dateStr].available === 0) return false;

  // Check for explicit check-in only markers
  if (
    roomData[dateStr].checkinOnly ||
    roomData[dateStr].status === "checkin" ||
    roomData[dateStr].isCheckin
  ) {
    return true;
  }

  // After an unavailable period, the next available date is typically check-in only
  const prevDay = new Date(date);
  prevDay.setDate(prevDay.getDate() - 1);
  const prevDateStr = formatDate(prevDay);

  return roomData[prevDateStr] && roomData[prevDateStr].available === 0;
};

/**
 * Checks if a date is checkout only (can be used as departure date but not arrival)
 * FIXED VERSION: Properly identifies dates that should be checkout-only
 * based on Smoobu's pattern (day before unavailable day)
 *
 * @param {Date} date - The date to check
 * @param {string} roomId - The ID of the room
 * @param {Object} availableDates - The availability data object
 * @returns {boolean} - Whether the date is checkout only
 */
export const isDateCheckoutOnly = (date, roomId, availableDates) => {
  if (!roomId || !availableDates || !availableDates[roomId]) return false;

  const dateStr = formatDate(date);
  const roomData = availableDates[roomId];

  // Don't process dates we have no data for
  if (!(dateStr in roomData)) return false;

  // If this date is not available, it can't be a checkout day
  if (roomData[dateStr].available === 0) return false;

  // IMPORTANT: Trust the actual data from Smoobu
  // Only return true if it's explicitly marked as checkoutOnly
  return roomData[dateStr].checkoutOnly === true;
};
