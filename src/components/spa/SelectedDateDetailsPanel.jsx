// File: src/components/Admin/SelectedDateDetailsPanel.jsx (Corrected)
import React from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  parseBookingDateTime, // Import utility for fallback display if needed
  isDateWithinBookingStay, // Import utility for display logic
  getPropertyColor, // Import utility for styling
} from "../spa/spaCalendarUtils"; // <-- CORRECTED UTILITY IMPORT PATH

/**
 * Component to display available slots and scheduled bookings for the selected date.
 * @param {object} props
 * @param {Date|null} props.selectedDate - The date currently selected in the calendar.
 * @param {object|null} props.selectedBooking - The booking currently selected from the 'À programmer' list.
 * @param {string[]} props.availableSlots - Array of available slot time strings (HH:mm).
 * @param {Array<object>} props.selectedDateBookings - Array of scheduled bookings for the selected date.
 * @param {object|null} props.spaSettings - Spa settings object (needed for duration info display).
 * @param {(date: Date, timeSlot: string) => void} props.onBookSlot - Handler function when an available slot is clicked.
 * @param {(booking: object) => void} props.onScheduledBookingClick - Handler function when a scheduled booking is clicked.
 * @param {boolean} props.isLoading - Global loading state from parent (e.g., initial bookings fetch).
 * @param {boolean} props.isSlotsLoading - Loading state specific to the available slots fetch.
 * @param {Error|null} props.slotsError - Error state specific to the available slots fetch. // <-- ADDED slotsError PROP
 * @param {boolean} props.isActionLoading - State indicating if an action (save/delete) is in progress.
 */
const SelectedDateDetailsPanel = ({
  selectedDate,
  selectedBooking,
  availableSlots,
  selectedDateBookings,
  spaSettings,
  onBookSlot,
  onScheduledBookingClick,
  isLoading, // Overall data loading (used for initial state)
  isSlotsLoading, // Loading specific to slots API
  slotsError,
  bookingsError, // <-- ACCEPT slotsError PROP
  isActionLoading, // Action loading (used for disabling buttons)
}) => {
  // If no date is selected, show the prompt message
  if (!selectedDate) {
    return (
      <div className="p-3 border rounded">
        <h3 className="mb-2 text-lg font-semibold">Sélectionnez une date</h3>
        <div className="p-4 text-sm text-center text-gray-500 rounded bg-gray-50">
          Sélectionnez une date dans le calendrier pour voir les créneaux
          disponibles et les rendez-vous existants.
        </div>
      </div>
    );
  }

  // Determine the duration displayed for the available slots calculation message
  // Use the duration from the selected booking if available, otherwise fallback
  const slotSearchDuration =
    selectedBooking?.spaTreatmentDuration &&
    typeof selectedBooking.spaTreatmentDuration === "number"
      ? selectedBooking.spaTreatmentDuration
      : spaSettings?.slotDurationMinutes || 30; // Fallback to settings slot size or 30

  return (
    <div className="p-3 border rounded">
      <h3 className="mb-2 text-lg font-semibold">
        Créneaux - {format(selectedDate, "EEEE d MMMM", { locale: fr })}
      </h3>
      {/* Show overall loading if initial data is fetching for the date */}
      {isLoading && !isSlotsLoading ? ( // Check overall loading, but don't hide if only slots are loading (which is handled below)
        <div className="p-4 text-center text-blue-600">
          Chargement des données de réservation...
        </div>
      ) : (
        // Content to show when date is selected and main data is loaded
        <div className="space-y-4">
          {/* Available Slots Section */}
          <div>
            <h4 className="mb-2 text-sm font-medium">
              Créneaux disponibles (recherche pour {slotSearchDuration} min){" "}
              {isSlotsLoading && " (Chargement...)"}{" "}
              {/* Use specific slots loading state */}
            </h4>
            {/* Show error message from slots hook if there is one */}
            {/* Use slotsError prop */}
            {slotsError && (
              <div className="p-2 text-sm text-red-600 border border-red-200 rounded bg-red-50">
                Erreur chargement créneaux: {slotsError.message}
              </div>
            )}

            {/* Show empty state if no slots and not loading/errored */}
            {availableSlots.length === 0 && !isSlotsLoading && !slotsError ? (
              <div className="p-2 text-sm text-center text-gray-500 rounded bg-gray-50">
                Aucun créneau disponible
              </div>
            ) : (
              // Only render the slots list if not currently loading slots and no error
              !isSlotsLoading &&
              !slotsError && (
                <div className="grid grid-cols-2 gap-2 pr-1 overflow-y-auto sm:grid-cols-3 max-h-40">
                  {/* Map over availableSlots state */}
                  {availableSlots.map((slot) => {
                    // Disable slot button if no booking is selected
                    // Or if the selected date is outside the selected booking's stay (redundant if calendar button is disabled, but defensive)
                    const isDisabledForBooking =
                      !selectedBooking ||
                      !isDateWithinBookingStay(selectedDate, selectedBooking); // Use imported utility

                    return (
                      <button
                        key={slot}
                        onClick={() => onBookSlot(selectedDate, slot)} // Use passed handler
                        disabled={isDisabledForBooking || isActionLoading} // Disable during action
                        className={`p-2 text-sm rounded border text-center
                           ${
                             isDisabledForBooking || isActionLoading
                               ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                               : "bg-white hover:bg-green-50 hover:border-green-500"
                           }`}
                        title={
                          !selectedBooking
                            ? "Sélectionnez d'abord une réservation à programmer"
                            : !isDateWithinBookingStay(
                                selectedDate,
                                selectedBooking
                              ) // Use imported utility for title
                            ? `Cette date (${format(
                                selectedDate,
                                "dd/MM"
                              )}) est hors du séjour du client (${
                                selectedBooking.arrivalDateObj // Use parsed obj from parent
                                  ? format(
                                      selectedBooking.arrivalDateObj,
                                      "dd/MM"
                                    )
                                  : "?"
                              } - ${
                                selectedBooking.departureDateObj // Use parsed obj from parent
                                  ? format(
                                      selectedBooking.departureDateObj,
                                      "dd/MM"
                                    )
                                  : "?"
                              })`
                            : null
                        }
                      >
                        {slot}
                      </button>
                    );
                  })}
                </div>
              ) // End !isSlotsLoading && !slotsError condition
            )}
            {/* Messages guiding the user */}
            {!selectedBooking && (
              <div className="p-2 mt-4 text-sm text-center text-yellow-600 border border-yellow-200 rounded bg-yellow-50">
                Sélectionnez une réservation dans la liste "À programmer" pour
                pouvoir réserver un créneau.
              </div>
            )}
            {selectedBooking &&
              selectedDate && // Added check for selectedDate exists
              !isDateWithinBookingStay(selectedDate, selectedBooking) && ( // Use imported utility
                <div className="p-2 mt-2 text-sm text-center text-red-600 border border-red-200 rounded bg-red-50">
                  La date sélectionnée ({format(selectedDate, "dd/MM")}) est
                  hors du séjour (
                  {selectedBooking.arrivalDateObj // Use parsed obj from parent
                    ? format(selectedBooking.arrivalDateObj, "dd/MM")
                    : "?"}{" "}
                  -{" "}
                  {selectedBooking.departureDateObj // Use parsed obj from parent
                    ? format(selectedBooking.departureDateObj, "dd/MM")
                    : "?"}
                  ) du client "
                  {selectedBooking.guestName ||
                    `${selectedBooking.firstName} ${selectedBooking.lastName}`}
                  ". Vous ne pouvez pas planifier le SPA pour cette date.
                </div>
              )}
          </div>
          {/* List of Existing bookings for the selected date */}
          <div>
            <h4 className="mb-2 text-sm font-medium">
              Réservations planifiées pour cette date (
              {selectedDateBookings.length}){" "}
              {/* Use derived state length from parent */}
              {/* Indicate bookings loading if the list is empty */}
              {isLoading &&
                selectedDateBookings.length === 0 &&
                " (Mise à jour...)"}
            </h4>
            {/* Show error message from bookings hook IF this panel is shown and bookings load failed */}
            {bookingsError &&
              selectedDate &&
              !isLoading && ( // Use bookingsError from parent
                <div className="p-2 text-sm text-red-600 border border-red-200 rounded bg-red-50">
                  Erreur chargement réservations: {bookingsError.message}
                </div>
              )}

            {/* Use derived state */}
            {selectedDateBookings.length === 0 && !isLoading ? ( // Check overall loading
              <div className="p-2 text-sm text-center text-gray-500 rounded bg-gray-50">
                Aucune réservation SPA planifiée pour cette date
              </div>
            ) : (
              // Only render list if not overall loading (or if list is not empty)
              !isLoading && (
                <div className="pr-1 space-y-2 overflow-y-auto max-h-40">
                  {/* Map over derived state */}
                  {selectedDateBookings.map((booking) => {
                    const colors = getPropertyColor(booking); // Use imported utility
                    // Use the parsed objects stored by the hook, fallback to utility parse if needed for display
                    const startTime =
                      booking.spaDateTimeObj ||
                      parseBookingDateTime(booking.spaDateTime);
                    const endTime =
                      booking.spaEndDateTimeObj ||
                      parseBookingDateTime(booking.spaEndDateTime);

                    const isValidTime =
                      startTime &&
                      !isNaN(startTime.getTime()) &&
                      endTime &&
                      !isNaN(endTime.getTime());

                    return (
                      <button
                        key={booking.id}
                        onClick={() => onScheduledBookingClick(booking)} // Use passed handler
                        disabled={isActionLoading} // Disable during action
                        className={`w-full text-left p-2 border rounded cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${colors.bg} ${colors.text} ${colors.border}`}
                      >
                        <div className="text-sm font-medium">
                          {isValidTime
                            ? `${format(startTime, "HH:mm")} - ${format(
                                endTime,
                                "HH:mm"
                              )}`
                            : "Heure invalide"}{" "}
                          {/* Display error if times are bad */}
                        </div>
                        <div className="text-xs">
                          {booking.guestName ||
                            `${booking.firstName} ${booking.lastName}`}
                        </div>
                        <div className="text-xs">{booking.property}</div>
                      </button>
                    );
                  })}
                </div>
              ) // End !isLoading condition
            )}
          </div>
        </div>
      )}{" "}
    </div>
  );
};

export default SelectedDateDetailsPanel;
