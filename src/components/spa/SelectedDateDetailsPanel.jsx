// File: src/components/spa/SelectedDateDetailsPanel.jsx

import React, { useState } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { isDateWithinBookingStay, getPropertyColor } from "./spaCalendarUtils";

/**
 * Component to display available slots, scheduled bookings, and manage overrides for the selected date using tabs.
 */
const SelectedDateDetailsPanel = ({
  selectedDate,
  selectedBooking,
  availableSlots,
  manuallyDeactivatedSlots,
  isDayClosed,
  selectedDateBookings,
  wordpressBookings, // New prop for WordPress bookings
  spaSettings,
  overrideData,
  overrideLoading,
  overrideError,
  editableOverrideSettings,
  onEditableOverrideChange,
  onSaveOverride,
  onDeleteOverride,
  onBookSlot,
  onScheduledBookingClick,
  onCancelWordPressBooking, // New prop for the cancellation handler
  isLoading,
  isSlotsLoading,
  slotsError,
  bookingsError,
  isActionLoading,
  isOverrideSaving,
  onToggleSlotActivation,
}) => {
  const [activeTab, setActiveTab] = useState("slots");

  if (!selectedDate) {
    return (
      <div className="p-3 border rounded">
        <h3 className="mb-2 text-lg font-semibold">Sélectionnez une date</h3>
        <div className="p-4 text-sm text-center text-gray-500 rounded bg-gray-50">
          Sélectionnez une date pour gérer les créneaux et voir les détails.
        </div>
      </div>
    );
  }

  const displaySearchDuration =
    selectedBooking?.spaTreatmentDuration &&
    typeof selectedBooking.spaTreatmentDuration === "number"
      ? selectedBooking.spaTreatmentDuration
      : 120;

  const canEditOverridePanel = !!editableOverrideSettings;

  const handleSlotButtonClick = (slotString, isCurrentlyDeactivated) => {
    if (!selectedDate || isOverrideSaving || isActionLoading) {
      alert("Une opération est en cours, veuillez patienter.");
      return;
    }

    if (isCurrentlyDeactivated) {
      if (
        window.confirm(
          `Voulez-vous réactiver le créneau de ${slotString} pour le ${format(
            selectedDate,
            "EEEE d MMMM",
            { locale: fr }
          )} ?`
        )
      ) {
        onToggleSlotActivation(slotString);
      }
    } else {
      const canAdminDeactivateSlot =
        !selectedBooking ||
        (selectedBooking && selectedBooking.spaBookingPreference !== "later");
      if (canAdminDeactivateSlot) {
        if (
          window.confirm(
            `Voulez-vous désactiver le créneau de ${slotString} pour le ${format(
              selectedDate,
              "EEEE d MMMM",
              { locale: fr }
            )} ?\nCe créneau ne sera plus disponible à la réservation.`
          )
        ) {
          onToggleSlotActivation(slotString);
        }
      } else {
        if (
          selectedBooking &&
          !isDateWithinBookingStay(selectedDate, selectedBooking)
        ) {
          alert(
            `La date sélectionnée (${format(
              selectedDate,
              "dd/MM/yyyy"
            )}) est en dehors des dates de séjour du client (${format(
              selectedBooking.arrivalDateObj,
              "dd/MM/yyyy"
            )} - ${format(selectedBooking.departureDateObj, "dd/MM/yyyy")}).`
          );
          return;
        }
        onBookSlot(selectedDate, slotString);
      }
    }
  };

  // --- NEW RENDER FUNCTION FOR WORDPRESS BOOKINGS ---
  const renderWordPressBookingsSection = () => (
    <div className="mt-4">
      <h4 className="mb-2 text-sm font-medium text-blue-700">
        Réservations Externes (WordPress) ({wordpressBookings?.length || 0})
      </h4>
      {(!wordpressBookings || wordpressBookings.length === 0) && (
        <div className="p-2 text-sm text-center text-gray-500 rounded bg-gray-50">
          Aucune réservation externe pour cette date.
        </div>
      )}
      {wordpressBookings && wordpressBookings.length > 0 && (
        <div className="pr-1 space-y-2 overflow-y-auto max-h-40">
          {wordpressBookings.map((booking) => (
            <div
              key={booking.id}
              className="flex items-center justify-between p-2 text-sm border rounded bg-blue-50"
            >
              <span className="font-medium text-blue-800">
                Créneau: {booking.time}
              </span>
              <button
                onClick={() => {
                  if (
                    window.confirm(
                      `Voulez-vous vraiment annuler le créneau de ${booking.time} ? Cette action est irréversible.`
                    )
                  ) {
                    onCancelWordPressBooking(booking.id);
                  }
                }}
                className="px-2 py-1 text-xs font-medium text-red-700 bg-red-100 border border-red-200 rounded hover:bg-red-200 disabled:opacity-50"
                disabled={isActionLoading || isOverrideSaving}
              >
                Annuler
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderOverrideSection = () => (
    <div className="mt-4">
      <h4 className="sr-only">Gestion Horaire Spécifique / Fermeture</h4>
      {overrideLoading ? (
        <div className="p-2 text-sm text-center text-blue-500">
          Chargement de l'état horaire spécifique...
        </div>
      ) : overrideError ? (
        <div className="p-2 text-sm text-red-600 border border-red-200 rounded bg-red-50">
          Erreur chargement horaire spécifique: {overrideError.message}
        </div>
      ) : !canEditOverridePanel ? (
        <div className="p-2 text-sm text-center text-gray-400">
          Impossible d'éditer les paramètres pour le moment.
        </div>
      ) : (
        <div className="p-3 space-y-3 border border-gray-200 rounded-md bg-gray-50">
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
              disabled={isOverrideSaving || isActionLoading}
              className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500 disabled:opacity-50"
            />
            <label
              htmlFor="overrideIsClosed"
              className="ml-2 text-sm font-medium text-gray-700"
            >
              Marquer comme fermé pour cette date
            </label>
          </div>
          <div
            className={`flex flex-wrap gap-3 ${
              editableOverrideSettings.isClosed
                ? "opacity-50 pointer-events-none"
                : ""
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
                disabled={isOverrideSaving || isActionLoading}
                className="block w-full px-2 py-1 text-sm border-gray-300 rounded shadow-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
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
                disabled={isOverrideSaving || isActionLoading}
                className="block w-full px-2 py-1 text-sm border-gray-300 rounded shadow-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
              />
            </div>
          </div>
          <div className="flex items-center justify-end pt-2 space-x-2 border-t border-gray-200">
            {isOverrideSaving && (
              <span className="text-xs text-blue-600">Enregistrement...</span>
            )}
            {overrideData && (
              <button
                onClick={onDeleteOverride}
                disabled={isOverrideSaving || isActionLoading}
                className="px-3 py-1 text-xs font-medium text-red-700 bg-red-100 border border-red-300 rounded hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1 disabled:opacity-60"
              >
                Supprimer Horaire Spéc.
              </button>
            )}
            <button
              onClick={onSaveOverride}
              disabled={isOverrideSaving || isActionLoading}
              className="px-3 py-1 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 disabled:opacity-60"
            >
              {overrideData ? "Modifier Horaire Spéc." : "Créer Horaire Spéc."}
            </button>
          </div>
        </div>
      )}
    </div>
  );

  const renderSlotsManagementSection = () => (
    <div className="mt-4 space-y-6">
      {isSlotsLoading && (
        <div className="p-2 text-sm text-center text-blue-500">
          Chargement des créneaux...
        </div>
      )}
      {slotsError && !isSlotsLoading && (
        <div className="p-2 text-sm text-red-600 border border-red-200 rounded bg-red-50">
          Erreur chargement créneaux: {slotsError.message}
        </div>
      )}

      {!isSlotsLoading && !slotsError && (
        <>
          {isDayClosed && (
            <div className="p-3 text-sm text-center text-orange-700 border border-orange-200 rounded bg-orange-50">
              Le SPA est actuellement fermé pour cette date.
            </div>
          )}

          <div className={isDayClosed ? "opacity-50 pointer-events-none" : ""}>
            <h4 className="mb-2 text-sm font-medium text-green-700">
              Créneaux disponibles ({availableSlots.length})
            </h4>
            {availableSlots.length === 0 && !isDayClosed && (
              <div className="p-2 text-sm text-center text-gray-500 rounded bg-gray-50">
                Aucun créneau disponible.
              </div>
            )}
            {availableSlots.length > 0 && !isDayClosed && (
              <div className="grid grid-cols-2 gap-2 pr-1 overflow-y-auto sm:grid-cols-3 max-h-40">
                {availableSlots.map((slot) => {
                  const slotButtonDisabled =
                    isOverrideSaving || isActionLoading || isLoading;
                  let title = "";
                  if (slotButtonDisabled) title = "Action en cours...";
                  else {
                    const canAdminDeactivateSlot =
                      !selectedBooking ||
                      (selectedBooking &&
                        selectedBooking.spaBookingPreference !== "later");
                    if (canAdminDeactivateSlot)
                      title = `Cliquer pour DÉSactiver le créneau ${slot}`;
                    else {
                      title = `Cliquer pour RÉSERVER ${slot} pour ${
                        selectedBooking.guestName ||
                        `${selectedBooking.firstName} ${selectedBooking.lastName}`
                      }`;
                      if (
                        !isDateWithinBookingStay(selectedDate, selectedBooking)
                      )
                        title = `Date hors séjour. Réservation impossible.`;
                    }
                  }
                  return (
                    <button
                      key={`avail-${slot}`}
                      type="button"
                      onClick={() => handleSlotButtonClick(slot, false)}
                      disabled={
                        slotButtonDisabled ||
                        (selectedBooking &&
                          !isDateWithinBookingStay(
                            selectedDate,
                            selectedBooking
                          ) &&
                          selectedBooking.spaBookingPreference === "later")
                      }
                      className={`px-3 py-1.5 rounded-md border text-sm font-medium transition-colors duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-1 ${
                        slotButtonDisabled ||
                        (selectedBooking &&
                          !isDateWithinBookingStay(
                            selectedDate,
                            selectedBooking
                          ) &&
                          selectedBooking.spaBookingPreference === "later")
                          ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                          : "bg-green-50 text-green-700 border-green-300 hover:border-green-500 hover:bg-green-100"
                      }`}
                      title={title}
                    >
                      {slot}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className={isDayClosed ? "opacity-50 pointer-events-none" : ""}>
            <h4 className="mb-2 text-sm font-medium text-red-700">
              Créneaux désactivés ({manuallyDeactivatedSlots.length})
            </h4>
            {manuallyDeactivatedSlots.length === 0 && !isDayClosed && (
              <div className="p-2 text-sm text-center text-gray-500 rounded bg-gray-50">
                Aucun créneau spécifiquement désactivé.
              </div>
            )}
            {manuallyDeactivatedSlots.length > 0 && !isDayClosed && (
              <div className="grid grid-cols-2 gap-2 pr-1 overflow-y-auto sm:grid-cols-3 max-h-40">
                {manuallyDeactivatedSlots.map((slot) => {
                  const slotButtonDisabled =
                    isOverrideSaving || isActionLoading || isLoading;
                  let title = slotButtonDisabled
                    ? "Action en cours..."
                    : `Cliquer pour RÉactiver le créneau ${slot}`;
                  return (
                    <button
                      key={`deact-${slot}`}
                      type="button"
                      onClick={() => handleSlotButtonClick(slot, true)}
                      disabled={slotButtonDisabled}
                      className={`px-3 py-1.5 rounded-md border text-sm font-medium transition-colors duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-1 ${
                        slotButtonDisabled
                          ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                          : "bg-red-50 text-red-700 border-red-300 hover:border-red-500 hover:bg-red-100"
                      }`}
                      title={title}
                    >
                      {slot}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* --- RENDER THE NEW SECTION HERE --- */}
          {renderWordPressBookingsSection()}

          {!selectedBooking &&
            !isDayClosed &&
            (availableSlots.length > 0 ||
              manuallyDeactivatedSlots.length > 0) && (
              <div className="p-2 mt-4 text-sm text-center text-yellow-600 border border-yellow-200 rounded bg-yellow-50">
                Sélectionnez une réservation "À programmer" pour réserver un
                créneau.
              </div>
            )}
        </>
      )}
    </div>
  );

  const renderScheduledBookingsSection = () => (
    <div className="mt-4">
      <h4 className="mb-2 text-sm font-medium">
        Réservations planifiées ({selectedDateBookings.length})
      </h4>
      {bookingsError && (
        <div className="p-2 mb-3 text-sm text-red-600 border border-red-200 rounded bg-red-50">
          Erreur chargement réservations: {bookingsError.message}
        </div>
      )}
      {selectedDateBookings.length === 0 && !isLoading && !bookingsError ? (
        <div className="p-2 text-sm text-center text-gray-500 rounded bg-gray-50">
          Aucune réservation SPA planifiée pour cette date.
        </div>
      ) : (
        !isLoading &&
        !bookingsError && (
          <div className="pr-1 space-y-2 overflow-y-auto max-h-40">
            {selectedDateBookings.map((booking) => {
              const colors = getPropertyColor(booking);
              const startTime = booking.spaDateTimeObj;
              const endTime = booking.spaEndDateTimeObj;
              let displayTimeRange = "Heure invalide";
              if (startTime && !isNaN(startTime.getTime())) {
                displayTimeRange = format(startTime, "HH:mm", { locale: fr });
                if (endTime && !isNaN(endTime.getTime()) && endTime > startTime)
                  displayTimeRange += ` - ${format(endTime, "HH:mm", {
                    locale: fr,
                  })}`;
              }
              return (
                <button
                  key={booking.id}
                  type="button"
                  onClick={() => onScheduledBookingClick(booking)}
                  disabled={isActionLoading || isOverrideSaving}
                  className={`w-full text-left p-2 border rounded cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${colors.bg} ${colors.text} ${colors.border}`}
                  title={`Voir détails pour ${
                    booking.guestName ||
                    `${booking.firstName} ${booking.lastName}`
                  }`}
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

  return (
    <div className="p-3 border rounded">
      <h3 className="mb-3 text-lg font-semibold">
        Détails - {format(selectedDate, "EEEE d MMMM", { locale: fr })}
      </h3>
      <div className="border-b border-gray-200">
        <nav className="flex -mb-px space-x-6" aria-label="Tabs">
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
            Créneaux
          </button>
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
            Horaires spécifiques
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
            Réservations planifiées ({selectedDateBookings.length})
          </button>
        </nav>
      </div>
      {isLoading && activeTab !== "override" ? (
        <div className="p-4 mt-4 text-center text-blue-600">
          Chargement des données...
        </div>
      ) : (
        <>
          {activeTab === "slots" && renderSlotsManagementSection()}
          {activeTab === "override" && renderOverrideSection()}
          {activeTab === "scheduled" && renderScheduledBookingsSection()}
        </>
      )}
    </div>
  );
};

export default SelectedDateDetailsPanel;
