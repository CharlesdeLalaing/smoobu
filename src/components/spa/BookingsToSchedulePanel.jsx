import React from "react";
import { format } from "date-fns";

/**
 * Component to display the list of bookings that need scheduling ('À programmer').
 * @param {object} props
 * @param {Array<object>} props.bookingsToSchedule - The list of bookings to display.
 * @param {object|null} props.selectedBooking - The currently selected booking from this list.
 * @param {(booking: object) => void} props.onBookingSelect - Handler function when a booking is clicked.
 * @param {boolean} props.isLoading - Global loading state from parent (e.g., bookings fetch).
 * @param {boolean} props.isActionLoading - State indicating if an action (save/delete) is in progress.
 */
const BookingsToSchedulePanel = ({
  bookingsToSchedule,
  selectedBooking,
  onBookingSelect,
  isLoading,
  isActionLoading,
}) => {
  return (
    <div className="p-3 border rounded">
      <h3 className="mb-2 text-lg font-semibold">À programmer</h3>
      {isLoading ? (
        // Use passed loading state
        <div className="p-2 text-center text-blue-600">
          Chargement des réservations...
        </div>
      ) : bookingsToSchedule.length === 0 ? (
        <div className="p-2 text-sm text-center text-gray-500">
          Aucune réservation SPA à programmer pour ce mois
        </div>
      ) : (
        <div className="pr-1 space-y-2 overflow-y-auto max-h-96">
          {bookingsToSchedule.map((booking) => (
            <button // Use button for clickability and accessibility
              key={booking.id}
              onClick={() =>
                // Disable click if an action is loading
                !isActionLoading && onBookingSelect(booking)
              }
              disabled={isActionLoading} // Added disabled attribute based on actionLoading
              className={`w-full text-left p-2 border rounded cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 ${
                selectedBooking?.id === booking.id
                  ? "bg-blue-50 border-blue-300" // Style for selected booking
                  : ""
              }`}
            >
              <div className="text-sm font-semibold">
                {booking.guestName ||
                  `${booking.firstName} ${booking.lastName}`}
              </div>
              <div className="text-xs text-gray-700">{booking.property}</div>
              <div className="text-xs text-gray-500">
                Séjour:{" "}
                {booking.arrivalDateObj // Use parsed object from parent
                  ? format(booking.arrivalDateObj, "dd/MM/yyyy")
                  : "?"}{" "}
                -{" "}
                {booking.departureDateObj // Use parsed object from parent
                  ? format(booking.departureDateObj, "dd/MM/yyyy")
                  : "?"}
              </div>
              {booking.notes && ( // Display notes if available
                <div className="mt-1 text-xs italic text-gray-700">
                  Notes: {booking.notes}
                </div>
              )}
              {/* Display requested duration if available */}
              {booking.spaTreatmentDuration && (
                <div className="text-xs text-gray-600">
                  Durée demandée: {booking.spaTreatmentDuration} min
                </div>
              )}
            </button>
          ))}
        </div>
      )}
      {/* Show action loading state passed from parent */}
      {isActionLoading && (
        <div className="p-2 mt-4 text-center text-blue-600">
          Action en cours...
        </div>
      )}
    </div>
  );
};

export default BookingsToSchedulePanel;
