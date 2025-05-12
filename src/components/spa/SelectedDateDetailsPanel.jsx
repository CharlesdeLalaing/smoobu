// File: src/components/Admin/SelectedDateDetailsPanel.jsx
import React from "react";
// Keep necessary date-fns imports for formatting and basic date comparisons
import {
  format,
  parseISO,
  startOfDay,
  addDays,
  addMinutes,
  isAfter,
  isBefore,
  isSameDay,
} from "date-fns";
import { fr } from "date-fns/locale";
import {
  parseBookingDateTime,
  isDateWithinBookingStay,
  getPropertyColor,
} from "./spaCalendarUtils"; // Correct utility path

/**
 * Component to display available slots and scheduled bookings for the selected date.
 * @param {object} props
 * @param {Date|null} props.selectedDate - The date currently selected in the calendar.
 * @param {object|null} props.selectedBooking - The booking currently selected from the 'À programmer' list.
 * @param {string[]} props.availableSlots - Array of available slot time strings (HH:mm).
 * @param {Array<object>} props.selectedDateBookings - Array of scheduled bookings for the selected date.
 * @param {object|null} props.spaSettings - Spa settings object (needed for duration info display and potentially end time limits).
 * @param {(date: Date, timeSlot: string) => void} props.onBookSlot - Handler function when an available slot is clicked.
 * @param {(booking: object) => void} props.onScheduledBookingClick - Handler function when a scheduled booking is clicked.
 * @param {boolean} props.isLoading - Global loading state from parent (e.g., initial bookings fetch).
 * @param {boolean} props.isSlotsLoading - Loading state specific to the available slots fetch.
 * @param {Error|null} props.slotsError - Error state specific to the available slots fetch.
 * @param {Error|null} props.bookingsError - Error state specific to the bookings fetch.
 * @param {boolean} props.isActionLoading - State indicating if an action (save/delete) is in progress.
 */
const SelectedDateDetailsPanel = ({
  selectedDate,
  selectedBooking,
  availableSlots, // Array of available START times for the requested duration
  selectedDateBookings,
  spaSettings, // Pass settings for duration info and potentially end time limits
  onBookSlot,
  onScheduledBookingClick,
  isLoading,
  isSlotsLoading,
  slotsError,
  bookingsError,
  isActionLoading,
}) => {
  console.log("SelectedDateDetailsPanel rendering", {
    selectedDate: selectedDate ? format(selectedDate, "yyyy-MM-dd") : null,
    selectedBooking: selectedBooking?.id || null,
    availableSlots: availableSlots.length,
    selectedDateBookings: selectedDateBookings.length,
    spaSettings,
    isLoading,
    isSlotsLoading,
    slotsError,
    bookingsError,
    isActionLoading,
  });

  // If no date is selected, show the prompt message
  if (!selectedDate) {
    console.log(
      "SelectedDateDetailsPanel: No selectedDate, showing placeholder."
    );
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

  // Determine the duration to DISPLAY above the available slots list.
  // This should reflect the duration the API was asked for, which is based on the *selectedBooking*'s duration or a fallback (120 min for double).
  const displaySearchDuration =
    selectedBooking?.spaTreatmentDuration &&
    typeof selectedBooking.spaTreatmentDuration === "number"
      ? selectedBooking.spaTreatmentDuration // Use actual booking duration if available
      : 120; // Fallback display duration (assuming double slot mode is standard)

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
              {/* Updated duration display message */}
              Créneaux disponibles (recherche pour {
                displaySearchDuration
              } min) {isSlotsLoading && " (Chargement...)"}{" "}
              {/* Use specific slots loading state */}
            </h4>
            {/* Show error message from slots hook if there is one */}
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
                  {/* Map over availableSlots state (This list should ONLY contain valid START times for the requested duration) */}
                  {availableSlots.map((slot) => {
                    // --- Determine if this slot should be disabled client-side ---
                    // This logic supplements the API availability check by adding UI/business rules.

                    // 1. Disabled if no booking is selected (cannot book a slot without a booking context)
                    const noBookingSelected = !selectedBooking;

                    // 2. Disabled if selected date is outside the selected booking's stay (redundant if calendar button disabled, but defensive)
                    const outsideBookingStay =
                      selectedBooking &&
                      !isDateWithinBookingStay(selectedDate, selectedBooking); // Use imported utility

                    // 3. Disabled if an action (save/delete) is in progress
                    const actionIsLoading = isActionLoading;

                    // Combine all client-side disable conditions
                    const isDisabled =
                      noBookingSelected ||
                      outsideBookingStay ||
                      actionIsLoading;

                    // --- End Client-side Disable Logic (Simplified) ---

                    // Determine if the slot is currently selected visually
                    // Check if the slot string is the *start time* of the selected booking
                    const isSelected =
                      selectedBooking?.spaDateTimeObj &&
                      !isNaN(selectedBooking.spaDateTimeObj.getTime())
                        ? format(selectedBooking.spaDateTimeObj, "HH:mm") ===
                          slot // Check if this is the exact start slot time string
                        : false; // Not selected if no booking or invalid time

                    return (
                      <button
                        key={slot}
                        type="button" // Important for buttons inside forms
                        onClick={() => onBookSlot(selectedDate, slot)} // Call passed handler
                        disabled={isDisabled || isLoading} // Disable while fetching slots or if slot is disabled
                        className={`px-3 py-1.5 rounded-md border text-sm font-medium transition-colors duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-1 ${
                          isSelected // Use the isSelected check
                            ? "bg-[#668E73] text-white border-[#5a7d66] ring-[#668E73]" // Selected style
                            : isDisabled
                            ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed" // Disabled style
                            : "bg-white text-gray-700 border-gray-300 hover:border-[#668E73] hover:text-[#668E73]" // Default enabled style
                        }`}
                        title={
                          // Combine tooltips for different reasons for disabling
                          [
                            noBookingSelected
                              ? "Sélectionnez d'abord une réservation à programmer"
                              : null,
                            outsideBookingStay
                              ? `Cette date (${format(
                                  selectedDate,
                                  "dd/MM"
                                )}) est hors du séjour du client (${
                                  selectedBooking?.arrivalDateObj
                                    ? format(
                                        selectedBooking.arrivalDateObj,
                                        "dd/MM"
                                      )
                                    : "?"
                                } - ${
                                  selectedBooking?.departureDateObj
                                    ? format(
                                        selectedBooking.departureDateObj,
                                        "dd/MM"
                                      )
                                    : "?"
                                })`
                              : null,
                            // Removed end time tooltip as that check is moved to API/simplified client-side
                            isActionLoading ? "Action en cours..." : null,
                            isLoading ? "Chargement des créneaux..." : null,
                          ]
                            .filter(Boolean)
                            .join("\n") // Filter out nulls and join with newlines
                        }
                      >
                        {slot} {/* e.g., "14:00" */}
                      </button>
                    );
                  })}
                </div>
              )
            )}
            {/* Messages guiding the user */}
            {!selectedBooking && (
              <div className="p-2 mt-4 text-sm text-center text-yellow-600 border border-yellow-200 rounded bg-yellow-50">
                Sélectionnez une réservation dans la liste "À programmer" pour
                pouvoir réserver un créneau.
              </div>
            )}
            {selectedBooking &&
              selectedDate &&
              !isDateWithinBookingStay(selectedDate, selectedBooking) && (
                <div className="p-2 mt-2 text-sm text-center text-red-600 border border-red-200 rounded bg-red-50">
                  La date sélectionnée ({format(selectedDate, "dd/MM")}) est
                  hors du séjour (
                  {selectedBooking.arrivalDateObj
                    ? format(selectedBooking.arrivalDateObj, "dd/MM")
                    : "?"}{" "}
                  -{" "}
                  {selectedBooking.departureDateObj
                    ? format(selectedBooking.departureDateObj, "dd/MM")
                    : "?"}
                  ) du client "
                  {selectedBooking.guestName ||
                    `${selectedBooking.firstName} ${selectedBooking.lastName}`}
                  ". Vous ne pouvez pas planifier le SPA pour cette date.
                </div>
              )}
          </div>{" "}
          {/* End Available Slots Section */}
          {/* List of Existing bookings for the selected date */}
          <div>
            <h4 className="mb-2 text-sm font-medium">
              Réservations planifiées pour cette date (
              {selectedDateBookings.length})
              {isLoading &&
                selectedDateBookings.length === 0 &&
                " (Mise à jour...)"}
            </h4>
            {/* Show error message from bookings hook IF this panel is shown and bookings load failed */}
            {bookingsError && selectedDate && !isLoading && (
              <div className="p-2 text-sm text-red-600 border border-red-200 rounded bg-red-50">
                Erreur chargement réservations: {bookingsError.message}
              </div>
            )}

            {/* Use derived state */}
            {selectedDateBookings.length === 0 && !isLoading ? (
              <div className="p-2 text-sm text-center text-gray-500 rounded bg-gray-50">
                Aucune réservation SPA planifiée pour cette date
              </div>
            ) : (
              // Only render list if not overall loading (or if list is not empty)
              !isLoading && (
                <div className="pr-1 space-y-2 overflow-y-auto max-h-40">
                  {/* Map over derived state */}
                  {selectedDateBookings.map((booking) => {
                    const colors = getPropertyColor(booking);
                    // Use the parsed objects stored by the hook, fallback to utility parse if needed for display
                    const startTime =
                      booking.spaDateTimeObj ||
                      parseBookingDateTime(booking.spaDateTime);
                    const endTime =
                      booking.spaEndDateTimeObj ||
                      parseBookingDateTime(booking.spaEndDateTime);

                    // Format the display string including the time range
                    let displayTimeRange = "Heure invalide";
                    // Need spaSettings to estimate duration if end time is missing
                    const slotDuration =
                      spaSettings?.slotDurationMinutes || null;

                    if (startTime && !isNaN(startTime.getTime())) {
                      displayTimeRange = format(startTime, "HH:mm", {
                        locale: fr,
                      });
                      if (
                        endTime &&
                        !isNaN(endTime.getTime()) &&
                        endTime.getTime() >= startTime.getTime()
                      ) {
                        displayTimeRange += ` - ${format(endTime, "HH:mm", {
                          locale: fr,
                        })}`;
                      } else if (booking.spaSlots?.length > 0 && slotDuration) {
                        // If end time is missing but slots and duration exist, estimate end time for display
                        const assumedEndTime = addMinutes(
                          startTime,
                          booking.spaSlots.length * slotDuration
                        ); // Use addMinutes
                        // Add a basic check that assumedEndTime is after startTime
                        if (assumedEndTime.getTime() >= startTime.getTime()) {
                          displayTimeRange += ` - ${format(
                            assumedEndTime,
                            "HH:mm",
                            { locale: fr }
                          )} (estimé)`;
                        } else {
                          console.warn(
                            "SelectedDateDetailsPanel: Estimated end time is before start time for booking:",
                            booking.id,
                            {
                              startTime,
                              assumedEndTime,
                              slots: booking.spaSlots,
                              duration: slotDuration,
                            }
                          );
                          displayTimeRange += ` (Heure de fin invalide)`; // Indicate issue
                        }
                      } else if (
                        booking.spaSlots?.length > 0 &&
                        !slotDuration
                      ) {
                        console.warn(
                          "SelectedDateDetailsPanel: Cannot estimate end time for display, slotDurationMinutes missing from settings.",
                          booking.id
                        );
                        displayTimeRange += ` (Durée inconnue)`; // Indicate issue
                      } else {
                        console.warn(
                          "SelectedDateDetailsPanel: spaEndDateTime and spaSlots missing or invalid for booking:",
                          booking.id
                        );
                        displayTimeRange += ` (Heure de fin manquante)`; // Indicate issue
                      }
                    }

                    return (
                      <button
                        key={booking.id}
                        type="button" // Important for buttons inside forms
                        onClick={() => onScheduledBookingClick(booking)} // Use passed handler
                        disabled={isActionLoading} // Disable during action
                        className={`w-full text-left p-2 border rounded cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${colors.bg} ${colors.text} ${colors.border}`}
                      >
                        <div className="text-sm font-medium">
                          {displayTimeRange}{" "}
                          {/* Display the formatted time range */}
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
              )
            )}
          </div>{" "}
          {/* End Scheduled Bookings List */}
        </div>
      )}{" "}
    </div>
  );
};

export default SelectedDateDetailsPanel;
