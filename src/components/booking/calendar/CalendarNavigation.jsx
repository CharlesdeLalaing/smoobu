// components/CalendarNavigation.jsx
import React from "react";
import PropTypes from "prop-types";
import { getMonthName } from "../../utils/dateUtils";

export const CalendarNavigation = ({
  viewMonth,
  nextMonth,
  prevMonthPair,
  nextMonthPair,
}) => {
  return (
    <div className="calendar-navigation-controls">
      <button
        type="button"
        className="calendar-nav-btn"
        onClick={prevMonthPair}
      >
        &lt;
      </button>
      <div className="calendar-date-range">
        {getMonthName(viewMonth)} {viewMonth.getFullYear()} -{" "}
        {getMonthName(nextMonth)} {nextMonth.getFullYear()}
      </div>
      <button
        type="button"
        className="calendar-nav-btn"
        onClick={nextMonthPair}
      >
        &gt;
      </button>
    </div>
  );
};

CalendarNavigation.propTypes = {
  viewMonth: PropTypes.instanceOf(Date).isRequired,
  nextMonth: PropTypes.instanceOf(Date).isRequired,
  prevMonthPair: PropTypes.func.isRequired,
  nextMonthPair: PropTypes.func.isRequired,
};
