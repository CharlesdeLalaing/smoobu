// File: src/components/Admin/SpaDetailsSection.jsx
import React from "react";
// Import necessary date-fns functions
import { format } from "date-fns"; // Need format for creating the specific string
import { fr } from "date-fns/locale"; // Need the locale for formatting

// Import utility function for parsing dates
import { parseBookingDateTime } from "../../../spa/spaCalendarUtils"

const SpaDetailsSection = ({ booking }) => {
  console.log("SpaDetailsSection rendering for booking:", booking?.id);
  console.log("SpaDetailsSection booking data:", booking);
  // Check if booking has any SPA information
  // Check for hasSpaTreatment flag first, as it's the explicit indicator
  const hasSpaInfo =
    booking.spaInfo?.hasSpaTreatment ||
    booking.spaBookingPreference ||
    booking.spaDateTime;

  if (!hasSpaInfo) {
    console.log("SpaDetailsSection: No SPA info detected, returning null.");
    return null;
  }

  // Determine booking status
  const getBookingStatus = () => {
    if (booking.spaBookingPreference === "later") {
      return {
        status: "to_be_scheduled",
        label: "À programmer avec le client", // Use French directly as per your example
        color: "yellow",
      };
    } else if (
      booking.spaBookingPreference === "scheduled" &&
      booking.spaDateTime
    ) {
      // Explicitly check preference is 'scheduled' AND there's a time
      return {
        status: "scheduled",
        label: "Programmé", // Use French directly
        color: "green",
      };
    } else if (
      booking.spaBookingPreference === "none" &&
      !booking.spaDateTime
    ) {
      // Explicitly handle 'none' preference
      return {
        status: "none",
        label: "Pas de SPA", // Use French directly
        color: "gray",
      };
    } else if (booking.spaDateTime) {
      // Fallback for old data where preference might be missing but time exists
      console.warn(
        "SpaDetailsSection: Booking has spaDateTime but preference is not 'scheduled'. Assuming scheduled.",
        booking.id
      );
      return {
        status: "scheduled",
        label: "Programmé (Préférence Manquante)",
        color: "green",
      };
    } else {
      // Catch any other case
      return {
        status: "unknown",
        label: "Statut SPA inconnu", // Use French directly
        color: "gray",
      };
    }
  };

  const bookingStatus = getBookingStatus();
  console.log("SpaDetailsSection booking status:", bookingStatus);

  // Format the date and time range if available
  const getFormattedDateTimeRange = () => {
    // Use the parsed date objects stored by the bookings hook if available,
    // otherwise, use the utility function to parse the raw fields.
    const startTime =
      booking.spaDateTimeObj || parseBookingDateTime(booking.spaDateTime);
    const endTime =
      booking.spaEndDateTimeObj || parseBookingDateTime(booking.spaEndDateTime);

    console.log("SpaDetailsSection: Formatting date time range", {
      rawStart: booking.spaDateTime,
      rawEnd: booking.spaEndDateTime,
      parsedStart: startTime,
      parsedEnd: endTime,
    });

    if (startTime && !isNaN(startTime.getTime())) {
      let formattedString = format(startTime, "EEEE d MMMM yyyy", {
        locale: fr,
      }); // Start with full date and day

      if (endTime && !isNaN(endTime.getTime())) {
        // If end time is valid, append the time range HH:mm - HH:mm
        // Ensure end time is not before start time (basic check)
        if (endTime.getTime() >= startTime.getTime()) {
          formattedString += ` de ${format(startTime, "HH:mm", {
            locale: fr,
          })} à ${format(endTime, "HH:mm", { locale: fr })}`;
        } else {
          // Handle invalid case where end time is before start time
          console.warn(
            "SpaDetailsSection: spaEndDateTime is before spaDateTime for booking:",
            booking.id,
            { startTime, endTime }
          );
          formattedString += ` à ${format(startTime, "HH:mm", {
            locale: fr,
          })} (Heure de fin invalide)`;
        }
      } else {
        // If start time is valid but end time is missing or invalid, just show the start time
        console.warn(
          "SpaDetailsSection: spaEndDateTime is missing or invalid for booking:",
          booking.id
        );
        formattedString += ` à ${format(startTime, "HH:mm", {
          locale: fr,
        })} (Heure de fin manquante)`;
      }

      console.log("SpaDetailsSection: Formatted string:", formattedString);
      return formattedString;
    } else {
      // If start time is missing or invalid
      console.warn(
        "SpaDetailsSection: spaDateTime is missing or invalid for booking:",
        booking.id
      );
      return "Date/Heure programmée manquante ou invalide";
    }
  };

  // We only need the formatted string if the status is 'scheduled'
  const formattedDateTimeRange =
    bookingStatus.status === "scheduled" ? getFormattedDateTimeRange() : null;
  console.log(
    "SpaDetailsSection formattedDateTimeRange:",
    formattedDateTimeRange
  );

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
                      key={index} // Using index as key is generally okay for static lists derived from props
                      className="inline-flex items-center px-2 py-1 text-xs font-medium text-blue-800 bg-blue-100 rounded-full"
                    >
                      {slot}{" "}
                      {/* This is the HH:mm string from the spaSlots array */}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : // Content for 'to_be_scheduled', 'unknown', 'none' statuses
        bookingStatus.status === "to_be_scheduled" ||
          bookingStatus.status === "none" ? (
          <div
            className={`p-3 border rounded-md ${
              bookingStatus.color === "yellow"
                ? "border-yellow-200 bg-yellow-50"
                : "border-gray-200 bg-gray-50"
            }`}
          >
            {/* Message changes slightly based on yellow/gray status color */}
            <p
              className={`text-sm ${
                bookingStatus.color === "yellow"
                  ? "text-yellow-800"
                  : "text-gray-800"
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
          // Fallback message for 'unknown' status
          <div className="p-3 border border-gray-200 rounded-md bg-gray-50">
            <p className="text-sm text-gray-800">
              Statut SPA non géré ou données incomplètes pour cette réservation.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SpaDetailsSection;
