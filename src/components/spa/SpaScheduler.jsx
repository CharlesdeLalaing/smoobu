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
const ARRIVAL_DAY_START_TIME = "14:00"; // Special start time for the arrival day
// *** LETSGOMYLOVE related: Definition of the special coupon code constant (Commented Out) ***
// const SINGLE_SLOT_COUPON_CODE = "LETSGOMYLOVE"; // Coupon code for single slot mode

// --- Helper Functions ---

const formatDateForDisplay = (date, locale = "en-US") => {
  if (!date) return "";
  // Example locales: 'en-US', 'fr-BE', 'nl-BE'
  return date.toLocaleDateString(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  });
};

// Format Date for API value (YYYY-MM-DD)
const formatDateForAPI = (date) => {
  if (!date) return "";
  return format(date, "yyyy-MM-dd");
};

// Calculate next slot time string based on duration
const calculateNextSlotTime = (startTimeString, durationMinutes) => {
  // Returns null if input is invalid or duration is non-positive
  if (!startTimeString || !durationMinutes || durationMinutes <= 0) return null;
  try {
    const [hours, minutes] = startTimeString.split(":").map(Number);
    // Use a fixed arbitrary date to avoid DST issues with just time manipulation
    const tempDate = new Date(2000, 0, 1, hours, minutes);
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
  maxDate, // Expecting Date object or undefined (Booking departure date - may need adjustment before passing)
  // Prop still received, but its use for LETSGOMYLOVE logic is commented out below
  appliedCoupon, // Receive the applied coupon object to determine mode
}) => {
  const { t, i18n } = useTranslation();
  const currentLocale = i18n.language || "en-US"; // Get current locale for date formatting

  // --- Determine Selection Mode based on Coupon ---
  // *** LETSGOMYLOVE related: Calculating selection mode (Commented Out - defaults to 'double') ***
  // The logic to check for the specific coupon is commented out.
  // The component will now always operate in 'double' slot mode unless this is uncommented.
  const selectionMode = useMemo(() => {
    // return appliedCoupon?.code?.toUpperCase() ===
    //   SINGLE_SLOT_COUPON_CODE.toUpperCase() // *** LETSGOMYLOVE related: Comparison logic (Commented Out) ***
    //   ? "single"
    //   : "double";
    return "double"; // Defaulting to 'double' mode since the coupon check is disabled.
  }, [appliedCoupon]);

  // --- State Initialization ---
  // (State initialization remains the same)
  const getInitialDateString = () => {
      if (initialDateTime && initialPreference !== "later") {
          try {
              return formatDateForAPI(new Date(initialDateTime));
          } catch (e) {
              console.error("Error parsing initialDateTime for date string:", initialDateTime, e);
              return "";
          }
      }
      return "";
  };
  const getInitialSlots = () => {
      if (initialDateTime && initialPreference !== "later") {
          try {
              const firstSlotTime = new Date(initialDateTime).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
              return [firstSlotTime];
          } catch (e) {
              console.error("Error parsing initialDateTime for initial slot:", initialDateTime, e);
              return [];
          }
      }
      return [];
  };
  const [selectedSpaDateString, setSelectedSpaDateString] = useState(getInitialDateString());
  const [availableSlots, setAvailableSlots] = useState([]);
  const [slotDuration, setSlotDuration] = useState(null);
  const [selectedSlots, setSelectedSlots] = useState(getInitialSlots());
  const [chooseLaterChecked, setChooseLaterChecked] = useState(initialPreference === "later");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [slotsLoadedForCurrentDate, setSlotsLoadedForCurrentDate] = useState(false);

  // --- Memos ---
  // (Memos remain the same)
    const dateOptions = useMemo(() => {
        const options = [];
        if (!minDate || !maxDate || !(minDate instanceof Date) || !(maxDate instanceof Date) || isBefore(maxDate, minDate)) {
            return options;
        }
        let currentDate = startOfDay(minDate);
        const lastDate = startOfDay(maxDate);
        while (isBefore(currentDate, lastDate) || isEqual(currentDate, lastDate)) {
            options.push({ value: formatDateForAPI(currentDate), label: formatDateForDisplay(currentDate, currentLocale) });
            currentDate = addDays(currentDate, 1);
        }
        return options;
    }, [minDate, maxDate, currentLocale]);
    const arrivalDateString = useMemo(() => {
        return minDate instanceof Date ? formatDateForAPI(minDate) : null;
    }, [minDate]);


  // --- Effects ---
  // Effect to clear selection if the selection mode changes (coupon applied/removed)
  // *** LETSGOMYLOVE related: Reaction to selection mode change (Commented Out) ***
  // Since `selectionMode` is now hardcoded to 'double', this effect (as written)
  // would only run if chooseLaterChecked or onScheduleChange changed.
  // The core purpose of reacting to the LETSGOMYLOVE coupon mode change is disabled.
  /*
  useEffect(() => {
    // Only clear if user hasn't explicitly chosen 'later'
    if (!chooseLaterChecked) {
      setSelectedSlots([]); // Clear local selection
      if (typeof onScheduleChange === 'function') {
        onScheduleChange(null); // Clear parent component's state
      }
      // Reset the slots loaded flag to fetch new slots if mode changes
      setSlotsLoadedForCurrentDate(false);
    }
  }, [selectionMode, chooseLaterChecked, onScheduleChange]); // selectionMode dependency is effectively inert now
  */
 // Alternative simpler effect if you only want clearing based on chooseLaterChecked:
  useEffect(() => {
      if (!chooseLaterChecked && selectedSlots.length > 0) {
          // If 'choose later' is unchecked and something was selected,
          // we might want to clear based on other logic, or keep this effect minimal.
          // Or remove this effect entirely if the fetch effect handles clearing adequately.
      }
       if (chooseLaterChecked){
            setSlotsLoadedForCurrentDate(false); // Reset if they check the box
       }
  }, [chooseLaterChecked]);


  // Effect to fetch available slots when the selected date changes (or 'choose later' is unchecked)
  useEffect(() => {
    if (
      selectedSpaDateString &&
      !chooseLaterChecked &&
      !slotsLoadedForCurrentDate
    ) {
      setIsLoading(true);
      setError("");
      setSlotDuration(null);
      const dateString = selectedSpaDateString;
      const apiUrl = process.env.REACT_APP_API_URL || "http://localhost:3000";
      const apiParams = {
        date: dateString,
        arrival: minDate instanceof Date ? formatDateForAPI(minDate) : undefined,
        departure: maxDate instanceof Date ? formatDateForAPI(maxDate) : undefined,
      };
      Object.keys(apiParams).forEach(
        (key) => apiParams[key] === undefined && delete apiParams[key]
      );

      axios
        .get(`${apiUrl}/api/spa/availability`, { params: apiParams })
        .then((response) => {
          const fetchedSlots = response.data?.slots || [];
          const fetchedDuration = response.data?.slotDurationMinutes;
          setAvailableSlots(fetchedSlots);
          setSlotDuration(fetchedDuration);

          // Re-validate any existing/initial selection based on fetched data and current mode
          // *** LETSGOMYLOVE related: Validating based on mode (Single mode logic commented out) ***
          if (selectedSlots.length > 0 && fetchedDuration) {
            const firstSelected = selectedSlots[0];
            let isValidInitialSelection = false;

            // *** LETSGOMYLOVE related: Single mode validation logic (Commented Out) ***
            /*
            if (selectionMode === "single") {
              // Single mode: check if the initially selected slot exists in the fetched list
              isValidInitialSelection = fetchedSlots.includes(firstSelected);
            } else {
            */
              // Always use Double mode logic now:
              const expectedSecond = calculateNextSlotTime(firstSelected, fetchedDuration);
              isValidInitialSelection =
                fetchedSlots.includes(firstSelected) &&
                expectedSecond &&
                fetchedSlots.includes(expectedSecond);
              if (isValidInitialSelection && selectedSlots.length === 1 && expectedSecond) {
                setSelectedSlots([firstSelected, expectedSecond]);
              }
            /*
            }
            */

            if (!isValidInitialSelection) {
              // Log message will always show 'double' now unless uncommented above
              console.warn(
                `Initial/existing selection [${selectedSlots.join(", ")}] no longer valid for mode '${selectionMode}'. Clearing.`
              );
              setSelectedSlots([]);
              if (!chooseLaterChecked && typeof onScheduleChange === "function") {
                onScheduleChange(null);
              }
            }
          } else {
            setSelectedSlots([]);
          }
          setSlotsLoadedForCurrentDate(true);
        })
        .catch((err) => {
          console.error("Error fetching SPA slots:", err);
          let errorMsg = t("extras.spa.errorLoading", "Failed to load slots.");
          if (err.message === "Network Error") errorMsg = t("errors.network", "Network error.");
          else if (err.response) errorMsg = err.response.data?.message || errorMsg;
          setError(errorMsg);
          setAvailableSlots([]);
          setSelectedSlots([]);
          if (typeof onScheduleChange === "function") onScheduleChange(null);
        })
        .finally(() => setIsLoading(false));
    } else {
      if (!selectedSpaDateString || chooseLaterChecked) {
        setAvailableSlots([]);
        setError("");
        setSlotDuration(null);
        if (!chooseLaterChecked) setSelectedSlots([]);
      }
    }
  }, [
    selectedSpaDateString,
    chooseLaterChecked,
    t,
    // selectionMode dependency is effectively inert now as it's always 'double'
    selectionMode,
    minDate,
    maxDate,
    slotsLoadedForCurrentDate,
    onScheduleChange, // Added back as clearing depends on it
  ]);

  // --- Event Handlers ---
    const handleDateChange = (event) => {
        const newDateString = event.target.value;
        setSelectedSpaDateString(newDateString);
        setSlotsLoadedForCurrentDate(false);
        setSelectedSlots([]);
        setAvailableSlots([]);
        setSlotDuration(null);
        setError("");
        if (typeof onScheduleChange === "function") {
            onScheduleChange(null);
        }
    };

  // Handles clicks on the time slot buttons
const handleSlotSelect = useCallback(
  (clickedSlot) => {
    if (!slotDuration || !selectedSpaDateString) {
      console.warn("Cannot select slot: duration or date string missing.");
      return;
    }
    const isArrivalDaySelected = selectedSpaDateString === arrivalDateString;
    if (isArrivalDaySelected && clickedSlot < ARRIVAL_DAY_START_TIME) {
      console.warn(
        `Selection prevented: ${clickedSlot} is before ${ARRIVAL_DAY_START_TIME} on arrival day.`
      );
      return;
    }

    let newSelectedSlots = [];
    let isValidSelection = false;

    // Always use Double Slot Mode logic now
    const nextSlotTime = calculateNextSlotTime(clickedSlot, slotDuration);
    if (nextSlotTime && availableSlots.includes(nextSlotTime)) {
      newSelectedSlots = [clickedSlot, nextSlotTime];
      isValidSelection = true;
    } else {
      console.warn(
        `Cannot select double slot starting at ${clickedSlot}. Next slot ${
          nextSlotTime || "N/A"
        } is unavailable.`
      );
      isValidSelection = false;
    }

    if (isValidSelection) {
      setSelectedSlots(newSelectedSlots);
      try {
        const datePart = parse(selectedSpaDateString, "yyyy-MM-dd", new Date());
        const [hours, minutes] = clickedSlot.split(":").map(Number);
        const combinedDateTime = new Date(datePart);
        combinedDateTime.setHours(hours, minutes, 0, 0);

        // MODIFIED: Create an object with both slot times
        const bookingData = {
          startDateTime: combinedDateTime,
          endDateTime: nextSlotTime
            ? (() => {
                const [nextHours, nextMinutes] = nextSlotTime
                  .split(":")
                  .map(Number);
                const nextDateTime = new Date(datePart);
                nextDateTime.setHours(nextHours, nextMinutes, 0, 0);
                return nextDateTime;
              })()
            : null,
          slots: newSelectedSlots, // Include the array of selected time slots
        };

        if (typeof onScheduleChange === "function") {
          // Pass the booking data object instead of just the start datetime
          onScheduleChange(bookingData);
        }
      } catch (e) {
        console.error("Error creating combined date/time object:", e);
        if (typeof onScheduleChange === "function") {
          onScheduleChange(null);
        }
      }
    } else {
      setSelectedSlots([]);
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
    selectionMode,
  ]
);

    const handleChooseLaterChange = (e) => {
        const isChecked = e.target.checked;
        setChooseLaterChecked(isChecked);
        if (!isChecked) {
            setSlotsLoadedForCurrentDate(false);
        }
        if (typeof onScheduleChange === "function") {
            if (isChecked) {
                onScheduleChange("later");
            } else {
                setSelectedSlots([]);
                onScheduleChange(null);
            }
        }
    };


  // --- JSX Rendering ---
  return (
    <div className="p-3 space-y-4 bg-white border border-gray-200 rounded-md">
      {/* Date Selection Dropdown */}
      <div>
        <label htmlFor="spaDateSelect" className="block mb-1 text-sm font-medium text-gray-700">
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
              : t("extras.spa.datePlaceholderNoDates", "-- No dates available --")}
          </option>
          {dateOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {dateOptions.length === 0 && !chooseLaterChecked && (
          <p className="mt-1 text-xs text-gray-500">
            {t("extras.spa.checkBookingDates", "Ensure booking dates are selected.")}
          </p>
        )}
      </div>

      {/* Time Slot Selection Area (conditional) */}
      {selectedSpaDateString && !chooseLaterChecked && (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            {t("extras.spa.selectTime", "Select Time Slot")}
            {/* *** LETSGOMYLOVE related: Conditional UI text (Single mode branch commented out) *** */}
            {selectionMode === "double" && (
              <span className="ml-2 text-xs text-gray-500">
                ({t("extras.spa.selectTwoSlotsNote", "Select start time for 2 slots")})
              </span>
            )}
            {/* *** LETSGOMYLOVE related: Text shown when coupon is active (Commented Out) *** */}
            {/*
            {selectionMode === "single" && (
              <span className="ml-2 text-xs text-gray-500">
                ({t("extras.spa.selectOneSlotNote", "Select 1 time slot")})
              </span>
            )}
            */}
          </label>
          {/* Loading, Error, No Slots Messages */}
          {isLoading && <p className="text-sm text-gray-500 animate-pulse">{t("loading", "Loading slots...")}</p>}
          {error && !isLoading && <p className="p-2 text-sm text-red-600 rounded-md bg-red-50">{error}</p>}
          {!isLoading && !error && availableSlots.length === 0 && <p className="p-2 text-sm text-gray-500 rounded-md bg-gray-50">{t("extras.spa.noSlots", "No slots for this date.")}</p>}

          {/* Slot Buttons */}
          {!isLoading && !error && availableSlots.length > 0 && slotDuration && (
              <div className="flex flex-wrap gap-2">
                {availableSlots.map((slot) => {
                  const isArrivalDaySelected = selectedSpaDateString === arrivalDateString;
                  const isTooEarlyOnArrival = isArrivalDaySelected && slot < ARRIVAL_DAY_START_TIME;
                  let isEnabled = !isTooEarlyOnArrival;
                  let disabledTooltip = isTooEarlyOnArrival ? t("extras.spa.slotDisabledArrivalTooltip", `From ${ARRIVAL_DAY_START_TIME}`) : "";

                  // *** LETSGOMYLOVE related: Conditional disable logic (Single mode check effectively removed) ***
                  // The check `selectionMode === "double"` will always be true now.
                  // The single-slot mode behavior (where this check was skipped) is disabled.
                  if (selectionMode === "double" && isEnabled) {
                    const expectedNextSlot = calculateNextSlotTime(slot, slotDuration);
                    const nextSlotIsAvailable = expectedNextSlot && availableSlots.includes(expectedNextSlot);
                    if (!nextSlotIsAvailable) {
                      isEnabled = false;
                      if (!disabledTooltip) disabledTooltip = t("extras.spa.slotDisabledNextUnavailableTooltip", "Next slot unavailable");
                    }
                  }

                  const isDisabled = !isEnabled;
                  // *** LETSGOMYLOVE related: Conditional selection styling (Single mode branch commented out) ***
                  const isSelected =
                    /* selectionMode === "single"
                      ? selectedSlots[0] === slot // *** LETSGOMYLOVE related: Single mode selection check (Commented Out) ***
                      : */ selectedSlots.includes(slot); // Always uses double mode check now

                  return (
                    <button
                     key={slot}
                      type="button"
                      onClick={() => handleSlotSelect(slot)}
                      disabled={isDisabled}
                      // *** LETSGOMYLOVE related: Styling depends on isSelected, which now always uses double mode logic ***
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
                {t("extras.spa.errorDurationMissing", "Slot duration missing.")}
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
    </div> // Closing div for the main component container
  );
};

export default SpaScheduler;

    