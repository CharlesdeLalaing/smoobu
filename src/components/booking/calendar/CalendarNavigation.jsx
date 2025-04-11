import i18next from "i18next";

export const CalendarNavigation = ({
  viewMonth,
  nextMonth,
  prevMonthPair,
  nextMonthPair,
  showTwoCalendars,
}) => {
  // Get current language from i18next
  const currentLocale = i18next.language || "fr";

  // Get localized month name
  const getLocalizedMonthName = (date) => {
    return date.toLocaleString(currentLocale, { month: "long" }).toUpperCase();
  };

  // Format the month and year with appropriate styling
  const formatMonthYear = (date) => {
    return (
      <>
        {getLocalizedMonthName(date)}{" "}
        <span className="month-year">{date.getFullYear()}</span>
      </>
    );
  };

  return (
    <div className="calendar-navigation-controls">
      <button
        type="button"
        className="calendar-nav-btn"
        onClick={prevMonthPair}
      >
        &lt;
      </button>

      {showTwoCalendars ? (
        <div className="calendar-months-header">
          <div className="left-month">{formatMonthYear(viewMonth)}</div>
          <div className="right-month">{formatMonthYear(nextMonth)}</div>
        </div>
      ) : (
        <div className="calendar-month-header-mobile">
          {formatMonthYear(viewMonth)}
        </div>
      )}

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
