// File: src/components/BookingsReport/sections/SpaDetailsSection.jsx
import React from "react";

const SpaDetailsSection = ({ booking }) => {
  // Add console logging to see what's in the booking object
  console.log("SPA Details Section - booking data:", {
    spaDateTime: booking.spaDateTime,
    spaBookingPreference: booking.spaBookingPreference,
    spaInfo: booking.spaInfo,
    hasProps: !!(
      booking.spaDateTime ||
      booking.spaBookingPreference ||
      booking.spaInfo
    ),
  });

  // Check if booking has any SPA information
  const hasSpaInfo =
    booking.spaDateTime || booking.spaBookingPreference || booking.spaInfo;

  if (!hasSpaInfo) {
    console.log("No SPA info found, returning null");
    return null;
  }

  // Determine SPA status
  const getStatus = () => {
    if (booking.spaInfo?.status === "scheduled" || booking.spaDateTime) {
      return "Programmé";
    } else if (
      booking.spaInfo?.status === "to_be_scheduled" ||
      booking.spaBookingPreference === "later"
    ) {
      return "À programmer avec le client";
    }
    return "-";
  };

  // Get start time formatted
  const getFormattedStartTime = () => {
    if (booking.spaInfo?.formattedDateTime) {
      return booking.spaInfo.formattedDateTime;
    } else if (booking.spaDateTime) {
      // Handle Firestore Timestamp conversion
      try {
        const date = booking.spaDateTime.toDate
          ? booking.spaDateTime.toDate()
          : booking.spaDateTime.seconds
          ? new Date(booking.spaDateTime.seconds * 1000)
          : new Date(booking.spaDateTime);

        return date.toLocaleString("fr-BE", {
          dateStyle: "full",
          timeStyle: "short",
        });
      } catch (e) {
        console.error("Error formatting SPA start time:", e);
        return "-";
      }
    }
    return "-";
  };

  // Get end time formatted if available
  const getFormattedEndTime = () => {
    if (booking.spaEndDateTime) {
      try {
        const date = booking.spaEndDateTime.toDate
          ? booking.spaEndDateTime.toDate()
          : booking.spaEndDateTime.seconds
          ? new Date(booking.spaEndDateTime.seconds * 1000)
          : new Date(booking.spaEndDateTime);

        return date.toLocaleString("fr-BE", {
          timeStyle: "short",
        });
      } catch (e) {
        console.error("Error formatting SPA end time:", e);
        return "-";
      }
    } else if (booking.spaSlots && booking.spaSlots.length > 1) {
      return `${booking.spaSlots[1]}`;
    }
    return null;
  };

  // Get a readable time range
  const getTimeRange = () => {
    const startTime = getFormattedStartTime();
    const endTime = getFormattedEndTime();

    if (startTime && endTime) {
      return `${startTime} - ${endTime}`;
    }
    return startTime;
  };

  return (
    <div className="p-4 bg-white border rounded-md shadow-sm">
      <h2 className="mb-3 text-sm font-bold text-gray-700">Informations SPA</h2>
      <div className="space-y-3">
        <div>
          <p className="text-xs text-gray-500">Statut:</p>
          <p className="text-sm font-medium">{getStatus()}</p>
        </div>

        {(booking.spaInfo?.status === "scheduled" || booking.spaDateTime) && (
          <div>
            <p className="text-xs text-gray-500">Créneau horaire:</p>
            <p className="text-sm font-medium">{getTimeRange()}</p>
          </div>
        )}

        {booking.spaSlots && booking.spaSlots.length > 0 && (
          <div>
            <p className="text-xs text-gray-500">Heures réservées:</p>
            <div className="flex flex-wrap gap-1 mt-1">
              {booking.spaSlots.map((slot, index) => (
                <span
                  key={index}
                  className="inline-flex items-center px-2 py-1 text-xs font-medium text-blue-800 bg-blue-100 rounded-full"
                >
                  {slot}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SpaDetailsSection;
