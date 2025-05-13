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
import { fr } from "date-fns/locale"; 



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
        "calculateNextSlotTime: Adding duration crossed day boundary unexpectedly for a non-midnight end."
      );
      // For SPA, crossing midnight usually means the slot is invalid unless it's exactly ending at 00:00
      // and the effectiveEndTime allows it. For simplicity here, if it's not 00:00, consider it problematic for pairing.
      // However, the main check is whether this `format(nextDate, "HH:mm")` exists in availableSlots.
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
  maxDate,
  spaSettings, // Expecting Date object or undefined (Booking departure date - should be memoized by parent)
}) => {
  const { t, i18n } = useTranslation();
  const currentLocale = i18n.language || "en-US";
  const selectionMode = "double"; // Hardcoded as per requirement
  const arrivalDayEffectiveStartTime = spaSettings?.startTime || "14:00"; 

  // State Initialization Helpers
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
        // For initial slots, just set the first one. The fetch effect will validate/complete the pair.
        return [format(initialDate, "HH:mm")];
      } catch (e) {
        console.error("Error parsing initialDateTime for initial slot:", e);
        return [];
      }
    }
    return [];
  };

  // --- State ---
  const [selectedSpaDateString, setSelectedSpaDateString] = useState(() =>
    getInitialDateString(initialDateTime, initialPreference)
  );
  // 'availableSlots' now stores ALL INDIVIDUAL open slots from the API response.
  const [availableSlots, setAvailableSlots] = useState([]);
  const [slotDuration, setSlotDuration] = useState(null); // Base duration of ONE slot from API
  const [selectedSlots, setSelectedSlots] = useState(() =>
    getInitialSlots(initialDateTime, initialPreference)
  );
  const [chooseLaterChecked, setChooseLaterChecked] = useState(
    initialPreference === "later"
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [slotsLoadedForCurrentDate, setSlotsLoadedForCurrentDate] =
    useState(false);

  const isMounted = useRef(false);
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  // --- Memos ---
  const dateOptions = useMemo(() => {
    const options = [];
    if (
      !minDate ||
      !maxDate ||
      !(minDate instanceof Date) ||
      !(maxDate instanceof Date) ||
      isNaN(minDate) ||
      isNaN(maxDate) ||
      isBefore(maxDate, minDate)
    ) {
      return options;
    }
    let currentDate = startOfDay(minDate);
    const lastDate = startOfDay(maxDate);
    while (isBefore(currentDate, lastDate) || isEqual(currentDate, lastDate)) {
      options.push({
        value: formatDateForAPI(currentDate),
        label: formatDateForDisplay(currentDate, currentLocale),
      });
      currentDate = addDays(currentDate, 1);
    }
    return options;
  }, [minDate, maxDate, currentLocale]);

  const arrivalDateString = useMemo(() => {
    return minDate instanceof Date && !isNaN(minDate)
      ? formatDateForAPI(minDate)
      : null;
  }, [minDate]);

  // --- Effects ---

  // Effect 1: Handles state synchronization when initial props change
  useEffect(() => {
    console.log("SpaScheduler Effect [Props Sync]: Running.", {
      initialDateTime,
      initialPreference,
      currentSelectedDate: selectedSpaDateString,
    });
    const isLater = initialPreference === "later";
    if (chooseLaterChecked !== isLater) setChooseLaterChecked(isLater);

    if (isLater) {
      if (selectedSlots.length > 0) setSelectedSlots([]);
      if (availableSlots.length > 0) setAvailableSlots([]);
      if (slotDuration) setSlotDuration(null);
      if (error) setError("");
      if (slotsLoadedForCurrentDate) setSlotsLoadedForCurrentDate(false);
      if (isLoading) setIsLoading(false);
      return;
    }

    if (initialDateTime) {
      try {
        const initialDateObj = new Date(initialDateTime);
        if (!isNaN(initialDateObj.getTime())) {
          const newInitialDateAPI = formatDateForAPI(initialDateObj);
          const newInitialSlotString = format(initialDateObj, "HH:mm");
          const dateHasChanged = newInitialDateAPI !== selectedSpaDateString;

          if (dateHasChanged) {
            setSelectedSpaDateString(newInitialDateAPI);
            setSelectedSlots([newInitialSlotString]);
            setSlotsLoadedForCurrentDate(false);
            setAvailableSlots([]);
            setSlotDuration(null);
            setError("");
          } else {
            let expectedSlotsBasedOnProp = [newInitialSlotString];
            // slotDuration might be null if slots for this date haven't been fetched yet
            if (selectionMode === "double" && slotDuration) {
              const nextSlot = calculateNextSlotTime(
                newInitialSlotString,
                slotDuration
              );
              if (nextSlot) expectedSlotsBasedOnProp.push(nextSlot);
            }
            // Only update if differs, to prevent re-render loops if prop confirms local state
            if (
              JSON.stringify(selectedSlots) !==
              JSON.stringify(expectedSlotsBasedOnProp)
            ) {
              setSelectedSlots(expectedSlotsBasedOnProp);
            }
          }
        }
      } catch (e) {
        console.error(
          "SpaScheduler Effect [Props Sync]: Error processing initialDateTime",
          e
        );
      }
    }
  }, [
    initialDateTime,
    initialPreference,
    selectedSpaDateString,
    selectionMode,
    slotDuration,
    chooseLaterChecked,
  ]); // slotDuration is needed here

  // Effect 2: Fetches available slots
  useEffect(() => {
    console.log("SpaScheduler Effect [Fetch]: Checking conditions.", {
      selectedSpaDateString,
      chooseLaterChecked,
      slotsLoadedForCurrentDate,
      isLoading,
    });

    if (
      selectedSpaDateString &&
      !chooseLaterChecked &&
      !slotsLoadedForCurrentDate &&
      !isLoading
    ) {
      setIsLoading(true);
      setError("");
      setSlotDuration(null);
      setAvailableSlots([]); // Clear previous slots before new fetch

      const dateString = selectedSpaDateString;
      const apiUrl = process.env.REACT_APP_API_URL || "http://localhost:3000";
      const apiEndpoint = `${apiUrl}/api/spa/availability`;
      const apiParams = {
        date: dateString,
        arrival:
          minDate instanceof Date ? formatDateForAPI(minDate) : undefined,
        departure:
          maxDate instanceof Date ? formatDateForAPI(maxDate) : undefined,
      };
      Object.keys(apiParams).forEach(
        (key) => apiParams[key] === undefined && delete apiParams[key]
      );

      console.log("SpaScheduler Effect [Fetch]: Fetching availability", {
        apiEndpoint,
        apiParams,
      });
      axios
        .get(apiEndpoint, { params: apiParams })
        .then((response) => {
          const allIndividualOpenSlotsFromAPI =
            response.data?.availableSlots || [];
          const baseSlotDurationFromAPI = response.data?.slotDurationMinutes;
          const isDayClosedByAPI = response.data?.isClosed || false;

          setSlotDuration(baseSlotDurationFromAPI);
          console.log("SpaScheduler Effect [Fetch]: API Success", {
            allIndividualOpenSlotsFromAPI,
            baseSlotDurationFromAPI,
            isDayClosedByAPI,
          });

          if (isDayClosedByAPI) {
            console.log(
              "SpaScheduler Effect [Fetch]: Day is marked closed by API."
            );
            setAvailableSlots([]);
          } else if (
            baseSlotDurationFromAPI &&
            allIndividualOpenSlotsFromAPI.length > 0
          ) {
            setAvailableSlots(allIndividualOpenSlotsFromAPI);
            console.log(
              "SpaScheduler Effect [Fetch]: Stored all individual open slots:",
              allIndividualOpenSlotsFromAPI
            );

            // Post-Fetch Validation of any existing `selectedSlots`
            if (selectedSlots.length > 0 && baseSlotDurationFromAPI) {
              const firstSelectedSlotString = selectedSlots[0];
              let expectedFullSelection = [firstSelectedSlotString]; // Start with the first selected slot
              let isCurrentSelectionStillValid =
                allIndividualOpenSlotsFromAPI.includes(firstSelectedSlotString);

              if (selectionMode === "double") {
                const secondSlotCandidate = calculateNextSlotTime(
                  firstSelectedSlotString,
                  baseSlotDurationFromAPI
                );
                if (
                  secondSlotCandidate &&
                  allIndividualOpenSlotsFromAPI.includes(secondSlotCandidate)
                ) {
                  expectedFullSelection.push(secondSlotCandidate);
                } else {
                  isCurrentSelectionStillValid = false; // The pair is not complete/valid
                }
              }
              // If !isCurrentSelectionStillValid at this point, it means either the first slot wasn't available,
              // or (for double mode) its pair wasn't.

              if (isCurrentSelectionStillValid) {
                if (
                  JSON.stringify(selectedSlots) !==
                  JSON.stringify(expectedFullSelection)
                ) {
                  setSelectedSlots(expectedFullSelection); // Sync local `selectedSlots` to the full valid pair
                }
                if (
                  !chooseLaterChecked &&
                  typeof onScheduleChange === "function"
                ) {
                  try {
                    const datePart = parse(
                      selectedSpaDateString,
                      "yyyy-MM-dd",
                      new Date()
                    );
                    const [h, m] = expectedFullSelection[0]
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
                      expectedFullSelection.length * baseSlotDurationFromAPI;
                    const endDateTime = addMinutes(
                      startDateTime,
                      totalDurationMinutes
                    );
                    onScheduleChange({
                      startDateTime,
                      endDateTime,
                      slots: expectedFullSelection,
                    });
                  } catch (e) {
                    onScheduleChange(null);
                  }
                }
              } else {
                console.warn(
                  `SpaScheduler Effect [Fetch]: Existing selection [${selectedSlots.join(
                    ", "
                  )}] NO LONGER VALID. Clearing.`
                );
                setSelectedSlots([]);
                if (
                  !chooseLaterChecked &&
                  typeof onScheduleChange === "function"
                )
                  onScheduleChange(null);
              }
            }
          } else if (
            !baseSlotDurationFromAPI &&
            allIndividualOpenSlotsFromAPI.length > 0
          ) {
            setError(
              t(
                "extras.spa.errorDurationMissing",
                "Slot duration missing from API."
              )
            );
            if (!chooseLaterChecked && typeof onScheduleChange === "function")
              onScheduleChange(null);
          } else {
            console.log(
              "SpaScheduler Effect [Fetch]: No open slots found or missing duration from API."
            );
          }
          setSlotsLoadedForCurrentDate(true);
        })
        .catch((err) => {
          console.error("SpaScheduler: Error fetching SPA slots:", err);
          let errorMsg = t("extras.spa.errorLoading", "Failed to load slots.");
          if (err.message === "Network Error")
            errorMsg = t("errors.network", "Network error.");
          else if (err.response?.data?.message)
            errorMsg = err.response.data.message;
          setError(errorMsg);
          setAvailableSlots([]);
          setSelectedSlots([]);
          setSlotDuration(null);
          if (!chooseLaterChecked && typeof onScheduleChange === "function")
            onScheduleChange(null);
          setSlotsLoadedForCurrentDate(true);
        })
        .finally(() => setIsLoading(false));
    } else if (selectedSpaDateString && chooseLaterChecked) {
      if (availableSlots.length > 0) setAvailableSlots([]);
      if (slotDuration) setSlotDuration(null);
      if (error) setError("");
      if (isLoading) setIsLoading(false);
      if (slotsLoadedForCurrentDate) setSlotsLoadedForCurrentDate(false);
    } else if (!selectedSpaDateString) {
      if (availableSlots.length > 0) setAvailableSlots([]);
      if (slotDuration) setSlotDuration(null);
      if (error) setError("");
      if (isLoading) setIsLoading(false);
      if (slotsLoadedForCurrentDate) setSlotsLoadedForCurrentDate(false);
    }
  }, [
    selectedSpaDateString,
    chooseLaterChecked,
    slotsLoadedForCurrentDate,
    isLoading,
    selectionMode,
    minDate,
    maxDate,
    onScheduleChange,
    t,
  ]);

  const handleDateChange = useCallback(
    (event) => {
      const newDateString = event.target.value;
      setSelectedSpaDateString(newDateString);
      setSlotsLoadedForCurrentDate(false);
      setSelectedSlots([]);
      setAvailableSlots([]);
      setSlotDuration(null);
      setError("");
      if (isLoading) setIsLoading(false);
      if (typeof onScheduleChange === "function") onScheduleChange(null);
    },
    [onScheduleChange, isLoading]
  );

  const handleSlotSelect = useCallback(
    (clickedSlot) => {
      if (!slotDuration || slotDuration <= 0 || !selectedSpaDateString) {
        if (typeof onScheduleChange === "function") onScheduleChange(null);
        return;
      }
      const isArrivalDaySelected = selectedSpaDateString === arrivalDateString;
      // VVVV CORRECTED LINE VVVV
      if (isArrivalDaySelected && clickedSlot < arrivalDayEffectiveStartTime) {
        console.warn(
          // VVVV CORRECTED LOG MESSAGE VVVV
          `SpaScheduler: Selection prevented on arrival day before ${arrivalDayEffectiveStartTime}.`
        );
        return;
      }

      if (!availableSlots.includes(clickedSlot)) {
        console.warn(
          "handleSlotSelect: Clicked slot is not in the master list of available slots. This is unexpected if button wasn't disabled."
        );
        return;
      }

      let newSelectedSlots = [];
      let isValidPair = false;

      if (selectionMode === "single") {
        newSelectedSlots = [clickedSlot];
        isValidPair = true;
      } else {
        const nextSlotTime = calculateNextSlotTime(clickedSlot, slotDuration);
        if (nextSlotTime && availableSlots.includes(nextSlotTime)) {
          newSelectedSlots = [clickedSlot, nextSlotTime];
          isValidPair = true;
        } else {
          console.warn(
            `SpaScheduler: Cannot form a double slot. Clicked: ${clickedSlot}, calculated next: ${nextSlotTime}, next available: ${
              nextSlotTime && availableSlots.includes(nextSlotTime)
            }`
          );
          return;
        }
      }

      setSelectedSlots(newSelectedSlots);
      try {
        const datePart = parse(selectedSpaDateString, "yyyy-MM-dd", new Date());
        const [h, m] = newSelectedSlots[0].split(":").map(Number);
        const startDateTime = new Date(
          datePart.getFullYear(),
          datePart.getMonth(),
          datePart.getDate(),
          h,
          m
        );
        const totalDurationMinutes = newSelectedSlots.length * slotDuration;
        const endDateTime = addMinutes(startDateTime, totalDurationMinutes);
        const bookingData = {
          startDateTime,
          endDateTime,
          slots: newSelectedSlots,
        };
        if (typeof onScheduleChange === "function")
          onScheduleChange(bookingData);
      } catch (e) {
        console.error(
          "SpaScheduler handleSlotSelect: Error creating bookingData",
          e
        );
        setSelectedSlots([]);
        if (typeof onScheduleChange === "function") onScheduleChange(null);
      }
    },
    [
      selectedSpaDateString,
      onScheduleChange,
      availableSlots,
      slotDuration,
      arrivalDateString,
      selectionMode,
      arrivalDayEffectiveStartTime, // Ensure this is in the dependency array
    ]
  );

  const handleChooseLaterChange = useCallback(
    (e) => {
      const isChecked = e.target.checked;
      setChooseLaterChecked(isChecked);

      if (!isChecked) {
        // WHEN UNCHECKING
        console.log("SpaScheduler: Unchecked 'Choose Later'");
        setSlotsLoadedForCurrentDate(false); // This will trigger the fetch effect if a date is selected
        setSelectedSlots([]);
        setAvailableSlots([]); // Clear visual slots immediately
        setSlotDuration(null);
        setError("");
        if (isLoading) setIsLoading(false); // Stop any ongoing load

        // Notify parent that preference is no longer 'later' and no slot is selected yet.
        // The fetch effect will handle sending actual slot data if a selection is made/validated.
        if (typeof onScheduleChange === "function") {
          onScheduleChange(null);
        }
      } else {
        // WHEN CHECKING
        console.log("SpaScheduler: Checked 'Choose Later'");
        // Clear all local state related to specific time slots
        setSelectedSlots([]);
        setAvailableSlots([]);
        setSlotDuration(null);
        setError("");
        setSlotsLoadedForCurrentDate(false); // Slots are not relevant when 'later'
        if (isLoading) setIsLoading(false);

        // Notify parent component immediately that the preference is now 'later'
        if (typeof onScheduleChange === "function") {
          onScheduleChange("later");
        }
      }
    },
    [onScheduleChange, isLoading] // isLoading dependency is good here
  );

  return (
    <div className="p-3 space-y-4 bg-white border border-gray-200 rounded-md">
      <div>
        <label
          htmlFor="spaDateSelect"
          className="block mb-1 text-sm font-medium text-gray-700"
        >
          {t("extras.spa.selectDate", "Select Date")}
        </label>
        <select
          id="spaDateSelect"
          value={selectedSpaDateString || ""}
          onChange={handleDateChange}
          disabled={chooseLaterChecked || isLoading || dateOptions.length === 0}
          className="w-full p-2 pr-8 bg-white bg-right bg-no-repeat border border-gray-300 rounded-md shadow-sm appearance-none focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
          style={{
            backgroundImage: `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" /></svg>')`,
            backgroundPosition: "right 0.5rem center",
            backgroundSize: "1.25em 1.25em",
          }}
        >
          <option value="" disabled={selectedSpaDateString !== ""}>
            {dateOptions.length > 0
              ? t("extras.spa.datePlaceholderDropdown",)
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
        {dateOptions.length === 0 && !chooseLaterChecked && (
          <p className="mt-1 text-xs text-gray-500">
            {t(
              "extras.spa.checkBookingDates",
              "Ensure booking dates are selected."
            )}
          </p>
        )}
      </div>

      {selectedSpaDateString && !chooseLaterChecked && (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            {t("extras.spa.selectTime", "Select Time Slot")}
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
          </label>

          {isLoading && (
            <p className="text-sm text-gray-500 animate-pulse">
              {t("extras.spa.loading", "Loading slots...")}
            </p>
          )}

          {error && !isLoading && (
            <p className="p-2 text-sm text-red-600 rounded-md bg-red-50">
              {error}
            </p>
          )}

          {!isLoading &&
            !error &&
            availableSlots.length === 0 &&
            slotsLoadedForCurrentDate && (
              <p className="p-2 text-sm text-gray-500 rounded-md bg-gray-50">
                {t("extras.spa.noSlots", "No slots available for this date.")}
              </p>
            )}

          {!isLoading &&
            !error &&
            availableSlots.length > 0 &&
            !slotDuration &&
            slotsLoadedForCurrentDate && (
              <p className="p-2 text-sm text-orange-600 rounded-md bg-orange-50">
                {t(
                  "extras.spa.errorDurationMissing",
                  "Slot duration missing from API."
                )}
              </p>
            )}

          {!isLoading &&
            !error &&
            availableSlots.length > 0 &&
            slotDuration && (
              <div className="flex flex-wrap gap-2">
                {/* Iterate over ALL individual open slots to render buttons */}
                {availableSlots.map((slot1) => {
                  const isArrival = selectedSpaDateString === arrivalDateString;
                  const isTooEarlyOnArrival =
                    isArrival && slot1 < arrivalDayEffectiveStartTime;

                  let canBeValidStart = true;
                  let disabledTooltip = "";

                  if (isTooEarlyOnArrival) {
                    canBeValidStart = false;
                    disabledTooltip = t(
                      "extras.spa.slotDisabledArrivalTooltip",
                      `From ${arrivalDayEffectiveStartTime}`
                    );
                  }

                  // For double mode, check if this slot1 can start a valid pair
                  if (canBeValidStart && selectionMode === "double") {
                    const slot2 = calculateNextSlotTime(slot1, slotDuration);
                    // The pair is valid if slot2 can be calculated AND slot2 is in the master list of available slots
                    if (!slot2 || !availableSlots.includes(slot2)) {
                      canBeValidStart = false;
                      if (!disabledTooltip) {
                        // Don't overwrite arrival tooltip
                        disabledTooltip = t(
                          "extras.spa.slotDisabledNextUnavailableTooltip",
                          "Next slot for pair unavailable"
                        );
                      }
                    }
                  }

                  const isDisabled = !canBeValidStart || isLoading; // Disable if not a valid start or globally loading
                  const isSelected = selectedSlots.includes(slot1);

                  return (
                    <button
                      key={slot1}
                      type="button"
                      onClick={() => handleSlotSelect(slot1)}
                      disabled={isDisabled}
                      className={`px-3 py-1.5 rounded-md border text-sm font-medium transition-colors duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-1 ${
                        isSelected
                          ? "bg-[#668E73] text-white border-[#5a7d66] ring-[#668E73]"
                          : isDisabled
                          ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                          : "bg-white text-gray-700 border-gray-300 hover:border-[#668E73] hover:text-[#668E73]"
                      }`}
                      title={disabledTooltip}
                    >
                      {slot1}
                    </button>
                  );
                })}
              </div>
            )}
        </div>
      )}

      <div className="pt-3 border-t border-gray-100">
        <label
          htmlFor="chooseLaterSpa"
          className="flex items-center gap-2 cursor-pointer"
        >
          <input
            id="chooseLaterSpa"
            type="checkbox"
            checked={chooseLaterChecked}
            onChange={handleChooseLaterChange}
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
    </div>
  );
};

export default SpaScheduler;
