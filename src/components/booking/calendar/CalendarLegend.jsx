
import PropTypes from "prop-types";

export const CalendarLegend = ({ t }) => {
  return (
    <div>
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
      <div className="calendar-times">
        <div className="time-item">
          <div className="time-dot checkin-dot"></div>
          <span>{t("calendar.checkInTime")}</span>
        </div>
        <div className="time-item">
          <div className="time-dot checkout-dot"></div>
          <span>{t("calendar.checkOutTime")}</span>
        </div>
      </div>
    </div>
  );
};

CalendarLegend.propTypes = {
  t: PropTypes.func.isRequired,
};
