import React, { useCallback, memo } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { useCalendarView } from "../hooks/useCalendarView";
import { useWindowWidth } from "../hooks/useWindowWidth";
import { useHoveredDate } from "../hooks/useHoveredDate";
import { AvailabilityService } from "./services/AvailabilityService";
import { generateCalendarMonth } from "../utils/dateUtils";
import { CalendarNavigation } from "./calendar/CalendarNavigation";
import { CalendarMonth } from "./calendar/CalendarMonth";
import { CalendarLegend } from "./calendar/CalendarLegend";
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
    const { viewMonth, nextMonth, prevMonthPair, nextMonthPair } =
      useCalendarView(roomId);
    const windowWidth = useWindowWidth();
    const {
      hoveredDate,
      handleDateMouseEnter: baseHandleMouseEnter,
      handleDateMouseLeave,
    } = useHoveredDate();

    // Show two calendars on tablets and above
    const showTwoCalendars = windowWidth >= 768;

    // Initialize the availability service
    const availabilityService = new AvailabilityService(roomId, availableDates);

    // IMPORTANT: Date selection handler - doesn't change the view month
    const handleDateSelect = useCallback(
      (date, isStart) => {
        if (onDateSelect) {
          // Simply pass the date to the parent component
          onDateSelect(date, isStart);
        }
      },
      [onDateSelect]
    );

    // Generate calendar days for current and next month
    const currentMonthDays = generateCalendarMonth(viewMonth);
    const nextMonthDays = generateCalendarMonth(nextMonth);

    // Handle date mouse enter with the required parameters
    const handleDateMouseEnter = (date) => {
      baseHandleMouseEnter(date, startDate, endDate);
    };

    // Handle date click - importantly, does NOT change the view month
    const handleDateClick = (date) => {
      // Check if date is clickable
      if (
        !availabilityService.isDateClickable(
          date,
          startDate,
          endDate,
          hasSearched
        )
      ) {
        return;
      }

      // Convert to noon to avoid timezone issues
      const selectedDate = new Date(date);
      selectedDate.setHours(12, 0, 0, 0);

      if (startDate && endDate) {
        // Clear end date first
        handleDateSelect(null, false);

        // Set new start date
        setTimeout(() => {
          handleDateSelect(selectedDate, true);
        }, 0);
        return;
      }

      if (!startDate) {
        handleDateSelect(selectedDate, true);
      } else if (selectedDate < new Date(startDate)) {
        handleDateSelect(selectedDate, true);
      } else {
        handleDateSelect(selectedDate, false);
      }
    };

    return (
      <div className="calendar-room">


        {/* Unified calendar container */}
        <div className="unified-calendar">
          {/* Shared navigation controls */}
          <CalendarNavigation
            viewMonth={viewMonth}
            nextMonth={nextMonth}
            prevMonthPair={prevMonthPair}
            nextMonthPair={nextMonthPair}
          />

          {/* Calendar months container */}
          <div className="calendar-months-container">
            {/* Always render the current month */}
            <div
              className={
                showTwoCalendars ? "calendar-month-half" : "calendar-month-full"
              }
            >
              <CalendarMonth
                monthDate={viewMonth}
                calendarDays={currentMonthDays}
                availabilityService={availabilityService}
                startDate={startDate}
                endDate={endDate}
                hoveredDate={hoveredDate}
                onDateClick={handleDateClick}
                onDateMouseEnter={handleDateMouseEnter}
                onDateMouseLeave={handleDateMouseLeave}
              />
            </div>

            {/* Conditionally render the next month based on screen width */}
            {showTwoCalendars && (
              <div className="calendar-month-half">
                <CalendarMonth
                  monthDate={nextMonth}
                  calendarDays={nextMonthDays}
                  availabilityService={availabilityService}
                  startDate={startDate}
                  endDate={endDate}
                  hoveredDate={hoveredDate}
                  onDateClick={handleDateClick}
                  onDateMouseEnter={handleDateMouseEnter}
                  onDateMouseLeave={handleDateMouseLeave}
                />
              </div>
            )}
          </div>

          {/* Shared legend for both calendars */}
          <CalendarLegend t={t} />
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

CalendarRoom.propTypes = {
  roomId: PropTypes.string.isRequired,
  availableDates: PropTypes.object,
  startDate: PropTypes.instanceOf(Date),
  endDate: PropTypes.instanceOf(Date),
  onDateSelect: PropTypes.func.isRequired,
  hasSearched: PropTypes.bool,
};

export default CalendarRoom;
