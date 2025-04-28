import React from "react";
import PropTypes from "prop-types";
import {
  isToday,
  isPastOrToday,
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
  // Assuming currency is passed down or globally available, e.g., 'EUR'
  // For simplicity, let's hardcode it here, but ideally get it from props/context
  currency = "€", // Or '$', '£', etc.
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

  const isPast = isPastOrToday(date);
  const isTodayDate = isToday(date);

  // --- Get the price for this day ---
  const price = availabilityService.getPriceForDate(date);
  // --- Format the price for display ---
  const formattedPrice =
    price !== null
      ? price.toLocaleString(undefined, {
          // Use locale formatting
          style: "currency",
          currency: currency === "€" ? "EUR" : "USD", // Map symbol to code
          minimumFractionDigits: 0, // Optional: Adjust decimals
          maximumFractionDigits: 0, // Optional: Adjust decimals
        })
      : null; // Or set to ''

  // Determine date status (your existing logic)
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
  ); // Assuming true for hasSearched here

  // Build classes (your existing logic)
  let classNames = "calendar-day";
  if (isPast) classNames += isTodayDate ? " today" : " past-date";
  if (!isAvailable && !isPartial)
    classNames +=
      " unavailable"; // Adjusted logic from previous discussion might be needed here
  else if (isCheckout) classNames += " checkout-only";
  else if (isCheckin) classNames += " checkin-only";
  else if (isPartial) classNames += " partially-available";
  if (isSelected) classNames += " selected";
  if (isInRange) classNames += " in-range";
  if (isInHoverRange) classNames += " in-hover-range";
  if (isClickable) classNames += " clickable";

  // --- Determine if price should be shown ---
  // Don't show price for past dates, or if no price exists
  const showPrice = !isPast && formattedPrice !== null;
  // Optional: You might also hide price on 'unavailable' days depending on preference
  // const showPrice = !isPast && formattedPrice !== null && (isAvailable || isPartial);

  return (
    <div
      key={`day-${monthDate.getMonth()}-${date.getDate()}`}
      className={classNames}
      onClick={() => isClickable && onDateClick(date)} // Only trigger click if clickable
      onMouseEnter={() => onDateMouseEnter(date)}
      onMouseLeave={onDateMouseLeave}
      data-date={dateStr}
      // data-status={dataStatus} // Keep if needed
      // Remove inline styles if managed by classes
    >
      {/* --- Container for Number and Price (using Flexbox) --- */}
      <div className="day-content">
        <span className="calendar-day-number">{date.getDate()}</span>
        {/* --- Conditionally render the price --- */}
        {showPrice && (
          <span className="calendar-day-price">
            {/* Display formatted price */}
            {formattedPrice}
          </span>
        )}
      </div>
    </div>
  );
};

// --- PropTypes (add currency if passed as prop) ---
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
