import React from "react";
import PropTypes from "prop-types";
import { getMonthName } from "../../utils/dateUtils";
import { CalendarDay } from "./CalendarDay";
import { AvailabilityService } from "../services/AvailabilityService";

export const CalendarMonth = ({
  monthDate,
  calendarDays,
  availabilityService,
  startDate,
  endDate,
  hoveredDate,
  onDateClick,
  onDateMouseEnter,
  onDateMouseLeave,
}) => {
  const daysOfWeek = ["LU", "MA", "ME", "JE", "VE", "SA", "DI"];

  return (
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
        {calendarDays.map((dayObj, index) => (
          <CalendarDay
            key={`day-${index}`}
            dayObj={dayObj}
            monthDate={monthDate}
            index={index}
            availabilityService={availabilityService}
            startDate={startDate}
            endDate={endDate}
            hoveredDate={hoveredDate}
            onDateClick={onDateClick}
            onDateMouseEnter={onDateMouseEnter}
            onDateMouseLeave={onDateMouseLeave}
          />
        ))}
      </div>
    </div>
  );
};

CalendarMonth.propTypes = {
  monthDate: PropTypes.instanceOf(Date).isRequired,
  calendarDays: PropTypes.array.isRequired,
  availabilityService: PropTypes.instanceOf(AvailabilityService).isRequired,
  startDate: PropTypes.instanceOf(Date),
  endDate: PropTypes.instanceOf(Date),
  hoveredDate: PropTypes.instanceOf(Date),
  onDateClick: PropTypes.func.isRequired,
  onDateMouseEnter: PropTypes.func.isRequired,
  onDateMouseLeave: PropTypes.func.isRequired,
};
