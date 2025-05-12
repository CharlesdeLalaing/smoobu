import React, { useState } from "react";
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
 * Component to display available slots, scheduled bookings, and manage overrides for the selected date using tabs.
 * @param {object} props
 * @param {Date|null} props.selectedDate - The date currently selected in the calendar.
 * @param {object|null} props.selectedBooking - The booking currently selected from the 'À programmer' list.
 * @param {string[]} props.availableSlots - Array of available slot time strings (HH:mm).
 * @param {Array<object>} props.selectedDateBookings - Array of scheduled bookings for the selected date.
 * @param {object|null} props.spaSettings - Spa settings object (needed for duration info display and potentially end time limits).
 * @param {object|null} props.overrideData - The fetched override data for the selected date (null if none exists).
 * @param {boolean} props.overrideLoading - Loading state for fetching the override data.
 * @param {Error|null} props.overrideError - Error state for fetching the override data.
 * @param {object|null} props.editableOverrideSettings - The current state of the override inputs {startTime, endTime, isClosed}.
 * @param {(newSettings: object) => void} props.onEditableOverrideChange - Handler to update the editableOverrideSettings state.
 * @param {() => Promise<void>} props.onSaveOverride - Handler to save the override settings.
 * @param {() => Promise<void>} props.onDeleteOverride - Handler to delete the override settings.
 * @param {(date: Date, timeSlot: string) => void} props.onBookSlot - Handler function when an available slot is clicked.
 * @param {(booking: object) => void} props.onScheduledBookingClick - Handler function when a scheduled booking is clicked.
 * @param {boolean} props.isLoading - Global loading state from parent (e.g., initial bookings fetch).
 * @param {boolean} props.isSlotsLoading - Loading state specific to the available slots fetch.
 * @param {Error|null} props.slotsError - Error state specific to the available slots fetch.
 * @param {Error|null} props.bookingsError - Error state specific to the bookings fetch.
 * @param {boolean} props.isActionLoading - State indicating if a general action (booking save/delete) is in progress.
 * @param {boolean} props.isOverrideSaving - State indicating if an override save/delete is in progress.
 */
const SelectedDateDetailsPanel = ({
  selectedDate,
  selectedBooking,
  availableSlots,
  selectedDateBookings,
  spaSettings,
  overrideData, // Fetched override
  overrideLoading,
  overrideError,
  editableOverrideSettings, // Editable state from parent
  onEditableOverrideChange, // Setter for editable state
  onSaveOverride, // Save handler
  onDeleteOverride, // Delete handler
  onBookSlot,
  onScheduledBookingClick,
  isLoading,
  isSlotsLoading,
  slotsError,
  bookingsError,
  isActionLoading, // General action loading
  isOverrideSaving, // Specific override action loading
}) => {
  console.log("SelectedDateDetailsPanel rendering with tabs", {
    selectedDate: selectedDate ? format(selectedDate, "yyyy-MM-dd") : null,
    selectedBooking: selectedBooking?.id || null,
    availableSlots: availableSlots.length,
    selectedDateBookings: selectedDateBookings.length,
    spaSettings,
    overrideData,
    overrideLoading,
    editableOverrideSettings,
    isLoading,
    isSlotsLoading,
    slotsError,
    bookingsError,
    isActionLoading,
    isOverrideSaving,
  });

  // --- State for Active Tab ---
  const [activeTab, setActiveTab] = useState("override"); // 'override', 'slots', 'scheduled'

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
          disponibles, les rendez-vous existants et gérer les heures
          spécifiques.
        </div>
      </div>
    );
  }

  // Determine the duration to DISPLAY above the available slots list.
  const displaySearchDuration =
    selectedBooking?.spaTreatmentDuration &&
    typeof selectedBooking.spaTreatmentDuration === "number"
      ? selectedBooking.spaTreatmentDuration
      : 120;

  // Helper to check if the editable state exists (it should if a date is selected)
  const canEditOverride = !!editableOverrideSettings;

  // Define Tab Content Components or Inline JSX Sections

  const renderOverrideSection = () => (
    <div className="mt-4">
      {" "}
      {/* Add margin top for spacing below tabs */}
      <h4 className="sr-only">Gestion Horaire Spécifique / Fermeture</h4>{" "}
      {/* Screen reader only heading */}
      {/* Show loading/error specific to fetching override data */}
      {overrideLoading ? (
        <div className="p-2 text-sm text-center text-blue-500">
          Chargement de l'état horaire...
        </div>
      ) : overrideError ? (
        <div className="p-2 text-sm text-red-600 border border-red-200 rounded bg-red-50">
          Erreur chargement horaire spécifique: {overrideError.message}
        </div>
      ) : !canEditOverride ? ( // Should not happen if selectedDate is set, but good fallback
        <div className="p-2 text-sm text-center text-gray-400">
          Impossible d'éditer les paramètres pour le moment.
        </div>
      ) : (
        // --- Override Controls ---
        <div className="p-3 space-y-3 border border-gray-200 rounded-md bg-gray-50">
          {/* isClosed Checkbox */}
          <div className="flex items-center">
            <input
              id="overrideIsClosed"
              type="checkbox"
              checked={editableOverrideSettings.isClosed || false}
              onChange={(e) =>
                onEditableOverrideChange({
                  ...editableOverrideSettings,
                  isClosed: e.target.checked,
                })
              }
              disabled={isOverrideSaving || isActionLoading} // Disable during any action
              className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500 disabled:opacity-50"
            />
            <label
              htmlFor="overrideIsClosed"
              className="ml-2 text-sm font-medium text-gray-700"
            >
              Marquer comme fermé pour cette date
            </label>
          </div>

          {/* Time Inputs (conditionally enabled) */}
          <div
            className={`flex flex-wrap gap-3 ${
              editableOverrideSettings.isClosed ? "opacity-50" : ""
            }`}
          >
            <div className="flex-1 min-w-[100px]">
              <label
                htmlFor="overrideStartTime"
                className="block text-xs font-medium text-gray-600"
              >
                Heure Début Spéc.
              </label>
              <input
                type="time"
                id="overrideStartTime"
                value={editableOverrideSettings.startTime || ""}
                onChange={(e) =>
                  onEditableOverrideChange({
                    ...editableOverrideSettings,
                    startTime: e.target.value,
                  })
                }
                disabled={
                  editableOverrideSettings.isClosed ||
                  isOverrideSaving ||
                  isActionLoading
                } // Also disable during any action
                className="block w-full px-2 py-1 text-sm border-gray-300 rounded shadow-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
            </div>
            <div className="flex-1 min-w-[100px]">
              <label
                htmlFor="overrideEndTime"
                className="block text-xs font-medium text-gray-600"
              >
                Heure Fin Spéc.
              </label>
              <input
                type="time"
                id="overrideEndTime"
                value={editableOverrideSettings.endTime || ""}
                onChange={(e) =>
                  onEditableOverrideChange({
                    ...editableOverrideSettings,
                    endTime: e.target.value,
                  })
                }
                disabled={
                  editableOverrideSettings.isClosed ||
                  isOverrideSaving ||
                  isActionLoading
                } // Also disable during any action
                className="block w-full px-2 py-1 text-sm border-gray-300 rounded shadow-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
            </div>
          </div>

          {/* Override Action Buttons */}
          <div className="flex items-center justify-end pt-2 space-x-2 border-t border-gray-200">
            {isOverrideSaving && (
              <span className="text-xs text-blue-600">Enregistrement...</span>
            )}
            {/* Display parent's overrideSavingError state here if needed */}
            {/* {overrideSavingError && <span className="text-xs text-red-600">{overrideSavingError}</span>} */}

            {/* Delete Button (only if override exists) */}
            {overrideData && ( // Check if an override *currently* exists in DB
              <button
                onClick={onDeleteOverride}
                disabled={isOverrideSaving || isActionLoading} // Disable during any action
                className="px-3 py-1 text-xs font-medium text-red-700 bg-red-100 border border-red-300 rounded hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                Supprimer Horaire Spéc.
              </button>
            )}

            {/* Save Button */}
            <button
              onClick={onSaveOverride}
              disabled={isOverrideSaving || isActionLoading} // Disable during any action
              className="px-3 py-1 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {overrideData ? "Modifier Horaire Spéc." : "Créer Horaire Spéc."}
            </button>
          </div>

          {/* Info text */}
          <p className="mt-1 text-xs text-gray-500">
            {overrideData
              ? "Modifiez ou supprimez l'horaire spécifique pour cette date."
              : "Aucun horaire spécifique défini. Le SPA utilisera les heures par défaut."}
            {!editableOverrideSettings.isClosed &&
              (!editableOverrideSettings.startTime ||
                !editableOverrideSettings.endTime) &&
              " Si les heures spécifiques sont laissées vides, les heures par défaut seront utilisées."}
            {editableOverrideSettings.isClosed &&
              " Le SPA sera marqué comme fermé si vous enregistrez."}
          </p>
        </div>
      )}
    </div>
  );

  const renderAvailableSlotsSection = () => (
    <div className="mt-4">
      {" "}
      {/* Add margin top for spacing below tabs */}
      {/* Conditionally render based on override isClosed */}
      {/* This outer condition handles the case where the SPA is marked closed */}
      {overrideData?.isClosed && !overrideLoading ? (
        <div className="p-2 mt-2 text-sm text-center text-gray-500 rounded bg-gray-50">
          Le SPA est marqué comme fermé pour cette date via l'horaire
          spécifique.
        </div>
      ) : (
        // If not closed (or override loading), show the slots section
        <div>
          <h4 className="mb-2 text-sm font-medium">
            Créneaux disponibles (recherche pour {displaySearchDuration} min)
            {isSlotsLoading && " (Chargement...)"}
            {/* No need to repeat (SPA Fermé) here as it's handled above */}
          </h4>
          {slotsError && (
            <div className="p-2 text-sm text-red-600 border border-red-200 rounded bg-red-50">
              Erreur chargement créneaux: {slotsError.message}
            </div>
          )}

          {/* Show slots list or empty state (only if not explicitly closed above) */}
          {availableSlots.length === 0 && !isSlotsLoading && !slotsError ? (
            <div className="p-2 text-sm text-center text-gray-500 rounded bg-gray-50">
              {/* Adjust message based on whether override times might be active */}
              {overrideData && (overrideData.startTime || overrideData.endTime)
                ? "Aucun créneau disponible pendant les heures spécifiques."
                : "Aucun créneau disponible."}
            </div>
          ) : (
            !isSlotsLoading &&
            !slotsError && (
              <div className="grid grid-cols-2 gap-2 pr-1 overflow-y-auto sm:grid-cols-3 max-h-40">
                {availableSlots.map((slot) => {
                  const noBookingSelected = !selectedBooking;
                  const outsideBookingStay =
                    selectedBooking &&
                    !isDateWithinBookingStay(selectedDate, selectedBooking);
                  const actionInProgress = isActionLoading || isOverrideSaving; // Combined action check

                  const isDisabled =
                    noBookingSelected ||
                    outsideBookingStay ||
                    actionInProgress ||
                    isLoading || // Global loading
                    isSlotsLoading; // Slots specific loading

                  const isSelected =
                    selectedBooking?.spaDateTimeObj &&
                    !isNaN(selectedBooking.spaDateTimeObj.getTime())
                      ? format(selectedBooking.spaDateTimeObj, "HH:mm") === slot
                      : false;

                  return (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => onBookSlot(selectedDate, slot)}
                      disabled={isDisabled}
                      className={`px-3 py-1.5 rounded-md border text-sm font-medium transition-colors duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-1 ${
                        isSelected
                          ? "bg-[#668E73] text-white border-[#5a7d66] ring-[#668E73]" // Specific selected style
                          : isDisabled
                          ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                          : "bg-white text-gray-700 border-gray-300 hover:border-[#668E73] hover:text-[#668E73]" // Specific hover style
                      }`}
                      title={[
                        noBookingSelected
                          ? "Sélectionnez d'abord une réservation à programmer"
                          : null,
                        outsideBookingStay
                          ? `Date (${format(
                              selectedDate,
                              "dd/MM"
                            )}) hors séjour (${
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
                        actionInProgress ? "Action en cours..." : null,
                        isLoading || isSlotsLoading ? "Chargement..." : null, // Combined loading state in title
                      ]
                        .filter(Boolean)
                        .join("\n")}
                    >
                      {slot}
                    </button>
                  );
                })}
              </div>
            )
          )}
          {/* Guiding messages - Show only if not closed and slots are available */}
          {!selectedBooking &&
            !overrideData?.isClosed &&
            !isSlotsLoading &&
            availableSlots.length > 0 && (
              <div className="p-2 mt-4 text-sm text-center text-yellow-600 border border-yellow-200 rounded bg-yellow-50">
                Sélectionnez une réservation dans la liste "À programmer" pour
                réserver un créneau.
              </div>
            )}
          {/* Add other guiding messages if needed */}
        </div>
      )}
    </div>
  );

  const renderScheduledBookingsSection = () => (
    <div className="mt-4">
      {" "}
      {/* Add margin top for spacing below tabs */}
      <h4 className="mb-2 text-sm font-medium">
        Réservations planifiées ({selectedDateBookings.length})
        {/* Indicate loading only if list is currently empty and still loading initial bookings */}
        {isLoading && selectedDateBookings.length === 0 && " (Mise à jour...)"}
      </h4>
      {/* Show bookings error specifically within this tab */}
      {bookingsError && (
        <div className="p-2 mb-3 text-sm text-red-600 border border-red-200 rounded bg-red-50">
          Erreur chargement réservations: {bookingsError.message}
        </div>
      )}
      {/* Show empty state only if not loading and no error */}
      {selectedDateBookings.length === 0 && !isLoading && !bookingsError ? (
        <div className="p-2 text-sm text-center text-gray-500 rounded bg-gray-50">
          Aucune réservation SPA planifiée pour cette date.
        </div>
      ) : (
        /* Render the list if not loading and no error, even if empty (handled above) */
        !isLoading &&
        !bookingsError && (
          <div className="pr-1 space-y-2 overflow-y-auto max-h-40">
            {" "}
            {/* Increased max-height slightly */}
            {selectedDateBookings.map((booking) => {
              const colors = getPropertyColor(booking);
              // Attempt to parse start and end times safely
              const startTime =
                booking.spaDateTimeObj ||
                parseBookingDateTime(booking.spaDateTime);
              const endTime =
                booking.spaEndDateTimeObj ||
                parseBookingDateTime(booking.spaEndDateTime);
              let displayTimeRange = "Heure invalide";
              const slotDuration = spaSettings?.slotDurationMinutes || null;

              // Calculate display time range logic
              if (startTime && !isNaN(startTime.getTime())) {
                displayTimeRange = format(startTime, "HH:mm", { locale: fr });
                // Check if end time is valid and after start time
                if (
                  endTime &&
                  !isNaN(endTime.getTime()) &&
                  isAfter(endTime, startTime)
                ) {
                  displayTimeRange += ` - ${format(endTime, "HH:mm", {
                    locale: fr,
                  })}`;
                }
                // If end time is missing/invalid, try estimating from slots
                else if (booking.spaSlots?.length > 0 && slotDuration) {
                  const assumedEndTime = addMinutes(
                    startTime,
                    booking.spaSlots.length * slotDuration
                  );
                  // Ensure assumed end time is after start time
                  if (isAfter(assumedEndTime, startTime)) {
                    displayTimeRange += ` - ${format(assumedEndTime, "HH:mm", {
                      locale: fr,
                    })} (estimé)`;
                  } else {
                    displayTimeRange += ` (Durée invalide)`; // If calculation results in end <= start
                  }
                }
                // Fallback if end time cannot be determined
                else {
                  displayTimeRange += ` (Fin manquante/invalide)`;
                }
              } else {
                // If start time itself is invalid
                displayTimeRange = "Heure début invalide";
              }
              // End time range formatting logic

              return (
                <button
                  key={booking.id}
                  type="button"
                  onClick={() => onScheduledBookingClick(booking)}
                  disabled={isActionLoading || isOverrideSaving} // Disable during any action
                  className={`w-full text-left p-2 border rounded cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${colors.bg} ${colors.text} ${colors.border}`}
                  title={`Voir détails pour ${
                    booking.guestName ||
                    booking.firstName + " " + booking.lastName
                  } - ${booking.property}`}
                >
                  <div className="text-sm font-medium">{displayTimeRange}</div>
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
    </div>
  );

  // Main Component Return
  return (
    <div className="p-3 border rounded">
      <h3 className="mb-3 text-lg font-semibold">
        {" "}
        {/* Increased margin bottom */}
        Détails - {format(selectedDate, "EEEE d MMMM", { locale: fr })}
      </h3>

      {/* --- Tab Navigation --- */}
      <div className="border-b border-gray-200">
        <nav className="flex -mb-px space-x-6" aria-label="Tabs">
          {" "}
          {/* Increased space */}
          <button
            type="button"
            onClick={() => setActiveTab("override")}
            className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm focus:outline-none ${
              activeTab === "override"
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
            aria-current={activeTab === "override" ? "page" : undefined}
          >
            Gestion Horaire
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("slots")}
            className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm focus:outline-none ${
              activeTab === "slots"
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
            aria-current={activeTab === "slots" ? "page" : undefined}
          >
            Créneaux Disponibles
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("scheduled")}
            className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm focus:outline-none ${
              activeTab === "scheduled"
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
            aria-current={activeTab === "scheduled" ? "page" : undefined}
          >
            Réservations Planifiées ({selectedDateBookings.length}){" "}
            {/* Show count here */}
          </button>
        </nav>
      </div>

      {/* --- Tab Content --- */}
      {/* Show overall initial loading message *before* rendering tab content */}
      {isLoading &&
      !overrideLoading &&
      !isSlotsLoading &&
      selectedDateBookings.length === 0 ? ( // Show only during initial load phase
        <div className="p-4 mt-4 text-center text-blue-600">
          Chargement initial des données...
        </div>
      ) : (
        // Render the active tab's content - Loading/error states are handled within each render function
        <>
          {activeTab === "override" && renderOverrideSection()}
          {activeTab === "slots" && renderAvailableSlotsSection()}
          {activeTab === "scheduled" && renderScheduledBookingsSection()}
        </>
      )}
    </div> // End Outer container div
  );
};

export default SelectedDateDetailsPanel;
