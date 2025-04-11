import React from "react";
import PropTypes from "prop-types";
import i18next from "i18next";
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
  // Get current language from i18next
  const currentLocale = i18next.language || "fr";

  // Days of week for different languages
  const daysOfWeekByLocale = {
    fr: ["LU", "MA", "ME", "JE", "VE", "SA", "DI"],
    en: ["MO", "TU", "WE", "TH", "FR", "SA", "SU"],
    nl: ["MA", "DI", "WO", "DO", "VR", "ZA", "ZO"],
  };

  // Use the appropriate days based on the current locale (with fallback to French)
  const daysOfWeek = daysOfWeekByLocale[currentLocale] || daysOfWeekByLocale.fr;


  return (
    <div className="custom-calendar-month">

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
