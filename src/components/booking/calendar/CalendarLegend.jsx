
import PropTypes from "prop-types";

export const CalendarLegend = ({ t }) => {
  return (
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
        <div className="legend-color partially-available-checkIn"></div>
        <span>{t("calendar.partiallyAvailableCheckIn")}</span>
      </div>
      <div className="legend-item">
        <div className="legend-color partially-available"></div>
        <span>{t("calendar.partiallyAvailableCheckOut")}</span>
      </div>
    </div>
  );
};

CalendarLegend.propTypes = {
  t: PropTypes.func.isRequired,
};
