import React from "react";
import PropTypes from "prop-types";
import {
  isToday,
  isPastOrToday, // Reverted back to your original, working function
  formatDate,
  isSameDate,
} from "../../utils/dateUtils";
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
  currency = "€",
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

  // Use the function we know exists in your code
  const isPast = isPastOrToday(date);
  const isTodayDate = isToday(date);

  const price = availabilityService.getPriceForDate(date);
  const formattedPrice =
    price !== null
      ? price.toLocaleString(undefined, {
          style: "currency",
          currency: currency === "€" ? "EUR" : "USD",
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        })
      : null;

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

  // --- THE CORE FIX: This logic is correct and remains ---
  // First, get the general clickability from the service.
  // This already checks for past dates, availability, etc.
  let isClickable = availabilityService.isDateClickable(
    date,
    startDate,
    endDate,
    true
  );

  // Now, add the specific rule to prevent double-clicking the start date.
  if (startDate && !endDate && isSameDate(date, startDate)) {
    isClickable = false;
  }
  // --- END OF FIX ---

  let classNames = "calendar-day";
  if (isPast) classNames += isTodayDate ? " today" : " past-date";
  if (!isAvailable && !isPartial) {
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

  // Simplified back to the original logic. The `isClickable` variable should be the single source of truth.
  if (isClickable) classNames += " clickable";

  // Don't show price for past dates, or if no price exists
  const showPrice = !isPast && formattedPrice !== null;

  return (
    <div
      key={`day-${monthDate.getMonth()}-${date.getDate()}`}
      className={classNames}
      onClick={() => isClickable && onDateClick(date)}
      onMouseEnter={() => onDateMouseEnter(date)}
      onMouseLeave={onDateMouseLeave}
      data-date={dateStr}
    >
      <div className="day-content">
        <span className="calendar-day-number">{date.getDate()}</span>
        {showPrice && (
          <span className="calendar-day-price">{formattedPrice}</span>
        )}
      </div>
    </div>
  );
};

// PropTypes are unchanged and correct
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
  currency: PropTypes.string,
};
