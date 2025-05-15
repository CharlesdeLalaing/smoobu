// File: src/hooks/useSpaCalendarData.js
import { useState, useEffect, useCallback } from "react";
import { format, startOfMonth, endOfMonth, parseISO } from "date-fns";
import axios from "axios";
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
  const [spaSettings, setSpaSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const settingsRef = doc(db, "spaSettings", "default");
      const settingsDoc = await getDoc(settingsRef);

      if (settingsDoc.exists()) {
        const settingsData = settingsDoc.data();
        setSpaSettings({
          id: settingsDoc.id,
          slotDurationMinutes: settingsData.slotDurationMinutes || 30, // Ensure this exists
          startTime: settingsData.startTime || "14:00",
          endTime: settingsData.endTime || "23:59", // Changed default to 23:59
          // startHour and endHour might be redundant if startTime/endTime are HH:mm strings
        });
        console.log("SPA settings loaded:", settingsData);
      } else {
        console.warn("SPA settings document not found. Using defaults.");
        // Provide fallback defaults that match expected structure
        setSpaSettings({
          id: "default",
          slotDurationMinutes: 30,
          startTime: "14:00",
          endTime: "23:59",
        });
      }
    } catch (err) {
      console.error("Error fetching SPA settings:", err);
      setError(err);
      setSpaSettings({
        id: "default",
        slotDurationMinutes: 30,
        startTime: "14:00",
        endTime: "23:59",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  return { spaSettings, loading, error, refetch: fetchSettings };
};

/**
 * Custom hook to fetch all bookings for a specific month from Firestore.
 */
export const useBookingsForMonth = (month) => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchBookingsForMonth = useCallback(async (monthToFetch) => {
    if (
      !monthToFetch ||
      !(monthToFetch instanceof Date) ||
      isNaN(monthToFetch.getTime())
    ) {
      console.warn(
        "useBookingsForMonth: Invalid month provided.",
        monthToFetch
      );
      setBookings([]);
      setLoading(false);
      setError(new Error("Invalid month provided for fetching bookings."));
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const startDate = format(startOfMonth(monthToFetch), "yyyy-MM-dd");
      const endDate = format(endOfMonth(monthToFetch), "yyyy-MM-dd");

      const bookingsRef = collection(db, "bookings");
      // Querying based on arrivalDate being within the month.
      // If bookings can span across months and you need to catch those too,
      // the query might need to be more complex (e.g., (arrival <= monthEnd AND departure >= monthStart))
      // For SPA scheduling, typically arrival date is the primary concern for "which month" it belongs to initially.
      const q = query(
        bookingsRef,
        where("arrivalDate", ">=", startDate),
        where("arrivalDate", "<=", endDate)
      );

      const querySnapshot = await getDocs(q);
      const fetchedBookings = [];

      querySnapshot.forEach((docSnap) => {
        // Changed doc to docSnap to avoid conflict
        const data = docSnap.data();
        const arrivalDateParsed = parseISO(data.arrivalDate); // Assuming arrivalDate is YYYY-MM-DD string
        const departureDateParsed = parseISO(data.departureDate); // Assuming departureDate is YYYY-MM-DD string

        // spaDateTime and spaEndDateTime are Firestore Timestamps or null
        const spaDateTimeParsed = data.spaDateTime
          ? parseBookingDateTime(data.spaDateTime) // Utility handles Timestamp or ISO string
          : null;
        const spaEndDateTimeParsed = data.spaEndDateTime
          ? parseBookingDateTime(data.spaEndDateTime)
          : null;

        fetchedBookings.push({
          id: docSnap.id,
          ...data,
          needsScheduling:
            data.spaBookingPreference === "later" && !data.spaDateTime,
          arrivalDateObj: isNaN(arrivalDateParsed?.getTime())
            ? null
            : arrivalDateParsed,
          departureDateObj: isNaN(departureDateParsed?.getTime())
            ? null
            : departureDateParsed,
          spaDateTimeObj: spaDateTimeParsed, // Already a Date object or null
          spaEndDateTimeObj: spaEndDateTimeParsed, // Already a Date object or null
          spaTreatmentDuration:
            typeof data.spaTreatmentDuration === "number"
              ? data.spaTreatmentDuration
              : 120, // Provide a default if not set, e.g., 120 mins
        });
      });

      setBookings(fetchedBookings);
      console.log(
        `Fetched ${fetchedBookings.length} total bookings for ${format(
          monthToFetch,
          "MMMM yyyy"
        )}.`
      );
    } catch (err) {
      console.error("Error fetching bookings:", err);
      setError(err);
      setBookings([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (month instanceof Date && !isNaN(month.getTime())) {
      fetchBookingsForMonth(month);
    } else {
      setBookings([]);
      setLoading(false);
      // setError(new Error("Invalid month provided to hook effect.")); // Avoid setting error for initial null month
    }
  }, [month, fetchBookingsForMonth]);

  return { bookings, loading, error, refetch: fetchBookingsForMonth };
};

/**
 * Custom hook to fetch available SPA slots and override data for a specific date.
 * The backend now returns availableSlots, manuallyDeactivatedSlots, and isClosed status.
 * @param {Date|null} selectedDate - The date for which to fetch data.
 * @param {object|null} selectedBooking - The currently selected booking (used for context, e.g., arrival/departure for API).
 * @param {object|null} spaSettings - Global SPA settings.
 */
export const useAvailableSlots = (
  selectedDate,
  selectedBooking,
  spaSettings
) => {
  const [availableSlots, setAvailableSlots] = useState([]);
  const [manuallyDeactivatedSlots, setManuallyDeactivatedSlots] = useState([]); // << NEW
  const [isDayClosed, setIsDayClosed] = useState(false); // << NEW: Reflects API's decision on day closure
  const [apiSlotDataLoading, setApiSlotDataLoading] = useState(false); // Renamed from 'loading'
  const [apiSlotDataError, setApiSlotDataError] = useState(null); // Renamed from 'error'

  const [overrideData, setOverrideData] = useState(null);
  const [overrideLoading, setOverrideLoading] = useState(false);
  const [overrideError, setOverrideError] = useState(null);

  const fetchSlotsAndOverride = useCallback(
    async (dateToFetch, bookingForContext, currentSpaSettings) => {
      if (
        !dateToFetch ||
        !(dateToFetch instanceof Date) ||
        isNaN(dateToFetch.getTime())
      ) {
        setAvailableSlots([]);
        setManuallyDeactivatedSlots([]);
        setIsDayClosed(false);
        setApiSlotDataLoading(false);
        setApiSlotDataError(null);
        setOverrideData(null);
        setOverrideLoading(false);
        setOverrideError(null);
        return;
      }

      const dateStr = format(dateToFetch, "yyyy-MM-dd");

      // --- 1. Fetch Override Document (for editable state in UI) ---
      // This is still useful for the UI to show the current override settings,
      // even though the API now handles override logic for slot calculation.
      setOverrideLoading(true);
      setOverrideError(null);
      try {
        const overrideRef = doc(db, "spaAvailabilityOverrides", dateStr);
        const overrideDocSnap = await getDoc(overrideRef);
        if (overrideDocSnap.exists()) {
          const data = overrideDocSnap.data();
          setOverrideData({ id: overrideDocSnap.id, ...data });
          console.log(
            `useAvailableSlots: Fetched override doc for ${dateStr}`,
            data
          );
        } else {
          setOverrideData(null); // No override document exists
          console.log(
            `useAvailableSlots: No override doc found for ${dateStr}`
          );
        }
      } catch (err) {
        console.error(
          `useAvailableSlots: Error fetching override doc for ${dateStr}:`,
          err
        );
        setOverrideError(err);
        setOverrideData(null);
      } finally {
        setOverrideLoading(false);
      }

      // --- 2. Fetch Slot Availability Data from API ---
      // The API now returns availableSlots, manuallyDeactivatedSlots, and isClosed status,
      // taking into account default settings, overrides, and bookings.
      setApiSlotDataLoading(true);
      setApiSlotDataError(null);
      try {
        // Use your actual API base URL
        const apiUrlBase =
          import.meta.env.VITE_API_URL || "http://localhost:3000";
        let apiEndpoint = `${apiUrlBase}/api/spa/availability?date=${dateStr}`;

        // The backend primarily needs the date.
        // Arrival/departure can be passed for context if your backend uses them for anything beyond the override logic (which it now handles)
        // For instance, if you had special rules for first/last day of stay not covered by overrides.
        // Currently, the backend's DEPARTURE_DAY_START_TIME is one such rule.
        const params = {};
        if (bookingForContext?.arrivalDateObj) {
          params.arrival = format(
            bookingForContext.arrivalDateObj,
            "yyyy-MM-dd"
          );
        }
        if (bookingForContext?.departureDateObj) {
          params.departure = format(
            bookingForContext.departureDateObj,
            "yyyy-MM-dd"
          );
        }
        // No need to pass startTime, endTime, duration from frontend anymore,
        // as backend calculates effective times and slot duration.

        console.log(
          `useAvailableSlots: Fetching slot data from API: ${apiEndpoint}`,
          { params }
        );
        const response = await axios.get(apiEndpoint, { params });

        if (response.status !== 200) {
          const errorDetail =
            response.data?.message ||
            `API responded with status ${response.status}`;
          console.error(
            `useAvailableSlots: API error - ${errorDetail}`,
            response
          );
          throw new Error(errorDetail);
        }

        const data = response.data;
        console.log(
          `useAvailableSlots: Received slot data for ${dateStr}:`,
          data
        );

        setAvailableSlots(data.availableSlots || []);
        setManuallyDeactivatedSlots(data.manuallyDeactivatedSlots || []);
        setIsDayClosed(data.isClosed || false); // isClosed from API is the source of truth
      } catch (err) {
        console.error(
          `useAvailableSlots: Error fetching slot data for ${dateStr}:`,
          err
        );
        setApiSlotDataError(err);
        setAvailableSlots([]); // Clear on error
        setManuallyDeactivatedSlots([]); // Clear on error
        setIsDayClosed(false); // Default to not closed on API error
      } finally {
        setApiSlotDataLoading(false);
        console.log("useAvailableSlots: Fetch slot data finished.");
      }
    },
    []
  ); // Removed spaSettings as direct dependency, as API now handles its use

  useEffect(() => {
    // spaSettings is still relevant for the component consuming this hook,
    // but the fetchSlotsAndOverride itself doesn't directly use it to query API anymore.
    // However, if spaSettings changes, we might want to refetch if it implies a change in how slots are interpreted.
    // For now, relying on selectedDate and selectedBooking as primary triggers.
    console.log("useAvailableSlots Effect: Deps changed", {
      date: selectedDate,
      bookingId: selectedBooking?.id,
    });
    fetchSlotsAndOverride(selectedDate, selectedBooking, spaSettings);
  }, [selectedDate, selectedBooking, spaSettings, fetchSlotsAndOverride]);

  return {
    availableSlots,
    manuallyDeactivatedSlots,
    isDayClosed,
    // Combined loading/error for simplicity in consumer, but individual states also available
    loading: apiSlotDataLoading || overrideLoading,
    error: apiSlotDataError || overrideError,
    // Specific states for override document handling
    overrideData,
    overrideLoading,
    overrideError,
    // Specific states for API slot data handling (if needed for more granular UI)
    slotsLoading: apiSlotDataLoading,
    slotsError: apiSlotDataError,
    refetch: fetchSlotsAndOverride,
  };
};