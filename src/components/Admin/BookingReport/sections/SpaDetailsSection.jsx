import React from "react";

const SpaDetailsSection = ({ booking }) => {
  // Check if booking has any SPA information
  const hasSpaInfo =
    booking.spaDateTime || booking.spaBookingPreference || booking.spaInfo;

  if (!hasSpaInfo) return null;

  // Determine booking status
  const getBookingStatus = () => {
    if (booking.spaBookingPreference === "later") {
      return {
        status: "to_be_scheduled",
        label: "À programmer avec le client",
        color: "yellow",
      };
    } else if (booking.spaDateTime) {
      return {
        status: "scheduled",
        label: "Programmé",
        color: "green",
      };
    } else {
      return {
        status: "unknown",
        label: "Statut inconnu",
        color: "gray",
      };
    }
  };

  const bookingStatus = getBookingStatus();

  // Format the date if available
  const getFormattedDateTime = () => {
    if (booking.spaDateTime) {
      try {
        // Handle different timestamp formats
        const date =
          typeof booking.spaDateTime.toDate === "function"
            ? booking.spaDateTime.toDate()
            : booking.spaDateTime.seconds !== undefined
            ? new Date(booking.spaDateTime.seconds * 1000)
            : new Date(booking.spaDateTime);

        return date.toLocaleString("fr-BE", {
          dateStyle: "full",
          timeStyle: "short",
        });
      } catch (e) {
        console.error("Error formatting SPA date:", e);
        return "Date programmée (format non reconnu)";
      }
    }
    return null;
  };

  return (
    <div className="p-4 bg-white border rounded-md shadow-sm">
      <h2 className="mb-3 text-sm font-bold text-gray-700">Informations SPA</h2>

      <div className="space-y-4">
        {/* Status badge */}
        <div className="flex items-center">
          <span
            className={`inline-flex items-center px-3 py-1 text-sm font-medium rounded-full
              ${
                bookingStatus.color === "green"
                  ? "bg-green-100 text-green-800"
                  : bookingStatus.color === "yellow"
                  ? "bg-yellow-100 text-yellow-800"
                  : "bg-gray-100 text-gray-800"
              }`}
          >
            {bookingStatus.label}
          </span>
        </div>

        {/* Show different content based on status */}
        {bookingStatus.status === "scheduled" ? (
          <div className="space-y-2">
            <div>
              <p className="text-xs text-gray-500">Date et heure réservées:</p>
              <p className="text-sm font-medium">{getFormattedDateTime()}</p>
            </div>

            {booking.spaSlots && booking.spaSlots.length > 0 && (
              <div>
                <p className="text-xs text-gray-500">Créneaux horaires:</p>
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
        ) : (
          <div className="p-3 border border-yellow-200 rounded-md bg-yellow-50">
            <p className="text-sm text-yellow-800">
              Ce client a choisi de réserver son créneau SPA ultérieurement.
              Contactez-le pour planifier ce service.
            </p>
            <p className="mt-1 text-xs text-yellow-600">
              Pensez à mettre à jour la réservation une fois la date convenue.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SpaDetailsSection;
