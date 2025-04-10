import i18next from "i18next";

export const CalendarNavigation = ({
  viewMonth,
  nextMonth,
  prevMonthPair,
  nextMonthPair,
  showTwoCalendars, // Add this new prop
}) => {
  // Get current language from i18next
  const currentLocale = i18next.language || "fr";

  // Get localized month name
  const getLocalizedMonthName = (date) => {
    return date.toLocaleString(currentLocale, { month: "long" }).toUpperCase();
  };

  return (
    <>
      {/* Green navigation bar */}
      <div className="calendar-navigation-controls">
        <button
          type="button"
          className="calendar-nav-btn"
          onClick={prevMonthPair}
        >
          &lt;
        </button>
        <div className="calendar-date-range">{/* Empty space */}</div>
        <button
          type="button"
          className="calendar-nav-btn"
          onClick={nextMonthPair}
        >
          &gt;
        </button>
      </div>

      {/* Centered date range underneath */}
      <div className="calendar-date-range-centered">
        {showTwoCalendars ? (
          // Show both months on larger screens
          <>
            {getLocalizedMonthName(viewMonth)} {viewMonth.getFullYear()} -{" "}
            {getLocalizedMonthName(nextMonth)} {nextMonth.getFullYear()}
          </>
        ) : (
          // Show only current month on mobile
          <>
            {getLocalizedMonthName(viewMonth)} {viewMonth.getFullYear()}
          </>
        )}
      </div>
    </>
  );
};
