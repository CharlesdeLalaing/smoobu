import React, { useState, useEffect, memo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { isRoomAvailable, isDateCheckinOnly } from "../hooks/roomUtils";
import "./CustomCalendar.css";

export const CalendarRoom = memo(
  ({
    roomId,
    availableDates,
    startDate,
    endDate,
    onDateSelect,
    hasSearched,
  }) => {
    const { t } = useTranslation();
    const [currentDate, setCurrentDate] = useState(new Date());
    const [hoveredDate, setHoveredDate] = useState(null);
    const [windowWidth, setWindowWidth] = useState(window.innerWidth);
    const [lastAvailableDates, setLastAvailableDates] = useState({});

    // Store last valid availability data when it changes
    useEffect(() => {
      if (availableDates && roomId && availableDates[roomId]) {
        setLastAvailableDates(availableDates);
      }
    }, [availableDates, roomId]);

    // Handle window resize to determine if we show two months side by side
    useEffect(() => {
      const handleResize = () => {
        setWindowWidth(window.innerWidth);
      };
      window.addEventListener("resize", handleResize);
      return () => {
        window.removeEventListener("resize", handleResize);
      };
    }, []);

    // Determine if we should show two calendars side by side based on screen width
    const showTwoCalendars = windowWidth >= 768; // Show two calendars on tablets and above

    // Calculate next month for dual calendar view
    const nextMonth = new Date(currentDate);
    nextMonth.setMonth(nextMonth.getMonth() + 1);

    // Navigate to previous month pair
    const prevMonthPair = () => {
      setCurrentDate(
        new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1)
      );
    };

    // Navigate to next month pair
    const nextMonthPair = () => {
      setCurrentDate(
        new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1)
      );
    };

    // Use useCallback to memoize the onDateSelect handler
    const handleDateSelect = useCallback(
      (date, isStart, calendarRoomId) => {
        if (onDateSelect) {
          // Pass null as third parameter to avoid changing room selection when clicking calendar
          onDateSelect(date, isStart, null);
        }
      },
      [onDateSelect]
    );

    // Days of the week header
    const daysOfWeek = ["LU", "MA", "ME", "JE", "VE", "SA", "DI"];

    // Get month name for display
    const getMonthName = (date) => {
      return date.toLocaleString("fr-FR", { month: "long" }).toUpperCase();
    };

    // Format date to YYYY-MM-DD consistently
    const formatDate = (date) => {
      const d = new Date(date);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
        2,
        "0"
      )}-${String(d.getDate()).padStart(2, "0")}`;
    };

    // Get the most recent valid availability data
    const getAvailabilityData = () => {
      // Check if current availability data is valid
      if (availableDates && roomId && availableDates[roomId]) {
        return availableDates;
      }
      
      // Fall back to last valid data
      if (lastAvailableDates && roomId && lastAvailableDates[roomId]) {
        return lastAvailableDates;
      }
      
      // If nothing is available, return an empty object
      return {};
    };

    // Check if a date has a checkout-only flag on the previous day
    const isSmoobuCheckoutDay = (date) => {
      if (!roomId) return false;

      const availabilityData = getAvailabilityData();
      if (!availabilityData || !availabilityData[roomId]) return false;

      const dateStr = formatDate(date);
      const roomData = availabilityData[roomId];

      // Don't process dates we have no data for
      if (!(dateStr in roomData)) return false;

      // Create a date for the previous day
      const prevDay = new Date(date);
      prevDay.setDate(prevDay.getDate() - 1);
      const prevDateStr = formatDate(prevDay);

      // Check if the PREVIOUS day has the checkoutOnly flag
      // If so, THIS day should be displayed as a checkout day
      return roomData[prevDateStr] && roomData[prevDateStr].checkoutOnly === true;
    };

    // Check if a date is available
    const isDateAvailable = (date) => {
      // Check if we have the necessary data
      const availabilityData = getAvailabilityData();
      if (!roomId || !availabilityData || !availabilityData[roomId]) {
        return true; // Default to available when no data
      }

      const dateStr = formatDate(date);
      const roomData = availabilityData[roomId];

      // If we don't have data for this specific date, consider it available
      if (!(dateStr in roomData)) {
        return true;
      }

      // IMPORTANT: If this date is being selected as a checkout date (end date),
      // we should consider it available
      if (startDate && !endDate) {
        // We are selecting an end date (checkout day)
        // If this date is right after the start date, consider it available for checkout
        const dayAfterStart = new Date(startDate);
        dayAfterStart.setDate(dayAfterStart.getDate() + 1);
        if (formatDate(dayAfterStart) === dateStr) {
          return true;
        }
      }

      // IMPORTANT: Checkout days should be considered available
      if (isSmoobuCheckoutDay(date)) {
        return true;
      }

      // Check if explicitly unavailable
      if (
        roomData[dateStr] &&
        roomData[dateStr].available !== undefined &&
        roomData[dateStr].available === 0
      ) {
        return false;
      }

      // Default to available
      return true;
    };

    // Check if a date is partially available
    const isDatePartiallyAvailable = (date) => {
      return (
        isSmoobuCheckoutDay(date) ||
        isDateCheckinOnly(date, roomId, getAvailabilityData())
      );
    };

    // Check if a date is selected (either start or end date)
    const isDateSelected = (date) => {
      if (!startDate && !endDate) return false;

      // Compare dates by day, month, and year only
      const isSameDate = (date1, date2) => {
        if (!date1 || !date2) return false;
        return (
          date1.getDate() === date2.getDate() &&
          date1.getMonth() === date2.getMonth() &&
          date1.getFullYear() === date2.getFullYear()
        );
      };

      return isSameDate(date, startDate) || isSameDate(date, endDate);
    };

    // Check if a date is in the selected range (between start and end)
    const isDateInRange = (date) => {
      if (!startDate || !endDate) return false;

      // Extract just the date parts (year, month, day)
      const current = new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate()
      );
      const start = new Date(
        startDate.getFullYear(),
        startDate.getMonth(),
        startDate.getDate()
      );
      const end = new Date(
        endDate.getFullYear(),
        endDate.getMonth(),
        endDate.getDate()
      );

      // Compare using getTime() for accurate results
      return (
        current.getTime() > start.getTime() && current.getTime() < end.getTime()
      );
    };

    // Check if a date is in the hovered range
    const isDateInHoveredRange = (date) => {
      if (!startDate || !hoveredDate || endDate) return false;

      const currentTime = date.getTime();
      const startTime = new Date(startDate).getTime();
      const hoverTime = hoveredDate.getTime();

      return (
        (currentTime > startTime && currentTime <= hoverTime) ||
        (currentTime < startTime && currentTime >= hoverTime)
      );
    };

    // Check if a date is clickable with proper checkout handling
    const isDateClickable = (date) => {
      // Calculate tomorrow (today + 1 day)
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);

      // Don't allow selecting today or dates in the past
      // Only allow selecting tomorrow and future dates
      if (date < tomorrow) {
        return false;
      }

      // During initial render or before search, allow all future dates
      if (!hasSearched) {
        return true;
      }

      // For selecting a start date (or first date in a new selection)
      if (!startDate || (startDate && endDate)) {
        // Checkout-only dates cannot be used as start dates
        if (isSmoobuCheckoutDay(date)) {
          return false;
        }
        return isDateAvailable(date);
      }

      // For selecting an end date
      if (startDate && !endDate) {
        // If selecting a date before current start, handle as new start date
        if (date < startDate) {
          // Checkout-only dates cannot be used as start dates
          if (isSmoobuCheckoutDay(date)) {
            return false;
          }
          return isDateAvailable(date);
        }

        // If it's the day immediately after the start date, always allow it
        const dayAfterStart = new Date(startDate);
        dayAfterStart.setDate(dayAfterStart.getDate() + 1);
        if (formatDate(date) === formatDate(dayAfterStart)) {
          return true;
        }

        // For other dates, check if the range (excluding the end date) is available
        return isRoomAvailable(
          roomId,
          startDate,
          date,
          getAvailabilityData(),
          hasSearched
        );
      }

      return isDateAvailable(date);
    };

    // Generate calendar for a specific month
    const generateCalendarMonth = (dateObj) => {
      const year = dateObj.getFullYear();
      const month = dateObj.getMonth();

      // First day of month
      const firstDay = new Date(year, month, 1);

      // Last day of month
      const lastDay = new Date(year, month + 1, 0);

      // Day of week for first day (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
      // Adjust for Monday as first day of week
      let firstDayOfWeek = firstDay.getDay();
      firstDayOfWeek = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;

      const days = [];

      // Add empty slots for days before the first day of month
      for (let i = 0; i < firstDayOfWeek; i++) {
        days.push({ date: null, empty: true });
      }

      // Add days of the month
      for (let i = 1; i <= lastDay.getDate(); i++) {
        const date = new Date(year, month, i);
        days.push({ date, empty: false });
      }

      return days;
    };

    // Handle date click
    const handleDateClick = (date) => {
      // Check if date is clickable
      if (!isDateClickable(date)) {
        return;
      }

      // Convert to noon to avoid timezone issues
      const selectedDate = new Date(date);
      selectedDate.setHours(12, 0, 0, 0);

      if (startDate && endDate) {
        // Clear end date first
        handleDateSelect(null, false, roomId);

        // Set new start date
        setTimeout(() => {
          handleDateSelect(selectedDate, true, roomId);
        }, 0);
        return;
      }

      if (!startDate) {
        handleDateSelect(selectedDate, true, roomId);
      } else if (selectedDate < new Date(startDate)) {
        handleDateSelect(selectedDate, true, roomId);
      } else {
        handleDateSelect(selectedDate, false, roomId);
      }
    };

    // Handle mouse enter on a date
    const handleDateMouseEnter = (date) => {
      if (startDate && !endDate) {
        setHoveredDate(date);
      }
    };

    // Handle mouse leave
    const handleDateMouseLeave = () => {
      setHoveredDate(null);
    };

    const isPastOrToday = (date) => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const checkDate = new Date(date);
      checkDate.setHours(0, 0, 0, 0);

      return checkDate <= today;
    };

    /**
     * Check if a date is today
     * @param {Date} date - The date to check
     * @returns {boolean} - True if the date is today
     */
    const isToday = (date) => {
      const today = new Date();

      return (
        date.getDate() === today.getDate() &&
        date.getMonth() === today.getMonth() &&
        date.getFullYear() === today.getFullYear()
      );
    };

    // Generate calendar days for current and next month
    const currentMonthDays = generateCalendarMonth(currentDate);
    const nextMonthDays = generateCalendarMonth(nextMonth);

    // Render a single month calendar
    const renderMonth = (monthDate, calendarDays) => (
      <div className="custom-calendar-month">
        <div className="calendar-header-month">
          <span className="calendar-month">{getMonthName(monthDate)}</span>
          <span className="calendar-year">{monthDate.getFullYear()}</span>
        </div>

        <div className="calendar-days-header">
          {daysOfWeek.map((day, index) => (
            <div key={index} className="calendar-day-header">
              {day}
            </div>
          ))}
        </div>

        <div className="calendar-days-grid">
          {calendarDays.map((dayObj, index) => {
            if (dayObj.empty) {
              return (
                <div
                  key={`empty-${monthDate.getMonth()}-${index}`}
                  className="calendar-day empty"
                ></div>
              );
            }

            const date = dayObj.date;
            const dateStr = formatDate(date);

            // Add checks for past dates and today
            const isPast = isPastOrToday(date);
            const isTodayDate = isToday(date);

            // Get availability data
            const availabilityData = getAvailabilityData();
            const roomData =
              roomId && availabilityData && availabilityData[roomId];
            const dateData = roomData ? roomData[dateStr] : null;

            // Determine date status for styling - follow Smoobu's visual pattern
            const isAvailable = isDateAvailable(date);
            const isCheckout = isSmoobuCheckoutDay(date);
            const isCheckin = isDateCheckinOnly(date, roomId, availabilityData);
            const isPartial = isDatePartiallyAvailable(date);
            const isSelected = isDateSelected(date);
            const isInRange = isDateInRange(date);
            const isInHoverRange = isDateInHoveredRange(date);
            const isClickable = isDateClickable(date);

            // Build classes - apply them in the correct order
            let classNames = "calendar-day";

            // Add past or today classes first
            if (isPast) {
              classNames += isTodayDate ? " today" : " past-date";
            }

            if (!isAvailable) {
              classNames += " unavailable";
            } else if (isCheckout) {
              classNames += " checkout-only";
            } else if (isCheckin) {
              classNames += " checkin-only";
            } else if (isPartial) {
              classNames += " partially-available";
            }

            if (isSelected) classNames += " selected";
            if (isInRange) classNames += " in-range";
            if (isInHoverRange) classNames += " in-hover-range";
            if (isClickable) classNames += " clickable";

            // Add data attributes for debugging
            const dataStatus = isCheckout
              ? "checkout-only"
              : !isAvailable
              ? "unavailable"
              : isCheckin
              ? "check-in-only"
              : isPartial
              ? "partially-available"
              : "available";

            return (
              <div
                key={`day-${monthDate.getMonth()}-${date.getDate()}`}
                className={classNames}
                onClick={() => handleDateClick(date)}
                onMouseEnter={() => handleDateMouseEnter(date)}
                onMouseLeave={handleDateMouseLeave}
                data-date={dateStr}
                data-status={dataStatus}
                style={{
                  backgroundColor: isSelected
                    ? "#668E73"
                    : isInRange
                    ? "rgba(102, 142, 115, 0.2)"
                    : undefined,
                  color: isSelected ? "#ffffff" : undefined,
                  fontWeight: isSelected ? "bold" : undefined,
                }}
              >
                <span className="calendar-day-number">{date.getDate()}</span>
              </div>
            );
          })}
        </div>
      </div>
    );

    return (
      <div className="calendar-room">
        <h3 className="text-lg font-medium text-[#668E73] mb-3">
          {t("calendar.availability")}
        </h3>
        
        {/* Unified calendar container */}
        <div className="unified-calendar">
          {/* Shared navigation controls */}
          <div className="calendar-navigation-controls">
            <button className="calendar-nav-btn" onClick={prevMonthPair}>
              &lt;
            </button>
            <div className="calendar-date-range">
              {getMonthName(currentDate)} {currentDate.getFullYear()} - {getMonthName(nextMonth)} {nextMonth.getFullYear()}
            </div>
            <button className="calendar-nav-btn" onClick={nextMonthPair}>
              &gt;
            </button>
          </div>
          
          {/* Calendar months container */}
          <div className="calendar-months-container">
            {/* Always render the current month */}
            <div className={showTwoCalendars ? "calendar-month-half" : "calendar-month-full"}>
              {renderMonth(currentDate, currentMonthDays)}
            </div>
            
            {/* Conditionally render the next month based on screen size */}
            {showTwoCalendars && (
              <div className="calendar-month-half">
                {renderMonth(nextMonth, nextMonthDays)}
              </div>
            )}
          </div>
          
          {/* Shared legend for both calendars */}
          <div className="calendar-legend">
            <div className="legend-item">
              <div className="legend-color available"></div>
              <span>{t("calendar.available")}</span>
            </div>
            <div className="legend-item">
              <div className="legend-color unavailable"></div>
              <span>{t("calendar.unavailable")}</span>
            </div>
            <div className="legend-item">
              <div className="legend-color partially-available"></div>
              <span>{t("calendar.partiallyAvailable")}</span>
            </div>
          </div>
        </div>
        
        <div className="mt-4 text-sm text-gray-600">
          <p>{t("calendar.instructions")}</p>
        </div>
      </div>
    );
  }
);

// Add a displayName for better debugging
CalendarRoom.displayName = "CalendarRoom";

export default CalendarRoom;import React, { useState, useEffect, memo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { isRoomAvailable, isDateCheckinOnly } from "../hooks/roomUtils";
import "./CustomCalendar.css";

export const CalendarRoom = memo(
  ({
    roomId,
    availableDates,
    startDate,
    endDate,
    onDateSelect,
    hasSearched,
  }) => {
    const { t } = useTranslation();
    const [currentDate, setCurrentDate] = useState(new Date());
    const [hoveredDate, setHoveredDate] = useState(null);
    const [windowWidth, setWindowWidth] = useState(window.innerWidth);
    const [lastAvailableDates, setLastAvailableDates] = useState({});

    // Store last valid availability data when it changes
    useEffect(() => {
      if (availableDates && roomId && availableDates[roomId]) {
        setLastAvailableDates(availableDates);
      }
    }, [availableDates, roomId]);

    // Handle window resize to determine if we show two months side by side
    useEffect(() => {
      const handleResize = () => {
        setWindowWidth(window.innerWidth);
      };
      window.addEventListener("resize", handleResize);
      return () => {
        window.removeEventListener("resize", handleResize);
      };
    }, []);

    // Determine if we should show two calendars side by side based on screen width
    const showTwoCalendars = windowWidth >= 768; // Show two calendars on tablets and above

    // Calculate next month for dual calendar view
    const nextMonth = new Date(currentDate);
    nextMonth.setMonth(nextMonth.getMonth() + 1);

    // Navigate to previous month pair
    const prevMonthPair = () => {
      setCurrentDate(
        new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1)
      );
    };

    // Navigate to next month pair
    const nextMonthPair = () => {
      setCurrentDate(
        new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1)
      );
    };

    // Use useCallback to memoize the onDateSelect handler
    const handleDateSelect = useCallback(
      (date, isStart, calendarRoomId) => {
        if (onDateSelect) {
          // Pass null as third parameter to avoid changing room selection when clicking calendar
          onDateSelect(date, isStart, null);
        }
      },
      [onDateSelect]
    );

    // Days of the week header
    const daysOfWeek = ["LU", "MA", "ME", "JE", "VE", "SA", "DI"];

    // Get month name for display
    const getMonthName = (date) => {
      return date.toLocaleString("fr-FR", { month: "long" }).toUpperCase();
    };

    // Format date to YYYY-MM-DD consistently
    const formatDate = (date) => {
      const d = new Date(date);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
        2,
        "0"
      )}-${String(d.getDate()).padStart(2, "0")}`;
    };

    // Get the most recent valid availability data
    const getAvailabilityData = () => {
      // Check if current availability data is valid
      if (availableDates && roomId && availableDates[roomId]) {
        return availableDates;
      }
      
      // Fall back to last valid data
      if (lastAvailableDates && roomId && lastAvailableDates[roomId]) {
        return lastAvailableDates;
      }
      
      // If nothing is available, return an empty object
      return {};
    };

    // Check if a date has a checkout-only flag on the previous day
    const isSmoobuCheckoutDay = (date) => {
      if (!roomId) return false;

      const availabilityData = getAvailabilityData();
      if (!availabilityData || !availabilityData[roomId]) return false;

      const dateStr = formatDate(date);
      const roomData = availabilityData[roomId];

      // Don't process dates we have no data for
      if (!(dateStr in roomData)) return false;

      // Create a date for the previous day
      const prevDay = new Date(date);
      prevDay.setDate(prevDay.getDate() - 1);
      const prevDateStr = formatDate(prevDay);

      // Check if the PREVIOUS day has the checkoutOnly flag
      // If so, THIS day should be displayed as a checkout day
      return roomData[prevDateStr] && roomData[prevDateStr].checkoutOnly === true;
    };

    // Check if a date is available
    const isDateAvailable = (date) => {
      // Check if we have the necessary data
      const availabilityData = getAvailabilityData();
      if (!roomId || !availabilityData || !availabilityData[roomId]) {
        return true; // Default to available when no data
      }

      const dateStr = formatDate(date);
      const roomData = availabilityData[roomId];

      // If we don't have data for this specific date, consider it available
      if (!(dateStr in roomData)) {
        return true;
      }

      // IMPORTANT: If this date is being selected as a checkout date (end date),
      // we should consider it available
      if (startDate && !endDate) {
        // We are selecting an end date (checkout day)
        // If this date is right after the start date, consider it available for checkout
        const dayAfterStart = new Date(startDate);
        dayAfterStart.setDate(dayAfterStart.getDate() + 1);
        if (formatDate(dayAfterStart) === dateStr) {
          return true;
        }
      }

      // IMPORTANT: Checkout days should be considered available
      if (isSmoobuCheckoutDay(date)) {
        return true;
      }

      // Check if explicitly unavailable
      if (
        roomData[dateStr] &&
        roomData[dateStr].available !== undefined &&
        roomData[dateStr].available === 0
      ) {
        return false;
      }

      // Default to available
      return true;
    };

    // Check if a date is partially available
    const isDatePartiallyAvailable = (date) => {
      return (
        isSmoobuCheckoutDay(date) ||
        isDateCheckinOnly(date, roomId, getAvailabilityData())
      );
    };

    // Check if a date is selected (either start or end date)
    const isDateSelected = (date) => {
      if (!startDate && !endDate) return false;

      // Compare dates by day, month, and year only
      const isSameDate = (date1, date2) => {
        if (!date1 || !date2) return false;
        return (
          date1.getDate() === date2.getDate() &&
          date1.getMonth() === date2.getMonth() &&
          date1.getFullYear() === date2.getFullYear()
        );
      };

      return isSameDate(date, startDate) || isSameDate(date, endDate);
    };

    // Check if a date is in the selected range (between start and end)
    const isDateInRange = (date) => {
      if (!startDate || !endDate) return false;

      // Extract just the date parts (year, month, day)
      const current = new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate()
      );
      const start = new Date(
        startDate.getFullYear(),
        startDate.getMonth(),
        startDate.getDate()
      );
      const end = new Date(
        endDate.getFullYear(),
        endDate.getMonth(),
        endDate.getDate()
      );

      // Compare using getTime() for accurate results
      return (
        current.getTime() > start.getTime() && current.getTime() < end.getTime()
      );
    };

    // Check if a date is in the hovered range
    const isDateInHoveredRange = (date) => {
      if (!startDate || !hoveredDate || endDate) return false;

      const currentTime = date.getTime();
      const startTime = new Date(startDate).getTime();
      const hoverTime = hoveredDate.getTime();

      return (
        (currentTime > startTime && currentTime <= hoverTime) ||
        (currentTime < startTime && currentTime >= hoverTime)
      );
    };

    // Check if a date is clickable with proper checkout handling
    const isDateClickable = (date) => {
      // Calculate tomorrow (today + 1 day)
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);

      // Don't allow selecting today or dates in the past
      // Only allow selecting tomorrow and future dates
      if (date < tomorrow) {
        return false;
      }

      // During initial render or before search, allow all future dates
      if (!hasSearched) {
        return true;
      }

      // For selecting a start date (or first date in a new selection)
      if (!startDate || (startDate && endDate)) {
        // Checkout-only dates cannot be used as start dates
        if (isSmoobuCheckoutDay(date)) {
          return false;
        }
        return isDateAvailable(date);
      }

      // For selecting an end date
      if (startDate && !endDate) {
        // If selecting a date before current start, handle as new start date
        if (date < startDate) {
          // Checkout-only dates cannot be used as start dates
          if (isSmoobuCheckoutDay(date)) {
            return false;
          }
          return isDateAvailable(date);
        }

        // If it's the day immediately after the start date, always allow it
        const dayAfterStart = new Date(startDate);
        dayAfterStart.setDate(dayAfterStart.getDate() + 1);
        if (formatDate(date) === formatDate(dayAfterStart)) {
          return true;
        }

        // For other dates, check if the range (excluding the end date) is available
        return isRoomAvailable(
          roomId,
          startDate,
          date,
          getAvailabilityData(),
          hasSearched
        );
      }

      return isDateAvailable(date);
    };

    // Generate calendar for a specific month
    const generateCalendarMonth = (dateObj) => {
      const year = dateObj.getFullYear();
      const month = dateObj.getMonth();

      // First day of month
      const firstDay = new Date(year, month, 1);

      // Last day of month
      const lastDay = new Date(year, month + 1, 0);

      // Day of week for first day (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
      // Adjust for Monday as first day of week
      let firstDayOfWeek = firstDay.getDay();
      firstDayOfWeek = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;

      const days = [];

      // Add empty slots for days before the first day of month
      for (let i = 0; i < firstDayOfWeek; i++) {
        days.push({ date: null, empty: true });
      }

      // Add days of the month
      for (let i = 1; i <= lastDay.getDate(); i++) {
        const date = new Date(year, month, i);
        days.push({ date, empty: false });
      }

      return days;
    };

    // Handle date click
    const handleDateClick = (date) => {
      // Check if date is clickable
      if (!isDateClickable(date)) {
        return;
      }

      // Convert to noon to avoid timezone issues
      const selectedDate = new Date(date);
      selectedDate.setHours(12, 0, 0, 0);

      if (startDate && endDate) {
        // Clear end date first
        handleDateSelect(null, false, roomId);

        // Set new start date
        setTimeout(() => {
          handleDateSelect(selectedDate, true, roomId);
        }, 0);
        return;
      }

      if (!startDate) {
        handleDateSelect(selectedDate, true, roomId);
      } else if (selectedDate < new Date(startDate)) {
        handleDateSelect(selectedDate, true, roomId);
      } else {
        handleDateSelect(selectedDate, false, roomId);
      }
    };

    // Handle mouse enter on a date
    const handleDateMouseEnter = (date) => {
      if (startDate && !endDate) {
        setHoveredDate(date);
      }
    };

    // Handle mouse leave
    const handleDateMouseLeave = () => {
      setHoveredDate(null);
    };

    const isPastOrToday = (date) => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const checkDate = new Date(date);
      checkDate.setHours(0, 0, 0, 0);

      return checkDate <= today;
    };

    /**
     * Check if a date is today
     * @param {Date} date - The date to check
     * @returns {boolean} - True if the date is today
     */
    const isToday = (date) => {
      const today = new Date();

      return (
        date.getDate() === today.getDate() &&
        date.getMonth() === today.getMonth() &&
        date.getFullYear() === today.getFullYear()
      );
    };

    // Generate calendar days for current and next month
    const currentMonthDays = generateCalendarMonth(currentDate);
    const nextMonthDays = generateCalendarMonth(nextMonth);

    // Render a single month calendar
    const renderMonth = (monthDate, calendarDays) => (
      <div className="custom-calendar-month">
        <div className="calendar-header-month">
          <span className="calendar-month">{getMonthName(monthDate)}</span>
          <span className="calendar-year">{monthDate.getFullYear()}</span>
        </div>

        <div className="calendar-days-header">
          {daysOfWeek.map((day, index) => (
            <div key={index} className="calendar-day-header">
              {day}
            </div>
          ))}
        </div>

        <div className="calendar-days-grid">
          {calendarDays.map((dayObj, index) => {
            if (dayObj.empty) {
              return (
                <div
                  key={`empty-${monthDate.getMonth()}-${index}`}
                  className="calendar-day empty"
                ></div>
              );
            }

            const date = dayObj.date;
            const dateStr = formatDate(date);

            // Add checks for past dates and today
            const isPast = isPastOrToday(date);
            const isTodayDate = isToday(date);

            // Get availability data
            const availabilityData = getAvailabilityData();
            const roomData =
              roomId && availabilityData && availabilityData[roomId];
            const dateData = roomData ? roomData[dateStr] : null;

            // Determine date status for styling - follow Smoobu's visual pattern
            const isAvailable = isDateAvailable(date);
            const isCheckout = isSmoobuCheckoutDay(date);
            const isCheckin = isDateCheckinOnly(date, roomId, availabilityData);
            const isPartial = isDatePartiallyAvailable(date);
            const isSelected = isDateSelected(date);
            const isInRange = isDateInRange(date);
            const isInHoverRange = isDateInHoveredRange(date);
            const isClickable = isDateClickable(date);

            // Build classes - apply them in the correct order
            let classNames = "calendar-day";

            // Add past or today classes first
            if (isPast) {
              classNames += isTodayDate ? " today" : " past-date";
            }

            if (!isAvailable) {
              classNames += " unavailable";
            } else if (isCheckout) {
              classNames += " checkout-only";
            } else if (isCheckin) {
              classNames += " checkin-only";
            } else if (isPartial) {
              classNames += " partially-available";
            }

            if (isSelected) classNames += " selected";
            if (isInRange) classNames += " in-range";
            if (isInHoverRange) classNames += " in-hover-range";
            if (isClickable) classNames += " clickable";

            // Add data attributes for debugging
            const dataStatus = isCheckout
              ? "checkout-only"
              : !isAvailable
              ? "unavailable"
              : isCheckin
              ? "check-in-only"
              : isPartial
              ? "partially-available"
              : "available";

            return (
              <div
                key={`day-${monthDate.getMonth()}-${date.getDate()}`}
                className={classNames}
                onClick={() => handleDateClick(date)}
                onMouseEnter={() => handleDateMouseEnter(date)}
                onMouseLeave={handleDateMouseLeave}
                data-date={dateStr}
                data-status={dataStatus}
                style={{
                  backgroundColor: isSelected
                    ? "#668E73"
                    : isInRange
                    ? "rgba(102, 142, 115, 0.2)"
                    : undefined,
                  color: isSelected ? "#ffffff" : undefined,
                  fontWeight: isSelected ? "bold" : undefined,
                }}
              >
                <span className="calendar-day-number">{date.getDate()}</span>
              </div>
            );
          })}
        </div>
      </div>
    );

    return (
      <div className="calendar-room">
        <h3 className="text-lg font-medium text-[#668E73] mb-3">
          {t("calendar.availability")}
        </h3>
        
        {/* Unified calendar container */}
        <div className="unified-calendar">
          {/* Shared navigation controls */}
          <div className="calendar-navigation-controls">
            <button className="calendar-nav-btn" onClick={prevMonthPair}>
              &lt;
            </button>
            <div className="calendar-date-range">
              {getMonthName(currentDate)} {currentDate.getFullYear()} - {getMonthName(nextMonth)} {nextMonth.getFullYear()}
            </div>
            <button className="calendar-nav-btn" onClick={nextMonthPair}>
              &gt;
            </button>
          </div>
          
          {/* Calendar months container */}
          <div className="calendar-months-container">
            {/* Always render the current month */}
            <div className={showTwoCalendars ? "calendar-month-half" : "calendar-month-full"}>
              {renderMonth(currentDate, currentMonthDays)}
            </div>
            
            {/* Conditionally render the next month based on screen size */}
            {showTwoCalendars && (
              <div className="calendar-month-half">
                {renderMonth(nextMonth, nextMonthDays)}
              </div>
            )}
          </div>
          
          {/* Shared legend for both calendars */}
          <div className="calendar-legend">
            <div className="legend-item">
              <div className="legend-color available"></div>
              <span>{t("calendar.available")}</span>
            </div>
            <div className="legend-item">
              <div className="legend-color unavailable"></div>
              <span>{t("calendar.unavailable")}</span>
            </div>
            <div className="legend-item">
              <div className="legend-color partially-available"></div>
              <span>{t("calendar.partiallyAvailable")}</span>
            </div>
          </div>
        </div>
        
        <div className="mt-4 text-sm text-gray-600">
          <p>{t("calendar.instructions")}</p>
        </div>
      </div>
    );
  }
);

// Add a displayName for better debugging
CalendarRoom.displayName = "CalendarRoom";

