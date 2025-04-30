import { db } from "../../../../firebase-config.js"; // Ensure path and .js extension are correct for your setup if using ES Modules
import { format, parse, startOfDay, endOfDay, isEqual } from "date-fns"; // Assuming date-fns is installed

// --- Helper Functions (keep these internal) ---
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
 * Express route handler to get available SPA time slots for a given date.
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
    // --- Core Logic (mostly same as before) ---
    const targetDate = parse(dateString, "yyyy-MM-dd", new Date());
    if (isNaN(targetDate.getTime())) {
      // Although regex checked, parse could fail for dates like 2024-02-30
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
      // Send error response directly
      return res
        .status(500)
        .json({ message: "SPA settings are not configured." });
    }
    const settings = settingsSnap.data();
    const defaultStartTime = settings.startTime || "09:00";
    const defaultEndTime = settings.endTime || "18:00";
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

    if (isClosed) {
      console.log(
        `[SPA Availability Route] SPA is closed on ${dateString} based on override.`
      );
      // Send empty array directly
      return res.status(200).json([]);
    }

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
    const bookingsSnap = await bookingsRef
      .where("spaDateTime", ">=", rangeStart)
      .where("spaDateTime", "<=", rangeEnd)
      .get();

    const bookedSlots = new Set();
    bookingsSnap.forEach((doc) => {
      const booking = doc.data();
      if (
        booking.spaDateTime &&
        typeof booking.spaDateTime.toDate === "function"
      ) {
        const slotDateTime = booking.spaDateTime.toDate();
        if (isEqual(startOfDay(slotDateTime), targetDateStart)) {
          const timeString = format(slotDateTime, "HH:mm");
          bookedSlots.add(timeString);
        }
      }
    });

    // Generate and Filter Slots
    const availableSlots = [];
    let currentMinutes = startMinutes;
    while (currentMinutes < endMinutes) {
      const potentialSlotTime = minutesToTime(currentMinutes);
      if (currentMinutes + slotDurationMinutes <= endMinutes) {
        if (!bookedSlots.has(potentialSlotTime)) {
          availableSlots.push(potentialSlotTime);
        }
      }
      currentMinutes += slotDurationMinutes;
    }
    // --- End Core Logic ---

    console.log(
      `[SPA Availability Route] Sending available slots for ${dateString}:`,
      availableSlots
    );
    // Send successful response with the slots array
    res.status(200).json(availableSlots);
  } catch (error) {
    // Catch any unexpected errors during execution
    console.error(
      `[SPA Availability Route] Unexpected error for date ${dateString}:`,
      error
    );
    // Send generic server error response
    res.status(500).json({
      message:
        "An internal server error occurred while retrieving SPA availability.",
      // Optionally include error.message in dev environment but not production
      // details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}
