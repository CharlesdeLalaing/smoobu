import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import "./CustomCalendar.css";
import {
  isRoomAvailable,
  isDateCheckinOnly,
  formatDate as formatDateUtil,
} from "../hooks/roomUtils";

const CustomCalendar = ({
  roomId,
  availableDates,
  startDate,
  endDate,
  onDateSelect,
  hasSearched,
  initialMonth = null,
}) => {
  const { t } = useTranslation();
  const [currentDate, setCurrentDate] = useState(initialMonth || new Date());
  const [calendarDays, setCalendarDays] = useState([]);
  const [hoveredDate, setHoveredDate] = useState(null);

  console.log("CustomCalendar rendered", {
    roomId,
    hasAvailableDates: !!availableDates,
    startDate,
    endDate,
    hasSearched,
  });

  // Days of the week header
  const daysOfWeek = ["LU", "MA", "ME", "JE", "VE", "SA", "DI"];

  // Get month name
  const getMonthName = (date) => {
    return date.toLocaleString("fr-FR", { month: "long" }).toUpperCase();
  };

  // Navigate to previous month
  const prevMonth = () => {
    setCurrentDate(
      new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1)
    );
  };

  // Navigate to next month
  const nextMonth = () => {
    setCurrentDate(
      new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1)
    );
  };

  // Format date to YYYY-MM-DD consistently
  const formatDate = (date) => {
    const d = new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
      2,
      "0"
    )}-${String(d.getDate()).padStart(2, "0")}`;
  };

  /**
   * CORRECTED PATTERN DETECTION:
   *
   * In Smoobu's calendar:
   * 1. If a date has checkoutOnly=true flag, then THE NEXT DAY should be displayed as checkout-only
   * 2. The date with the flag should be fully available (white)
   */
  const isSmoobuCheckoutDay = (date) => {
    if (!roomId || !availableDates || !availableDates[roomId]) return false;

    const dateStr = formatDate(date);
    const roomData = availableDates[roomId];

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

  const debugCalendarData = () => {
    if (roomId && availableDates && availableDates[roomId]) {
      console.log("=== DEBUG CALENDAR DATA ===");
      console.log("Calendar data for room:", roomId);

      // Add this new debug section
      console.log("RAW AVAILABILITY DATA:");
      for (let day = 10; day <= 26; day++) {
        const date = new Date(2025, 3, day); // April
        const dateStr = formatDate(date);
        if (availableDates[roomId][dateStr]) {
          console.log(
            `April ${day} raw data: `,
            availableDates[roomId][dateStr]
          );
        }
      }

      // Examine specific checkout days
      console.log("CHECKOUT DAY ANALYSIS - CORRECTED PATTERN:");
      [
        "2025-04-10",
        "2025-04-11",
        "2025-04-17",
        "2025-04-18",
        "2025-04-24",
        "2025-04-25",
      ].forEach((dateStr) => {
        const date = new Date(dateStr);

        // Get previous day
        const prevDay = new Date(date);
        prevDay.setDate(prevDay.getDate() - 1);
        const prevDateStr = formatDate(prevDay);

        // Get next day
        const nextDay = new Date(date);
        nextDay.setDate(nextDay.getDate() + 1);
        const nextDateStr = formatDate(nextDay);

        if (availableDates[roomId][dateStr]) {
          console.log(`${dateStr} analysis:`, {
            prevDay: prevDateStr,
            prevDayHasFlag:
              availableDates[roomId][prevDateStr]?.checkoutOnly === true,
            thisDay: dateStr,
            thisDayData: availableDates[roomId][dateStr],
            thisDayHasFlag:
              availableDates[roomId][dateStr].checkoutOnly === true,
            isDetectedAsCheckout: isSmoobuCheckoutDay(date),
            displayedAs: isSmoobuCheckoutDay(date)
              ? "checkout-only"
              : "available",
          });
        }
      });

      console.log("========================");
    }
  };

  // Check if a date is available
  const isDateAvailable = (date) => {
    // Check if we have the necessary data
    if (!roomId || !availableDates || !availableDates[roomId]) {
      return true; // Default to available when no data
    }

    const dateStr = formatDate(date);
    const roomData = availableDates[roomId];

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
      isDateCheckinOnly(date, roomId, availableDates)
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

  // Check if a date can be clicked with proper checkout handling
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
      availableDates,
      hasSearched
    );
  }

  return isDateAvailable(date);
};

  // Handle date click
  const handleDateClick = (date) => {
    console.log("Date clicked:", formatDate(date));
    console.log("Is clickable:", isDateClickable(date));

    // Check if date is clickable
    if (!isDateClickable(date)) {
      console.log("Date not clickable - returning");
      return;
    }

    // Convert to noon to avoid timezone issues
    const selectedDate = new Date(date);
    selectedDate.setHours(12, 0, 0, 0);

    console.log("Selected date (noon):", selectedDate);
    console.log("Current state - startDate:", startDate, "endDate:", endDate);

    // If no start date is selected, or if both dates are selected (new selection)
    if (!startDate || (startDate && endDate)) {
      console.log("Setting as START date");
      onDateSelect(selectedDate, true);
    } else {
      // If start date is selected but no end date
      // Ensure end date is after start date
      if (selectedDate < new Date(startDate)) {
        console.log(
          "Selected date is before start date - setting as new START date"
        );
        onDateSelect(selectedDate, true);
      } else {
        console.log("Setting as END date");
        onDateSelect(selectedDate, false);
      }
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

  // Verify availability data on component mount or data change
  useEffect(() => {
    if (roomId && availableDates && availableDates[roomId]) {
      const roomData = availableDates[roomId];
      console.log(`Availability data for room ${roomId}:`);
      console.log("Number of dates with data:", Object.keys(roomData).length);

      // Debug calendar data for April
      debugCalendarData();

      // Check for dates with unavailability
      const unavailableDates = Object.entries(roomData)
        .filter(
          ([_, data]) => data.available !== undefined && data.available <= 0
        )
        .map(([date]) => date);

      console.log("Unavailable dates:", unavailableDates);

      // Check for partially available dates
      const partiallyAvailableDates = Object.entries(roomData)
        .filter(([date]) => isDatePartiallyAvailable(new Date(date)))
        .map(([date]) => date);

      console.log("Partially available dates:", partiallyAvailableDates);

      // Check current month data
      const currentMonth = currentDate.getMonth();
      const datesInCurrentMonth = Object.keys(roomData).filter(
        (dateStr) => new Date(dateStr).getMonth() === currentMonth
      );

      console.log(
        `Dates with data in current month (${currentMonth + 1}):`,
        datesInCurrentMonth.length > 0 ? datesInCurrentMonth : "none"
      );
    }
  }, [roomId, availableDates, currentDate]);


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


  // Generate calendar days for the current month
  useEffect(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

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

    setCalendarDays(days);
  }, [currentDate, availableDates, roomId]);

  return (
    <div className="custom-calendar">
      <div className="calendar-header">
        <div className="calendar-navigation">
          <span className="calendar-year">{currentDate.getFullYear()}</span>
          <span className="calendar-month">{getMonthName(currentDate)}</span>
        </div>
        <div className="calendar-controls">
          <button className="calendar-nav-btn" onClick={prevMonth}>
            &lt;
          </button>
          <button className="calendar-nav-btn" onClick={nextMonth}>
            &gt;
          </button>
        </div>
      </div>

      <div className="calendar-body">
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
                  key={`empty-${index}`}
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
            const roomData = roomId && availableDates && availableDates[roomId];
            const dateData = roomData ? roomData[dateStr] : null;

            // Determine date status for styling - follow Smoobu's visual pattern
            const isAvailable = isDateAvailable(date);
            const isCheckout = isSmoobuCheckoutDay(date);
            const isCheckin = isDateCheckinOnly(date, roomId, availableDates);
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
                key={`day-${date.getDate()}`}
                className={classNames}
                onClick={() => handleDateClick(date)}
                onMouseEnter={() => handleDateMouseEnter(date)}
                onMouseLeave={handleDateMouseLeave}
                data-date={dateStr}
                data-status={dataStatus}
                style={{
                  // Only apply background for selected and range status
                  // Let CSS handle the available/unavailable/partially-available styling
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
  );
};

export default CustomCalendar;
