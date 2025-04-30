import React, { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import DatePicker from "react-datepicker";
import axios from "axios"; //

// Import the datepicker CSS
import "react-datepicker/dist/react-datepicker.css";

// Optional: Add custom CSS or use Tailwind utility classes directly

// Helper function to format date for API (YYYY-MM-DD)
// Avoids potential issues with different timezones just for formatting the date part
const formatDateForAPI = (date) => {
  if (!date) return "";
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const SpaScheduler = ({
  onScheduleChange, // Callback: receives Date object, 'later', or null
  initialDateTime, // Optional: ISO String or Timestamp from existing booking
  initialPreference, // Optional: 'later' if previously selected
  minDate, // Optional: Minimum bookable date (e.g., booking start date)
  maxDate, // Optional: Maximum bookable date (e.g., booking end date)
}) => {
  const { t } = useTranslation();

  // --- State Initialization ---
  const getInitialDate = () => {
    if (initialDateTime && initialPreference !== "later") {
      try {
        return new Date(initialDateTime);
      } catch (e) {
        console.error("Error parsing initialDateTime:", initialDateTime, e);
        return null;
      }
    }
    return null;
  };

  const getInitialSlot = (initialDate) => {
    if (initialDate) {
      // Format as HH:mm
      return initialDate.toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
      });
    }
    return null;
  };

  const initialDateValue = getInitialDate();
  const [selectedSpaDate, setSelectedSpaDate] = useState(initialDateValue);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(
    getInitialSlot(initialDateValue)
  );
  const [chooseLaterChecked, setChooseLaterChecked] = useState(
    initialPreference === "later"
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  // --- Fetch Availability Effect ---
  useEffect(() => {
    // Only fetch if a date is selected and user hasn't chosen 'book later'
    if (selectedSpaDate && !chooseLaterChecked) {
      setIsLoading(true);
      setError("");
      const dateString = formatDateForAPI(selectedSpaDate);

      // Use environment variable for API base URL if needed
      const apiUrl = process.env.REACT_APP_API_URL || "http://localhost:3000"; // Adjust if needed

      axios
        .get(`${apiUrl}/api/spa/availability?date=${dateString}`)
        .then((response) => {
          setAvailableSlots(response.data || []);
          // If a slot was previously selected, check if it's still available
          if (selectedSlot && !(response.data || []).includes(selectedSlot)) {
            console.warn(
              `Previously selected slot ${selectedSlot} is no longer available for ${dateString}.`
            );
            setSelectedSlot(null); // Reset selection
            onScheduleChange(null); // Inform parent state is cleared
          }
        })
        .catch((err) => {
          console.error("Error fetching SPA slots:", err);
          const errorMsg =
            err.response?.data?.message ||
            t(
              "extras.spa.errorLoading",
              "Failed to load available time slots."
            );
          setError(errorMsg);
          setAvailableSlots([]);
        })
        .finally(() => setIsLoading(false));
    } else {
      setAvailableSlots([]); // Clear slots if no date or 'choose later' is checked
      setError(""); // Clear any previous errors
    }
    // Dependencies: Run when date changes or 'choose later' is toggled
    // Also include t, selectedSlot, onScheduleChange for error messages/slot validation
  }, [selectedSpaDate, chooseLaterChecked, t, selectedSlot, onScheduleChange]);

  // --- Event Handlers ---
  const handleDateChange = (date) => {
    setSelectedSpaDate(date);
    setSelectedSlot(null); // Reset time slot when date changes
    onScheduleChange(null); // Clear schedule in parent until a slot is picked
    setError(""); // Clear errors when changing date
  };

  const handleSlotSelect = useCallback(
    (slot) => {
      setSelectedSlot(slot);
      if (selectedSpaDate && slot) {
        try {
          const [hours, minutes] = slot.split(":").map(Number);
          // Create a new Date object to avoid mutating the state directly
          const combinedDateTime = new Date(selectedSpaDate);
          combinedDateTime.setHours(hours, minutes, 0, 0); // Set hours, minutes, seconds, ms
          onScheduleChange(combinedDateTime); // Pass the full Date object
        } catch (e) {
          console.error("Error creating combined date/time:", e);
          onScheduleChange(null); // Clear if error
        }
      }
      // Include dependencies that this handler relies on
    },
    [selectedSpaDate, onScheduleChange]
  );

  const handleChooseLaterChange = (e) => {
    const isChecked = e.target.checked;
    setChooseLaterChecked(isChecked);
    if (isChecked) {
      // Optionally clear date/slot visually when checking 'later'
      // setSelectedSpaDate(null); // Uncomment if desired
      // setSelectedSlot(null); // Uncomment if desired
      onScheduleChange("later"); // Inform parent: 'later'
    } else {
      // If unchecking, clear the 'later' preference. User needs to select a date/time now.
      onScheduleChange(null); // Inform parent: clear selection
    }
  };

  // --- JSX Rendering ---
  return (
    <div className="p-3 space-y-4 bg-white border border-gray-200 rounded-md">
      {/* Date Picker */}
      <div>
        <label
          htmlFor="spaDatePicker"
          className="block mb-1 text-sm font-medium text-gray-700"
        >
          {t("extras.spa.selectDate", "Select Date")}
        </label>
        <DatePicker
          id="spaDatePicker"
          selected={selectedSpaDate}
          onChange={handleDateChange}
          minDate={minDate}
          maxDate={maxDate}
          disabled={chooseLaterChecked}
          className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
          dateFormat="yyyy-MM-dd" // Match API format for clarity, locale formatting happens via DatePicker internals
          placeholderText={t(
            "extras.spa.datePlaceholder",
            "Click to select a date"
          )}
        />
      </div>

      {/* Time Slot Selector - Conditional Rendering */}
      {selectedSpaDate && !chooseLaterChecked && (
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
                      ? "bg-[#668E73] text-white border-[#5a7d66] ring-[#668E73]" // Active state
                      : "bg-white text-gray-700 border-gray-300 hover:border-[#668E73] hover:text-[#668E73]" // Default state
                  }`}
                >
                  {slot} {/* e.g., "10:00" */}
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
        {/* Optional: Add explanatory text if needed */}
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
