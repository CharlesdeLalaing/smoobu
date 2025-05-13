// third-party/smoobu/actions/api/spa-availability.js
import { db } from "../../../../firebase-config.js"; // Adjust path and ensure .js if needed
import { format, parse, startOfDay, endOfDay, isEqual } from "date-fns";

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
const DEPARTURE_DAY_END_TIME = "10:00";

// --- Route Handler ---
export async function handleGetSpaAvailability(req, res) {
  const {
    date: dateString,
    arrival: arrivalDateString,
    departure: departureDateString,
  } = req.query;

  console.log(
    `[SPA Availability Route] Request for date: ${dateString}, arrival: ${arrivalDateString}, departure: ${departureDateString}`
  );

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
    const defaultStartTime = settings.startTime || "14:00";
    const defaultEndTime = settings.endTime || "23:59";
    const slotDurationMinutes = settings.slotDurationMinutes || 120;

    let baseEffectiveStartTime = defaultStartTime;
    let baseEffectiveEndTime = defaultEndTime;
    let isClosed = false; // Will be set by override if applicable
    let manuallyDeactivatedSlotsList = []; // Initialize

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
        isClosed = true; // Set the flag here
      } else {
        // Override defaults only if specified and not closed
        baseEffectiveStartTime =
          overrideData.startTime || baseEffectiveStartTime;
        baseEffectiveEndTime = overrideData.endTime || baseEffectiveEndTime;
      }
      // Always read manuallyDeactivatedSlots if they exist, regardless of isClosed status
      if (
        overrideData.manuallyDeactivatedSlots &&
        Array.isArray(overrideData.manuallyDeactivatedSlots)
      ) {
        manuallyDeactivatedSlotsList = overrideData.manuallyDeactivatedSlots;
        console.log(
          `[SPA Availability Route] Found manually deactivated slots for ${dateString}:`,
          manuallyDeactivatedSlotsList
        );
      }
    }

    // Apply Departure Day Logic (only if not explicitly closed by override)
    let finalEffectiveStartTime = baseEffectiveStartTime;
    let finalEffectiveEndTime = baseEffectiveEndTime;
    const isDepartureDay =
      departureDateString && dateString === departureDateString;

    if (!isClosed && isDepartureDay) {
      // Check isClosed before applying departure logic
      console.log(
        `[SPA Availability Route] Applying departure day hours (${DEPARTURE_DAY_START_TIME} - ${DEPARTURE_DAY_END_TIME}) for ${dateString}`
      );
      finalEffectiveStartTime = DEPARTURE_DAY_START_TIME;
      finalEffectiveEndTime = DEPARTURE_DAY_END_TIME;
    }

    // If explicitly closed by an override, return now with the appropriate structure
    if (isClosed) {
      console.log(
        `[SPA Availability Route] SPA is closed on ${dateString} based on override.`
      );
      return res.status(200).json({
        availableSlots: [], // No slots available if closed
        manuallyDeactivatedSlots: manuallyDeactivatedSlotsList, // Still return this
        isClosed: true, // Indicate it's closed
        slotDurationMinutes: slotDurationMinutes,
        effectiveEndTime: finalEffectiveEndTime, // The end time that *would* have applied or from override
      });
    }

    // Convert FINAL effective times to minutes (only if not closed)
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
      // If times are invalid, it's effectively closed or misconfigured.
      // Return as if closed but with specific error if needed, or just empty slots.
      return res
        .status(200) // Still 200, but with data indicating no availability
        .json({
          availableSlots: [],
          manuallyDeactivatedSlots: manuallyDeactivatedSlotsList,
          isClosed: true, // Treat as closed due to invalid time config for this day
          slotDurationMinutes: slotDurationMinutes,
          effectiveEndTime: finalEffectiveEndTime,
          error: "Invalid SPA operating hours configuration for this day.", // Optional error hint
        });
    }

    // Get Existing Bookings from Firestore
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
        const startSlotDateTime = booking.spaDateTime.toDate();
        if (isEqual(startOfDay(startSlotDateTime), targetDateStart)) {
          // Prefer spaSlots array if available and valid
          if (
            booking.spaSlots &&
            Array.isArray(booking.spaSlots) &&
            booking.spaSlots.length > 0
          ) {
            booking.spaSlots.forEach((slot) => {
              if (typeof slot === "string" && slot.includes(":")) {
                // Basic validation
                bookedSlots.add(slot);
              }
            });
          } else {
            // Fallback: if spaSlots is missing or empty, use spaDateTime and spaEndDateTime
            const startTimeString = format(startSlotDateTime, "HH:mm");
            bookedSlots.add(startTimeString); // Add the initial slot

            // If spaEndDateTime is present, calculate intermediate slots
            if (
              booking.spaEndDateTime &&
              typeof booking.spaEndDateTime.toDate === "function"
            ) {
              let currentSlotTimeJS = startSlotDateTime.getTime();
              const endTimeJS = booking.spaEndDateTime.toDate().getTime();

              // Iterate by slotDurationMinutes to fill in all slots covered by the booking
              // This loop ensures we add slots *up to but not including* the one that would start at or after spaEndDateTime
              while (currentSlotTimeJS < endTimeJS) {
                const slotToAdd = format(new Date(currentSlotTimeJS), "HH:mm");
                bookedSlots.add(slotToAdd);
                currentSlotTimeJS += slotDurationMinutes * 60000; // Increment by slot duration
              }
            }
            // If only spaDateTime is present and no spaSlots/spaEndDateTime,
            // it implies a booking of at least one slotDuration.
            // The initial slot is already added. If a treatment spans multiple default slots,
            // this basic fallback might not cover all booked time without spaSlots array.
            // However, new bookings *should* have the spaSlots array.
          }
        }
      }
    });

    // Generate potential slots using FINAL effective times
    const availableSlotsResult = []; // Renamed to avoid conflict with existing 'availableSlots' variable from hook
    let currentMinutes = startMinutes;

    while (currentMinutes < endMinutes) {
      const potentialSlotTime = minutesToTime(currentMinutes);
      // Check against booked slots AND manually deactivated slots
      if (
        !bookedSlots.has(potentialSlotTime) &&
        !manuallyDeactivatedSlotsList.includes(potentialSlotTime)
      ) {
        availableSlotsResult.push(potentialSlotTime);
      }
      currentMinutes += slotDurationMinutes;
    }

    console.log(
      `[SPA Availability Route] Sending data for ${dateString} (DepDay: ${isDepartureDay}):`,
      {
        available: availableSlotsResult,
        deactivated: manuallyDeactivatedSlotsList,
        closed: isClosed, // Should be false here if we reached this point
      }
    );
    // Respond with the filtered slots, duration, and the end time used for filtering
    res.status(200).json({
      availableSlots: availableSlotsResult, // Use the new variable name
      manuallyDeactivatedSlots: manuallyDeactivatedSlotsList,
      isClosed: isClosed, // This will be false if we are in this part of the code
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
      // For dev, you might want to include more detail: error: error.message
    });
  }
}
