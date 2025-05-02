import { db } from "../../../../firebase-config.js"; // Adjust path and ensure .js if needed
import { format, parse, startOfDay, endOfDay, isEqual } from "date-fns"; // Removed addMinutes as it's not used here

// --- Helper Functions (internal to this file) ---
const timeToMinutes = (timeStr) => {
  if (!timeStr || !timeStr.includes(":")) return null;
  const [hours, minutes] = timeStr.split(":").map(Number);
  return hours * 60 + minutes;
};

const minutesToTime = (totalMinutes) => {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
    2,
    "0"
  )}`;
};

// --- Constants for Departure Day ---
const DEPARTURE_DAY_START_TIME = "06:00";
const DEPARTURE_DAY_END_TIME = "10:00"; // Slots starting before this time allowed

// --- Route Handler ---
export async function handleGetSpaAvailability(req, res) {
  // Extract all query parameters
  const {
    date: dateString,
    arrival: arrivalDateString,
    departure: departureDateString,
  } = req.query;

  console.log(
    `[SPA Availability Route] Request for date: ${dateString}, arrival: ${arrivalDateString}, departure: ${departureDateString}`
  );

  // Validate target date format
  if (!dateString) {
    return res
      .status(400)
      .json({ message: "Missing required query parameter: date (YYYY-MM-DD)" });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    return res
      .status(400)
      .json({ message: "Invalid date format. Please use YYYY-MM-DD." });
  }

  try {
    const targetDate = parse(dateString, "yyyy-MM-dd", new Date());
    if (isNaN(targetDate.getTime())) {
      return res.status(400).json({ message: "Invalid date value." });
    }
    const targetDateStart = startOfDay(targetDate);

    // Get Default SPA Settings from Firestore
    const settingsRef = db.collection("spaSettings").doc("default");
    const settingsSnap = await settingsRef.get();
    if (!settingsSnap.exists) {
      console.error(
        "[SPA Availability Route] Default SPA settings missing ('spaSettings/default')."
      );
      return res
        .status(500)
        .json({ message: "SPA settings are not configured." });
    }
    const settings = settingsSnap.data();
    const defaultStartTime = settings.startTime || "14:00"; // Using your previously mentioned defaults
    const defaultEndTime = settings.endTime || "23:59"; // Using your previously mentioned defaults (23:59 for midnight)
    const slotDurationMinutes = settings.slotDurationMinutes || 120; // Using your previously mentioned default

    // --- Determine Base Effective Times (Including Firestore Override) ---
    let baseEffectiveStartTime = defaultStartTime;
    let baseEffectiveEndTime = defaultEndTime;
    let isClosed = false;
    const overrideRef = db
      .collection("spaAvailabilityOverrides")
      .doc(dateString);
    const overrideSnap = await overrideRef.get();
    if (overrideSnap.exists) {
      const overrideData = overrideSnap.data();
      console.log(
        `[SPA Availability Route] Found Firestore override for ${dateString}:`,
        overrideData
      );
      if (overrideData.isClosed === true) {
        isClosed = true;
      } else {
        // Override defaults only if specified in the document
        baseEffectiveStartTime =
          overrideData.startTime || baseEffectiveStartTime;
        baseEffectiveEndTime = overrideData.endTime || baseEffectiveEndTime;
      }
    }
    // --- End Base Effective Times ---

    // --- Apply Departure Day Logic (if not closed and departure date matches) ---
    let finalEffectiveStartTime = baseEffectiveStartTime;
    let finalEffectiveEndTime = baseEffectiveEndTime;
    const isDepartureDay =
      departureDateString && dateString === departureDateString;

    if (!isClosed && isDepartureDay) {
      console.log(
        `[SPA Availability Route] Applying departure day hours (${DEPARTURE_DAY_START_TIME} - ${DEPARTURE_DAY_END_TIME}) for ${dateString}`
      );
      finalEffectiveStartTime = DEPARTURE_DAY_START_TIME;
      finalEffectiveEndTime = DEPARTURE_DAY_END_TIME;
    }
    // --- End Departure Day Logic ---

    // If closed by override, return empty slots but include duration/endtime
    if (isClosed) {
      console.log(
        `[SPA Availability Route] SPA is closed on ${dateString} based on override.`
      );
      return res.status(200).json({
        slots: [],
        slotDurationMinutes: slotDurationMinutes,
        effectiveEndTime: finalEffectiveEndTime, // Still useful to know the intended end time
      });
    }

    // Convert FINAL effective times to minutes
    const startMinutes = timeToMinutes(finalEffectiveStartTime);
    const endMinutes = timeToMinutes(finalEffectiveEndTime);

    // Validate final times (using 23:59 avoids midnight issues)
    if (
      startMinutes === null ||
      endMinutes === null ||
      startMinutes >= endMinutes
    ) {
      console.error(
        `[SPA Availability Route] Invalid final effective start/end times for ${dateString}: ${finalEffectiveStartTime} - ${finalEffectiveEndTime}`
      );
      return res
        .status(500)
        .json({ message: "Invalid SPA operating hours configuration." });
    }

    // --- Get Existing Bookings from Firestore ---
const rangeStart = targetDateStart;
const rangeEnd = endOfDay(targetDateStart);
const bookingsRef = db.collection("bookings");

// First, get bookings with spaDateTime on the target date
const bookingsSnap = await bookingsRef
  .where("spaDateTime", ">=", rangeStart)
  .where("spaDateTime", "<=", rangeEnd)
  .get();

const bookedSlots = new Set(); // Store booked slots as "HH:MM" strings

// Process each booking to mark all affected slots as booked
bookingsSnap.forEach((doc) => {
  const booking = doc.data();

  if (booking.spaDateTime && typeof booking.spaDateTime.toDate === "function") {
    const startSlotDateTime = booking.spaDateTime.toDate();

    if (isEqual(startOfDay(startSlotDateTime), targetDateStart)) {
      // Add the start slot
      const startTimeString = format(startSlotDateTime, "HH:mm");
      bookedSlots.add(startTimeString);

      // If we have spaSlots array, add all slots in it
      if (booking.spaSlots && Array.isArray(booking.spaSlots)) {
        booking.spaSlots.forEach((slot) => {
          bookedSlots.add(slot);
        });
      }
      // If we have spaEndDateTime, calculate and add any intermediate slots
      else if (
        booking.spaEndDateTime &&
        typeof booking.spaEndDateTime.toDate === "function"
      ) {
        const endSlotDateTime = booking.spaEndDateTime.toDate();
        const endTimeString = format(endSlotDateTime, "HH:mm");

        // Calculate number of slots between start and end
        const startMinutes = timeToMinutes(startTimeString);
        const endMinutes = timeToMinutes(endTimeString);
        const numSlots = Math.ceil(
          (endMinutes - startMinutes) / slotDurationMinutes
        );

        // Mark all intermediate slots as booked
        let currentMinutes = startMinutes;
        for (let i = 0; i < numSlots; i++) {
          const slotTime = minutesToTime(currentMinutes);
          bookedSlots.add(slotTime);
          currentMinutes += slotDurationMinutes;
        }
      }
      // If we only have the start time, assume it books the default duration
      else {
        // Mark the next slot as booked too (for double slot bookings)
        const startMinutes = timeToMinutes(startTimeString);
        const nextSlotTime = minutesToTime(startMinutes + slotDurationMinutes);
        bookedSlots.add(nextSlotTime);
      }
    }
  }
});
    // --- End Get Bookings ---

    // --- Generate potential slots using FINAL effective times ---
    const availableSlots = [];
    let currentMinutes = startMinutes;
    // Loop generates slots starting strictly BEFORE the final end time
    while (currentMinutes < endMinutes) {
      const potentialSlotTime = minutesToTime(currentMinutes);
      if (!bookedSlots.has(potentialSlotTime)) {
        availableSlots.push(potentialSlotTime);
      }
      currentMinutes += slotDurationMinutes;
    }
    // --- End Slot Generation ---

    console.log(
      `[SPA Availability Route] Sending available slots for ${dateString} (DepDay: ${isDepartureDay}):`,
      availableSlots
    );
    // Respond with the filtered slots, duration, and the end time used for filtering
    res.status(200).json({
      slots: availableSlots,
      slotDurationMinutes: slotDurationMinutes,
      effectiveEndTime: finalEffectiveEndTime,
    });
  } catch (error) {
    console.error(
      `[SPA Availability Route] Unexpected error for date ${dateString}:`,
      error
    );
    // Avoid sending detailed error messages to the client in production
    res.status(500).json({
      message:
        "An internal server error occurred while retrieving SPA availability.",
    });
  }
}