import {
  format, // Keep format for potential use within utilities
  parseISO,
  isSameDay,
  isBefore,
  isAfter,
  addDays,
  startOfDay,
} from "date-fns";

/**
 * Safely parses a date value from various formats (Firestore Timestamp, JS Date, ISO string)
 * into a standard JavaScript Date object.
 * @param {any} timestamp - The date value to parse.
 * @returns {Date | null} A Date object if parsing is successful, otherwise null.
 */
export const parseBookingDateTime = (timestamp) => {
  if (!timestamp) return null;
  try {
    if (timestamp.toDate) {
      // Firestore Timestamp object
      return timestamp.toDate();
    } else if (
      typeof timestamp.seconds === "number" &&
      typeof timestamp.nanoseconds === "number"
    ) {
      // Handle potential older Timestamp format (if needed)
      return new Date(
        timestamp.seconds * 1000 + timestamp.nanoseconds / 1000000
      );
    } else if (timestamp instanceof Date) {
      // Already a Date object
      return timestamp;
    } else if (typeof timestamp === "string") {
      // Attempt to parse ISO string YYYY-MM-DD or full ISO strings
      const date = parseISO(timestamp);
      // Check if parsing failed (e.g., invalid string)
      if (isNaN(date.getTime())) {
        console.warn("parseISO failed for string:", timestamp);
        return null;
      }
      return date;
    }
    // Log unknown types
    console.warn("Unknown date format encountered:", timestamp);
    return null; // Return null for unknown types
  } catch (e) {
    console.error("Error parsing date:", timestamp, e);
    return null; // Return null on error
  }
};

/**
 * Checks if a given calendar date falls within a booking's arrival and departure dates (inclusive).
 * Compares dates at the start of the day to ignore time components.
 * @param {Date | string} date - The date from the calendar.
 * @param {object} booking - The booking object, expected to have arrivalDate and departureDate (ideally as strings 'YYYY-MM-DD').
 * @returns {boolean} True if the date is within the booking stay, false otherwise.
 */
export const isDateWithinBookingStay = (date, booking) => {
  // Basic validation for required inputs
  if (!date || !booking || !booking.arrivalDate || !booking.departureDate) {
    // console.warn("isDateWithinBookingStay: Missing date or booking details.", { date, booking });
    return false; // Cannot check range if booking or dates are missing
  }

  try {
    // Ensure both inputs are Date objects at the start of their respective days
    const currentDate =
      date instanceof Date && !isNaN(date.getTime())
        ? startOfDay(date)
        : startOfDay(parseISO(String(date)));

    // Use the parsed date objects stored during fetch if available (arrivalDateObj/departureDateObj)
    // otherwise, parse the original strings. Always use startOfDay for comparison.
    const arrival = booking.arrivalDateObj
      ? startOfDay(booking.arrivalDateObj)
      : startOfDay(parseISO(booking.arrivalDate));
    const departure = booking.departureDateObj
      ? startOfDay(booking.departureDateObj)
      : startOfDay(parseISO(booking.departureDate));

    // Validate parsed dates
    if (
      isNaN(currentDate.getTime()) ||
      isNaN(arrival.getTime()) ||
      isNaN(departure.getTime())
    ) {
      console.warn("isDateWithinBookingStay: Invalid date(s) after parsing.", {
        currentDate: String(date),
        arrivalDate: booking.arrivalDate,
        departureDate: booking.departureDate,
      });
      return false; // Cannot check range if dates are invalid
    }

    // Date must be on or after arrival and on or before departure (inclusive)
    const isAfterArrival =
      isAfter(currentDate, arrival) || isSameDay(currentDate, arrival);
    const isBeforeDeparture =
      isBefore(currentDate, departure) || isSameDay(currentDate, departure);

    return isAfterArrival && isBeforeDeparture;
  } catch (error) {
    console.error("Error in isDateWithinBookingStay:", error);
    return false; // Default to not within on error
  }
};

/**
 * Determines the color scheme for a booking based on its apartmentId.
 * @param {object} booking - The booking object, expected to have apartmentId.
 * @returns {{bg: string, text: string, border: string}} An object containing Tailwind CSS class names for background, text, and border color.
 */
export const getPropertyColor = (booking) => {
  const propertyColors = {
    2565753: 0, // La Cabane du Chêne - Blue
    1946282: 1, // Le Dôme des Libellules - Green
    1644643: 2, // La Bulle du Ruisseau - Purple
    1946279: 3, // Le Moulin - Yellow
    1946276: 4, // La Chambre de Blé - Pink
    1946270: 5, // Le Logis - Orange
  };

  const bgColors = [
    "bg-blue-100",
    "bg-green-100",
    "bg-purple-100",
    "bg-yellow-100",
    "bg-pink-100",
    "bg-orange-100",
  ];
  const textColors = [
    "text-blue-800",
    "text-green-800",
    "text-purple-800",
    "text-yellow-800",
    "text-pink-800",
    "text-orange-800",
  ];
  const borderColors = [
    "border-blue-300",
    "border-green-300",
    "border-purple-300",
    "border-yellow-300",
    "border-pink-300",
    "border-orange-300",
  ];

  // Get color index for this apartmentId
  const colorIndex = propertyColors[booking.apartmentId];

  // Fallback if apartmentId not found or missing
  const finalIndex = colorIndex !== undefined ? colorIndex : 0; // Default to blue

  return {
    bg: bgColors[finalIndex],
    text: textColors[finalIndex],
    border: borderColors[finalIndex],
  };
};


export const calculateBookingSlots = (
  startDateTime,
  treatmentDurationMinutes,
  slotDurationMinutes
) => {
  if (
    !startDateTime ||
    !(startDateTime instanceof Date) ||
    isNaN(startDateTime.getTime())
  ) {
    throw new Error("Invalid start date time provided for slot calculation.");
  }
  if (slotDurationMinutes <= 0 || treatmentDurationMinutes <= 0) {
    throw new Error("Invalid duration settings provided for slot calculation.");
  }

  const requiredSlotsCount = Math.ceil(
    treatmentDurationMinutes / slotDurationMinutes
  );
  if (requiredSlotsCount <= 0) {
    // This might happen if duration is less than slot size but somehow rounded down to 0? Or negative duration.
    console.warn(
      "calculateBookingSlots: Calculated requiredSlotsCount is zero or less:",
      requiredSlotsCount,
      { treatmentDurationMinutes, slotDurationMinutes }
    );
    // Decide if this should be an error or return [format(startDateTime, "HH:mm")] for a minimal slot.
    // Let's make it an error to prevent scheduling zero-duration bookings.
    throw new Error("Calculated required slots count is zero or less.");
  }

  const bookedSlots = [];
  const start = new Date(startDateTime); // Use a copy to avoid modifying the original Date object
  for (let i = 0; i < requiredSlotsCount; i++) {
    const slotTime = new Date(
      start.getTime() + i * slotDurationMinutes * 60000
    );

    // Basic sanity check: ensure all required slots fall on the *same day* as the start time
    // or exactly at midnight (00:00) on the *next* day.
    const startDay = startOfDay(startDateTime);
    const slotDay = startOfDay(slotTime);
    const nextDayStart = startOfDay(addDays(startDay, 1)); // Use addDays from date-fns

    // A calculated slot is valid if it's on the same day as the start,
    // OR if it's on the *immediately* following day AND is exactly at midnight (00:00).
    // This handles bookings that end precisely at midnight or span into the next day slightly.
    // This check is slightly more complex than the previous version to be more robust.
    const isSlotOnStartDay = isSameDay(slotDay, startDay);
    const isSlotOnNextDayAtMidnight =
      isSameDay(slotDay, nextDayStart) && format(slotTime, "HH:mm") === "00:00";
    const isSlotPastNextDayMidnight =
      isAfter(slotDay, nextDayStart) ||
      (isSameDay(slotDay, nextDayStart) &&
        format(slotTime, "HH:mm") !== "00:00");

    if (!isSlotOnStartDay && !isSlotOnNextDayAtMidnight) {
      // If the slot is not on the start day and not exactly at midnight on the next day,
      // it's an unexpected time.
      console.error(
        "Calculated slot crosses day boundary incorrectly or jumps days:",
        format(slotTime, "yyyy-MM-dd HH:mm"),
        "Start:",
        format(startDateTime, "yyyy-MM-dd HH:mm"),
        "Start Day:",
        format(startDay, "yyyy-MM-dd"),
        "Slot Day:",
        format(slotDay, "yyyy-MM-dd")
      );
      // Throw an error as this indicates a problem with duration relative to boundaries
      throw new Error(
        "Calculated slots extend beyond allowed time frame (crosses day boundary incorrectly)."
      );
    }

    bookedSlots.push(format(slotTime, "HH:mm"));
  }
  return bookedSlots;
};