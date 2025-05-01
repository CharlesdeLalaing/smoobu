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
// --- End Helper Functions ---

/**
 * Express route handler to get available SPA time slots and duration for a given date.
 * Responds directly to the request.
 * @param {object} req - Express request object, expects req.query.date (YYYY-MM-DD).
 * @param {object} res - Express response object.
 */
export async function handleGetSpaAvailability(req, res) {
  // Extract date from query parameters inside the handler
  const { date: dateString } = req.query;
  console.log(
    `[SPA Availability Route] Received request for date: ${dateString}`
  );

  // Validate input date right away
  if (!dateString) {
    return res.status(400).json({
      message: "Missing required query parameter: date (YYYY-MM-DD)",
    });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    return res.status(400).json({
      message: "Invalid date format. Please use YYYY-MM-DD.",
    });
  }

  try {
    // --- Core Logic ---
    const targetDate = parse(dateString, "yyyy-MM-dd", new Date());
    if (isNaN(targetDate.getTime())) {
      return res.status(400).json({ message: "Invalid date value." });
    }
    const targetDateStart = startOfDay(targetDate);

    // Get Default SPA Settings
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
    const defaultStartTime = settings.startTime || "09:00";
    const defaultEndTime = settings.endTime || "18:00";
    // Store the duration to be returned
    const slotDurationMinutes = settings.slotDurationMinutes || 60;

    // Check for Overrides
    let effectiveStartTime = defaultStartTime;
    let effectiveEndTime = defaultEndTime;
    let isClosed = false;
    const overrideRef = db
      .collection("spaAvailabilityOverrides")
      .doc(dateString);
    const overrideSnap = await overrideRef.get();
    if (overrideSnap.exists) {
      const overrideData = overrideSnap.data();
      console.log(
        `[SPA Availability Route] Found override for ${dateString}:`,
        overrideData
      );
      if (overrideData.isClosed === true) {
        isClosed = true;
      } else {
        effectiveStartTime = overrideData.startTime || effectiveStartTime;
        effectiveEndTime = overrideData.endTime || effectiveEndTime;
      }
    }

    // If closed, return empty slots array but include duration
    if (isClosed) {
      console.log(
        `[SPA Availability Route] SPA is closed on ${dateString} based on override.`
      );
      return res
        .status(200)
        .json({ slots: [], slotDurationMinutes: slotDurationMinutes });
    }

    // Convert effective times to minutes
    const startMinutes = timeToMinutes(effectiveStartTime);
    const endMinutes = timeToMinutes(effectiveEndTime);
    if (
      startMinutes === null ||
      endMinutes === null ||
      startMinutes >= endMinutes
    ) {
      console.error(
        `[SPA Availability Route] Invalid effective start/end times for ${dateString}: ${effectiveStartTime} - ${effectiveEndTime}`
      );
      return res
        .status(500)
        .json({ message: "Invalid SPA operating hours configuration." });
    }

    // Get Existing Booked SPA Slots
    const rangeStart = targetDateStart;
    const rangeEnd = endOfDay(targetDateStart);
    const bookingsRef = db.collection("bookings");
    // Requires single-field index on spaDateTime in Firestore
    const bookingsSnap = await bookingsRef
      .where("spaDateTime", ">=", rangeStart)
      .where("spaDateTime", "<=", rangeEnd)
      .get();

    const bookedSlots = new Set(); // Store booked slots as "HH:MM" strings
    bookingsSnap.forEach((doc) => {
      const booking = doc.data();
      if (
        booking.spaDateTime &&
        typeof booking.spaDateTime.toDate === "function"
      ) {
        const slotDateTime = booking.spaDateTime.toDate();
        // Ensure the booking is actually on the target day (sanity check)
        if (isEqual(startOfDay(slotDateTime), targetDateStart)) {
          const timeString = format(slotDateTime, "HH:mm");
          bookedSlots.add(timeString);
        }
      }
    });

    // Generate potential slots based on start time and duration
    const availableSlots = [];
    let currentMinutes = startMinutes;
    while (currentMinutes < endMinutes) {
      // Generate slots that *start* before the end time
      const potentialSlotTime = minutesToTime(currentMinutes);
      if (!bookedSlots.has(potentialSlotTime)) {
        availableSlots.push(potentialSlotTime);
      }
      currentMinutes += slotDurationMinutes; // Increment by the actual duration
    }
    // --- End Core Logic ---

    console.log(
      `[SPA Availability Route] Sending available slots for ${dateString}:`,
      availableSlots
    );
    // Respond with an object containing both the slots array and the duration
    res
      .status(200)
      .json({
        slots: availableSlots,
        slotDurationMinutes: slotDurationMinutes,
      });
  } catch (error) {
    console.error(
      `[SPA Availability Route] Unexpected error for date ${dateString}:`,
      error
    );
    res.status(500).json({
      message:
        "An internal server error occurred while retrieving SPA availability.",
    });
  }
}
