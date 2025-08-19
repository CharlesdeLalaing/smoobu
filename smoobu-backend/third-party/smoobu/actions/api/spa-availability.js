// File: handleGetSpaAvailability.js (Final Multi-Purpose Version)

import { db } from "../../../../firebase-config.js"; // Adjust path if needed
import { format } from "date-fns";

// Helper functions (no change)
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
const DEPARTURE_DAY_END_TIME = "13:00";
const WIDEST_POSSIBLE_START_TIME = "06:00";
const WIDEST_POSSIBLE_END_TIME = "23:59";

export async function handleGetSpaAvailability(req, res) {
  const {
    date: dateString,
    arrival: arrivalDateString,
    departure: departureDateString,
  } = req.query;

  if (!dateString || !/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    return res.status(400).json({
      message: "Invalid or missing 'date' query parameter (YYYY-MM-DD).",
    });
  }

  try {
    const settingsRef = db.collection("spaSettings").doc("default");
    const settingsSnap = await settingsRef.get();

    const settingsExist =
      typeof settingsSnap.exists === "function"
        ? settingsSnap.exists()
        : settingsSnap.exists;
    if (!settingsExist) {
      return res
        .status(500)
        .json({ message: "SPA settings are not configured." });
    }
    const globalSettings = settingsSnap.data();
    const slotDurationMinutes = globalSettings.slotDurationMinutes || 60;
    const globalDefaultStartTime = globalSettings.startTime || "09:00";
    const globalDefaultEndTime = globalSettings.endTime || "23:00";

    let manuallyDeactivatedSlotsList = [];
    let isClosedByOverride = false;
    let overrideStartTime = null;
    let overrideEndTime = null;

    const overrideRef = db
      .collection("spaAvailabilityOverrides")
      .doc(dateString);
    const overrideSnap = await overrideRef.get();

    const overrideExists =
      typeof overrideSnap.exists === "function"
        ? overrideSnap.exists()
        : overrideSnap.exists;
    if (overrideExists) {
      const overrideData = overrideSnap.data();
      if (overrideData.isClosed === true) isClosedByOverride = true;
      if (overrideData.startTime) overrideStartTime = overrideData.startTime;
      if (overrideData.endTime) overrideEndTime = overrideData.endTime;
      if (overrideData.manuallyDeactivatedSlots) {
        manuallyDeactivatedSlotsList = overrideData.manuallyDeactivatedSlots;
      }
    }

    if (isClosedByOverride) {
      return res.status(200).json({
        availableSlots: [],
        manuallyDeactivatedSlots: manuallyDeactivatedSlotsList,
        isClosed: true,
        slotDurationMinutes,
      });
    }

    // --- NEW LOGIC: Determine the correct time window ---
    let finalEffectiveStartTime;
    let finalEffectiveEndTime;

    // Check if the request is coming from the booking form (it will have arrival/departure dates)
    const isBookingFormRequest = arrivalDateString && departureDateString;

    if (isBookingFormRequest) {
      // --- Logic for the Customer Booking Form ---
      const isArrivalDay = dateString === arrivalDateString;
      const isDepartureDay = dateString === departureDateString;

      let baseStartTime = overrideStartTime || globalDefaultStartTime;
      let baseEndTime = overrideEndTime || globalDefaultEndTime;

      if (isDepartureDay) {
        finalEffectiveStartTime = DEPARTURE_DAY_START_TIME;
        finalEffectiveEndTime = DEPARTURE_DAY_END_TIME;
      } else if (isArrivalDay) {
        const baseStartMinutes = timeToMinutes(baseStartTime);
        const fixedArrivalStartMinutes = timeToMinutes(
          FIXED_ARRIVAL_DAY_START_TIME
        );
        finalEffectiveStartTime =
          baseStartMinutes < fixedArrivalStartMinutes
            ? FIXED_ARRIVAL_DAY_START_TIME
            : baseStartTime;
        finalEffectiveEndTime = baseEndTime;
      } else {
        // It's a day in between
        finalEffectiveStartTime = baseStartTime;
        finalEffectiveEndTime = baseEndTime;
      }
    } else {
      // --- Logic for the Admin Panel (no arrival/departure dates sent) ---
      // Provide the widest possible range for the admin view.
      finalEffectiveStartTime = WIDEST_POSSIBLE_START_TIME;
      finalEffectiveEndTime = WIDEST_POSSIBLE_END_TIME;
    }

    // --- Get Booked Slots from ALL Sources (No change here) ---
    const bookedSlots = new Set();
    const bookingsRef = db.collection("bookings");
    const bookingsSnap = await bookingsRef
      .where("spaDateString", "==", dateString)
      .get();
    bookingsSnap.forEach((doc) =>
      doc.data().spaSlots?.forEach((slot) => bookedSlots.add(slot))
    );

    const spaBookingsRef = db.collection("spaBookings");
    const spaBookingsSnap = await spaBookingsRef
      .where("date", "==", dateString)
      .get();
    spaBookingsSnap.forEach((doc) => {
      const bookingData = doc.data();
      // Only add to booked slots if it's not a test booking
      if (
        bookingData.time &&
        !(bookingData.isTemporary === true && bookingData.testBooking === true)
      ) {
        bookedSlots.add(bookingData.time);
      }
    });

    // --- Generate Slots based on the determined time window ---
    const allPossibleSlots = [];
    const finalStartMinutes = timeToMinutes(finalEffectiveStartTime);
    const finalEndMinutes = timeToMinutes(finalEffectiveEndTime);

    if (
      finalStartMinutes !== null &&
      finalEndMinutes !== null &&
      finalStartMinutes < finalEndMinutes
    ) {
      let currentMinutesLoop = finalStartMinutes;
      while (currentMinutesLoop < finalEndMinutes) {
        allPossibleSlots.push(minutesToTime(currentMinutesLoop));
        currentMinutesLoop += slotDurationMinutes;
      }
    }

    const availableSlotsResult = allPossibleSlots.filter(
      (slot) =>
        !bookedSlots.has(slot) && !manuallyDeactivatedSlotsList.includes(slot)
    );

    const wordpressBookingsList = [];
    spaBookingsSnap.forEach((doc) => {
      const bookingData = doc.data();
      // Filter out test bookings that have isTemporary=true and testBooking=true
      if (
        !(bookingData.isTemporary === true && bookingData.testBooking === true)
      ) {
        wordpressBookingsList.push({
          id: doc.id, // The Firestore Document ID
          ...bookingData, // The data: { date, time, createdAt }
        });
      }
    });

    res.status(200).json({
      availableSlots: availableSlotsResult,
      manuallyDeactivatedSlots: manuallyDeactivatedSlotsList,
      isClosed: false,
      slotDurationMinutes: slotDurationMinutes,
      wordpressBookings: wordpressBookingsList,
    });
  } catch (error) {
    console.error(
      `[SPA Availability] Unexpected error for date ${dateString}:`,
      error
    );
    res.status(500).json({ message: "An internal server error occurred." });
  }
}
