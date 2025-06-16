// File: src/components/spa/useSpaCalendarData.js

import { useState, useEffect, useCallback } from "react";
import { format, startOfMonth, endOfMonth, parseISO, isValid } from "date-fns";
import axios from "axios";
import {
  collection,
  getDoc,
  getDocs,
  query,
  where,
  doc,
} from "firebase/firestore";
import { db } from "../../firebase"; // Adjust path as needed
import { parseBookingDateTime } from "./spaCalendarUtils";

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
          slotDurationMinutes: settingsData.slotDurationMinutes || 30,
          startTime: settingsData.startTime || "14:00",
          endTime: settingsData.endTime || "23:59",
        });
      } else {
        console.warn("SPA settings document not found. Using defaults.");
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

export const useBookingsForMonth = (month) => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchBookingsForMonth = useCallback(async (monthToFetch) => {
    if (
      !monthToFetch ||
      !(monthToFetch instanceof Date) ||
      !isValid(monthToFetch)
    ) {
      console.warn(
        "useBookingsForMonth: Invalid month provided.",
        monthToFetch
      );
      setBookings([]);
      setLoading(false);
      setError(new Error("Invalid month for fetching bookings."));
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

      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const bookingIdForLog = docSnap.id;

        const arrivalDateObj = data.arrivalDate
          ? parseISO(data.arrivalDate)
          : null;
        const departureDateObj = data.departureDate
          ? parseISO(data.departureDate)
          : null;

        const rawSpaDateTime = data.spaDateTime;
        const spaDateTimeObj = parseBookingDateTime(rawSpaDateTime);
        const spaEndDateTimeObj = parseBookingDateTime(data.spaEndDateTime);

        let spaInfoProcessed = null;
        if (data.spaInfo) {
          spaInfoProcessed = {
            ...data.spaInfo,
            scheduledDateTimeObj: parseBookingDateTime(
              data.spaInfo.scheduledDateTime
            ),
            endDateTimeObj: parseBookingDateTime(data.spaInfo.endDateTime),
          };
        }

        let spaTreatmentDuration = 120;
        if (
          typeof data.spaTreatmentDuration === "number" &&
          !isNaN(data.spaTreatmentDuration)
        ) {
          spaTreatmentDuration = data.spaTreatmentDuration;
        } else if (data.spaTreatmentDuration) {
          console.warn(
            `Booking ID ${bookingIdForLog} has non-numeric spaTreatmentDuration: ${data.spaTreatmentDuration}. Using default 120.`
          );
        }

        fetchedBookings.push({
          id: docSnap.id,
          firestoreId: docSnap.id,
          ...data,
          arrivalDateObj:
            arrivalDateObj && isValid(arrivalDateObj) ? arrivalDateObj : null,
          departureDateObj:
            departureDateObj && isValid(departureDateObj)
              ? departureDateObj
              : null,
          spaDateTimeObj: spaDateTimeObj,
          spaEndDateTimeObj: spaEndDateTimeObj,
          spaInfo: spaInfoProcessed,
          needsScheduling:
            data.spaBookingPreference === "later" &&
            (!spaDateTimeObj || !isValid(spaDateTimeObj)),
          spaTreatmentDuration: spaTreatmentDuration,
        });
      });

      setBookings(fetchedBookings);
    } catch (err) {
      console.error("Error fetching bookings for month:", err);
      setError(err);
      setBookings([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (month instanceof Date && isValid(month)) {
      fetchBookingsForMonth(month);
    } else {
      setBookings([]);
      setLoading(false);
    }
  }, [month, fetchBookingsForMonth]);

  return { bookings, loading, error, refetch: fetchBookingsForMonth };
};

// --- THIS IS THE CORRECTED HOOK ---
export const useAvailableSlots = (
  selectedDate,
  selectedBooking,
  spaSettings
) => {
  const [availableSlots, setAvailableSlots] = useState([]);
  const [manuallyDeactivatedSlots, setManuallyDeactivatedSlots] = useState([]);
  const [isDayClosed, setIsDayClosed] = useState(false);

  // 1. Add new state for the WordPress bookings
  const [wordpressBookings, setWordpressBookings] = useState([]);

  const [apiSlotDataLoading, setApiSlotDataLoading] = useState(false);
  const [apiSlotDataError, setApiSlotDataError] = useState(null);
  const [overrideData, setOverrideData] = useState(null);
  const [overrideLoading, setOverrideLoading] = useState(false);
  const [overrideError, setOverrideError] = useState(null);

  const fetchSlotsAndOverride = useCallback(
    async (dateToFetch, bookingForContext) => {
      if (
        !dateToFetch ||
        !(dateToFetch instanceof Date) ||
        !isValid(dateToFetch)
      ) {
        // Reset all states if the date is invalid or cleared
        setAvailableSlots([]);
        setManuallyDeactivatedSlots([]);
        setIsDayClosed(false);
        setWordpressBookings([]); // Also reset the new state
        setApiSlotDataLoading(false);
        setApiSlotDataError(null);
        setOverrideData(null);
        setOverrideLoading(false);
        setOverrideError(null);
        return;
      }

      const dateStr = format(dateToFetch, "yyyy-MM-dd");

      // Fetch override data (no changes here)
      setOverrideLoading(true);
      setOverrideError(null);
      try {
        const overrideRef = doc(db, "spaAvailabilityOverrides", dateStr);
        const overrideDocSnap = await getDoc(overrideRef);
        setOverrideData(
          overrideDocSnap.exists()
            ? { id: overrideDocSnap.id, ...overrideDocSnap.data() }
            : null
        );
      } catch (err) {
        console.error(`Error fetching override doc for ${dateStr}:`, err);
        setOverrideError(err);
      } finally {
        setOverrideLoading(false);
      }

      // Fetch slot availability from API
      setApiSlotDataLoading(true);
      setApiSlotDataError(null);
      try {
        const apiUrlBase =
          import.meta.env.VITE_API_URL || "http://localhost:3000";
        const apiEndpoint = `${apiUrlBase}/api/spa/availability`;
        const params = { date: dateStr };

        if (
          bookingForContext?.arrivalDateObj &&
          isValid(bookingForContext.arrivalDateObj)
        ) {
          params.arrival = format(
            bookingForContext.arrivalDateObj,
            "yyyy-MM-dd"
          );
        }
        if (
          bookingForContext?.departureDateObj &&
          isValid(bookingForContext.departureDateObj)
        ) {
          params.departure = format(
            bookingForContext.departureDateObj,
            "yyyy-MM-dd"
          );
        }

        const response = await axios.get(apiEndpoint, { params });
        if (response.status !== 200) {
          throw new Error(
            response.data?.message || `API status ${response.status}`
          );
        }

        const data = response.data;

        // 2. Set ALL state variables from the API response
        setAvailableSlots(data.availableSlots || []);
        setManuallyDeactivatedSlots(data.manuallyDeactivatedSlots || []);
        setIsDayClosed(data.isClosed || false);
        setWordpressBookings(data.wordpressBookings || []); // Set the new state here
      } catch (err) {
        console.error(`Error fetching slot data for ${dateStr}:`, err);
        setApiSlotDataError(err);
        setAvailableSlots([]);
        setManuallyDeactivatedSlots([]);
        setIsDayClosed(false);
        setWordpressBookings([]); // Reset on error as well
      } finally {
        setApiSlotDataLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (selectedDate && isValid(selectedDate)) {
      fetchSlotsAndOverride(selectedDate, selectedBooking, spaSettings);
    } else {
      // Clear all data if no date is selected
      setAvailableSlots([]);
      setManuallyDeactivatedSlots([]);
      setIsDayClosed(false);
      setWordpressBookings([]);
      setApiSlotDataLoading(false);
      setOverrideData(null);
    }
  }, [selectedDate, selectedBooking, spaSettings, fetchSlotsAndOverride]);

  // 3. Return the new state variable along with the others
  return {
    availableSlots,
    manuallyDeactivatedSlots,
    isDayClosed,
    wordpressBookings, // Make the data available to the component
    loading: apiSlotDataLoading || overrideLoading,
    error: apiSlotDataError || overrideError,
    overrideData,
    overrideLoading,
    overrideError,
    slotsLoading: apiSlotDataLoading,
    slotsError: apiSlotDataError,
    refetch: fetchSlotsAndOverride,
  };
};
