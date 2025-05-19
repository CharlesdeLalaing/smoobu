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
    // console.log("parseBookingDateTime: Received falsy value, returning null:", dateTimeValue); // Optional log
    return null;
  }

  console.log("parseBookingDateTime: Attempting to parse:", dateTimeValue); // Log input

  try {
    // 1. If it's already a JavaScript Date object and valid
    if (dateTimeValue instanceof Date) {
      console.log("parseBookingDateTime: Value is already a Date object.");
      return isValid(dateTimeValue) ? dateTimeValue : null;
    }

    // 2. If it's a Firestore Timestamp object (has a toDate method)
    if (typeof dateTimeValue.toDate === "function") {
      console.log(
        "parseBookingDateTime: Value has toDate method (Firestore Timestamp instance)."
      );
      const date = dateTimeValue.toDate();
      console.log(
        "parseBookingDateTime: Result from toDate():",
        date,
        "Is valid:",
        isValid(date)
      );
      return isValid(date) ? date : null;
    }

    // 3. If it's a plain object like { _seconds: ..., _nanoseconds: ... } (common from Firestore JSON)
    //    or { seconds: ..., nanoseconds: ... }
    if (typeof dateTimeValue === "object" && dateTimeValue !== null) {
      const seconds =
        dateTimeValue.seconds !== undefined
          ? dateTimeValue.seconds
          : dateTimeValue._seconds;
      const nanoseconds =
        dateTimeValue.nanoseconds !== undefined
          ? dateTimeValue.nanoseconds
          : dateTimeValue._nanoseconds || 0;

      console.log(
        "parseBookingDateTime: Value is an object. Seconds:",
        seconds,
        "Nanoseconds:",
        nanoseconds
      ); // Log extracted s/ns

      if (typeof seconds === "number" && typeof nanoseconds === "number") {
        if (Number.isFinite(seconds) && Number.isFinite(nanoseconds)) {
          console.log(
            "parseBookingDateTime: Seconds and Nanoseconds are finite numbers."
          );
          const date = new Date(seconds * 1000 + nanoseconds / 1000000);
          // For the specific problematic timestamp: 1747746000 seconds
          // (1747746000 * 1000) = 1747746000000 milliseconds
          // new Date(1747746000000) should be Tue May 20 2025 15:00:00 GMT+0200 (Central European Summer Time)
          // (assuming your local timezone is CEST, otherwise the GMT offset will differ)
          console.log(
            "parseBookingDateTime: Constructed date from s/ns:",
            date,
            "Is valid:",
            isValid(date)
          );
          return isValid(date) ? date : null;
        } else {
          console.warn(
            "parseBookingDateTime: Seconds or Nanoseconds are not finite:",
            { seconds, nanoseconds }
          );
        }
      } else {
        console.warn(
          "parseBookingDateTime: Seconds or Nanoseconds are not numbers:",
          { seconds, nanoseconds }
        );
      }
    }

    // 4. If it's a string (attempt to parse as ISO or let Date constructor try)
    if (typeof dateTimeValue === "string") {
      console.log("parseBookingDateTime: Value is a string.");
      let date = parseISO(dateTimeValue); // Try date-fns parseISO first for strict ISO
      console.log(
        "parseBookingDateTime: Result from parseISO:",
        date,
        "Is valid:",
        isValid(date)
      );
      if (isValid(date)) {
        return date;
      }
      // Fallback for other string date formats that new Date() might handle
      console.log(
        "parseBookingDateTime: parseISO failed, trying new Date(string)."
      );
      date = new Date(dateTimeValue);
      console.log(
        "parseBookingDateTime: Result from new Date(string):",
        date,
        "Is valid:",
        isValid(date)
      );
      return isValid(date) ? date : null;
    }

    // 5. If it's a number (likely a timestamp in milliseconds)
    if (typeof dateTimeValue === "number") {
      console.log("parseBookingDateTime: Value is a number.");
      const date = new Date(dateTimeValue);
      console.log(
        "parseBookingDateTime: Result from new Date(number):",
        date,
        "Is valid:",
        isValid(date)
      );
      return isValid(date) ? date : null;
    }

    console.warn(
      "parseBookingDateTime: Could not parse date value, unknown format after all checks:",
      dateTimeValue
    );
    return null;
  } catch (e) {
    console.error(
      "parseBookingDateTime: Error during parsing:",
      e,
      dateTimeValue
    );
    return null;
  }
};

export const isDateWithinBookingStay = (date, booking) => {
  if (
    !date ||
    !booking ||
    (!booking.arrivalDate && !booking.arrivalDateObj) ||
    (!booking.departureDate && !booking.departureDateObj)
  ) {
    // console.warn("isDateWithinBookingStay: Missing date or booking details.", { date, booking });
    return false;
  }

  try {
    const currentDateInput = date; // Keep original for logging
    const arrivalInput = booking.arrivalDateObj || booking.arrivalDate;
    const departureInput = booking.departureDateObj || booking.departureDate;

    const currentDate = startOfDay(
      parseBookingDateTime(currentDateInput) || new Date("invalid")
    );

    const arrival = startOfDay(
      (booking.arrivalDateObj && isValid(booking.arrivalDateObj)
        ? booking.arrivalDateObj
        : parseBookingDateTime(booking.arrivalDate)) || new Date("invalid")
    );
    const departure = startOfDay(
      (booking.departureDateObj && isValid(booking.departureDateObj)
        ? booking.departureDateObj
        : parseBookingDateTime(booking.departureDate)) || new Date("invalid")
    );

    if (!isValid(currentDate) || !isValid(arrival) || !isValid(departure)) {
      // console.warn("isDateWithinBookingStay: Invalid date(s) after parsing.", { currentDateInput, arrivalInput, departureInput });
      return false;
    }

    const isAfterArrivalOrSame =
      isAfter(currentDate, arrival) || isSameDay(currentDate, arrival);
    const isBeforeDepartureOrSame =
      isBefore(currentDate, departure) || isSameDay(currentDate, departure);

    return isAfterArrivalOrSame && isBeforeDepartureOrSame;
  } catch (error) {
    console.error("Error in isDateWithinBookingStay:", error, {
      date,
      booking,
    });
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
  const colorIndex = propertyColors[booking?.apartmentId]; // Add optional chaining for booking
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
