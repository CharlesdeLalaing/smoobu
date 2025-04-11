import React from "react";
import PropTypes from "prop-types";
import { isToday, isPastOrToday, formatDate, isSameDate } from "../../utils/dateUtils";
import { isDateCheckinOnly } from "../../hooks/roomUtils";
import { AvailabilityService } from "../services/AvailabilityService";

export const CalendarDay = ({
  dayObj,
  monthDate,
  index,
  availabilityService,
  startDate,
  endDate,
  hoveredDate,
  onDateClick,
  onDateMouseEnter,
  onDateMouseLeave,
}) => {
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

  // Determine date status for styling - follow Smoobu's visual pattern
  const isAvailable = availabilityService.isDateAvailable(
    date,
    startDate,
    endDate
  );
  const isCheckout = availabilityService.isSmoobuCheckoutDay(date);
  const isCheckin = isDateCheckinOnly(
    date,
    availabilityService.roomId,
    availabilityService.getAvailabilityData()
  );
  const isPartial = availabilityService.isDatePartiallyAvailable(date);
  const isSelected = isSameDate(date, startDate) || isSameDate(date, endDate);
  const isInRange = availabilityService.isDateInRange(date, startDate, endDate);
  const isInHoverRange = availabilityService.isDateInHoveredRange(
    date,
    startDate,
    hoveredDate,
    endDate
  );
  const isClickable = availabilityService.isDateClickable(
    date,
    startDate,
    endDate,
    true
  );

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
      onClick={() => onDateClick(date)}
      onMouseEnter={() => onDateMouseEnter(date)}
      onMouseLeave={onDateMouseLeave}
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
};

CalendarDay.propTypes = {
  dayObj: PropTypes.shape({
    date: PropTypes.instanceOf(Date),
    empty: PropTypes.bool,
  }).isRequired,
  monthDate: PropTypes.instanceOf(Date).isRequired,
  index: PropTypes.number.isRequired,
  availabilityService: PropTypes.instanceOf(AvailabilityService).isRequired,
  startDate: PropTypes.instanceOf(Date),
  endDate: PropTypes.instanceOf(Date),
  hoveredDate: PropTypes.instanceOf(Date),
  onDateClick: PropTypes.func.isRequired,
  onDateMouseEnter: PropTypes.func.isRequired,
  onDateMouseLeave: PropTypes.func.isRequired,
};
