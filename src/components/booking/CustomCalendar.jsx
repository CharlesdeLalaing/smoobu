import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import "./CustomCalendar.css";

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

  // Check if a date is available

  const isDateAvailable = (date) => {
    // Check if we have the necessary data
    if (!roomId || !availableDates || !availableDates[roomId]) {
      console.log("Missing availability data for room:", roomId);
      return true; // Default to available when no data
    }

    const dateStr = formatDate(date);
    const roomData = availableDates[roomId];

    // Debug what we're checking
    console.log(`Checking availability for ${dateStr}:`, {
      hasData: dateStr in roomData,
      data: roomData[dateStr],
    });

    // If we have explicit unavailability data
    if (
      dateStr in roomData &&
      roomData[dateStr] &&
      roomData[dateStr].available !== undefined &&
      roomData[dateStr].available === 0
    ) {
      return false;
    }

    // Default to available
    return true;
  };

  // In CustomCalendar.jsx
  const isDatePartiallyAvailable = (date) => {
    if (!roomId || !availableDates || !availableDates[roomId]) return false;

    const dateStr = formatDate(date);
    const roomData = availableDates[roomId];

    // First, check if we have explicit partial availability info
    if (
      dateStr in roomData &&
      roomData[dateStr] &&
      roomData[dateStr].partiallyAvailable
    ) {
      return true;
    }

    // For Smoobu data compatibility, check for dates that might be marked in a specific way
    // This is a guess based on your screenshot - you might need to adjust based on actual data
    if (dateStr in roomData && roomData[dateStr]) {
      // Check for any properties that might indicate partial availability
      // For example, checkout-only days, days with limited hours, etc.
      const data = roomData[dateStr];
      if (data.checkoutOnly || data.partialDay || data.limitedHours) {
        return true;
      }
    }

    return false;
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

  // Handle date click
  const handleDateClick = (date) => {
    console.log("Date clicked:", date);
    console.log("Is clickable:", isDateClickable(date));

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

  // Check if a date can be clicked
  const isDateClickable = (date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Don't allow selecting dates in the past
    if (date < today) {
      console.log("Date not clickable: In the past");
      return false;
    }

    // During initial render or before search, allow all future dates
    if (!hasSearched) {
      console.log("Date clickable: No search performed yet");
      return true;
    }

    // Always allow selecting the start date if it's available
    if (!startDate || (startDate && endDate)) {
      const available = isDateAvailable(date);
      console.log("Selecting start date, available:", available);
      return available;
    }

    // For end date selection, we check if all dates in the range are available
    const startDateTime = new Date(startDate).getTime();
    const currentDateTime = date.getTime();

    // If selecting an end date before the start date, allow it if the date is available
    if (currentDateTime < startDateTime) {
      const available = isDateAvailable(date);
      console.log("Selecting date before start date, available:", available);
      return available;
    }

    // For simplicity in this initial fix, let's allow any date selection
    // We can add more sophisticated range checking later if needed
    const available = isDateAvailable(date);
    console.log("Selecting end date, available:", available);
    return available;
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

      // Check for dates with unavailability
      const unavailableDates = Object.entries(roomData)
        .filter(
          ([_, data]) => data.available !== undefined && data.available <= 0
        )
        .map(([date]) => date);

      console.log("Unavailable dates:", unavailableDates);

      // Check for partially available dates
      const partiallyAvailableDates = Object.entries(roomData)
        .filter(([_, data]) => data.partiallyAvailable)
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

            // Get availability data
            const roomData = roomId && availableDates && availableDates[roomId];
            const dateData = roomData ? roomData[dateStr] : null;

            // Determine date status for styling
            const isAvailable = isDateAvailable(date);
            const isPartiallyAvailable = isDatePartiallyAvailable(date);
            const isSelected = isDateSelected(date);
            const isInRange = isDateInRange(date);
            const isInHoverRange = isDateInHoveredRange(date);
            const isClickable = isDateClickable(date);

            // Build classes
            let classNames = "calendar-day";
            if (!isAvailable) classNames += " unavailable";
            if (isPartiallyAvailable) classNames += " partially-available";
            if (isSelected) classNames += " selected";
            if (isInRange) classNames += " in-range";
            if (isInHoverRange) classNames += " in-hover-range";
            if (isClickable) classNames += " clickable";

            // Add a data attribute for debugging
            const dataStatus = dateData
              ? `${dateData.available > 0 ? "available" : "unavailable"}`
              : "no-data";

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

                {/* Red dot indicator at the bottom-right of unavailable dates */}
                {!isAvailable && (
                  <span className="unavailable-indicator"></span>
                )}

                {/* Orange dot indicator at the bottom-right of partially available dates */}
                {isPartiallyAvailable && (
                  <span className="partially-available-indicator"></span>
                )}
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
