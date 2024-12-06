export const isRoomAvailable = (roomId, startDate, endDate, availableDates, hasSearched = false) => {
  // If we haven't searched yet, consider the room available
  console.log("isRoomAvailable check:", { 
    roomId, 
    startDate, 
    endDate, 
    hasAvailableDates: !!availableDates,
    hasSearched 
  });
  if (!hasSearched) {
    return true;
  }

  // Rest of your existing isRoomAvailable code stays the same
  if (!availableDates || !startDate || !endDate) {
    return false;
  }

  const roomData = availableDates[roomId];
  if (!roomData) {
    return false;
  }

  const start = new Date(startDate).toISOString().split("T")[0];
  const end = new Date(endDate).toISOString().split("T")[0];
  let currentDate = new Date(start);
  const endDateTime = new Date(end);

  while (currentDate <= endDateTime) {
    const dateStr = currentDate.toISOString().split("T")[0];
    const dayData = roomData[dateStr];
    if (!dayData || dayData.available === 0) {
      return false;
    }
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return true;
};
