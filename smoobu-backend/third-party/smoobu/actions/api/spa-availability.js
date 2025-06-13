// File: handleGetSpaAvailability.js (or wherever it is located)

import { db } from "../../../../firebase-config.js";
import { format, parse, startOfDay, endOfDay, isEqual } from "date-fns";

// --- Helper Functions (No changes here) ---
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

const FIXED_ARRIVAL_DAY_START_TIME = "14:00";
const DEPARTURE_DAY_START_TIME = "06:00";
const DEPARTURE_DAY_END_TIME = "10:00";

// --- Route Handler ---
export async function handleGetSpaAvailability(req, res) {
  const {
    date: dateString,
    arrival: arrivalDateString,
    departure: departureDateString,
  } = req.query;

  if (!dateString || !/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    return res
      .status(400)
      .json({
        message: "Invalid or missing 'date' query parameter (YYYY-MM-DD).",
      });
  }

  try {
    // --- Sections 1-5 (No changes here) ---
    const settingsRef = db.collection("spaSettings").doc("default");
    const settingsSnap = await settingsRef.get();
    if (!settingsSnap.exists) {
      return res
        .status(500)
        .json({ message: "SPA settings are not configured." });
    }
    const globalSettings = settingsSnap.data();
    const globalDefaultStartTime = globalSettings.startTime || "09:00";
    const globalDefaultEndTime = globalSettings.endTime || "23:00";
    const slotDurationMinutes = globalSettings.slotDurationMinutes || 60;

    let baseEffectiveStartTime = globalDefaultStartTime;
    let baseEffectiveEndTime = globalDefaultEndTime;
    let isClosedByOverride = false;
    let manuallyDeactivatedSlotsList = [];
    const overrideRef = db
      .collection("spaAvailabilityOverrides")
      .doc(dateString);
    const overrideSnap = await overrideRef.get();
    if (overrideSnap.exists) {
      const overrideData = overrideSnap.data();
      if (overrideData.isClosed === true) isClosedByOverride = true;
      else {
        if (overrideData.startTime)
          baseEffectiveStartTime = overrideData.startTime;
        if (overrideData.endTime) baseEffectiveEndTime = overrideData.endTime;
      }
      if (overrideData.manuallyDeactivatedSlots) {
        manuallyDeactivatedSlotsList = overrideData.manuallyDeactivatedSlots;
      }
    }

    if (isClosedByOverride) {
      return res
        .status(200)
        .json({
          availableSlots: [],
          manuallyDeactivatedSlots: manuallyDeactivatedSlotsList,
          isClosed: true,
          slotDurationMinutes,
        });
    }

    let finalEffectiveStartTime = baseEffectiveStartTime;
    let finalEffectiveEndTime = baseEffectiveEndTime;
    const isArrivalDayQuery =
      arrivalDateString && dateString === arrivalDateString;
    const isDepartureDayQuery =
      departureDateString && dateString === departureDateString;
    if (isDepartureDayQuery) {
      finalEffectiveStartTime = DEPARTURE_DAY_START_TIME;
      finalEffectiveEndTime = DEPARTURE_DAY_END_TIME;
    } else if (isArrivalDayQuery) {
      const baseEffectiveStartMinutes = timeToMinutes(baseEffectiveStartTime);
      const fixedArrivalStartMinutes = timeToMinutes(
        FIXED_ARRIVAL_DAY_START_TIME
      );
      finalEffectiveStartTime =
        baseEffectiveStartMinutes < fixedArrivalStartMinutes
          ? FIXED_ARRIVAL_DAY_START_TIME
          : baseEffectiveStartTime;
      finalEffectiveEndTime = baseEffectiveEndTime;
    }

    const finalStartMinutes = timeToMinutes(finalEffectiveStartTime);
    const finalEndMinutes = timeToMinutes(finalEffectiveEndTime);
    if (
      finalStartMinutes === null ||
      finalEndMinutes === null ||
      finalStartMinutes >= finalEndMinutes
    ) {
      return res
        .status(200)
        .json({
          availableSlots: [],
          manuallyDeactivatedSlots: manuallyDeactivatedSlotsList,
          isClosed: true,
          slotDurationMinutes,
          error: "Invalid SPA operating hours.",
        });
    }

    // --- Section 6: Get Existing Bookings (THE MAIN CHANGE IS HERE) ---
    const bookedSlots = new Set();
    const bookingsRef = db.collection("bookings");

    // This is the NEW, more reliable query. It looks for a simple string match.
    const bookingsSnap = await bookingsRef
      .where("spaDateString", "==", dateString)
      .get();

    console.log(
      `[API] For date ${dateString}, found ${bookingsSnap.size} booking(s) using spaDateString query.`
    );

    bookingsSnap.forEach((doc) => {
      const booking = doc.data();
      if (booking.spaSlots?.length > 0) {
        booking.spaSlots.forEach((slot) => {
          if (typeof slot === "string" && slot.includes(":")) {
            bookedSlots.add(slot);
          }
        });
      }
    });

    // --- Section 7: Generate potential slots (No changes here) ---
    const availableSlotsResult = [];
    let currentMinutesLoop = finalStartMinutes;
    while (currentMinutesLoop < finalEndMinutes) {
      const potentialSlotTime = minutesToTime(currentMinutesLoop);
      if (
        !bookedSlots.has(potentialSlotTime) &&
        !manuallyDeactivatedSlotsList.includes(potentialSlotTime)
      ) {
        availableSlotsResult.push(potentialSlotTime);
      }
      currentMinutesLoop += slotDurationMinutes;
    }

    res.status(200).json({
      availableSlots: availableSlotsResult,
      manuallyDeactivatedSlots: manuallyDeactivatedSlotsList,
      isClosed: false,
      slotDurationMinutes: slotDurationMinutes,
      effectiveStartTime: finalEffectiveStartTime,
      effectiveEndTime: finalEffectiveEndTime,
    });
  } catch (error) {
    console.error(
      `[SPA Availability] Unexpected error for date ${dateString}:`,
      error
    );
    res.status(500).json({ message: "An internal server error occurred." });
  }
}
