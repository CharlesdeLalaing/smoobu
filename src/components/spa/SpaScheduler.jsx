// File: src/components/Admin/SpaScheduler.jsx
import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
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

// --- Constants ---
const ARRIVAL_DAY_START_TIME = "14:00"; // Special start time for the arrival day

// --- Helper Functions ---

const formatDateForDisplay = (date, locale = "en-US") => {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
    console.warn("formatDateForDisplay: Invalid date input", date);
    return "";
  }
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
    // Fallback using date-fns format
    return format(date, "EEEE d MMMM yyyy", {
      locale: locale.startsWith("fr") ? fr : undefined,
    });
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
    // Use a fixed arbitrary date to avoid DST issues with just time manipulation
    const today = startOfDay(new Date());
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
        "calculateNextSlotTime: Adding duration crossed day boundary unexpectedly."
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
  minDate, // Expecting Date object or undefined (Booking arrival date - should be memoized by parent)
  maxDate, // Expecting Date object or undefined (Booking departure date - should be memoized by parent)
  appliedCoupon, // Prop received but logic using it for mode selection is removed/hardcoded
}) => {
  const { t, i18n } = useTranslation();
  const currentLocale = i18n.language || "en-US";
  const selectionMode = "double"; // Hardcoded as per requirement

  // State Initialization Helpers (moved outside for clarity, call inside useState)
  const getInitialDateString = (dateTime, preference) => {
    if (dateTime && preference !== "later") {
      try {
        const initialDate = new Date(dateTime);
        return !isNaN(initialDate.getTime())
          ? formatDateForAPI(initialDate)
          : "";
      } catch (e) {
        console.error("Error parsing initialDateTime for date string:", e);
        return "";
      }
    }
    return "";
  };

  const getInitialSlots = (dateTime, preference) => {
    if (dateTime && preference !== "later") {
      try {
        const initialDate = new Date(dateTime);
        if (isNaN(initialDate.getTime())) return [];
        const firstSlotTime = format(initialDate, "HH:mm");
        // In double mode, when initializing, just knowing the start is enough.
        // The fetch validation effect will handle ensuring the second slot is selected if valid.
        return [firstSlotTime];
      } catch (e) {
        console.error("Error parsing initialDateTime for initial slot:", e);
        return [];
      }
    }
    return [];
  };

  // --- State ---
  const [selectedSpaDateString, setSelectedSpaDateString] = useState(
    () => getInitialDateString(initialDateTime, initialPreference) // Use functional initial state
  );
  const [availableSlots, setAvailableSlots] = useState([]);
  const [slotDuration, setSlotDuration] = useState(null);
  const [selectedSlots, setSelectedSlots] = useState(
    () => getInitialSlots(initialDateTime, initialPreference) // Use functional initial state
  );
  const [chooseLaterChecked, setChooseLaterChecked] = useState(
    initialPreference === "later"
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  // Flag to indicate if slots have been loaded (or load attempted) for the currently selected date
  const [slotsLoadedForCurrentDate, setSlotsLoadedForCurrentDate] =
    useState(false);

  // Ref to track mount status (can be useful for effects, though not strictly used in final logic here)
  const isMounted = useRef(false);
  useEffect(() => {
    isMounted.current = true; // Set after the first render cycle
    return () => {
      isMounted.current = false;
    }; // Clean up on unmount
  }, []);

  // --- Memos ---
  // Generate available date options for the dropdown
  const dateOptions = useMemo(() => {
    const options = [];
    // Basic validation for min/max dates
    if (
      !minDate ||
      !maxDate ||
      !(minDate instanceof Date) ||
      !(maxDate instanceof Date) ||
      isNaN(minDate) ||
      isNaN(maxDate) ||
      isBefore(maxDate, minDate)
    ) {
      console.log("SpaScheduler: Invalid min/max dates for dateOptions.", {
        minDate,
        maxDate,
      });
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
    return options;
    // Depend on minDate, maxDate, and locale as they affect the options
  }, [minDate, maxDate, currentLocale]);

  // Get the arrival date formatted for API (needed for the "too early on arrival day" check)
  const arrivalDateString = useMemo(() => {
    return minDate instanceof Date && !isNaN(minDate)
      ? formatDateForAPI(minDate)
      : null;
    // Depend on minDate stability (should be memoized in parent)
  }, [minDate]);

  // --- Effects ---

  // Effect 1: Handles state synchronization when initial props change (initialDateTime, initialPreference)
  useEffect(() => {
    // This effect syncs the component's internal state (selected date, selected slots, checkbox)
    // based on changes to the initialDateTime and initialPreference props passed from the parent.
    // It aims to reflect the parent's desired initial state without fighting user interactions within this component.
    console.log("SpaScheduler Effect [Props Sync]: Running.", {
      initialDateTime,
      initialPreference,
      currentSelectedDate: selectedSpaDateString,
    });

    const isLater = initialPreference === "later";

    // 1. Always sync the 'Choose Later' checkbox state with the prop
    // This ensures the checkbox reflects the official preference from the parent.
    if (chooseLaterChecked !== isLater) {
      console.log(
        "SpaScheduler Effect [Props Sync]: Syncing 'chooseLaterChecked' state to:",
        isLater
      );
      setChooseLaterChecked(isLater);
    }

    // 2. If preference is 'later', ensure slots/availability state is cleared.
    //    This cleans up the UI and state when the parent indicates 'later' preference.
    if (isLater) {
      let changed = false;
      // Clear selected time slots if any exist
      if (selectedSlots.length > 0) {
        setSelectedSlots([]);
        changed = true;
      }
      // Clear the list of available slots if any exist
      if (availableSlots.length > 0) {
        setAvailableSlots([]);
        changed = true;
      }
      // Clear the slot duration if it was set
      if (slotDuration) {
        setSlotDuration(null);
        changed = true;
      }
      // Clear any existing error message
      if (error) {
        setError("");
        changed = true;
      }
      // Resetting the load flag is important if switching to 'later', as slots are no longer relevant/loaded.
      if (slotsLoadedForCurrentDate) {
        setSlotsLoadedForCurrentDate(false);
        changed = true;
      }
      // Ensure loading indicator is off
      if (isLoading) {
        setIsLoading(false);
        changed = true;
      }

      if (changed)
        console.log(
          "SpaScheduler Effect [Props Sync]: Preference is 'later', cleared slot-related state."
        );
      // Do not process initialDateTime if 'later' is active. Exit the effect early.
      return;
    }

    // 3. If preference is NOT 'later', handle the initialDateTime prop
    // This section runs only if the desired state is a specific scheduled time.
    if (initialDateTime) {
      // A specific date/time is provided via props. Attempt to parse and sync.
      try {
        const initialDateObj = new Date(initialDateTime);
        // Validate the date object derived from the prop
        if (!isNaN(initialDateObj.getTime())) {
          // Prop contains a valid date/time
          const newInitialDateAPI = formatDateForAPI(initialDateObj);
          const newInitialSlotString = format(initialDateObj, "HH:mm");

          // *** CORE LOGIC: Check if the DATE part from the prop is different ***
          // from the currently selected date state within this component.
          const dateHasChanged = newInitialDateAPI !== selectedSpaDateString;

          if (dateHasChanged) {
            // Date from prop is different: This implies the parent wants to set a NEW date.
            // Update the internal date state, set the initial slot based on the prop's time,
            // and crucially, mark slots as needing loading for this new date.
            console.log(
              "SpaScheduler Effect [Props Sync]: Date part CHANGED via prop. Updating date, initial slot, and marking slots as NOT loaded.",
              { newDate: newInitialDateAPI, oldDate: selectedSpaDateString }
            );
            setSelectedSpaDateString(newInitialDateAPI);
            // Set only the first slot initially; the fetch effect will validate/add the second if needed
            setSelectedSlots([newInitialSlotString]);
            setSlotsLoadedForCurrentDate(false); // <- This triggers the fetch effect for the new date
            // Clear related state for the new date fetch
            setAvailableSlots([]);
            setSlotDuration(null);
            setError("");
          } else {
            // Date part is the same: The prop update likely reflects a recent user selection *within* this component
            // that was communicated to the parent and then passed back down.
            // We should ensure our local selectedSlots matches the prop's time,
            // but DO NOT reset slotsLoadedForCurrentDate, as this would cause an unnecessary fetch/flicker.
            console.log(
              "SpaScheduler Effect [Props Sync]: Date part SAME via prop. Ensuring local slot matches prop time if needed. Slots remain LOADED.",
              { newInitialSlotString, currentSlots: selectedSlots }
            );

            // Determine the expected slots based on the prop's time and current mode/duration
            // This helps ensure the correct number of slots (e.g., two for 'double' mode) are reflected locally.
            let expectedSlotsBasedOnProp = [newInitialSlotString];
            if (selectionMode === "double" && slotDuration) {
              const nextSlot = calculateNextSlotTime(
                newInitialSlotString,
                slotDuration
              );
              if (nextSlot) {
                expectedSlotsBasedOnProp.push(nextSlot);
              }
            }
            // Only update local state (selectedSlots) if it doesn't already match the expectation from the prop.
            // This avoids unnecessary state updates and re-renders.
            if (
              JSON.stringify(selectedSlots) !==
              JSON.stringify(expectedSlotsBasedOnProp)
            ) {
              console.log(
                "SpaScheduler Effect [Props Sync]: Updating local selectedSlots to match prop time.",
                expectedSlotsBasedOnProp
              );
              setSelectedSlots(expectedSlotsBasedOnProp);
            }
            // *** Crucially, do NOT setSlotsLoadedForCurrentDate(false) here ***
          }
        } else {
          // initialDateTime prop resulted in an Invalid Date
          console.warn(
            "SpaScheduler Effect [Props Sync]: Invalid initialDateTime prop received, ignoring sync for this cycle.",
            initialDateTime
          );
          // We choose not to automatically clear state here if the prop is invalid,
          // as the component might already hold valid user-selected state. Clearing could be disruptive.
          // The parent component should ideally ensure valid props are passed.
        }
      } catch (e) {
        console.error(
          "SpaScheduler Effect [Props Sync]: Error processing initialDateTime prop",
          e
        );
        // Handle potential errors during date parsing or processing. Maybe clear state if error is severe?
      }
    } else {
      // 4. Handle initialDateTime being null/undefined (and preference is NOT 'later')
      // This means the parent is not specifying a particular time slot.
      // *** PREVIOUS BUG FIX: We no longer automatically clear selectedSpaDateString here ***
      // Clearing the date string here would fight with the user's selection via the dropdown (`handleDateChange`).
      // We trust that `handleDateChange` or `handleChooseLaterChange` are responsible for clearing the date string based on user action.
      console.log(
        "SpaScheduler Effect [Props Sync]: initialDateTime is null/undefined and not 'later'. No automatic clearing of selected date based on this prop state alone."
      );

      // Optional Refinement: If the parent *explicitly* sets initialDateTime to null after it previously had a value,
      // maybe we *should* clear the locally selected time slots (`selectedSlots`), while keeping the selected date?
      // This depends on the desired interaction contract with the parent.
      // Example (currently commented out):
      // if (selectedSpaDateString && selectedSlots.length > 0) {
      //     console.log("SpaScheduler Effect [Props Sync]: initialDateTime became null, clearing only selected time slots, keeping date.");
      //     setSelectedSlots([]);
      //     // Do NOT clear selectedSpaDateString or setSlotsLoadedForCurrentDate(false) here.
      // }
    }
    // Dependencies: List props and key state values that influence the synchronization logic.
    // selectedSpaDateString is needed for the date comparison logic.
    // slotDuration is needed for calculating the expected second slot in double mode.
    // chooseLaterChecked gates the main logic branches.
  }, [
    initialDateTime,
    initialPreference,
    selectedSpaDateString,
    selectionMode,
    slotDuration,
    chooseLaterChecked,
  ]); // Keep dependencies focused on what the effect *reads* to make decisions. State setters are stable.

  // Effect 2: Fetches available slots when date changes or 'choose later' is unchecked
  // This effect is primarily gated by the `slotsLoadedForCurrentDate` flag.
  useEffect(() => {
    // Log entry point to trace when this effect's logic is evaluated
    console.log("SpaScheduler Effect [Fetch]: Checking conditions.", {
      selectedSpaDateString,
      chooseLaterChecked,
      slotsLoadedForCurrentDate,
      isLoading,
    });

    // Condition to fetch:
    // 1. A valid date string must be selected.
    // 2. 'Choose Later' must NOT be checked.
    // 3. Slots must NOT have been loaded *yet* for this specific date (`slotsLoadedForCurrentDate` is false).
    // 4. A fetch must NOT already be in progress (`isLoading` is false).
    if (
      selectedSpaDateString &&
      !chooseLaterChecked &&
      !slotsLoadedForCurrentDate && // This flag is the main gatekeeper, set by date changes or prop sync
      !isLoading
    ) {
      console.log(
        "SpaScheduler Effect [Fetch]: ---> Condition MET - Initiating Fetch <---"
      );
      // Set loading state and clear previous data/errors before the API call
      setIsLoading(true);
      setError("");
      setSlotDuration(null);
      setAvailableSlots([]); // Clear old slots before fetch

      const dateString = selectedSpaDateString; // Use the current state value
      const apiUrl = process.env.REACT_APP_API_URL || "http://localhost:3000";
      const apiEndpoint = `${apiUrl}/api/spa/availability`;
      // Determine total duration needed based on mode (API needs total time to find valid start slots)
      const apiRequestDuration = selectionMode === "single" ? 60 : 120;

      // Prepare API parameters
      const apiParams = {
        date: dateString,
        arrival:
          minDate instanceof Date ? formatDateForAPI(minDate) : undefined,
        departure:
          maxDate instanceof Date ? formatDateForAPI(maxDate) : undefined,
        duration: apiRequestDuration, // Pass the required total duration
      };
      // Remove undefined parameters to keep the request clean
      Object.keys(apiParams).forEach(
        (key) => apiParams[key] === undefined && delete apiParams[key]
      );

      console.log("SpaScheduler Effect [Fetch]: Fetching availability", {
        apiEndpoint,
        apiParams,
      });

      // Perform the API request
      axios
        .get(apiEndpoint, { params: apiParams })
        .then((response) => {
          // API call successful
          const fetchedSlots = response.data?.slots || []; // Available start times (HH:mm array)
          const fetchedDuration = response.data?.slotDurationMinutes; // Base duration of one slot (e.g., 60)
          setAvailableSlots(fetchedSlots);
          setSlotDuration(fetchedDuration); // Store the base duration
          console.log("SpaScheduler Effect [Fetch]: Success", {
            fetchedSlots,
            fetchedDuration,
          });

          // --- Post-Fetch Validation of Selection ---
          // After getting fresh availability, check if any locally selected slots
          // (which might have come from `initialDateTime` prop or previous selection) are still valid.
          if (selectedSlots.length > 0 && fetchedDuration) {
            // We have a local selection and a valid slot duration from the API
            const firstSelectedSlotString = selectedSlots[0];
            // Determine what the full selection *should* be based on the first slot and mode
            let expectedSlotsAfterFetch = [firstSelectedSlotString];
            if (selectionMode === "double") {
              const nextSlot = calculateNextSlotTime(
                firstSelectedSlotString,
                fetchedDuration
              );
              // Ensure next slot calculation was successful
              if (nextSlot) expectedSlotsAfterFetch.push(nextSlot);
            }

            // Check if *all* expected slots (e.g., ['14:00', '15:00']) are present in the *fetched* available slots list
            const isSelectionValid = expectedSlotsAfterFetch.every((slot) =>
              fetchedSlots.includes(slot)
            );

            if (isSelectionValid) {
              console.log(
                "SpaScheduler Effect [Fetch]: Existing/Initial selection is VALID after fetch."
              );
              // Ensure local state reflects the potentially calculated second slot correctly.
              if (
                JSON.stringify(selectedSlots) !==
                JSON.stringify(expectedSlotsAfterFetch)
              ) {
                setSelectedSlots(expectedSlotsAfterFetch);
              }
              // If the selection is valid, notify the parent with the complete booking data.
              // Do this only if 'Choose Later' is not checked.
              if (
                !chooseLaterChecked &&
                typeof onScheduleChange === "function"
              ) {
                try {
                  // Construct Date objects for start and end times
                  const datePart = parse(
                    selectedSpaDateString,
                    "yyyy-MM-dd",
                    new Date()
                  );
                  const [h, m] = expectedSlotsAfterFetch[0]
                    .split(":")
                    .map(Number);
                  const startDateTime = new Date(
                    datePart.getFullYear(),
                    datePart.getMonth(),
                    datePart.getDate(),
                    h,
                    m
                  );
                  const totalDurationMinutes =
                    expectedSlotsAfterFetch.length * fetchedDuration;
                  const endDateTime = addMinutes(
                    startDateTime,
                    totalDurationMinutes
                  );
                  // Prepare the data structure expected by the parent
                  const bookingData = {
                    startDateTime,
                    endDateTime,
                    slots: expectedSlotsAfterFetch,
                  };
                  console.log(
                    "SpaScheduler Effect [Fetch]: Notifying parent with validated bookingData:",
                    bookingData
                  );
                  onScheduleChange(bookingData); // Send data to parent
                } catch (e) {
                  console.error(
                    "SpaScheduler Effect [Fetch]: Error preparing booking data for parent notification",
                    e
                  );
                  onScheduleChange(null); // Notify parent of invalid state due to error
                }
              }
            } else {
              // The previously selected slot(s) are no longer available according to the API response.
              console.warn(
                `SpaScheduler Effect [Fetch]: Existing/Initial selection [${selectedSlots.join(
                  ", "
                )}] is NO LONGER VALID based on fetched slots. Clearing.`
              );
              setSelectedSlots([]); // Clear the invalid local selection
              // Notify parent that the previous selection is now invalid (only if not 'later')
              if (
                !chooseLaterChecked &&
                typeof onScheduleChange === "function"
              ) {
                onScheduleChange(null);
              }
            }
          } else if (selectedSlots.length > 0 && !fetchedDuration) {
            // This case indicates an API issue: we had a selection but the API didn't return the slot duration needed for validation/calculation.
            console.warn(
              "SpaScheduler Effect [Fetch]: Had initial selection but slotDuration is missing from API response after fetch. Clearing selection."
            );
            setSelectedSlots([]); // Clear invalid local selection
            // Notify parent of the invalid state (only if not 'later')
            if (!chooseLaterChecked && typeof onScheduleChange === "function") {
              onScheduleChange(null);
            }
          } else {
            // No initial selection existed, or API didn't return duration.
            // Ensure parent state is null if nothing is selected (and not 'later').
            // This notification might be redundant if handlers/prop sync already sent null, but acts as a safeguard.
            if (!chooseLaterChecked && typeof onScheduleChange === "function") {
              // Let's assume parent state is already null if selectedSlots is empty here. Avoid redundant null notification.
              // onScheduleChange(null);
            }
          }
          // --- End Post-Fetch Validation ---

          // Mark slots as loaded *after* processing and validation is complete
          setSlotsLoadedForCurrentDate(true);
        })
        .catch((err) => {
          // Handle API errors
          console.error("SpaScheduler: Error fetching SPA slots:", err);
          // Set user-friendly error message
          let errorMsg = t("extras.spa.errorLoading", "Failed to load slots.");
          if (err.message === "Network Error")
            errorMsg = t("errors.network", "Network error.");
          else if (err.response?.data?.message)
            errorMsg = err.response.data.message; // Use server message if available
          setError(errorMsg);
          // Clear state related to slots on error
          setAvailableSlots([]);
          setSelectedSlots([]); // Clear selection on error
          setSlotDuration(null);
          // Notify parent about the error / lack of valid selection
          if (!chooseLaterChecked && typeof onScheduleChange === "function") {
            console.log(
              "SpaScheduler Effect [Fetch]: Notifying parent (null) due to fetch error."
            );
            onScheduleChange(null);
          }
          // Mark as 'attempted to load' even on error to prevent immediate retry loops for the same date.
          setSlotsLoadedForCurrentDate(true);
        })
        .finally(() => {
          // This block runs whether the promise resolved or rejected
          setIsLoading(false); // Always turn off loading indicator
          console.log(
            "SpaScheduler Effect [Fetch]: Fetch process finished (success or error)."
          );
        });
    } else if (selectedSpaDateString && chooseLaterChecked) {
      // Condition: Date selected BUT 'Choose Later' is checked.
      // No fetch needed. Ensure loading/error/slots state is clear.
      console.log(
        "SpaScheduler Effect [Fetch]: 'Choose Later' checked. Clearing active slots/state if needed."
      );
      let stateChanged = false;
      // Clear any potentially lingering state from previous interactions
      if (availableSlots.length > 0) {
        setAvailableSlots([]);
        stateChanged = true;
      }
      if (slotDuration) {
        setSlotDuration(null);
        stateChanged = true;
      }
      if (error) {
        setError("");
        stateChanged = true;
      }
      if (isLoading) {
        setIsLoading(false);
        stateChanged = true;
      } // Stop loading if it was somehow true
      // Keep selectedSlots cleared (handled by 'Choose Later' handler or prop sync)
      // Reset the loaded flag as slots are not relevant now.
      if (slotsLoadedForCurrentDate) {
        setSlotsLoadedForCurrentDate(false);
        stateChanged = true;
      }

      if (stateChanged)
        console.log(
          "SpaScheduler Effect [Fetch]: Cleared state because 'Choose Later' is checked."
        );
      // Parent notification ('later') is handled by handleChooseLaterChange or prop sync effect.
    } else if (!selectedSpaDateString) {
      // Condition: No date is selected.
      // Clear any active slot/error/loading state.
      console.log(
        "SpaScheduler Effect [Fetch]: No date selected. Clearing active slots/state if needed."
      );
      let stateChanged = false;
      // Clear potentially lingering state
      if (availableSlots.length > 0) {
        setAvailableSlots([]);
        stateChanged = true;
      }
      if (slotDuration) {
        setSlotDuration(null);
        stateChanged = true;
      }
      if (error) {
        setError("");
        stateChanged = true;
      }
      if (isLoading) {
        setIsLoading(false);
        stateChanged = true;
      } // Stop loading if active
      // Ensure the loaded flag is false when no date is selected.
      // Check before setting to avoid unnecessary state updates if already false.
      if (slotsLoadedForCurrentDate) {
        setSlotsLoadedForCurrentDate(false);
        stateChanged = true; // Mark that state changed
      }
      if (stateChanged)
        console.log(
          "SpaScheduler Effect [Fetch]: Cleared state because no date is selected."
        );
      // Keep selectedSlots cleared (handled by handleDateChange or prop sync)
      // Parent notification (null) is handled by handleDateChange or prop sync effect.
    } else {
      // This block logs if the effect ran but none of the main conditions were met
      // (e.g., date selected, not later, but slots *already* loaded).
      console.log(
        "SpaScheduler Effect [Fetch]: Condition NOT MET for fetch (likely slots already loaded or still loading). No fetch action taken."
      );
    }

    // Dependencies: List all external variables (props, state, stable functions/values from hooks)
    // that are read inside this effect. Ensure props passed down are memoized where necessary (minDate, maxDate, onScheduleChange).
  }, [
    selectedSpaDateString,
    chooseLaterChecked,
    slotsLoadedForCurrentDate, // The primary gatekeeper flag
    isLoading, // Prevents concurrent fetches
    selectionMode, // Determines API request duration
    minDate, // Stable prop (useMemo in parent)
    maxDate, // Stable prop (useMemo in parent)
    onScheduleChange, // Stable prop (useCallback in parent hook)
    arrivalDateString, // Stable (derived from memoized minDate)
    t, // Stable (from useTranslation hook)
    // Note: State setters (setIsLoading, setError, etc.) are stable and don't need to be dependencies.
  ]);

  // --- Event Handlers ---

  // Handles change in the date selection dropdown
  const handleDateChange = useCallback(
    (event) => {
      console.log("handleDateChange triggered");
      const newDateString = event.target.value;
      // Update the selected date string state
      setSelectedSpaDateString(newDateString);
      // Reset flags and dependent state because the date context has changed
      setSlotsLoadedForCurrentDate(false); // <-- This is crucial to trigger fetch for the new date
      setSelectedSlots([]); // Clear any previous time selection
      setAvailableSlots([]); // Clear visual slots immediately
      setSlotDuration(null); // Clear duration info
      setError(""); // Clear any previous error message
      // Stop loading indicator if it was active (e.g., user changes date while loading)
      if (isLoading) setIsLoading(false);

      // Notify the parent component immediately that the selection is now invalid/cleared due to the date change.
      // Pass null to indicate no valid time slot is selected.
      if (typeof onScheduleChange === "function") {
        console.log("handleDateChange: Notifying parent with null.");
        onScheduleChange(null);
      }
    },
    [onScheduleChange, isLoading]
  ); // Add isLoading to dependency to use setIsLoading safely

  // Handles clicks on the time slot buttons
  const handleSlotSelect = useCallback(
    (clickedSlot) => {
      console.log("handleSlotSelect called with slot:", clickedSlot);
      // Guard clauses: Ensure necessary data is available before proceeding
      if (!slotDuration || slotDuration <= 0) {
        console.warn(
          "handleSlotSelect: Cannot select slot - slotDuration missing or invalid.",
          { slotDuration }
        );
        if (typeof onScheduleChange === "function") onScheduleChange(null); // Notify parent of invalid state
        return;
      }
      if (!selectedSpaDateString) {
        console.warn(
          "handleSlotSelect: Cannot select slot - selectedSpaDateString missing."
        );
        if (typeof onScheduleChange === "function") onScheduleChange(null); // Notify parent of invalid state
        return;
      }
      // Check arrival day restriction
      const isArrivalDaySelected = selectedSpaDateString === arrivalDateString;
      if (isArrivalDaySelected && clickedSlot < ARRIVAL_DAY_START_TIME) {
        console.warn(
          `handleSlotSelect: Selection prevented on arrival day before ${ARRIVAL_DAY_START_TIME}.`
        );
        // Provide visual feedback (e.g., brief message/toast) is recommended here.
        // Do not change selection or notify parent.
        return;
      }

      // Determine the slots to be selected based on the mode and availability
      let newSelectedSlots = [];
      let isValidSelectionAttempt = false;

      if (selectionMode === "single") {
        // Single slot mode: Only the clicked slot needs to be available
        if (availableSlots.includes(clickedSlot)) {
          newSelectedSlots = [clickedSlot];
          isValidSelectionAttempt = true;
        }
      } else {
        // Double slot mode
        // Calculate the expected time of the second slot
        const nextSlotTime = calculateNextSlotTime(clickedSlot, slotDuration);
        // Both the clicked slot AND the next slot must be in the available list
        if (
          nextSlotTime &&
          availableSlots.includes(clickedSlot) &&
          availableSlots.includes(nextSlotTime)
        ) {
          newSelectedSlots = [clickedSlot, nextSlotTime]; // Select both
          isValidSelectionAttempt = true;
        } else {
          // Log why selection failed (e.g., clicked available, next isn't, or vice-versa)
          console.warn(
            `SpaScheduler: Cannot select double slot starting at ${clickedSlot}. Clicked available: ${availableSlots.includes(
              clickedSlot
            )}, Next (${nextSlotTime}) available: ${
              nextSlotTime && availableSlots.includes(nextSlotTime)
            }`
          );
          // Provide user feedback (e.g., visual cue on the button) is recommended.
        }
      }

      // If the selection attempt was valid (found the required available slot(s))
      if (isValidSelectionAttempt && newSelectedSlots.length > 0) {
        console.log(
          "handleSlotSelect: Valid selection attempt",
          newSelectedSlots
        );
        // Update local state IMMEDIATELY to provide responsive UI feedback
        setSelectedSlots(newSelectedSlots);

        // Prepare data structure and notify the parent component
        try {
          // Parse the selected date string back into a Date object part
          const datePart = parse(
            selectedSpaDateString,
            "yyyy-MM-dd",
            new Date()
          );
          // Get hours/minutes from the *first* selected slot string
          const [h, m] = newSelectedSlots[0].split(":").map(Number);
          // Create the start DateTime object
          const startDateTime = new Date(
            datePart.getFullYear(),
            datePart.getMonth(),
            datePart.getDate(),
            h,
            m
          );
          // Calculate the total duration based on number of slots selected and base duration
          const totalDurationMinutes = newSelectedSlots.length * slotDuration;
          // Calculate the end DateTime object
          const endDateTime = addMinutes(startDateTime, totalDurationMinutes);

          // Prepare the booking data object for the parent
          const bookingData = {
            startDateTime,
            endDateTime,
            slots: newSelectedSlots,
          };
          console.log(
            "handleSlotSelect: Notifying parent with bookingData:",
            bookingData
          );
          // Call the parent's handler function if provided
          if (typeof onScheduleChange === "function") {
            onScheduleChange(bookingData);
          }
        } catch (e) {
          // Handle errors during date/time object creation
          console.error(
            "SpaScheduler: Error creating bookingData object for parent:",
            e
          );
          // Clear local state as it led to an error
          setSelectedSlots([]);
          // Notify parent of the error/invalid state
          if (typeof onScheduleChange === "function") {
            onScheduleChange(null);
          }
        }
      } else {
        // If selection attempt was invalid (e.g., clicked unavailable/disabled slot or pair)
        // Usually, do nothing to the current state. The button was likely visually disabled,
        // or if clickable, the availability check failed. Don't clear a previously valid selection.
        console.log(
          "handleSlotSelect: Invalid selection attempt (likely clicked disabled or unavailable slot/pair). No state change."
        );
        // Do NOT clear selectedSlots here unless implementing specific deselect logic.
        // Do NOT notify parent with null, as the previous valid state (if any) should persist.
      }
    },
    [
      selectedSpaDateString,
      onScheduleChange,
      availableSlots,
      slotDuration,
      arrivalDateString,
      selectionMode, // Include all dependencies read inside the callback
    ]
  );

  // Handles change in the "Book Later" checkbox
  const handleChooseLaterChange = useCallback(
    (e) => {
      console.log("handleChooseLaterChange triggered", e.target.checked);
      const isChecked = e.target.checked;
      // Update local checkbox state immediately
      setChooseLaterChecked(isChecked);

      if (!isChecked) {
        // ---- UNCHECKING 'Choose Later' ----
        console.log(
          "handleChooseLaterChange: Unchecked 'Choose Later'. Resetting flags/state."
        );
        // Reset flag to allow the fetch effect to run if a date is selected
        setSlotsLoadedForCurrentDate(false);
        // Clear any previous time selection/error immediately for cleaner UI transition
        setSelectedSlots([]);
        setAvailableSlots([]);
        setSlotDuration(null);
        setError("");
        // Stop loading if it was active
        if (isLoading) setIsLoading(false);
        // Let the fetch effect handle notifying the parent (with null or bookingData)
        // based on whether a date is selected and the fetch outcome.
        // Avoid sending premature 'null' notification here.
      } else {
        // ---- CHECKING 'Choose Later' ----
        console.log(
          "handleChooseLaterChange: Checked 'Choose Later'. Clearing state and notifying parent."
        );
        // Clear all local state related to specific time slots
        setSelectedSlots([]);
        setAvailableSlots([]);
        setSlotDuration(null);
        setError("");
        setSlotsLoadedForCurrentDate(false); // Reset flag as slots are no longer relevant
        // Ensure loading indicator is off
        if (isLoading) setIsLoading(false);

        // Notify parent component immediately that the preference is now 'later'
        if (typeof onScheduleChange === "function") {
          onScheduleChange("later");
        }
      }
    },
    [onScheduleChange, isLoading]
  ); // Add isLoading dependency

  // --- JSX Rendering ---
  return (
    <div className="p-3 space-y-4 bg-white border border-gray-200 rounded-md">
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
          value={selectedSpaDateString || ""} // Ensure controlled component has a valid value
          onChange={handleDateChange} // Attach the handler
          // Disable dropdown if 'choose later' is checked, while loading, or if no date options exist
          disabled={chooseLaterChecked || isLoading || dateOptions.length === 0}
          // Standard styling + custom dropdown arrow
          className="w-full p-2 pr-8 bg-white bg-right bg-no-repeat border border-gray-300 rounded-md shadow-sm appearance-none focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
          style={{
            backgroundImage: `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" /></svg>')`,
            backgroundPosition: "right 0.5rem center",
            backgroundSize: "1.25em 1.25em",
          }}
        >
          {/* Default placeholder option */}
          <option value="" disabled={selectedSpaDateString !== ""}>
            {" "}
            {/* Disable placeholder once a date is picked */}
            {dateOptions.length > 0
              ? t("extras.spa.datePlaceholderDropdown", "-- Select a Date --")
              : t(
                  "extras.spa.datePlaceholderNoDates",
                  "-- No dates available --"
                )}
          </option>
          {/* Map generated date options */}
          {dateOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {/* Message if no date options were generated (and not choosing later) */}
        {dateOptions.length === 0 && !chooseLaterChecked && (
          <p className="mt-1 text-xs text-gray-500">
            {t(
              "extras.spa.checkBookingDates",
              "Ensure booking dates are selected."
            )}
          </p>
        )}
      </div>

      {/* Time Slot Selection Area (Conditionally Rendered) */}
      {/* Show only if a date is selected AND 'choose later' is NOT checked */}
      {selectedSpaDateString && !chooseLaterChecked && (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            {t("extras.spa.selectTime", "Select Time Slot")}
            {/* Add mode-specific instruction */}
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
            {/* Add similar note for single mode if it were possible */}
          </label>

          {/* Loading Indicator */}
          {isLoading && (
            <p className="text-sm text-gray-500 animate-pulse">
              {t("loading", "Loading slots...")}
            </p>
          )}

          {/* Error Message Display */}
          {error &&
            !isLoading && ( // Show only if error exists and not currently loading
              <p className="p-2 text-sm text-red-600 rounded-md bg-red-50">
                {error}
              </p>
            )}

          {/* "No Slots Available" Message */}
          {/* Show only if NOT loading, NO error, fetched slots ARE empty, AND load attempt finished */}
          {!isLoading &&
            !error &&
            availableSlots.length === 0 &&
            slotsLoadedForCurrentDate && (
              <p className="p-2 text-sm text-gray-500 rounded-md bg-gray-50">
                {t("extras.spa.noSlots", "No slots available for this date.")}
              </p>
            )}

          {/* "Missing Duration" Message (Indicates potential API issue) */}
          {/* Show if NOT loading, NO error, slots EXIST, but duration is MISSING, AND load attempt finished */}
          {!isLoading &&
            !error &&
            availableSlots.length > 0 &&
            !slotDuration &&
            slotsLoadedForCurrentDate && (
              <p className="p-2 text-sm text-orange-600 rounded-md bg-orange-50">
                {t(
                  "extras.spa.errorDurationMissing",
                  "Slot duration missing from API response."
                )}
              </p>
            )}

          {/* Slot Buttons Container */}
          {/* Render only if NOT loading, NO error, slots EXIST, AND duration is KNOWN */}
          {!isLoading &&
            !error &&
            availableSlots.length > 0 &&
            slotDuration && (
              <div className="flex flex-wrap gap-2">
                {/* Map over the available slot times fetched from the API */}
                {availableSlots.map((slot) => {
                  // Determine if the button for this slot should be disabled
                  const isArrival = selectedSpaDateString === arrivalDateString;
                  const isTooEarly = isArrival && slot < ARRIVAL_DAY_START_TIME;
                  let isClickable = !isTooEarly; // Start by assuming clickable unless too early
                  let disabledTooltip = isTooEarly
                    ? t(
                        "extras.spa.slotDisabledArrivalTooltip",
                        `From ${ARRIVAL_DAY_START_TIME}`
                      )
                    : "";

                  // Additional check for double mode: disable if the *next* required slot isn't available
                  if (isClickable && selectionMode === "double") {
                    const nextSlot = calculateNextSlotTime(slot, slotDuration);
                    // If next slot cannot be calculated OR is not in the available list, disable this button
                    if (!nextSlot || !availableSlots.includes(nextSlot)) {
                      isClickable = false;
                      // Set tooltip only if not already set by arrival time rule
                      if (!disabledTooltip)
                        disabledTooltip = t(
                          "extras.spa.slotDisabledNextUnavailableTooltip",
                          "Next slot unavailable"
                        );
                    }
                  }

                  const isDisabled = !isClickable; // Final disabled state
                  // Check if this slot is part of the currently selected slots array
                  const isSelected = selectedSlots.includes(slot);

                  return (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => handleSlotSelect(slot)} // Call handler on click
                      disabled={isDisabled || isLoading} // Disable based on calculated state OR if loading globally
                      // Dynamic classes for styling based on selected/disabled/default states
                      className={`px-3 py-1.5 rounded-md border text-sm font-medium transition-colors duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-1 ${
                        isSelected
                          ? "bg-[#668E73] text-white border-[#5a7d66] ring-[#668E73]" // Selected style
                          : isDisabled
                          ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed" // Disabled style
                          : "bg-white text-gray-700 border-gray-300 hover:border-[#668E73] hover:text-[#668E73]" // Default enabled style
                      }`}
                      title={disabledTooltip} // Add tooltip explaining why it might be disabled
                    >
                      {slot} {/* Display the slot time e.g., "14:00" */}
                    </button>
                  );
                })}
              </div> // End flex-wrap container
            )}
        </div> // End conditional time slot area
      )}

      {/* "Book Later" Option Section */}
      <div className="pt-3 border-t border-gray-100">
        {" "}
        {/* Add top border for separation */}
        <label
          htmlFor="chooseLaterSpa"
          className="flex items-center gap-2 cursor-pointer"
        >
          <input
            id="chooseLaterSpa"
            type="checkbox"
            checked={chooseLaterChecked} // Controlled by state
            onChange={handleChooseLaterChange} // Attach handler
            className="h-4 w-4 rounded text-[#668E73] focus:ring-[#5a7d66] border-gray-300"
          />
          <span className="text-sm text-gray-700">
            {t("extras.spa.bookLater", "I want to book my time slot later")}
          </span>
        </label>
        {/* Informational text shown only when the checkbox is checked */}
        {chooseLaterChecked && (
          <p className="pl-6 mt-1 text-xs text-gray-500">
            {t("extras.spa.bookLaterInfo", "Arrange time directly with host.")}
          </p>
        )}
      </div>
    </div> // Closing main component div
  );
};

export default SpaScheduler;
