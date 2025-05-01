import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import axios from "axios"; // Or use fetch
// Import necessary date-fns functions
import {
  format,
  parse,
  startOfDay,
  isEqual,
  addDays,
  isBefore,
  addMinutes,
} from "date-fns";

// --- Constants ---
const ARRIVAL_DAY_START_TIME = "15:00"; // Special start time for the arrival day

// --- Helper Functions ---

// Format Date for display in dropdown (e.g., "Lundi 15 août 2024")
const formatDateForDisplay = (date, locale = "en-US") => {
  if (!date) return "";
  // Example locales: 'en-US', 'fr-BE', 'nl-BE'
  return date.toLocaleDateString(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long", // Added weekday for context
  });
};

// Format Date for API value (YYYY-MM-DD)
const formatDateForAPI = (date) => {
  if (!date) return "";
  return format(date, "yyyy-MM-dd");
};

// Calculate next slot time string based on duration
const calculateNextSlotTime = (startTimeString, durationMinutes) => {
  if (!startTimeString || !durationMinutes || durationMinutes <= 0) return null;
  try {
    const [hours, minutes] = startTimeString.split(":").map(Number);
    const tempDate = new Date(2000, 0, 1, hours, minutes); // Use a fixed arbitrary date
    const nextDate = addMinutes(tempDate, durationMinutes);
    return format(nextDate, "HH:mm"); // Return HH:mm string
  } catch (e) {
    console.error("Error calculating next slot time:", e);
    return null;
  }
};

// --- Component ---

const SpaScheduler = ({
  onScheduleChange, // Callback: receives START Date object, 'later', or null
  initialDateTime, // Optional: ISO String or Timestamp for the START time
  initialPreference, // Optional: 'later' if previously selected
  minDate, // Expecting Date object or undefined (Booking arrival date)
  maxDate, // Expecting Date object or undefined (Booking departure date - adjusted if needed)
}) => {
  const { t, i18n } = useTranslation();
  const currentLocale = i18n.language || "en-US";

  // --- State Initialization ---
  const getInitialDateString = () => {
    if (initialDateTime && initialPreference !== "later") {
      try {
        return formatDateForAPI(new Date(initialDateTime));
      } catch (e) {
        console.error(
          "Error parsing initialDateTime for date string:",
          initialDateTime,
          e
        );
        return "";
      }
    }
    return "";
  };

  const getInitialSlots = () => {
    if (initialDateTime && initialPreference !== "later") {
      try {
        const firstSlotTime = new Date(initialDateTime).toLocaleTimeString(
          "en-GB",
          { hour: "2-digit", minute: "2-digit" }
        );
        // Second slot depends on fetched duration, so only store the first initially
        return [firstSlotTime];
      } catch (e) {
        console.error(
          "Error parsing initialDateTime for initial slot:",
          initialDateTime,
          e
        );
        return [];
      }
    }
    return [];
  };

  const [selectedSpaDateString, setSelectedSpaDateString] = useState(
    getInitialDateString()
  );
  const [availableSlots, setAvailableSlots] = useState([]);
  const [slotDuration, setSlotDuration] = useState(null); // Store duration from API
  const [selectedSlots, setSelectedSlots] = useState(getInitialSlots()); // Array: [startTime, endTime] or just [startTime]
  const [chooseLaterChecked, setChooseLaterChecked] = useState(
    initialPreference === "later"
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  // --- Memos ---
  // Generate Date Options for Dropdown
  const dateOptions = useMemo(() => {
    const options = [];
    if (
      !minDate ||
      !maxDate ||
      !(minDate instanceof Date) ||
      !(maxDate instanceof Date) ||
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

  // Memoize the arrival date string for comparison
  const arrivalDateString = useMemo(() => {
    return minDate instanceof Date ? formatDateForAPI(minDate) : null;
  }, [minDate]);

  // --- Fetch Availability Effect ---
  useEffect(() => {
    if (selectedSpaDateString && !chooseLaterChecked) {
      setIsLoading(true);
      setError("");
      setSlotDuration(null);
      const dateString = selectedSpaDateString;
      const apiUrl = process.env.REACT_APP_API_URL || "http://localhost:3000"; 

      axios
        .get(`${apiUrl}/api/spa/availability?date=${dateString}`)
        .then((response) => {
          const fetchedSlots = response.data?.slots || [];
          const fetchedDuration = response.data?.slotDurationMinutes;

          setAvailableSlots(fetchedSlots);
          setSlotDuration(fetchedDuration);

          // Re-validate or complete initial selection
          if (selectedSlots.length > 0 && fetchedDuration) {
            const firstSelected = selectedSlots[0];
            const expectedSecond = calculateNextSlotTime(
              firstSelected,
              fetchedDuration
            );

            if (
              !fetchedSlots.includes(firstSelected) ||
              !fetchedSlots.includes(expectedSecond)
            ) {
              setSelectedSlots([]);
              if (!chooseLaterChecked && typeof onScheduleChange === "function")
                onScheduleChange(null);
            } else if (selectedSlots.length === 1 && expectedSecond) {
              setSelectedSlots([firstSelected, expectedSecond]);
            }
          } else {
            setSelectedSlots([]);
          }
        })
        .catch((err) => {
          console.error("Error fetching SPA slots:", err);
          let errorMsg = t("extras.spa.errorLoading", "Failed to load slots.");
          if (err.message === "Network Error")
            errorMsg = t("errors.network", "Network error.");
          else if (err.response)
            errorMsg = err.response.data?.message || errorMsg;
          setError(errorMsg);
          setAvailableSlots([]);
          setSelectedSlots([]);
          if (typeof onScheduleChange === "function") onScheduleChange(null);
        })
        .finally(() => setIsLoading(false));
    } else {
      setAvailableSlots([]);
      setError("");
      setSlotDuration(null);
      if (!chooseLaterChecked) setSelectedSlots([]);
    }
  }, [selectedSpaDateString, chooseLaterChecked, t, onScheduleChange]); // onScheduleChange added

  // --- Event Handlers ---
  const handleDateChange = (event) => {
    const newDateString = event.target.value;
    setSelectedSpaDateString(newDateString);
    setSelectedSlots([]);
    setAvailableSlots([]);
    setSlotDuration(null);
    if (typeof onScheduleChange === "function") {
      onScheduleChange(null);
    }
    setError("");
  };

  const handleSlotSelect = useCallback(
    (clickedSlot) => {
      if (!slotDuration || !selectedSpaDateString) return;

      const isArrivalDaySelected = selectedSpaDateString === arrivalDateString;
      if (isArrivalDaySelected && clickedSlot < ARRIVAL_DAY_START_TIME) {
        console.warn(
          `Attempted to select slot ${clickedSlot} before ${ARRIVAL_DAY_START_TIME} on arrival day.`
        );
        return; // Prevent selection
      }

      const nextSlotTime = calculateNextSlotTime(clickedSlot, slotDuration);

      if (nextSlotTime && availableSlots.includes(nextSlotTime)) {
        const newSelectedSlots = [clickedSlot, nextSlotTime];
        setSelectedSlots(newSelectedSlots);

        try {
          const datePart = parse(
            selectedSpaDateString,
            "yyyy-MM-dd",
            new Date()
          );
          const [hours, minutes] = clickedSlot.split(":").map(Number);
          const combinedDateTime = new Date(datePart);
          combinedDateTime.setHours(hours, minutes, 0, 0);
          if (typeof onScheduleChange === "function") {
            onScheduleChange(combinedDateTime);
          }
        } catch (e) {
          console.error("Error creating combined date/time:", e);
          if (typeof onScheduleChange === "function") {
            onScheduleChange(null);
          }
        }
      } else {
        console.warn(
          `Cannot select ${clickedSlot}, next slot ${nextSlotTime} unavailable.`
        );
        setSelectedSlots([]); // Clear invalid selection
        if (typeof onScheduleChange === "function") {
          onScheduleChange(null);
        }
      }
    },
    [
      selectedSpaDateString,
      onScheduleChange,
      availableSlots,
      slotDuration,
      arrivalDateString,
    ]
  ); // Added arrivalDateString

  const handleChooseLaterChange = (e) => {
    const isChecked = e.target.checked;
    setChooseLaterChecked(isChecked);
    if (typeof onScheduleChange === "function") {
      if (isChecked) {
        onScheduleChange("later");
      } else {
        // If unchecking, clear parent state. User must now select.
        setSelectedSlots([]); // Also clear local selection
        onScheduleChange(null);
      }
    }
  };

  // --- JSX Rendering ---
  return (
    <div className="p-3 space-y-4 bg-white border border-gray-200 rounded-md">
      {/* Date Dropdown */}
      <div>
        <label
          htmlFor="spaDateSelect"
          className="block mb-1 text-sm font-medium text-gray-700"
        >
          {t("extras.spa.selectDate", "Select Date")}
        </label>
        <select
          id="spaDateSelect"
          value={selectedSpaDateString}
          onChange={handleDateChange}
          disabled={chooseLaterChecked || dateOptions.length === 0}
          className="w-full p-2 pr-8 bg-white bg-right bg-no-repeat border border-gray-300 rounded-md shadow-sm appearance-none focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
          style={{
            backgroundImage: `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" /></svg>')`,
            backgroundPosition: "right 0.5rem center",
            backgroundSize: "1.25em 1.25em",
          }}
        >
          <option value="" disabled={selectedSpaDateString !== ""}>
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
        {dateOptions.length === 0 && !chooseLaterChecked && (
          <p className="mt-1 text-xs text-gray-500">
            {t(
              "extras.spa.checkBookingDates",
              "Ensure booking dates are selected."
            )}
          </p>
        )}
      </div>

      {/* Time Slot Selector */}
      {selectedSpaDateString && !chooseLaterChecked && (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            {t("extras.spa.selectTime", "Select Time Slot")}
            <span className="ml-2 text-xs text-gray-500">
              (
              {t(
                "extras.spa.selectTwoSlotsNote",
                "Select start time for 2 slots"
              )}
              )
            </span>
          </label>
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
          {!isLoading && !error && availableSlots.length === 0 && (
            <p className="p-2 text-sm text-gray-500 rounded-md bg-gray-50">
              {t("extras.spa.noSlots", "No slots for this date.")}
            </p>
          )}
          {!isLoading &&
            !error &&
            availableSlots.length > 0 &&
            slotDuration && (
              <div className="flex flex-wrap gap-2">
                {availableSlots.map((slot) => {
                  // Determine if slot is selectable/enabled
                  const expectedNextSlot = calculateNextSlotTime(
                    slot,
                    slotDuration
                  );
                  const nextSlotIsAvailable =
                    expectedNextSlot &&
                    availableSlots.includes(expectedNextSlot);
                  const isArrivalDaySelected =
                    selectedSpaDateString === arrivalDateString;
                  const isTooEarlyOnArrival =
                    isArrivalDaySelected && slot < ARRIVAL_DAY_START_TIME;
                  const isDisabled =
                    !nextSlotIsAvailable || isTooEarlyOnArrival;
                  const isSelected = selectedSlots.includes(slot);

                  // Generate tooltip message for disabled slots
                  let disabledTooltip = "";
                  if (isTooEarlyOnArrival) {
                    disabledTooltip = t(
                      "extras.spa.slotDisabledArrivalTooltip",
                      `Available from ${ARRIVAL_DAY_START_TIME} on arrival day`
                    );
                  } else if (!nextSlotIsAvailable) {
                    disabledTooltip = t(
                      "extras.spa.slotDisabledNextUnavailableTooltip",
                      "Next slot unavailable"
                    );
                  }

                  return (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => handleSlotSelect(slot)}
                      disabled={isDisabled}
                      className={`px-3 py-1.5 rounded-md border text-sm font-medium transition-colors duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-1 ${
                        isSelected
                          ? "bg-[#668E73] text-white border-[#5a7d66] ring-[#668E73]" // Selected
                          : isDisabled
                          ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed" // Disabled
                          : "bg-white text-gray-700 border-gray-300 hover:border-[#668E73] hover:text-[#668E73]" // Default
                      }`}
                      title={disabledTooltip} // Add tooltip for disabled reason
                    >
                      {slot}
                    </button>
                  );
                })}
              </div>
            )}
          {/* Message if slots are loaded but duration is missing (API issue?) */}
          {!isLoading &&
            !error &&
            availableSlots.length > 0 &&
            !slotDuration && (
              <p className="p-2 text-sm text-orange-600 rounded-md bg-orange-50">
                {t("extras.spa.errorDurationMissing", "Slot duration missing.")}
              </p>
            )}
        </div>
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
