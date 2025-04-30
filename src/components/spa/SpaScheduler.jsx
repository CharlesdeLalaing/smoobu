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
} from "date-fns";

// Helper: Format Date for display in dropdown (e.g., "August 15, 2024")
const formatDateForDisplay = (date, locale = "en-US") => {
  if (!date) return "";
  // Example locales: 'en-US', 'fr-BE', 'nl-BE'
  return date.toLocaleDateString(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long", // Optional: Add weekday for clarity
  });
};

// Helper: Format Date for API value (YYYY-MM-DD)
const formatDateForAPI = (date) => {
  if (!date) return "";
  return format(date, "yyyy-MM-dd");
};

const SpaScheduler = ({
  onScheduleChange, // Callback: receives Date object, 'later', or null
  initialDateTime, // Optional: ISO String or Timestamp from existing booking
  initialPreference, // Optional: 'later' if previously selected
  minDate, // Expecting Date object or undefined (Booking arrival date)
  maxDate, // Expecting Date object or undefined (Booking departure date - adjusted if needed)
}) => {
  const { t, i18n } = useTranslation(); // Get i18n instance for locale
  const currentLocale = i18n.language || "en-US"; // Get current language for date formatting

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

  const getInitialSlot = () => {
    if (initialDateTime && initialPreference !== "later") {
      try {
        return new Date(initialDateTime).toLocaleTimeString("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
        });
      } catch (e) {
        console.error(
          "Error parsing initialDateTime for time slot:",
          initialDateTime,
          e
        );
        return null;
      }
    }
    return null;
  };

  // State holds the selected date STRING (YYYY-MM-DD)
  const [selectedSpaDateString, setSelectedSpaDateString] = useState(
    getInitialDateString()
  );
  const [availableSlots, setAvailableSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(getInitialSlot());
  const [chooseLaterChecked, setChooseLaterChecked] = useState(
    initialPreference === "later"
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  // --- Generate Date Options for Dropdown ---
  const dateOptions = useMemo(() => {
    const options = [];
    // Ensure minDate and maxDate are valid Date objects before proceeding
    if (
      !minDate ||
      !maxDate ||
      !(minDate instanceof Date) ||
      !(maxDate instanceof Date) ||
      isBefore(maxDate, minDate)
    ) {
      console.warn(
        "SpaScheduler: Invalid minDate or maxDate provided for options generation.",
        { minDate, maxDate }
      );
      return options;
    }

    let currentDate = startOfDay(minDate);
    const lastDate = startOfDay(maxDate);

    while (isBefore(currentDate, lastDate) || isEqual(currentDate, lastDate)) {
      options.push({
        value: formatDateForAPI(currentDate), // YYYY-MM-DD
        label: formatDateForDisplay(currentDate, currentLocale), // Localized display
      });
      currentDate = addDays(currentDate, 1);
    }
    return options;
  }, [minDate, maxDate, currentLocale]);

  // --- Fetch Availability Effect ---
  useEffect(() => {
    if (selectedSpaDateString && !chooseLaterChecked) {
      setIsLoading(true);
      setError("");
      const dateString = selectedSpaDateString;

      // Ensure your API URL is correct (use environment variables ideally)
      const apiUrl = process.env.REACT_APP_API_URL || "http://localhost:3000";

      axios
        .get(`${apiUrl}/api/spa/availability?date=${dateString}`)
        .then((response) => {
          setAvailableSlots(response.data || []);
          // Reset selected slot if it's no longer available after fetching
          if (selectedSlot && !(response.data || []).includes(selectedSlot)) {
            console.warn(
              `Previously selected slot ${selectedSlot} is no longer available for ${dateString}.`
            );
            setSelectedSlot(null);
            // Only clear parent state if user hasn't just checked 'later'
            if (!chooseLaterChecked) {
              onScheduleChange(null);
            }
          }
        })
        .catch((err) => {
          console.error("Error fetching SPA slots:", err);
          // Check for CORS or network errors specifically
          let errorMsg = t(
            "extras.spa.errorLoading",
            "Failed to load available time slots."
          );
          if (err.message === "Network Error") {
            errorMsg = t(
              "errors.network",
              "Network error. Please check connection or CORS setup."
            );
          } else if (err.response) {
            // Use server error message if available
            errorMsg = err.response.data?.message || errorMsg;
          }
          setError(errorMsg);
          setAvailableSlots([]);
        })
        .finally(() => setIsLoading(false));
    } else {
      setAvailableSlots([]); // Clear slots if no date or 'choose later'
      setError(""); // Clear errors
    }
  }, [
    selectedSpaDateString,
    chooseLaterChecked,
    t,
    selectedSlot,
    onScheduleChange,
  ]); // Added onScheduleChange dependency

  // --- Event Handlers ---
  const handleDateChange = (event) => {
    const newDateString = event.target.value;
    setSelectedSpaDateString(newDateString);
    setSelectedSlot(null); // Reset time slot when date changes
    // Inform parent that selection is cleared until a time slot is picked
    if (typeof onScheduleChange === "function") {
      onScheduleChange(null);
    } else {
      console.error("onScheduleChange is not a function in handleDateChange");
    }
    setError(""); // Clear errors
  };

  const handleSlotSelect = useCallback(
    (slot) => {
      setSelectedSlot(slot);
      if (selectedSpaDateString && slot) {
        try {
          const datePart = parse(
            selectedSpaDateString,
            "yyyy-MM-dd",
            new Date()
          );
          const [hours, minutes] = slot.split(":").map(Number);
          const combinedDateTime = new Date(datePart);
          combinedDateTime.setHours(hours, minutes, 0, 0);
          if (typeof onScheduleChange === "function") {
            onScheduleChange(combinedDateTime); // Pass Date object
          } else {
            console.error(
              "onScheduleChange is not a function in handleSlotSelect"
            );
          }
        } catch (e) {
          console.error(
            "Error parsing selected date string or setting time:",
            e
          );
          if (typeof onScheduleChange === "function") {
            onScheduleChange(null); // Clear if error
          }
        }
      }
    },
    [selectedSpaDateString, onScheduleChange]
  );

  const handleChooseLaterChange = (e) => {
    const isChecked = e.target.checked;
    setChooseLaterChecked(isChecked);
    if (typeof onScheduleChange === "function") {
      if (isChecked) {
        onScheduleChange("later"); // Inform parent: 'later'
      } else {
        // If unchecking, try to re-select the current date/time if valid, otherwise clear
        if (selectedSpaDateString && selectedSlot) {
          handleSlotSelect(selectedSlot); // Re-submit current selection
        } else {
          onScheduleChange(null); // Clear parent state
        }
      }
    } else {
      console.error(
        "onScheduleChange is not a function in handleChooseLaterChange"
      );
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
          className="w-full p-2 pr-8 bg-white bg-right bg-no-repeat border border-gray-300 rounded-md shadow-sm appearance-none focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed" // Added appearance-none for custom arrow styling if desired
          style={{
            backgroundImage: `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" /></svg>')`,
            backgroundPosition: "right 0.5rem center",
            backgroundSize: "1.25em 1.25em",
          }} // Basic SVG arrow
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
          </label>
          {isLoading && (
            <p className="text-sm text-gray-500 animate-pulse">
              {t("loading", "Loading available slots...")}
            </p>
          )}
          {error && !isLoading && (
            <p className="p-2 text-sm text-red-600 rounded-md bg-red-50">
              {error}
            </p>
          )}
          {!isLoading && !error && availableSlots.length === 0 && (
            <p className="p-2 text-sm text-gray-500 rounded-md bg-gray-50">
              {t(
                "extras.spa.noSlots",
                "No available slots found for this date."
              )}
            </p>
          )}
          {!isLoading && !error && availableSlots.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {availableSlots.map((slot) => (
                <button
                  key={slot}
                  type="button"
                  onClick={() => handleSlotSelect(slot)}
                  className={`px-3 py-1.5 rounded-md border text-sm font-medium transition-colors duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-1 ${
                    selectedSlot === slot
                      ? "bg-[#668E73] text-white border-[#5a7d66] ring-[#668E73]"
                      : "bg-white text-gray-700 border-gray-300 hover:border-[#668E73] hover:text-[#668E73]"
                  }`}
                >
                  {slot}
                </button>
              ))}
            </div>
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
            {t(
              "extras.spa.bookLaterInfo",
              "You can arrange the exact time directly with the host after booking."
            )}
          </p>
        )}
      </div>
    </div>
  );
};

export default SpaScheduler;
