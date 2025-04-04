// In roomUtils.js
export const isRoomAvailable = (
  roomId,
  startDate,
  endDate,
  availableDates,
  hasSearched = false
) => {
  console.log("isRoomAvailable called for", {
    roomId,
    startDate: startDate ? startDate.toLocaleDateString() : null,
    endDate: endDate ? endDate.toLocaleDateString() : null,
    hasAvailableDates: !!availableDates,
    hasSearched,
  });

  // If no search performed, all rooms show as available
  if (!hasSearched) return true;

  // Early validation
  if (!availableDates || !startDate || !endDate) return false;

  const roomData = availableDates[roomId];
  if (!roomData) return false;

  // Format date to YYYY-MM-DD consistently
  const formatDate = (date) => {
    const d = new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
      2,
      "0"
    )}-${String(d.getDate()).padStart(2, "0")}`;
  };

  const start = formatDate(startDate);
  const end = formatDate(endDate);

  console.log(`Checking availability from ${start} to ${end}`);
  console.log("Room data keys:", Object.keys(roomData).slice(0, 5)); // First 5 keys

  // For booking systems, typically checkout date can overlap with a new check-in
  let currentDate = new Date(startDate);
  const endDateTime = new Date(endDate);
  endDateTime.setDate(endDateTime.getDate() - 1); // Exclude checkout date

  // Check all dates in the range
  while (currentDate <= endDateTime) {
    const dateStr = formatDate(currentDate);
    console.log(`Checking date: ${dateStr}`);

    // If the date isn't in our data, it's not in the range we queried
    if (!(dateStr in roomData)) {
      console.log(`Date ${dateStr} not in data range, continuing`);
      currentDate.setDate(currentDate.getDate() + 1);
      continue;
    }

    // Check the available property
    if (!roomData[dateStr] || roomData[dateStr].available <= 0) {
      console.log(`Date ${dateStr} is unavailable`);
      return false;
    }

    currentDate.setDate(currentDate.getDate() + 1);
  }

  console.log("All dates in range are available");
  return true;
};
