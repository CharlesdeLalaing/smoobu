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
                id: settingsDoc.id, // Add document ID
                slotDurationMinutes: settingsData.slotDurationMinutes || 30,
                startHour: settingsData.startHour || 14,
                endHour: settingsData.endHour || 20,
                endTime: settingsData.endTime || "20:00",
                startTime: settingsData.startTime || "14:00", // Ensure startTime is also included
              });
              console.log("SPA settings loaded:", settingsData);
          } else {
              console.warn("SPA settings document not found. Using defaults.");
              setSpaSettings({
                id: 'default', // Add a default ID
                slotDurationMinutes: 30,
                startHour: 14,
                endHour: 20,
                endTime: "20:00",
                startTime: "14:00",
              });
          }
      } catch (err) {
          console.error("Error fetching SPA settings:", err);
          setError(err);
          setSpaSettings({ // Provide defaults on error
             id: 'default',
             slotDurationMinutes: 30,
             startHour: 14,
             endHour: 20,
             endTime: "20:00",
             startTime: "14:00",
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
 * Uses the logic from your original fetchBookingsForMonth function.
 * @param {Date} month - The month (any Date object within the month) for which to fetch bookings.
 * @returns {{bookings: Array<object>, loading: boolean, error: Error|null, refetch: (month: Date) => Promise<void>}}
 */
export const useBookingsForMonth = (month) => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchBookingsForMonth = useCallback(async (monthToFetch) => {
     if (!monthToFetch || !(monthToFetch instanceof Date) || isNaN(monthToFetch.getTime())) {
          console.warn("useBookingsForMonth: Invalid month provided.", monthToFetch);
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
          const q = query(
              bookingsRef,
              where("arrivalDate", ">=", startDate),
              where("arrivalDate", "<=", endDate)
          );

          const querySnapshot = await getDocs(q);
          const fetchedBookings = [];

          querySnapshot.forEach((doc) => {
              const data = doc.data();
              const arrivalDateParsed = parseISO(data.arrivalDate);
              const departureDateParsed = parseISO(data.departureDate);
              const spaDateTimeParsed = data.spaDateTime
                  ? parseBookingDateTime(data.spaDateTime)
                  : null;
              const spaEndDateTimeParsed = data.spaEndDateTime
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
                   spaEndDateTimeObj: spaEndDateTimeParsed,
                  spaTreatmentDuration:
                      typeof data.spaTreatmentDuration === "number"
                          ? data.spaTreatmentDuration
                          : null,
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
        setError(new Error("Invalid month provided to hook effect."));
    }
  }, [month, fetchBookingsForMonth]);

  return { bookings, loading, error, refetch: fetchBookingsForMonth };
};


/**
 * Custom hook to fetch available SPA slots for a specific date, considering overrides.
 * Fetches both the override document and the API slots.
 * @param {Date|null} date - The date for which to fetch available slots. Pass null to clear slots.
 * @param {object|null} selectedBooking - The booking context (if any) used to filter availability.
 * @param {object|null} spaSettings - Spa settings object, used for default duration/hours if no override.
 * @returns {{availableSlots: Array<string>, loading: boolean, error: Error|null, overrideData: object|null, overrideLoading: boolean, overrideError: Error|null, refetch: (date: Date|null, booking: object|null, settings: object|null) => Promise<void>}}
 */
export const useAvailableSlots = (date, selectedBooking, spaSettings) => {
  // State specific to slots API fetch
  const [availableSlots, setAvailableSlots] = useState([]);
  const [loading, setLoading] = useState(false); // Loading for API call
  const [error, setError] = useState(null); // Error for API call

  // State specific to override fetch
  const [overrideData, setOverrideData] = useState(null);
  const [overrideLoading, setOverrideLoading] = useState(false); // Loading for override fetch
  const [overrideError, setOverrideError] = useState(null); // Error for override fetch


  const fetchSlotsAndOverride = useCallback(async (dateToFetch, booking, settings) => {
    // Clear data and stop if no valid date is provided
    if (!dateToFetch || !(dateToFetch instanceof Date) || isNaN(dateToFetch.getTime())) {
       console.log("useAvailableSlots: No valid date provided, clearing all state.");
       setAvailableSlots([]);
       setLoading(false);
       setError(null);
       setOverrideData(null); // Also clear override data
       setOverrideLoading(false);
       setOverrideError(null);
       return;
    }

    const dateStr = format(dateToFetch, "yyyy-MM-dd");

    // --- 1. Fetch Override Data ---
    setOverrideLoading(true);
    setOverrideError(null);
    let fetchedOverride = null;
    try {
        const overrideRef = doc(db, "spaAvailabilityOverrides", dateStr);
        const overrideDoc = await getDoc(overrideRef);
        if(overrideDoc.exists()) {
            fetchedOverride = { id: overrideDoc.id, ...overrideDoc.data() };
            setOverrideData(fetchedOverride);
            console.log(`useAvailableSlots: Fetched override for ${dateStr}`, fetchedOverride);
        } else {
            setOverrideData(null);
            console.log(`useAvailableSlots: No override found for ${dateStr}`);
        }
    } catch(err) {
        console.error(`useAvailableSlots: Error fetching override for ${dateStr}:`, err);
        setOverrideError(err);
        setOverrideData(null); // Ensure state is null on error
    } finally {
        setOverrideLoading(false);
    }

    // --- 2. Check if Spa is Closed by Override ---
    // If override fetch succeeded and it indicates the spa is closed, return early
    if (fetchedOverride?.isClosed) {
         console.log(`useAvailableSlots: Spa is marked as closed for ${dateStr}. Skipping API call.`);
         setAvailableSlots([]); // Set slots to empty
         setLoading(false); // Ensure API loading is off
         setError(null); // Ensure API error is off
         return; // Stop here, no API call needed
    }

    // --- 3. Fetch Available Slots from API ---
    setLoading(true); // Start API loading
    setError(null); // Clear previous API error
    try {
      const apiUrl = "http://localhost:3000"; // Replace with your actual API URL
      let apiEndpoint = `${apiUrl}/api/spa/availability?date=${dateStr}`;

       // Determine API parameters, prioritizing override times if they exist
       const effectiveStartTime = fetchedOverride?.startTime || settings?.startTime; // Use override start or settings start
       const effectiveEndTime = fetchedOverride?.endTime || settings?.endTime; // Use override end or settings end

       const apiParams = {};

       if (effectiveStartTime) apiParams.startTime = effectiveStartTime;
       if (effectiveEndTime) apiParams.endTime = effectiveEndTime;

      // Add booking-specific parameters
      if (booking) {
        apiParams.bookingId = booking.id;
        // Duration logic remains the same, based on booking duration or fallback
        const treatmentDurationMinutes =
          booking.spaTreatmentDuration && typeof booking.spaTreatmentDuration === "number"
            ? booking.spaTreatmentDuration
            : 120; // Default 120 minutes
        apiParams.duration = treatmentDurationMinutes;

        if (booking.arrivalDateObj)
          apiParams.arrival = format(booking.arrivalDateObj, "yyyy-MM-dd");
        if (booking.departureDateObj)
          apiParams.departure = format(booking.departureDateObj, "yyyy-MM-dd");
      } else {
        // If no booking, pass a default duration, maybe based on settings slot size
         apiParams.duration = settings?.slotDurationMinutes || 60; // Default 60 min if no booking
      }


      console.log(`useAvailableSlots: Fetching slots from API for ${dateStr}`, { apiEndpoint, apiParams });
      const response = await axios.get(apiEndpoint, { params: apiParams }); // Use axios as per your SpaScheduler example

      if (response.status !== 200) { // Check for non-200 status from axios
        console.error(`useAvailableSlots: API responded with status: ${response.status}`, response);
        throw new Error(`API responded with status: ${response.status}`);
      }

      const data = response.data; // Axios puts response data in .data
      console.log("useAvailableSlots: Received slots data:", data);

      setAvailableSlots(data.slots || []); // Update hook state
    } catch (err) {
      console.error("useAvailableSlots: Error fetching available slots:", err);
      setError(err); // Set API error state
      setAvailableSlots([]); // Clear slots on error
    } finally {
      setLoading(false); // End API loading
       console.log("useAvailableSlots: Fetch slots finished.");
    }
  }, [spaSettings]); // Depend on spaSettings as it provides default times/duration


  // Effect to run the fetch function whenever date, selectedBooking, or spaSettings changes
  useEffect(() => {
     console.log("useAvailableSlots Effect: Dependencies changed, calling fetchSlotsAndOverride", { date, selectedBooking: selectedBooking?.id, spaSettings });
     fetchSlotsAndOverride(date, selectedBooking, spaSettings);
  }, [date, selectedBooking, spaSettings, fetchSlotsAndOverride]); // Depend on parameters and the memoized fetch function

  // Return all relevant state and the refetch function
  return {
      availableSlots,
      loading: loading || overrideLoading, // Combine loading states for consumer
      error: error || overrideError, // Combine error states for consumer
      overrideData, // Return override data
      overrideLoading, // Return separate override loading
      overrideError, // Return separate override error
      refetch: fetchSlotsAndOverride // Return the combined refetch function
  };
};