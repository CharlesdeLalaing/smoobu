import { db } from "../../../../firebase-config.js";
import { format, parse, startOfDay, endOfDay, isEqual } from "date-fns";

// --- Helper Functions ---
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

// --- Constants for Day-Specific Rules ---
const FIXED_ARRIVAL_DAY_START_TIME = "14:00"; // Always 14:00 for arrivals
const DEPARTURE_DAY_START_TIME = "06:00";     // Fixed for departure
const DEPARTURE_DAY_END_TIME = "10:00";       // Fixed for departure

// --- Route Handler ---
export async function handleGetSpaAvailability(req, res) {
  const {
    date: dateString,
    arrival: arrivalDateString,
    departure: departureDateString,
  } = req.query;



  if (!dateString || !/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    return res.status(400).json({ message: "Invalid or missing 'date' query parameter (YYYY-MM-DD)." });
  }

  try {
    const targetDate = parse(dateString, "yyyy-MM-dd", new Date());
    if (isNaN(targetDate.getTime())) {
      return res.status(400).json({ message: "Invalid date value." });
    }
    const targetDateStart = startOfDay(targetDate);

    // 1. Get Default SPA Settings from Firestore
    const settingsRef = db.collection("spaSettings").doc("default");
    const settingsSnap = await settingsRef.get();
    if (!settingsSnap.exists) {
      console.error("[SPA Availability] Default SPA settings ('spaSettings/default') missing.");
      return res.status(500).json({ message: "SPA settings are not configured." });
    }
    const globalSettings = settingsSnap.data();
    // These are for REGULAR days if no override
    const globalDefaultStartTime = globalSettings.startTime || "09:00"; // e.g., general opening
    const globalDefaultEndTime = globalSettings.endTime || "23:00";   // e.g., general closing
    const slotDurationMinutes = globalSettings.slotDurationMinutes || 60;

    // 2. Determine Base Effective Times (considering Firestore Override for *this specific date*)
    let baseEffectiveStartTime = globalDefaultStartTime;
    let baseEffectiveEndTime = globalDefaultEndTime;
    let isClosedByOverride = false;
    let manuallyDeactivatedSlotsList = [];

    const overrideRef = db.collection("spaAvailabilityOverrides").doc(dateString);
    const overrideSnap = await overrideRef.get();
    if (overrideSnap.exists) {
      const overrideData = overrideSnap.data();

      if (overrideData.isClosed === true) {
        isClosedByOverride = true;
      } else {
        if (overrideData.startTime) baseEffectiveStartTime = overrideData.startTime;
        if (overrideData.endTime) baseEffectiveEndTime = overrideData.endTime;
      }
      if (overrideData.manuallyDeactivatedSlots && Array.isArray(overrideData.manuallyDeactivatedSlots)) {
        manuallyDeactivatedSlotsList = overrideData.manuallyDeactivatedSlots;
      }
    }

    // 3. If explicitly closed by an override, no further logic needed for times
    if (isClosedByOverride) {

      return res.status(200).json({
        availableSlots: [],
        manuallyDeactivatedSlots: manuallyDeactivatedSlotsList,
        isClosed: true,
        slotDurationMinutes: slotDurationMinutes,
        effectiveEndTime: baseEffectiveEndTime,
      });
    }

    // 4. Apply Day-Specific Logic (Arrival / Departure) to get finalEffectiveStartTime/EndTime
    let finalEffectiveStartTime = baseEffectiveStartTime;
    let finalEffectiveEndTime = baseEffectiveEndTime;

    const isArrivalDayQuery = arrivalDateString && dateString === arrivalDateString;
    const isDepartureDayQuery = departureDateString && dateString === departureDateString;

    if (isDepartureDayQuery) {
     
      finalEffectiveStartTime = DEPARTURE_DAY_START_TIME;
      finalEffectiveEndTime = DEPARTURE_DAY_END_TIME;
    } else if (isArrivalDayQuery) {
     
      // On arrival day, start time is the LATER of (baseEffectiveStartTime from settings/override)
      // AND the FIXED_ARRIVAL_DAY_START_TIME.
      // This means an override can make arrival day start LATER than 14:00, but not EARLIER.
      const baseEffectiveStartMinutes = timeToMinutes(baseEffectiveStartTime);
      const fixedArrivalStartMinutes = timeToMinutes(FIXED_ARRIVAL_DAY_START_TIME); // "14:00"

      if (baseEffectiveStartMinutes < fixedArrivalStartMinutes) {
        finalEffectiveStartTime = FIXED_ARRIVAL_DAY_START_TIME; // Enforce 14:00 if override/settings were earlier
      } else {
        finalEffectiveStartTime = baseEffectiveStartTime; // Use override/settings if it's 14:00 or later
      }
      // End time for arrival day is the normal end time (already in baseEffectiveEndTime from settings/override)
      finalEffectiveEndTime = baseEffectiveEndTime;
      
    }
    // If it's a regular day, finalEffectiveStart/End Time remain baseEffectiveStart/End Time (from settings/override).

    // 5. Validate final times and generate slots
    const finalStartMinutes = timeToMinutes(finalEffectiveStartTime);
    const finalEndMinutes = timeToMinutes(finalEffectiveEndTime);

    if (finalStartMinutes === null || finalEndMinutes === null || finalStartMinutes >= finalEndMinutes) {
      console.error(`[SPA Availability] Invalid final effective times for ${dateString}: ${finalEffectiveStartTime} - ${finalEffectiveEndTime}`);
      return res.status(200).json({
        availableSlots: [],
        manuallyDeactivatedSlots: manuallyDeactivatedSlotsList,
        isClosed: true,
        slotDurationMinutes: slotDurationMinutes,
        effectiveEndTime: finalEffectiveEndTime,
        error: "Invalid SPA operating hours configuration for this day after all rules.",
      });
    }

    // 6. Get Existing Bookings
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
      if (booking.spaDateTime?.toDate) {
        const startSlotDateTime = booking.spaDateTime.toDate();
        if (isEqual(startOfDay(startSlotDateTime), targetDateStart)) {
          if (booking.spaSlots?.length > 0) {
            booking.spaSlots.forEach(slot => { if (typeof slot === "string" && slot.includes(":")) bookedSlots.add(slot); });
          } else {
            bookedSlots.add(format(startSlotDateTime, "HH:mm"));
            if (booking.spaEndDateTime?.toDate) {
              let currentMillis = startSlotDateTime.getTime();
              const endMillis = booking.spaEndDateTime.toDate().getTime();
              while (currentMillis < endMillis) {
                bookedSlots.add(format(new Date(currentMillis), "HH:mm"));
                currentMillis += slotDurationMinutes * 60000;
              }
            }
          }
        }
      }
    });

    // 7. Generate potential slots
    const availableSlotsResult = [];
    let currentMinutesLoop = finalStartMinutes;
    while (currentMinutesLoop < finalEndMinutes) {
      const potentialSlotTime = minutesToTime(currentMinutesLoop);
      if (!bookedSlots.has(potentialSlotTime) && !manuallyDeactivatedSlotsList.includes(potentialSlotTime)) {
        availableSlotsResult.push(potentialSlotTime);
      }
      currentMinutesLoop += slotDurationMinutes;
    }


    res.status(200).json({
      availableSlots: availableSlotsResult,
      manuallyDeactivatedSlots: manuallyDeactivatedSlotsList,
      isClosed: false, // If we reached here, not closed by override or impossible time range
      slotDurationMinutes: slotDurationMinutes,
      effectiveStartTime: finalEffectiveStartTime,
      effectiveEndTime: finalEffectiveEndTime,
    });

  } catch (error) {
    console.error(`[SPA Availability] Unexpected error for date ${dateString}:`, error);
    res.status(500).json({
      message: "An internal server error occurred while retrieving SPA availability.",
    });
  }
}

