      
// File: src/components/Admin/SpaDetailsSection.jsx
import React from "react";
import { format, isValid } from "date-fns"; // ENSURE isValid IS IMPORTED
import { fr } from "date-fns/locale";

// No need to import parseBookingDateTime here if we consistently rely on ...Obj fields
// from the useBookingsForMonth hook (or wherever bookings are processed).

const SpaDetailsSection = ({ booking }) => {
  // console.log("SpaDetailsSection rendering for booking:", booking?.id); // For debugging
  // console.log("SpaDetailsSection booking data:", booking); // For debugging

  // Handle cases where the booking prop might not be provided
  if (!booking) {
    return (
      <div className="p-4 bg-white border rounded-md shadow-sm">
        <h2 className="mb-3 text-sm font-bold text-gray-700">
          Informations SPA
        </h2>
        <p className="text-sm text-gray-500">
          Données de réservation non disponibles.
        </p>
      </div>
    );
  }

  // Determine if there's any SPA-related information to display
  // booking.spaDateTimeObj will be a Date object if a SPA time is set and parsed
  const hasSpaIndication =
    booking.spaInfo?.hasSpaTreatment || // Explicit flag from spaInfo
    booking.spaBookingPreference ||     // Any preference is set
    (booking.spaDateTimeObj && isValid(booking.spaDateTimeObj)); // A valid parsed SPA date exists

  if (!hasSpaIndication) {
    // console.log("SpaDetailsSection: No SPA indication detected, returning null or minimal info.");
    // You could optionally return a "No SPA service for this booking" message if preferred over null
    return null; 
  }

  const getBookingStatus = () => {
    // booking.spaDateTimeObj should be a Date object or null
    // booking.spaBookingPreference is a string like "later", "scheduled", "none"

    if (booking.spaBookingPreference === "later") {
      return {
        status: "to_be_scheduled",
        label: "À programmer avec le client",
        color: "yellow",
      };
    } else if (
      booking.spaBookingPreference === "scheduled" &&
      booking.spaDateTimeObj &&
      isValid(booking.spaDateTimeObj)
    ) {
      return {
        status: "scheduled",
        label: "Programmé",
        color: "green",
      };
    } else if (
      booking.spaBookingPreference === "none" &&
      (!booking.spaDateTimeObj || !isValid(booking.spaDateTimeObj)) // No valid SPA date
    ) {
      // Explicitly 'none' and no valid date set
      return {
        status: "none",
        label: "Pas de SPA",
        color: "gray",
      };
    } else if (booking.spaDateTimeObj && isValid(booking.spaDateTimeObj)) {
      // A valid SPA date exists, but preference might be missing or not 'scheduled'
      console.warn(
        `SpaDetailsSection (getBookingStatus): Booking ID ${booking.id || 'N/A'} has a valid spaDateTimeObj but spaBookingPreference is '${booking.spaBookingPreference || 'missing'}'. Displaying as 'Programmé'.`
      );
      return {
        status: "scheduled", // Treat as scheduled if a valid date is there
        label: "Programmé (Vérifier Préférence)",
        color: "green",
      };
    } else if (
        booking.spaBookingPreference === "scheduled" && 
        (!booking.spaDateTimeObj || !isValid(booking.spaDateTimeObj))
    ) {
        // It's supposed to be scheduled, but the date is invalid or missing
        console.warn(
            `SpaDetailsSection (getBookingStatus): Booking ID ${booking.id || 'N/A'} is 'scheduled' but spaDateTimeObj is invalid or missing.`
          );
        return {
            status: "error_scheduled_date_invalid",
            label: "Programmé (Date Invalide)",
            color: "red", // Use red for errors
        };
    }
     else {
      // Fallback for any other unhandled combination
    //   console.log(
    //     `SpaDetailsSection (getBookingStatus): Unknown SPA status for Booking ID ${booking.id || 'N/A'}. Preference: ${booking.spaBookingPreference}, spaDateTimeObj valid: ${booking.spaDateTimeObj ? isValid(booking.spaDateTimeObj) : 'N/A'}`
    //   );
      return {
        status: "unknown",
        label: "Statut SPA inconnu",
        color: "gray",
      };
    }
  };

  const bookingStatus = getBookingStatus();
  // console.log(`SpaDetailsSection booking status for ID ${booking.id}:`, bookingStatus); // For debugging

  const getFormattedDateTimeRange = () => {
    // booking.spaDateTimeObj and booking.spaEndDateTimeObj should be Date objects or null
    const startTime = booking.spaDateTimeObj;
    const endTime = booking.spaEndDateTimeObj;

    if (startTime && isValid(startTime)) {
      let formattedString = format(startTime, "EEEE d MMMM yyyy", {
        locale: fr,
      });

      if (endTime && isValid(endTime)) {
        if (endTime.getTime() >= startTime.getTime()) {
          formattedString += ` de ${format(startTime, "HH:mm", {
            locale: fr,
          })} à ${format(endTime, "HH:mm", { locale: fr })}`;
        } else {
          // console.warn(`SpaDetailsSection (getFormattedDateTimeRange): spaEndDateTimeObj is before spaDateTimeObj for booking ID: ${booking.id || 'N/A'}`);
          formattedString += ` à ${format(startTime, "HH:mm", {
            locale: fr,
          })} (Heure de fin invalide)`;
        }
      } else {
        // console.warn(`SpaDetailsSection (getFormattedDateTimeRange): spaEndDateTimeObj is missing or invalid for booking ID: ${booking.id || 'N/A'}. EndTime value:`, endTime);
        formattedString += ` à ${format(startTime, "HH:mm", {
          locale: fr,
        })} (Heure de fin manquante)`;
      }
      return formattedString;
    } else {
      // console.warn(`SpaDetailsSection (getFormattedDateTimeRange): spaDateTimeObj is missing or invalid for booking ID: ${booking.id || 'N/A'}. StartTime value:`, startTime);
      return "Date/Heure programmée manquante ou invalide";
    }
  };

  // We only need the formatted string if the status is 'scheduled' (and date is valid)
  const formattedDateTimeRange =
    bookingStatus.status === "scheduled" ? getFormattedDateTimeRange() : null;
  // console.log(`SpaDetailsSection formattedDateTimeRange for ID ${booking.id}:`, formattedDateTimeRange); // For debugging


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
                  : bookingStatus.color === "red" // For error status
                  ? "bg-red-100 text-red-800"
                  : "bg-gray-100 text-gray-800" // Default/gray
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
              {/* Use the formatted string including the time range */}
              <p className="text-sm font-medium">{formattedDateTimeRange}</p>
            </div>

            {/* Display the list of individual slots (optional, but useful for detail) */}
            {/* Access spaSlots array directly from the booking prop */}
            {booking.spaSlots && booking.spaSlots.length > 0 && (
              <div>
                <p className="text-xs text-gray-500">Créneaux horaires:</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {booking.spaSlots.map((slot, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center px-2 py-1 text-xs font-medium text-blue-800 bg-blue-100 rounded-full"
                    >
                      {slot} {/* This is the HH:mm string from the spaSlots array */}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : bookingStatus.status === "error_scheduled_date_invalid" ? (
            // Specific UI for when it's scheduled but the date is bad
            <div className="p-3 border border-red-200 rounded-md bg-red-50">
                <p className="text-sm text-red-800">
                    La date de SPA programmée est invalide ou manquante dans les données. Veuillez vérifier cette réservation.
                </p>
            </div>
        ) : bookingStatus.status === "to_be_scheduled" || bookingStatus.status === "none" ? (
          <div
            className={`p-3 border rounded-md ${
              bookingStatus.color === "yellow"
                ? "border-yellow-200 bg-yellow-50"
                : "border-gray-200 bg-gray-50" // For 'none' status
            }`}
          >
            <p
              className={`text-sm ${
                bookingStatus.color === "yellow"
                  ? "text-yellow-800"
                  : "text-gray-800" // For 'none' status
              }`}
            >
              {bookingStatus.status === "to_be_scheduled"
                ? "Ce client a choisi de réserver son créneau SPA ultérieurement. Contactez-le pour planifier ce service."
                : "Ce client n'a pas réservé de créneau SPA pour l'instant."}
            </p>
            {bookingStatus.status === "to_be_scheduled" && (
              <p className="mt-1 text-xs text-yellow-600">
                Pensez à mettre à jour la réservation une fois la date convenue.
              </p>
            )}
          </div>
        ) : (
          // Fallback message for 'unknown' status (and any other unhandled ones)
          <div className="p-3 border border-gray-200 rounded-md bg-gray-50">
            <p className="text-sm text-gray-800">
              Statut SPA non géré ou données SPA incomplètes pour cette réservation.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SpaDetailsSection;

    