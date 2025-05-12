// File: src/components/Admin/SpaScheduler.jsx
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import axios from "axios";
// Import necessary date-fns functions
import {
  format,
  parse,
  startOfDay,
  isEqual,
  addDays,
  isBefore,
  addMinutes,
  isSameDay, // Needed for calculateNextSlotTime check
} from "date-fns";
import { fr } from "date-fns/locale"; // Needed for formatDateForDisplay fallback

// Import utility function if used here (not directly used now, but keep imports clean)
// import { parseBookingDateTime } from "../../utils/spaCalendarUtils";

// --- Constants ---
const ARRIVAL_DAY_START_TIME = "14:00"; // Special start time for the arrival day



const formatDateForDisplay = (date, locale = "en-US") => {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
    console.warn("formatDateForDisplay: Invalid date input", date);
    return "";
  }
  // Example locales: 'en-US', 'fr-BE', 'nl-BE'
  try {
    // Use i18n locale if available, otherwise fallback
    return date.toLocaleDateString(locale, {
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "long",
    });
  } catch (e) {
    console.error(
      "formatDateForDisplay failed using toLocaleDateString:",
      date,
      locale,
      e
    );
    // Fallback using date-fns format if toLocaleDateString fails or locale is not supported
    // This fallback might not match the exact appearance of the requested locale but is safer.
    return format(date, "EEEE d MMMM yyyy", {
      locale: locale === "fr-BE" ? fr : undefined,
    }); // Use fr locale explicitly if fr-BE/fr
  }
};

// Format Date for API value (YYYY-MM-DD)
const formatDateForAPI = (date) => {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
    console.warn("formatDateForAPI: Invalid date input", date);
    return ""; // Return empty string for invalid dates
  }
  return format(date, "yyyy-MM-dd");
};

// Calculate next slot time string based on duration (local helper)
const calculateNextSlotTime = (startTimeString, durationMinutes) => {
  // Returns null if input is invalid or duration is non-positive
  if (!startTimeString || !durationMinutes || durationMinutes <= 0) {
    console.warn("calculateNextSlotTime: Invalid input", {
      startTimeString,
      durationMinutes,
    });
    return null;
  }
  try {
    const [hours, minutes] = startTimeString.split(":").map(Number);
    // Use a fixed arbitrary date (like start of today) to avoid DST issues with just time manipulation
    // by adding minutes to a Date object at the start of the day containing the time.
    const today = startOfDay(new Date()); // Using current day's start is generally safe for time arithmetic
    const start = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
      hours,
      minutes
    );

    const nextDate = addMinutes(start, durationMinutes);

    // Optional: Check if adding minutes crossed day boundary unexpectedly
    if (!isSameDay(start, nextDate) && format(nextDate, "HH:mm") !== "00:00") {
      console.warn(
        "calculateNextSlotTime: Adding duration crossed day boundary unexpectedly (not midnight).",
        {
          startTimeString,
          durationMinutes,
          nextTime: format(nextDate, "HH:mm"),
        }
      );
    }

    return format(nextDate, "HH:mm"); // Return HH:mm string
  } catch (e) {
    console.error("Error calculating next slot time:", e);
    return null;
  }
};

// --- Component ---

const SpaScheduler = ({
  onScheduleChange, // Callback: receives bookingData object {startDateTime, endDateTime, slots} or 'later' or null
  initialDateTime, // Optional: ISO String or Timestamp for the START time
  initialPreference, // Optional: 'later' if previously selected
  minDate, // Expecting Date object or undefined (Booking arrival date)
  maxDate, // Expecting Date object or undefined (Booking departure date - may need adjustment before passing)
  appliedCoupon, // Coupon prop is still received but not used for mode logic here
}) => {
  const { t, i18n } = useTranslation();
  const currentLocale = i18n.language || "en-US"; // Get current locale for date formatting

  console.log("SpaScheduler rendering", {
    initialDateTime,
    initialPreference,
    minDate: minDate ? format(minDate, "yyyy-MM-dd") : null,
    maxDate: maxDate ? format(maxDate, "yyyy-MM-dd") : null,
    appliedCoupon,
  });

  // --- Determine Selection Mode ---
  // Mode is hardcoded to 'double' as per user request.
  const selectionMode = "double"; // Always operate in double slot mode

  // --- State Initialization ---
  const getInitialDateString = () => {
    // Only set initial date string if there's an initialDateTime AND it wasn't 'later'
    if (initialDateTime && initialPreference !== "later") {
      try {
        // Use Date constructor which handles ISO strings and Firebase Timestamps
        const initialDate = new Date(initialDateTime);
        if (isNaN(initialDate.getTime())) {
          console.warn(
            "SpaScheduler: initialDateTime resulted in Invalid Date during initialization.",
            initialDateTime
          );
          return ""; // Return empty string if parsing fails
        }
        return formatDateForAPI(initialDate);
      } catch (e) {
        console.error(
          "SpaScheduler: Error parsing initialDateTime for date string during initialization:",
          initialDateTime,
          e
        );
        return ""; // Return empty string on error
      }
    }
    return "";
  };

  const getInitialSlots = () => {
    // Only set initial slots if there's initialDateTime AND it wasn't 'later'
    if (initialDateTime && initialPreference !== "later") {
      try {
        // The initialDateTime might be a Date object or Timestamp from Firebase
        const initialDate = new Date(initialDateTime);
        if (isNaN(initialDate.getTime())) {
          console.warn(
            "SpaScheduler: initialDateTime resulted in Invalid Date during initialization.",
            initialDateTime
          );
          return []; // Return empty array if parsing fails
        }
        // Get the *first* slot time string from the initial DateTime
        const firstSlotTime = format(initialDate, "HH:mm"); // Use format for reliable HH:mm

        // If the booking was scheduled as a DOUBLE slot, it *should* have a second slot.
        // When initializing from existing data, we *could* try to grab all saved slots.
        // However, the SpaScheduler's role is to determine the *next* slots based on the *first* click
        // and the mode/duration. So, initializing with just the first slot time string is sufficient
        // for `handleSlotSelect` to work with. The effect below re-validates this.
        return [firstSlotTime];
      } catch (e) {
        console.error(
          "SpaScheduler: Error parsing initialDateTime for initial slot during initialization:",
          initialDateTime,
          e
        );
        return []; // Return empty array on error
      }
    }
    return [];
  };

  // Initialize states using the getters
  const [selectedSpaDateString, setSelectedSpaDateString] = useState(
    getInitialDateString()
  );
  const [availableSlots, setAvailableSlots] = useState([]); // Slots fetched from API
  const [slotDuration, setSlotDuration] = useState(null); // Duration of a single slot from API (e.g., 30 or 60)
  const [selectedSlots, setSelectedSlots] = useState(getInitialSlots()); // Array of HH:mm strings for selected slots (e.g., ['15:00', '16:00'])
  const [chooseLaterChecked, setChooseLaterChecked] = useState(
    initialPreference === "later"
  ); // State for the 'choose later' checkbox
  const [isLoading, setIsLoading] = useState(false); // Loading state for API calls
  const [error, setError] = useState(""); // Error message for API calls
  // Flag to prevent refetching slots repeatedly for the same date/mode unless triggered by state/prop change
  const [slotsLoadedForCurrentDate, setSlotsLoadedForCurrentDate] =
    useState(false);

  console.log("SpaScheduler initial state:", {
    selectedSpaDateString,
    selectedSlots,
    chooseLaterChecked,
  });

  // --- Memos ---
  // Generate available dates from minDate to maxDate
  const dateOptions = useMemo(() => {
    console.log("SpaScheduler: Recalculating dateOptions", {
      minDate,
      maxDate,
      currentLocale,
    });
    const options = [];
    // Basic validation for min/max dates
    if (
      !minDate ||
      !maxDate ||
      !(minDate instanceof Date) ||
      !(maxDate instanceof Date) ||
      isBefore(maxDate, minDate)
    ) {
      console.log("SpaScheduler: Invalid min/max dates for dateOptions.");
      return options; // Return empty if dates are invalid
    }
    let currentDate = startOfDay(minDate);
    const lastDate = startOfDay(maxDate);
    while (isBefore(currentDate, lastDate) || isEqual(currentDate, lastDate)) {
      options.push({
        value: formatDateForAPI(currentDate),
        label: formatDateForDisplay(currentDate, currentLocale),
      });
      currentDate = addDays(currentDate, 1); // Use addDays
    }
    console.log(`SpaScheduler: Generated ${options.length} date options.`);
    return options;
    // Depend on minDate, maxDate, and locale as they affect the options
  }, [minDate, maxDate, currentLocale]);

  // Get the arrival date formatted for API (needed for the "too early on arrival day" check)
  const arrivalDateString = useMemo(() => {
    console.log("SpaScheduler: Recalculating arrivalDateString", { minDate });
    return minDate instanceof Date ? formatDateForAPI(minDate) : null;
    // Depend on minDate
  }, [minDate]);

  // --- Effects ---

  // Effect to handle state updates when initial props change (e.g., initialDateTime or initialPreference updated from parent)
  useEffect(() => {
    console.log(
      "SpaScheduler Effect: initialDateTime or initialPreference changed.",
      { initialDateTime, initialPreference }
    );
    const isLater = initialPreference === "later";
    setChooseLaterChecked(isLater);

    if (!isLater && initialDateTime) {
      try {
        const initialDate = new Date(initialDateTime);
        if (!isNaN(initialDate.getTime())) {
          const initialDateAPI = formatDateForAPI(initialDate);
          setSelectedSpaDateString(initialDateAPI);
          // Initialize local slots with the first slot string.
          // The fetch effect will validate this selection against availability.
          setSelectedSlots([format(initialDate, "HH:mm")]);
          setSlotsLoadedForCurrentDate(false); // Need to refetch availability for this new date/selection

          console.log(
            "SpaScheduler Effect: Initial scheduled booking found, setting date and initial slot string.",
            { date: initialDateAPI, slot: format(initialDate, "HH:mm") }
          );
        } else {
          console.warn(
            "SpaScheduler Effect: Invalid initialDateTime provided, clearing state."
          );
          setSelectedSpaDateString("");
          setSelectedSlots([]);
          setSlotsLoadedForCurrentDate(false); // Ensure availability fetch is triggered if a date is then selected
        }
      } catch (e) {
        console.error(
          "SpaScheduler Effect: Error processing initialDateTime",
          e
        );
        setSelectedSpaDateString("");
        setSelectedSlots([]);
        setSlotsLoadedForCurrentDate(false);
      }
    } else if (!initialDateTime && !isLater) {
      // Initial state is neither scheduled nor later, reset all
      console.log(
        "SpaScheduler Effect: Initial state is not scheduled/later, resetting."
      );
      setSelectedSpaDateString("");
      setSelectedSlots([]);
      setSlotsLoadedForCurrentDate(false); // Ensure availability fetch is triggered if a date is then selected
      // No parent notification here, this is just about initial state setup.
    }
    // Note: onScheduleChange is not a dependency here, as this effect shouldn't call it.
  }, [initialDateTime, initialPreference]); // Depend on the initial props

  // Effect to fetch available slots when the selected date changes or 'choose later' is unchecked.
  // Also prevents refetching if slots are already loaded for the current date/mode.
  useEffect(() => {
    console.log("SpaScheduler Effect: Fetch trigger check.", {
      selectedSpaDateString,
      chooseLaterChecked,
      selectionMode,
      slotsLoadedForCurrentDate,
      isLoading,
    });

    // Only fetch if a date is selected, 'choose later' is unchecked, and slots haven't been loaded yet for this date/mode, and not already loading
    if (
      selectedSpaDateString &&
      !chooseLaterChecked &&
      !slotsLoadedForCurrentDate &&
      !isLoading
    ) {
      setIsLoading(true); // Start loading
      setError(""); // Clear previous error
      setSlotDuration(null); // Clear previous duration
      setAvailableSlots([]); // Clear previous slots

      const dateString = selectedSpaDateString;
      const apiUrl = process.env.REACT_APP_API_URL || "http://localhost:3000";
      const apiEndpoint = `${apiUrl}/api/spa/availability`;

      // Determine the duration parameter for the API call.
      // This should represent the *total* duration needed for the booking,
      // as the API is expected to return available *start times* for that duration block.
      // Assuming 'double' mode needs 120min, 'single' needs 60min as per your original logic.
      // If the actual required duration per booking varies, this needs to come from a parent prop.
      // For now, hardcoding based on selectionMode seems to match your context.
      const apiRequestDuration = selectionMode === "single" ? 60 : 120; // Duration to ask the API for

      const apiParams = {
        date: dateString,
        arrival:
          minDate instanceof Date ? formatDateForAPI(minDate) : undefined, // Pass arrival date for server-side validation
        departure:
          maxDate instanceof Date ? formatDateForAPI(maxDate) : undefined, // Pass departure date for server-side validation
        duration: apiRequestDuration, // <--- Pass duration based on mode
      };

      // Clean up undefined params
      Object.keys(apiParams).forEach(
        (key) => apiParams[key] === undefined && delete apiParams[key]
      );

      console.log("SpaScheduler Effect: Fetching availability", {
        apiEndpoint,
        apiParams,
      });

      axios
        .get(apiEndpoint, { params: apiParams })
        .then((response) => {
          const fetchedSlots = response.data?.slots || []; // Array of available start times (HH:mm)
          const fetchedDuration = response.data?.slotDurationMinutes; // Expecting the base slot duration (e.g., 30 or 60) from API
          setAvailableSlots(fetchedSlots);
          setSlotDuration(fetchedDuration); // Store the base slot duration

          console.log("SpaScheduler Effect: Slots fetched successfully", {
            fetchedSlots,
            fetchedDuration,
          });

          // --- Validation and Update based on Fetched Slots ---
          // After fetching, re-validate any existing/initial selection (held in `selectedSlots`)
          // This ensures that if the user's previously selected slot(s) are no longer available (e.g., due to data change),
          // the local selection is cleared and parent is notified.
          if (selectedSlots.length > 0 && fetchedDuration) {
            const firstSelectedSlotString = selectedSlots[0];
            let isInitialSelectionValid = false;
            console.log(
              "SpaScheduler Effect: Validating existing selection starting at",
              firstSelectedSlotString
            );

            // Re-determine the *expected* slots based on the first selected slot string and the *fetched* duration
            let expectedSlots = [];
            if (selectionMode === "single") {
              // In single mode, the expected slots are just the first selected one
              expectedSlots = [firstSelectedSlotString];
            } else {
              // selectionMode === "double"
              // In double mode, the expected slots are the first selected one AND the next one
              const nextExpectedSlotString = calculateNextSlotTime(
                firstSelectedSlotString,
                fetchedDuration
              );
              if (nextExpectedSlotString) {
                expectedSlots = [
                  firstSelectedSlotString,
                  nextExpectedSlotString,
                ];
              } else {
                console.warn(
                  "SpaScheduler Effect: Could not calculate expected second slot for double mode validation."
                );
              }
            }

            // Check if *all* expected slots are present in the *fetched* available slots list
            isInitialSelectionValid =
              expectedSlots.length > 0 &&
              expectedSlots.every((slot) => fetchedSlots.includes(slot));

            console.log(
              "SpaScheduler Effect: Initial selection validation result:",
              isInitialSelectionValid,
              {
                selectedSlotsWere: selectedSlots,
                expectedSlotsAre: expectedSlots,
                availableFetched: fetchedSlots,
              }
            );

            if (isInitialSelectionValid) {
              console.log(
                "SpaScheduler Effect: Initial/existing selection is valid after fetch."
              );
              // Update local state to ensure `selectedSlots` array matches `expectedSlots` (e.g., adding the second slot if needed)
              // Only update local state if the array content is actually different to avoid unnecessary re-renders.
              if (
                JSON.stringify(selectedSlots) !== JSON.stringify(expectedSlots)
              ) {
                console.log(
                  "SpaScheduler Effect: Updating local selectedSlots to match validated expected slots."
                );
                setSelectedSlots(expectedSlots); // This will trigger a render, but not a refetch due to slotsLoadedForCurrentDate
              }

              // If the initial selection *is* valid after fetching, notify the parent again
              // with the full booking data structure, including the correct end time and the validated slots array.
              // This handles cases where SpaScheduler mounts/refetches *after* the booking was saved,
              // ensuring the parent always has the complete, validated data for the current selection.
              try {
                const datePart = parse(
                  selectedSpaDateString,
                  "yyyy-MM-dd",
                  new Date()
                );
                const [hours, minutes] = firstSelectedSlotString
                  .split(":")
                  .map(Number);
                const startDateTime = new Date(datePart);
                startDateTime.setHours(hours, minutes, 0, 0);

                // Calculate end time based on the *start time* of the first slot
                // plus the *total duration* of the selected slots (length of expectedSlots * fetchedDuration)
                const totalDurationMinutes =
                  expectedSlots.length * fetchedDuration;
                const endDateTime = addMinutes(
                  startDateTime,
                  totalDurationMinutes
                );

                const bookingData = {
                  startDateTime: startDateTime, // Date object for the start time (first slot)
                  endDateTime: endDateTime, // Date object for the *actual end* time (after last slot finishes)
                  slots: expectedSlots, // Pass the validated/corrected array of HH:mm strings
                };
                console.log(
                  "SpaScheduler Effect: Notifying parent with validated initial selection bookingData:",
                  bookingData
                );
                // Important: Only notify parent if we're *not* in chooseLater mode
                if (
                  !chooseLaterChecked &&
                  typeof onScheduleChange === "function"
                ) {
                  onScheduleChange(bookingData);
                }
              } catch (e) {
                console.error(
                  "SpaScheduler Effect: Error preparing booking data for parent notification after validation",
                  e
                );
                if (
                  !chooseLaterChecked &&
                  typeof onScheduleChange === "function"
                ) {
                  onScheduleChange(null);
                }
              }
            } else {
              // Initial selection is NOT valid based on fetched slots
              console.warn(
                `SpaScheduler Effect: Initial/existing selection [${selectedSlots.join(
                  ", "
                )}] no longer valid for mode '${selectionMode}' based on fetched slots. Clearing.`
              );
              setSelectedSlots([]); // Clear local state
              // Notify parent that the previously selected slot is no longer valid
              if (
                !chooseLaterChecked &&
                typeof onScheduleChange === "function"
              ) {
                console.log(
                  "SpaScheduler Effect: Notifying parent (null) due to invalid initial selection."
                );
                onScheduleChange(null);
              }
            }
          } else if (selectedSlots.length > 0 && !fetchedDuration) {
            // We had a selection but couldn't get slot duration from API - invalid state
            console.warn(
              "SpaScheduler Effect: Had initial selection but slotDuration is missing after fetch. Clearing."
            );
            setSelectedSlots([]); // Clear local state
            // Notify parent of invalid state
            if (!chooseLaterChecked && typeof onScheduleChange === "function") {
              console.log(
                "SpaScheduler Effect: Notifying parent (null) due to missing slot duration after fetch."
              );
              onScheduleChange(null);
            }
          } else {
            // No initial selection or initial selection was already cleared. Ensure parent is null if not 'later'.
            if (!chooseLaterChecked && typeof onScheduleChange === "function") {
              console.log(
                "SpaScheduler Effect: No initial selection, notifying parent with null."
              );
              onScheduleChange(null); // Ensures parent state is null if nothing is selected initially
            }
          }
          // --- End Validation and Update ---

          // Set the flag *after* processing the fetched slots and selection validation
          setSlotsLoadedForCurrentDate(true);
        })
        .catch((err) => {
          console.error("SpaScheduler: Error fetching SPA slots:", err);
          let errorMsg = t("extras.spa.errorLoading", "Failed to load slots.");
          if (err.message === "Network Error")
            errorMsg = t("errors.network", "Network error.");
          else if (err.response)
            errorMsg = err.response.data?.message || errorMsg;
          setError(errorMsg); // Set hook's error state
          setAvailableSlots([]); // Clear available slots
          setSelectedSlots([]); // Clear local selection
          setSlotDuration(null); // Clear duration
          // Notify parent that there's no valid selection available
          if (!chooseLaterChecked && typeof onScheduleChange === "function") {
            console.log(
              "SpaScheduler Effect: Notifying parent (null) due to fetch error."
            );
            onScheduleChange(null);
          }
          setSlotsLoadedForCurrentDate(true); // Mark as loaded (or failed) to prevent loop for this attempt
        })
        .finally(() => {
          setIsLoading(false); // End loading
          console.log("SpaScheduler Effect: Fetch availability finished.");
        });
    } else if (selectedSpaDateString && chooseLaterChecked) {
      // If a date is selected but "Choose Later" is checked, clear slots and don't fetch
      console.log(
        "SpaScheduler Effect: Date selected but 'Choose Later' checked, clearing slots and skipping fetch."
      );
      setAvailableSlots([]);
      setSlotDuration(null);
      setSelectedSlots([]); // Ensure local slots are empty
      setError(""); // Clear any error
      setSlotsLoadedForCurrentDate(false); // Reset flag if date is selected and choose later is checked (maybe unnecessary)

      // Notify parent that the preference is 'later'
      if (typeof onScheduleChange === "function") {
        console.log(
          "SpaScheduler Effect: Notifying parent ('later') because chooseLaterChecked is true."
        );
        onScheduleChange("later");
      }
    } else if (!selectedSpaDateString) {
      // If no date is selected, clear everything related to slots and preference (unless chooseLater was true)
      console.log(
        "SpaScheduler Effect: No date selected, clearing all slot/date state."
      );
      setAvailableSlots([]);
      setSlotDuration(null);
      setSelectedSlots([]);
      setError("");
      setSlotsLoadedForCurrentDate(false); // Reset flag if date is unselected

      // Notify parent (no valid selection) - Only if not in 'later' mode
      if (!chooseLaterChecked && typeof onScheduleChange === "function") {
        console.log(
          "SpaScheduler Effect: Notifying parent (null) because no date is selected."
        );
        onScheduleChange(null);
      }
    }
    console.log("SpaScheduler Effect finished.");
  }, [
    selectedSpaDateString, // Trigger fetch when date dropdown changes
    chooseLaterChecked, // Trigger fetch or state clear when checkbox changes
    selectionMode, // Trigger fetch/validation if mode changes (although hardcoded 'double' now)
    slotsLoadedForCurrentDate, // Flag to prevent refetch loops for the same date/mode
    isLoading, // Avoid triggering fetch while already loading
    // Other dependencies used inside the effect logic:
    t, // For translation (used in error messages)
    minDate, // Used in apiParams and arrivalDateString check
    maxDate, // Used in apiParams
    availableSlots, // Used for initial selection validation
    slotDuration, // Used for initial selection validation and end time calculation
    selectedSlots, // Used for initial selection validation
    onScheduleChange, // Used to notify parent
    arrivalDateString, // Used for arrival day check
  ]);

  // --- Event Handlers ---

  // Handles change in the date selection dropdown
  const handleDateChange = (event) => {
    console.log("handleDateChange called");
    const newDateString = event.target.value;
    setSelectedSpaDateString(newDateString); // Update state to the new date string
    setSlotsLoadedForCurrentDate(false); // Reset this flag to force a fetch for the new date
    setSelectedSlots([]); // Clear any previously selected slots when date changes
    setAvailableSlots([]); // Clear available slots for the old date
    setSlotDuration(null); // Clear slot duration
    setError(""); // Clear any previous error message
    // Notify the parent that the selection is now invalid/cleared due to date change
    if (typeof onScheduleChange === "function") {
      console.log("handleDateChange: Notifying parent with null.");
      onScheduleChange(null);
    }
    console.log("handleDateChange finished.");
  };

  // Handles clicks on the time slot buttons
  const handleSlotSelect = useCallback(
    (clickedSlot) => {
      console.log("handleSlotSelect called with slot:", clickedSlot);
      // Validate essential data needed for calculation
      if (!slotDuration || slotDuration <= 0 || !selectedSpaDateString) {
        console.warn(
          "handleSlotSelect: Cannot select slot: duration (",
          slotDuration,
          ") or date string missing."
        );
        if (typeof onScheduleChange === "function") onScheduleChange(null); // Notify parent of invalid state
        return;
      }
      // Validate against arrival day restriction
      const isArrivalDaySelected = selectedSpaDateString === arrivalDateString;
      if (isArrivalDaySelected && clickedSlot < ARRIVAL_DAY_START_TIME) {
        console.warn(
          `handleSlotSelect: Selection prevented: ${clickedSlot} is before ${ARRIVAL_DAY_START_TIME} on arrival day.`
        );
        if (typeof onScheduleChange === "function") onScheduleChange(null); // Notify parent of invalid selection attempt
        return;
      }

      let newSelectedSlots = []; // Array to hold the HH:mm strings of the slots we *should* select
      let isValidSelectionAttempt = false; // Flag indicating if the attempt *could* result in a valid selection

      // --- Determine slots to select based on mode ---
      if (selectionMode === "single") {
        // In single mode, the user selects just one slot.
        // Check if the clicked slot is available.
        if (availableSlots.includes(clickedSlot)) {
          newSelectedSlots = [clickedSlot];
          isValidSelectionAttempt = true;
          console.log(`SpaScheduler: Single slot ${clickedSlot} is available.`);
        } else {
          console.warn(
            `SpaScheduler: Single slot ${clickedSlot} is unavailable.`
          );
          isValidSelectionAttempt = false; // Clicked an unavailable slot
        }
      } else {
        // selectionMode === "double"
        // In double mode, the user selects the *start* of a two-slot block.
        // We need the clicked slot AND the next slot to be available.
        const nextSlotTime = calculateNextSlotTime(clickedSlot, slotDuration); // Calculate the time of the second slot
        if (
          nextSlotTime &&
          availableSlots.includes(clickedSlot) &&
          availableSlots.includes(nextSlotTime)
        ) {
          newSelectedSlots = [clickedSlot, nextSlotTime]; // Both slots must be selected
          isValidSelectionAttempt = true;
          console.log(
            `SpaScheduler: Double slots ${clickedSlot}, ${nextSlotTime} are available.`
          );
        } else {
          console.warn(
            `SpaScheduler: Cannot select double slot starting at ${clickedSlot}. One or both slots unavailable.`,
            {
              clicked: availableSlots.includes(clickedSlot),
              nextExpected: nextSlotTime,
              nextAvailable: nextSlotTime
                ? availableSlots.includes(nextSlotTime)
                : "N/A",
            }
          );
          isValidSelectionAttempt = false; // Clicked an unavailable slot OR the next slot isn't available
        }
      }
      // --- End slot determination ---

      // If the selection attempt was valid and we identified slots
      if (isValidSelectionAttempt && newSelectedSlots.length > 0) {
        // Update the local state *inside* SpaScheduler with the determined slots
        setSelectedSlots(newSelectedSlots); // This sets selectedSlots to ['15:00', '16:00'] if valid double, or ['15:00'] if valid single.

        // Prepare data to pass back to the parent component
        try {
          const datePart = parse(
            selectedSpaDateString,
            "yyyy-MM-dd",
            new Date()
          );
          // Get the start time Date object from the *first* slot string in the selected slots array
          const [hours, minutes] = newSelectedSlots[0].split(":").map(Number);
          const startDateTime = new Date(datePart);
          startDateTime.setHours(hours, minutes, 0, 0);

          // --- CORRECTED: Calculate endDateTime based on TOTAL duration ---
          // The total duration is the number of *determined* selected slots multiplied by the *base slot duration*
          const totalDurationMinutes = newSelectedSlots.length * slotDuration;
          const endDateTime = addMinutes(startDateTime, totalDurationMinutes); // Use addMinutes

          console.log("SpaScheduler: Prepared bookingData for parent", {
            startDateTime,
            endDateTime,
            newSelectedSlots,
          });

          const bookingData = {
            startDateTime: startDateTime, // Date object for the start time
            endDateTime: endDateTime, // Date object for the *actual end time* (start time + total duration)
            slots: newSelectedSlots, // Array of HH:mm strings (e.g., ['15:00', '16:00'])
          };

          // Call the parent's handler with the valid booking data object
          if (typeof onScheduleChange === "function") {
            console.log(
              "SpaScheduler: Calling onScheduleChange with valid bookingData."
            );
            onScheduleChange(bookingData);
          }
        } catch (e) {
          console.error(
            "SpaScheduler: Error creating bookingData object for parent:",
            e
          );
          setSelectedSlots([]); // Clear local state on error
          // Notify parent of error/invalid state
          if (typeof onScheduleChange === "function") {
            console.log(
              "SpaScheduler: Calling onScheduleChange with null due to error."
            );
            onScheduleChange(null);
          }
        }
      } else {
        // If selection attempt was invalid (e.g. clicked unavailable slot or next slot unavailable)
        console.log(
          "SpaScheduler: Selection attempt invalid, clearing local slots and notifying parent with null."
        );
        setSelectedSlots([]); // Clear local selection
        // Inform parent no valid selection was made
        if (typeof onScheduleChange === "function") {
          console.log("SpaScheduler: Calling onScheduleChange with null.");
          onScheduleChange(null);
        }
      }
      console.log("handleSlotSelect finished.");
    },
    // Dependencies for useCallback: Ensure any state or prop used inside is listed
    [
      selectedSpaDateString, // Used to create Date objects
      onScheduleChange, // Parent callback
      availableSlots, // List of available slots from API (used for availability check)
      slotDuration, // Duration of a single slot from API (used in calculations)
      arrivalDateString, // Formatted arrival date string (used for arrival day check)
      selectionMode, // 'single' or 'double' mode (determines selection logic)
      // calculateNextSlotTime is a local helper, implicitly stable if its dependencies (addMinutes, format) are stable.
      // If calculateNextSlotTime used external state/props, it would need useCallback itself and be a dependency here.
    ]
  );

  // Handles change in the "Book Later" checkbox
  const handleChooseLaterChange = (e) => {
    console.log("handleChooseLaterChange called", e.target.checked);
    const isChecked = e.target.checked;
    setChooseLaterChecked(isChecked); // Update local state

    if (!isChecked) {
      // If unchecking "Book Later", reset flag to trigger a fetch of available slots
      console.log(
        "SpaScheduler: Choose later unchecked, resetting slotsLoadedForCurrentDate."
      );
      setSlotsLoadedForCurrentDate(false);
      // Clear local selection immediately, the useEffect will handle potentially re-selecting based on initial data or user click.
      setSelectedSlots([]);
      // Clear available slots and related info immediately for a cleaner UI transition before fetch starts
      setAvailableSlots([]);
      setSlotDuration(null);
      setError("");

      // Notify parent that the preference is no longer 'later'.
      // The parent should clear any saved schedule state. We send null for now.
      // Note: The useEffect that fetches slots will *also* notify the parent if it finds a valid
      // initial selection or if the fetch fails. This might result in parent being notified twice (null then either bookingData or null again).
      // Depending on parent logic, this might be acceptable, or the null notification here could be removed.
      if (typeof onScheduleChange === "function") {
        console.log(
          "SpaScheduler: Choose later unchecked, notifying parent with null."
        );
        onScheduleChange(null);
      }
    } else {
      // If checking "Book Later"
      // Clear all slot-related state locally
      setSelectedSlots([]); // Clear local selection
      setAvailableSlots([]); // Clear available slots UI
      setSlotDuration(null); // Clear duration UI
      setError(""); // Clear error UI
      console.log(
        "SpaScheduler: Choose later checked, clearing all slot state locally."
      );
      setSlotsLoadedForCurrentDate(false); // Reset flag (good practice, although fetch won't happen if checked)

      // Notify parent that the preference is now 'later'
      if (typeof onScheduleChange === "function") {
        console.log(
          "SpaScheduler: Choose later checked, notifying parent with 'later'."
        );
        onScheduleChange("later");
      }
    }
    console.log("handleChooseLaterChange finished.");
  };

  // --- JSX Rendering ---
  return (
    <div className="p-3 space-y-4 bg-white border border-gray-200 rounded-md">
      {console.log("Rendering SpaScheduler JSX. State:", {
        selectedSpaDateString,
        selectedSlots,
        chooseLaterChecked,
        isLoading,
        error,
        availableSlots: availableSlots.length,
        slotDuration,
        slotsLoadedForCurrentDate,
      })}
      {/* Date Selection Dropdown */}
      <div>
        <label
          htmlFor="spaDateSelect"
          className="block mb-1 text-sm font-medium text-gray-700"
        >
          {t("extras.spa.selectDate", "Select Date")}
        </label>
        <select
          id="spaDateSelect"
          value={selectedSpaDateString || ""} // Ensure value is never undefined for controlled component
          onChange={handleDateChange} // <-- This should now be correctly defined and called
          disabled={chooseLaterChecked || isLoading || dateOptions.length === 0} // Disable while loading or no options
          className="w-full p-2 pr-8 bg-white bg-right bg-no-repeat border border-gray-300 rounded-md shadow-sm appearance-none focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
          style={{
            backgroundImage: `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" /></svg>')`,
            backgroundPosition: "right 0.5rem center",
            backgroundSize: "1.25em 1.25em",
          }}
        >
          <option value="" disabled={selectedSpaDateString !== ""}>
            {" "}
            {/* Disable default option once a date is picked */}
            {dateOptions.length > 0
              ? t("extras.spa.datePlaceholderDropdown", "-- Select a Date --")
              : t(
                  "extras.spa.datePlaceholderNoDates",
                  "-- No dates available --"
                )}
          </option>
          {dateOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {/* Show message if no date options generated */}
        {dateOptions.length === 0 && !chooseLaterChecked && (
          <p className="mt-1 text-xs text-gray-500">
            {t(
              "extras.spa.checkBookingDates",
              "Ensure booking dates are selected."
            )}
          </p>
        )}
      </div>

      {/* Time Slot Selection Area (conditional) */}
      {selectedSpaDateString &&
        !chooseLaterChecked && ( // Only show if a date is selected and "choose later" is unchecked
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              {t("extras.spa.selectTime", "Select Time Slot")}
              {/* Display duration based on mode */}
              {selectionMode === "double" && (
                <span className="ml-2 text-xs text-gray-500">
                  (
                  {t(
                    "extras.spa.selectTwoSlotsNote",
                    "Select start time for 2 slots"
                  )}
                  )
                </span>
              )}
              {selectionMode === "single" && (
                <span className="ml-2 text-xs text-gray-500">
                  ({t("extras.spa.selectOneSlotNote", "Select 1 time slot")})
                </span>
              )}
            </label>
            {/* Loading, Error, No Slots Messages */}
            {isLoading && (
              <p className="text-sm text-gray-500 animate-pulse">
                {t("loading", "Loading slots...")}
              </p>
            )}
            {error && !isLoading && (
              <p className="p-2 text-sm text-red-600 rounded-md bg-red-50">
                {error}
              </p>
            )}
            {/* Show no slots message only if not loading, no error, no slots, AND slots have been attempted to load for this date */}
            {!isLoading &&
              !error &&
              availableSlots.length === 0 &&
              slotsLoadedForCurrentDate && (
                <p className="p-2 text-sm text-gray-500 rounded-md bg-gray-50">
                  {t("extras.spa.noSlots", "No slots for this date.")}
                </p>
              )}

            {/* Slot Buttons */}
            {/* Only render slots if not loading, no error, slots exist, AND slotDuration is known */}
            {!isLoading &&
              !error &&
              availableSlots.length > 0 &&
              slotDuration && (
                <div className="flex flex-wrap gap-2">
                  {availableSlots.map((slot) => {
                    const isArrivalDaySelected =
                      selectedSpaDateString === arrivalDateString;
                    const isTooEarlyOnArrival =
                      isArrivalDaySelected && slot < ARRIVAL_DAY_START_TIME;
                    let isEnabled = !isTooEarlyOnArrival; // Start enabled unless too early on arrival day
                    let disabledTooltip = isTooEarlyOnArrival
                      ? t(
                          "extras.spa.slotDisabledArrivalTooltip",
                          `From ${ARRIVAL_DAY_START_TIME}`
                        )
                      : "";

                    // Disable based on mode and availability of necessary slots
                    if (isEnabled) {
                      // Only perform further checks if not already disabled by arrival time
                      if (selectionMode === "single") {
                        // In single mode, if the slot is in availableSlots, it's enabled.
                        // This check is already covered by the map iterating over availableSlots.
                      } else {
                        // selectionMode === "double"
                        // In double mode, check if the *next* slot is also available
                        const expectedNextSlot = calculateNextSlotTime(
                          slot,
                          slotDuration
                        );
                        const nextSlotIsAvailable =
                          expectedNextSlot &&
                          availableSlots.includes(expectedNextSlot);
                        if (!nextSlotIsAvailable) {
                          isEnabled = false; // Disable if the second required slot isn't available
                          if (!disabledTooltip)
                            disabledTooltip = t(
                              "extras.spa.slotDisabledNextUnavailableTooltip",
                              "Next slot unavailable"
                            );
                        }
                      }
                    }

                    const isDisabled = !isEnabled; // Final disable state
                    // Check if the slot is currently selected (handles both single and double visually)
                    // Uses the local `selectedSlots` state
                    const isSelected = selectedSlots.includes(slot);

                    return (
                      <button
                        key={slot}
                        type="button"
                        onClick={() => handleSlotSelect(slot)} // Call the handler
                        disabled={isDisabled || isLoading} // Disable while fetching slots too, or if slot is disabled
                        className={`px-3 py-1.5 rounded-md border text-sm font-medium transition-colors duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-1 ${
                          isSelected
                            ? "bg-[#668E73] text-white border-[#5a7d66] ring-[#668E73]" // Selected style
                            : isDisabled
                            ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed" // Disabled style
                            : "bg-white text-gray-700 border-gray-300 hover:border-[#668E73] hover:text-[#668E73]" // Default enabled style
                        }`}
                        title={disabledTooltip} // Tooltip explains why it's disabled
                      >
                        {slot} {/* e.g., "14:00" */}
                      </button>
                    );
                  })}
                </div> // Closing div for flex-wrap gap-2
              )}
            {/* Message if duration is missing (indicates potential API issue) */}
            {!isLoading &&
              !error &&
              availableSlots.length > 0 &&
              !slotDuration && (
                <p className="p-2 text-sm text-orange-600 rounded-md bg-orange-50">
                  {t(
                    "extras.spa.errorDurationMissing",
                    "Slot duration missing from API response."
                  )}
                </p>
              )}
          </div> // Closing div for space-y-2 (Time Slot Selection Area)
        )}

      {/* "Book Later" Option */}
      <div className="pt-3 border-t border-gray-100">
        <label
          htmlFor="chooseLaterSpa"
          className="flex items-center gap-2 cursor-pointer"
        >
          <input
            id="chooseLaterSpa"
            type="checkbox"
            checked={chooseLaterChecked}
            onChange={handleChooseLaterChange} // Call the handler
            className="h-4 w-4 rounded text-[#668E73] focus:ring-[#5a7d66] border-gray-300"
          />
          <span className="text-sm text-gray-700">
            {t("extras.spa.bookLater", "I want to book my time slot later")}
          </span>
        </label>
        {chooseLaterChecked && (
          <p className="pl-6 mt-1 text-xs text-gray-500">
            {t("extras.spa.bookLaterInfo", "Arrange time directly with host.")}
          </p>
        )}
      </div>
    </div> // Closing div for the main component container
  );
};

export default SpaScheduler;
