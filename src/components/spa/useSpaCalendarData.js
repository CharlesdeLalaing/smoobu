// File: src/hooks/useSpaCalendarData.js
import { useState, useEffect, useCallback } from "react";
import { format, startOfMonth, endOfMonth, parseISO } from "date-fns";
import {
  collection,
  getDoc,
  getDocs,
  query,
  where,
  doc,
} from "firebase/firestore";
import { db } from "../../firebase"; // Adjust path as needed based on your project structure

// Import the utility function from Step 1
import { parseBookingDateTime } from "./spaCalendarUtils";

/**
 * Custom hook to fetch SPA settings from Firestore.
 * Wraps your original fetchSpaSettings function.
 * @returns {{spaSettings: object|null, loading: boolean, error: Error|null, refetch: () => Promise<void>}}
 */
export const useSpaSettings = () => {
  // State specific to this hook
  const [spaSettings, setSpaSettings] = useState(null);
  const [loading, setLoading] = useState(true); // Loading true initially
  const [error, setError] = useState(null);

  // Define your original fetch function *inside* the hook
  // It now has access to the hook's state setters (setSpaSettings, setLoading, setError)
  const fetchSettings = useCallback(async () => {
    setLoading(true); // Manage loading within the hook
    setError(null); // Clear error
    try {
      const settingsRef = doc(db, "spaSettings", "default");
      const settingsDoc = await getDoc(settingsRef);

      if (settingsDoc.exists()) {
        // Use the data directly and set the hook's state
        setSpaSettings(settingsDoc.data());
        console.log("SPA settings loaded:", settingsDoc.data());
      } else {
        console.warn("SPA settings document not found. Using defaults.");
        // Provide fallback defaults matching your original function
        setSpaSettings({
          slotDurationMinutes: 30, // Default slot size
          startHour: 14, // Default timeline start
          endHour: 20, // Default timeline end
          endTime: "20:00", // Add endTime string for consistency
        });
      }
    } catch (err) {
      // Use err for catch parameter to avoid conflict with outer scope 'error' state variable name
      console.error("Error fetching SPA settings:", err);
      setError(err); // Set hook's error state
      // Provide fallback defaults on error matching your original function
      setSpaSettings({
        slotDurationMinutes: 30,
        startHour: 14,
        endHour: 20,
        endTime: "20:00",
      });
    } finally {
      setLoading(false); // Manage loading within the hook
    }
  }, []); // This function's dependencies are stable (db, doc, getDoc, console)

  // Effect to call the fetch function once on mount
  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]); // Depend on the memoized fetchSettings function

  // Return the hook's state and the fetch function (as refetch)
  return { spaSettings, loading, error, refetch: fetchSettings };
};

/**
 * Custom hook to fetch all bookings for a specific month from Firestore.
 * Wraps your original fetchBookingsForMonth function.
 * @param {Date} month - The month (any Date object within the month) for which to fetch bookings.
 * @returns {{bookings: Array<object>, loading: boolean, error: Error|null, refetch: (month: Date) => Promise<void>}}
 */
export const useBookingsForMonth = (month) => {
  // State specific to this hook
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(false); // Loading false initially
  const [error, setError] = useState(null);

  // Define your original fetch function *inside* the hook
  // It now takes the month as a parameter and has access to the hook's state setters
  const fetchBookingsForMonth = useCallback(async (monthToFetch) => {
    // Add a check for a valid month object before attempting to fetch
    if (
      !monthToFetch ||
      !(monthToFetch instanceof Date) ||
      isNaN(monthToFetch.getTime())
    ) {
      console.warn(
        "useBookingsForMonth: Invalid month provided.",
        monthToFetch
      );
      setBookings([]); // Clear bookings if month is invalid
      setLoading(false); // Ensure loading is off
      setError(new Error("Invalid month provided for fetching bookings.")); // Set an error state
      return; // Stop execution if month is invalid
    }

    setLoading(true); // Manage loading within the hook
    setError(null); // Clear error
    try {
      // Your original logic
      const startDate = format(startOfMonth(monthToFetch), "yyyy-MM-dd");
      const endDate = format(endOfMonth(monthToFetch), "yyyy-MM-dd");

      const bookingsRef = collection(db, "bookings");
      const q = query(
        bookingsRef,
        where("arrivalDate", ">=", startDate),
        where("arrivalDate", "<=", endDate)
      );

      const querySnapshot = await getDocs(q);
      const fetchedBookings = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        // Your original logic, using the imported utility
        const arrivalDateParsed = parseISO(data.arrivalDate);
        const departureDateParsed = parseISO(data.departureDate);
        const spaDateTimeParsed = data.spaDateTime
          ? parseBookingDateTime(data.spaDateTime) // Use imported utility
          : null;
        const spaEndDateTimeParsed = data.spaEndDateTime // Also parse end time if it exists
          ? parseBookingDateTime(data.spaEndDateTime)
          : null;

        fetchedBookings.push({
          id: doc.id,
          ...data,
          needsScheduling:
            data.spaBookingPreference === "later" && !data.spaDateTime,
          arrivalDateObj: isNaN(arrivalDateParsed?.getTime())
            ? null
            : arrivalDateParsed,
          departureDateObj: isNaN(departureDateParsed?.getTime())
            ? null
            : departureDateParsed,
          spaDateTimeObj: spaDateTimeParsed,
          spaEndDateTimeObj: spaEndDateTimeParsed, // Store parsed end time
          spaTreatmentDuration:
            typeof data.spaTreatmentDuration === "number"
              ? data.spaTreatmentDuration
              : null,
        });
      });

      setBookings(fetchedBookings); // Update hook state
      console.log(
        `Fetched ${fetchedBookings.length} total bookings for ${format(
          monthToFetch,
          "MMMM yyyy"
        )}.`
      );
    } catch (err) {
      // Use err for catch parameter
      console.error("Error fetching bookings:", err);
      setError(err); // Set hook's error state
      setBookings([]); // Clear bookings on error
    } finally {
      setLoading(false); // Manage loading within the hook
    }
  }, []); // This function's dependencies are stable (db, collection, query, where, getDocs, format, startOfMonth, endOfMonth, parseISO, parseBookingDateTime, console)

  // Effect to call the fetch function whenever the 'month' parameter changes
  useEffect(() => {
    // Only trigger fetch if month is valid
    if (month instanceof Date && !isNaN(month.getTime())) {
      fetchBookingsForMonth(month); // Call your original function name
    } else {
      // If month becomes invalid, clear state and loading
      setBookings([]);
      setLoading(false);
      setError(new Error("Invalid month provided to hook effect."));
    }
  }, [month, fetchBookingsForMonth]); // Depend on the month prop and the memoized fetchBookingsForMonth

  // Return the hook's state and the fetch function (as refetch)
  return { bookings, loading, error, refetch: fetchBookingsForMonth }; // Return your original function name for refetch
};

/**
 * Custom hook to fetch available SPA slots for a specific date.
 * Wraps your original fetchAvailableSlotsForDate function.
 * Depends on the selected date, the selected booking context, and spa settings.
 * @param {Date|null} date - The date for which to fetch available slots. Pass null to clear slots.
 * @param {object|null} selectedBooking - The booking context (if any) used to filter availability.
 * @param {object|null} spaSettings - Spa settings object, used for default duration if no booking.
 * @returns {{availableSlots: Array<string>, loading: boolean, error: Error|null, refetch: (date: Date|null, booking: object|null, settings: object|null) => Promise<void>}}
 */
export const useAvailableSlots = (date, selectedBooking, spaSettings) => {
  // State specific to this hook
  const [availableSlots, setAvailableSlots] = useState([]);
  const [loading, setLoading] = useState(false); // Loading false initially
  const [error, setError] = useState(null);

  // Define your original fetch function *inside* the hook
  // It now takes date, selectedBooking, and spaSettings as parameters
  const fetchAvailableSlotsForDate = useCallback(
    async (dateToFetch, booking, settings) => {
      // Clear slots and stop if no valid date is provided
      if (
        !dateToFetch ||
        !(dateToFetch instanceof Date) ||
        isNaN(dateToFetch.getTime())
      ) {
        console.log(
          "useAvailableSlots: No valid date provided, clearing slots."
        );
        setAvailableSlots([]);
        setLoading(false); // Ensure loading is off
        setError(null); // Clear any previous error
        return;
      }

      setLoading(true); // Manage loading within the hook
      setError(null); // Clear error
      try {
        // Your original logic
        const dateStr = format(dateToFetch, "yyyy-MM-dd");
        const apiUrl = "http://localhost:3000"; // Replace with your actual API URL

        let apiEndpoint = `${apiUrl}/api/spa/availability?date=${dateStr}`;

        // Your original logic for adding booking/settings params
        if (booking) {
          apiEndpoint += `&bookingId=${booking.id}`;
          const treatmentDurationMinutes =
            booking.spaTreatmentDuration &&
            typeof booking.spaTreatmentDuration === "number"
              ? booking.spaTreatmentDuration
              : 120; // Default 120 minutes
          apiEndpoint += `&duration=${treatmentDurationMinutes}`;

          // Use the parsed date objects if available (from bookings hook)
          if (booking.arrivalDateObj)
            apiEndpoint += `&arrival=${format(
              booking.arrivalDateObj,
              "yyyy-MM-dd"
            )}`;
          if (booking.departureDateObj)
            apiEndpoint += `&departure=${format(
              booking.departureDateObj,
              "yyyy-MM-dd"
            )}`;
        } else {
          // Default duration logic from your original function (60 min)
          // Use settings' slot size as default, or fallback to 30min
          const defaultDurationMinutes = settings?.slotDurationMinutes || 30; // Using slot size from settings if available
          apiEndpoint += `&duration=${defaultDurationMinutes}`;
        }

        console.log(`Fetching slots from: ${apiEndpoint}`);
        const response = await fetch(apiEndpoint);

        if (!response.ok) {
          // Your original error handling
          const errorBody = await response.text().catch(() => "N/A");
          console.error(
            `API responded with status: ${response.status}. Body: ${errorBody}`
          );
          throw new Error(`API responded with status: ${response.status}`);
        }

        const data = await response.json();
        console.log("Received slots data:", data);

        setAvailableSlots(data.slots || []); // Update hook state
      } catch (err) {
        // Use err for catch parameter
        console.error("Error fetching available slots:", err);
        setError(err); // Set hook's error state
        setAvailableSlots([]); // Clear slots on error
      } finally {
        setLoading(false); // Manage loading within the hook
      }
      // This function's dependencies are stable (db, doc, etc., format, fetch, console).
      // It takes dateToFetch, booking, and settings as parameters.
    },
    []
  );

  // Effect to call the fetch function whenever date, selectedBooking, or spaSettings changes
  useEffect(() => {
    // Call your original function name, passing the hook's current state values
    fetchAvailableSlotsForDate(date, selectedBooking, spaSettings);
    // Dependencies for useEffect: these are the values that should trigger a refetch
  }, [date, selectedBooking, spaSettings, fetchAvailableSlotsForDate]); // Depend on parameters and the memoized fetch function

  // Return the hook's state and the fetch function (as refetch)
  return {
    availableSlots,
    loading,
    error,
    refetch: fetchAvailableSlotsForDate,
  }; // Return your original function name for refetch
};
