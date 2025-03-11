export const isRoomAvailable = (
  roomId,
  startDate,
  endDate,
  availableDates,
  hasSearched = false
) => {
  // If we haven't searched yet, consider the room available
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

  const start = new Date(startDate).toISOString().split("T")[0];
  const end = new Date(endDate).toISOString().split("T")[0];

  // Create a copy of the end date and subtract one day
  // This is because the checkout date doesn't need to be fully available
  const endDateTimeForChecking = new Date(endDate);
  endDateTimeForChecking.setDate(endDateTimeForChecking.getDate() - 1);
  const endForChecking = endDateTimeForChecking.toISOString().split("T")[0];

  // Check availability for all dates EXCEPT the checkout date
  let currentDate = new Date(start);
  const lastDateToCheck = new Date(endForChecking);

  while (currentDate <= lastDateToCheck) {
    const dateStr = currentDate.toISOString().split("T")[0];
    const dayData = roomData[dateStr];

    if (!dayData || dayData.available === 0) {
      return false;
    }

    currentDate.setDate(currentDate.getDate() + 1);
  }

  // We've confirmed all stay dates are available (except checkout)
  return true;
};
