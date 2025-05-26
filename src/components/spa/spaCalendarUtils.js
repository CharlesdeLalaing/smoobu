// File: src/components/spa/spaCalendarUtils.js (or your actual path)

import {
  format,
  parseISO,
  isSameDay,
  isBefore,
  isAfter,
  addDays,
  startOfDay,
  isValid,
} from "date-fns";

/**
 * Safely parses a date value from various formats into a JavaScript Date object.
 * Handles Firestore Timestamps (direct instances or plain objects), JS Dates,
 * ISO strings, and numeric timestamps (milliseconds).
 * @param {any} dateTimeValue - The date value to parse.
 * @returns {Date | null} A Date object if parsing is successful, otherwise null.
 */
export const parseBookingDateTime = (dateTimeValue) => {
  if (!dateTimeValue) {
    return null;
  }

  const logPrefix = "parseBookingDateTime (Utils):";
  const inputValueForLog =
    (typeof dateTimeValue === "object" && dateTimeValue !== null) ||
    Array.isArray(dateTimeValue)
      ? JSON.stringify(dateTimeValue)
      : dateTimeValue;
  // console.log(`${logPrefix} Attempting to parse:`, inputValueForLog); // Can be too verbose

  try {
    // 1. If it's already a JavaScript Date object and valid
    if (dateTimeValue instanceof Date) {
      const isValidDate = isValid(dateTimeValue);
      return isValidDate ? dateTimeValue : null;
    }

    // 2. If it's a Firestore Timestamp object (has a toDate method)
    if (typeof dateTimeValue.toDate === "function") {
      const date = dateTimeValue.toDate();
      const isValidDate = isValid(date);
      return isValidDate ? date : null;
    }

    // 3. If it's a plain object like { _seconds: ..., _nanoseconds: ... } or { seconds: ..., nanoseconds: ... }
    if (typeof dateTimeValue === "object" && dateTimeValue !== null) {
      const s_val = dateTimeValue.seconds;
      const _s_val = dateTimeValue._seconds;
      const ns_val = dateTimeValue.nanoseconds;
      const _ns_val = dateTimeValue._nanoseconds;

      const seconds = s_val !== undefined ? s_val : _s_val;
      const nanoseconds = ns_val !== undefined ? ns_val : _ns_val || 0;

      if (
        typeof seconds === "number" &&
        typeof nanoseconds === "number" &&
        Number.isFinite(seconds) &&
        Number.isFinite(nanoseconds)
      ) {
        const millisecondsBase = seconds * 1000;
        const millisecondsNano = Math.floor(nanoseconds / 1000000);
        const totalMilliseconds = millisecondsBase + millisecondsNano;

        const date = new Date(totalMilliseconds);
        const isValidDate = isValid(date);

        // --- VERY FOCUSED LOGGING ---
        if (seconds === 1750446000) {
          // Problematic start time's seconds value (target 19:00 local / 17:00 UTC)
          console.error(
            `--- ${logPrefix} PROBLEM_CASE_START (Input _seconds: 1750446000) ---`
          );
          console.error(
            `${logPrefix} Value of 'totalMilliseconds' VAR just before new Date():`,
            totalMilliseconds,
            "(Type:",
            typeof totalMilliseconds,
            ")"
          );
          // This 'date' object was created using the 'totalMilliseconds' variable
          console.error(
            `${logPrefix}   new Date(totalMilliseconds).toISOString():`,
            isValidDate ? date.toISOString() : "Invalid Actual Date (from var)"
          );
          console.error(
            `${logPrefix}   new Date(totalMilliseconds).toString():`,
            isValidDate ? date.toString() : "Invalid Actual Date (from var)"
          );

          const literalMillisProblematic = 1750446000000;
          const literalDateProblematic = new Date(literalMillisProblematic);
          console.error(
            `${logPrefix}   TEST new Date(${literalMillisProblematic}).toISOString():`,
            isValid(literalDateProblematic)
              ? literalDateProblematic.toISOString()
              : "Invalid Literal Date"
          );
          console.error(
            `${logPrefix}   TEST new Date(${literalMillisProblematic}).toString():`,
            isValid(literalDateProblematic)
              ? literalDateProblematic.toString()
              : "Invalid Literal Date"
          );

          // Forcing a known good timestamp through new Date for comparison
          const knownGoodMillis = 1747746000000; // Example: Maxime Coutelier booking _seconds: 1747746000
          const knownGoodDateTest = new Date(knownGoodMillis);
          console.error(
            `${logPrefix} TEST_KNOWN_GOOD_MS (${knownGoodMillis}, Target UTC for known good: 2025-05-20T13:00:00.000Z):`
          );
          console.error(
            `${logPrefix}     new Date(KNOWN_GOOD_MS).toISOString():`,
            isValid(knownGoodDateTest)
              ? knownGoodDateTest.toISOString()
              : "Invalid Known Good Date"
          );
          console.error(
            `${logPrefix}     new Date(KNOWN_GOOD_MS).toString():`,
            isValid(knownGoodDateTest)
              ? knownGoodDateTest.toString()
              : "Invalid Known Good Date"
          );
          console.error(`--- ${logPrefix} END PROBLEM_CASE_START ---`);
        }
        if (seconds === 1750453200) {
          // Problematic end time's seconds value (target 21:00 local / 19:00 UTC)
          console.error(
            `--- ${logPrefix} PROBLEM_CASE_END (Input _seconds: 1750453200) ---`
          );
          console.error(
            `${logPrefix} Value of 'totalMilliseconds' VAR just before new Date():`,
            totalMilliseconds,
            "(Type:",
            typeof totalMilliseconds,
            ")"
          );
          console.error(
            `${logPrefix}   new Date(totalMilliseconds).toISOString():`,
            isValidDate ? date.toISOString() : "Invalid Actual Date (from var)"
          );
          console.error(
            `${logPrefix}   new Date(totalMilliseconds).toString():`,
            isValidDate ? date.toString() : "Invalid Actual Date (from var)"
          );

          const literalMillisProblematic = 1750453200000;
          const literalDateProblematic = new Date(literalMillisProblematic);
          console.error(
            `${logPrefix}   TEST new Date(${literalMillisProblematic}).toISOString():`,
            isValid(literalDateProblematic)
              ? literalDateProblematic.toISOString()
              : "Invalid Literal Date"
          );
          console.error(
            `${logPrefix}   TEST new Date(${literalMillisProblematic}).toString():`,
            isValid(literalDateProblematic)
              ? literalDateProblematic.toString()
              : "Invalid Literal Date"
          );
          console.error(`--- ${logPrefix} END PROBLEM_CASE_END ---`);
        }
        // --- END FOCUSED LOGGING ---

        return isValidDate ? date : null;
      } else {
        console.warn(
          `${logPrefix} Seconds or Nanoseconds from object were not valid numbers:`,
          { seconds, nanoseconds }
        );
      }
    }

    // 4. If it's a string
    if (typeof dateTimeValue === "string") {
      let date = parseISO(dateTimeValue);
      let isValidDate = isValid(date);
      if (isValidDate) {
        return date;
      }
      date = new Date(dateTimeValue);
      isValidDate = isValid(date);
      return isValidDate ? date : null;
    }

    // 5. If it's a number (likely a timestamp in milliseconds)
    if (typeof dateTimeValue === "number") {
      const date = new Date(dateTimeValue);
      const isValidDate = isValid(date);
      return isValidDate ? date : null;
    }

    console.warn(
      `${logPrefix} Could not parse, unknown format:`,
      inputValueForLog
    );
    return null;
  } catch (e) {
    console.error(`${logPrefix} Error during parsing:`, e, inputValueForLog);
    return null;
  }
};

// isDateWithinBookingStay, getPropertyColor, calculateBookingSlots remain the same
// as their last correct versions. Make sure they are included below this line.

export const isDateWithinBookingStay = (date, booking) => {
  if (
    !date ||
    !booking ||
    (!booking.arrivalDate && !booking.arrivalDateObj) ||
    (!booking.departureDate && !booking.departureDateObj)
  ) {
    return false;
  }
  try {
    const parsedCurrentDate = parseBookingDateTime(date);
    if (!parsedCurrentDate || !isValid(parsedCurrentDate)) return false;
    const currentDate = startOfDay(parsedCurrentDate);

    const parsedArrival =
      booking.arrivalDateObj && isValid(booking.arrivalDateObj)
        ? booking.arrivalDateObj
        : parseBookingDateTime(booking.arrivalDate);
    if (!parsedArrival || !isValid(parsedArrival)) return false;
    const arrival = startOfDay(parsedArrival);

    const parsedDeparture =
      booking.departureDateObj && isValid(booking.departureDateObj)
        ? booking.departureDateObj
        : parseBookingDateTime(booking.departureDate);
    if (!parsedDeparture || !isValid(parsedDeparture)) return false;
    const departure = startOfDay(parsedDeparture);

    const isAfterArrivalOrSame =
      isAfter(currentDate, arrival) || isSameDay(currentDate, arrival);
    const isBeforeDepartureOrSame =
      isBefore(currentDate, departure) || isSameDay(currentDate, departure);
    return isAfterArrivalOrSame && isBeforeDepartureOrSame;
  } catch (error) {
    // console.error("Error in isDateWithinBookingStay:", error, { date, booking }); // Can be noisy
    return false;
  }
};

export const getPropertyColor = (booking) => {
  const propertyColors = {
    2565753: 0,
    1946282: 1,
    1644643: 2,
    1946279: 3,
    1946276: 4,
    1946270: 5,
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
  const colorIndex = propertyColors[booking?.apartmentId];
  const finalIndex = colorIndex !== undefined ? colorIndex : 0;
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
    !isValid(startDateTime)
  ) {
    throw new Error("calculateBookingSlots: Invalid start date time provided.");
  }
  if (slotDurationMinutes <= 0 || treatmentDurationMinutes <= 0) {
    throw new Error(
      "calculateBookingSlots: Invalid duration settings provided."
    );
  }
  const requiredSlotsCount = Math.ceil(
    treatmentDurationMinutes / slotDurationMinutes
  );
  if (requiredSlotsCount <= 0) {
    throw new Error(
      "calculateBookingSlots: Calculated required slots count is zero or less."
    );
  }
  const bookedSlots = [];
  const start = new Date(startDateTime);
  for (let i = 0; i < requiredSlotsCount; i++) {
    const slotTime = new Date(
      start.getTime() + i * slotDurationMinutes * 60000
    );
    const startDay = startOfDay(startDateTime);
    const slotDay = startOfDay(slotTime);
    const nextDayStart = startOfDay(addDays(startDay, 1));
    const isSlotOnStartDay = isSameDay(slotDay, startDay);
    const isSlotOnNextDayAtMidnight =
      isSameDay(slotDay, nextDayStart) && format(slotTime, "HH:mm") === "00:00";
    if (!isSlotOnStartDay && !isSlotOnNextDayAtMidnight) {
      throw new Error(
        "calculateBookingSlots: Calculated slots extend beyond allowed time frame."
      );
    }
    bookedSlots.push(format(slotTime, "HH:mm"));
  }
  return bookedSlots;
};
