// File: src/components/Admin/EditDeleteSpaModal.jsx
import React from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { parseBookingDateTime } from "./spaCalendarUtils"; // Correct utility path

/**
 * Component to display the modal for editing or deleting a scheduled booking.
 * @param {object} props
 * @param {object|null} props.bookingToEdit - The scheduled booking object currently selected for action.
 * @param {string} props.modalStep - Current step of the modal ('options' | 'confirm-reschedule' | 'confirm-delete').
 * @param {() => void} props.onClose - Handler to close the modal.
 * @param {() => void} props.onRescheduleConfirm - Handler to confirm rescheduling the booking.
 * @param {() => void} props.onDeleteConfirm - Handler to confirm deleting the booking.
 * @param {boolean} props.actionLoading - State indicating if an action (save/delete) is in progress.
 * @param {() => void} props.onRequestRescheduleStep - Handler to request changing the modal step to 'confirm-reschedule'.
 * @param {() => void} props.onRequestDeleteStep - Handler to request changing the modal step to 'confirm-delete'.
 * @param {() => void} props.onRequestOptionsStep - Handler to request changing the modal step back to 'options'.
 */
const EditDeleteSpaModal = ({
  bookingToEdit,
  modalStep,
  onClose,
  onRescheduleConfirm,
  onDeleteConfirm,
  actionLoading,
  onRequestRescheduleStep, // Accepts prop from parent
  onRequestDeleteStep, // Accepts prop from parent
  onRequestOptionsStep, // Accepts prop from parent
}) => {
  console.log(
    "EditDeleteSpaModal rendering, modalStep:",
    modalStep,
    "bookingToEdit:",
    bookingToEdit?.id,
    "actionLoading:",
    actionLoading
  );

  // Don't render the modal if no booking is selected for editing
  if (!bookingToEdit) {
    console.log("EditDeleteSpaModal: No bookingToEdit, returning null");
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="max-w-full p-6 bg-white rounded-lg shadow-xl w-96">
        {/* Modal Content based on step */}
        {modalStep === "options" && (
          <>
            <h3 className="mb-4 text-lg font-semibold">
              Options pour le rendez-vous SPA
            </h3>

            {/* Booking Details - Use data from bookingToEdit prop */}
            <div className="mb-4 text-sm text-gray-700">
              <div className="text-base font-medium">
                Client:{" "}
                {bookingToEdit.guestName ||
                  `${bookingToEdit.firstName} ${bookingToEdit.lastName}`}
              </div>
              <div className="">Chambre: {bookingToEdit.property}</div>
              {/* Safely parse and format dates for display - Use parsed objects or utility */}
              {(() => {
                // Use the parsed objects stored by the hook if available, otherwise use utility parse for display
                const startTime =
                  bookingToEdit.spaDateTimeObj ||
                  parseBookingDateTime(bookingToEdit.spaDateTime);
                const endTime =
                  bookingToEdit.spaEndDateTimeObj ||
                  parseBookingDateTime(bookingToEdit.spaEndDateTime);

                const isValidTime = startTime && !isNaN(startTime.getTime());

                if (isValidTime) {
                  return (
                    <>
                      <div className="">
                        Date:{" "}
                        {format(startTime, "EEEE d MMMM yyyy", {
                          locale: fr,
                        })}
                      </div>
                      {endTime && !isNaN(endTime.getTime()) ? (
                        <div className="">
                          Heure: {format(startTime, "HH:mm", { locale: fr })} -{" "}
                          {format(endTime, "HH:mm", { locale: fr })}
                        </div>
                      ) : // Fallback display if only start time is valid
                      // Check if slots array exists and has items before assuming duration
                      bookingToEdit.spaSlots?.length > 0 ? (
                        <div className="text-xs text-gray-600">
                          Heure de début:{" "}
                          {format(startTime, "HH:mm", { locale: fr })} (Heure de
                          fin manquante/invalide)
                        </div>
                      ) : (
                        <div className="text-xs text-red-500">
                          Heure de fin invalide ou manquante
                        </div>
                      )}
                      {bookingToEdit.spaSlots &&
                        bookingToEdit.spaSlots.length > 0 && (
                          <div className="text-xs text-gray-600">
                            Créneaux réservés:{" "}
                            {bookingToEdit.spaSlots.join(", ")}
                          </div>
                        )}
                      {bookingToEdit.spaTreatmentDuration && (
                        <div className="text-xs text-gray-600">
                          Durée demandée: {bookingToEdit.spaTreatmentDuration}{" "}
                          min
                        </div>
                      )}
                    </>
                  );
                }
                return (
                  <div className="text-xs text-red-500">
                    Date/Heure de début SPA invalide ou manquante
                  </div>
                ); // Message if dates are bad
              })()}
              {bookingToEdit.notes && ( // Display notes if available
                <div className="mt-1 text-xs italic text-gray-700">
                  Notes: {bookingToEdit.notes}
                </div>
              )}
            </div>

            {/* Action Buttons - Use passed handlers and actionLoading state */}
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  console.log("Modal: Fermer clicked");
                  onClose();
                }} // Use passed handler to close
                className="px-4 py-2 text-sm bg-gray-200 rounded hover:bg-gray-300"
                disabled={actionLoading}
              >
                Fermer
              </button>
              {/* Call props handlers to request step changes */}
              <button
                onClick={() => {
                  console.log("Modal: Reprogrammer (options) clicked");
                  onRequestRescheduleStep();
                }} // <-- CORRECTED: CALL PROP + log
                className="px-4 py-2 text-sm text-white bg-yellow-500 rounded hover:bg-yellow-600"
                disabled={actionLoading}
              >
                Reprogrammer
              </button>
              <button
                onClick={() => {
                  console.log("Modal: Supprimer (options) clicked");
                  onRequestDeleteStep();
                }} // <-- CORRECTED: CALL PROP + log
                className="px-4 py-2 text-sm text-white bg-red-500 rounded hover:bg-red-600"
                disabled={actionLoading}
              >
                Supprimer
              </button>
            </div>
          </>
        )}

        {modalStep === "confirm-reschedule" && (
          <>
            <h3 className="mb-4 text-lg font-semibold">
              Confirmer la Reprogrammation
            </h3>
            <p className="mb-6 text-sm text-gray-700">
              Êtes-vous sûr de vouloir retirer ce rendez-vous planifié pour le
              reprogrammer ? Il apparaîtra de nouveau dans la liste "À
              programmer".
            </p>
            {/* Show action loading state passed from parent */}
            {actionLoading && (
              <div className="p-2 mb-3 text-center text-blue-600">
                Action en cours...
              </div>
            )}
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  console.log("Modal: Annuler (reschedule confirm) clicked");
                  onRequestOptionsStep();
                }} // <-- CORRECTED: CALL PROP + log
                className="px-4 py-2 text-sm bg-gray-200 rounded hover:bg-gray-300"
                disabled={actionLoading}
              >
                Annuler
              </button>
              <button
                onClick={() => {
                  console.log("Modal: Oui, Reprogrammer (confirm) clicked");
                  onRescheduleConfirm();
                }} // Use passed handler for confirmation + log
                className="px-4 py-2 text-sm text-white bg-yellow-500 rounded hover:bg-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={actionLoading} // Disable during action
              >
                Oui, Reprogrammer
              </button>
            </div>
          </>
        )}

        {modalStep === "confirm-delete" && (
          <>
            <h3 className="mb-4 text-lg font-semibold">
              Confirmer la Suppression
            </h3>
            <p className="mb-6 text-sm text-gray-700">
              Êtes-vous sûr de vouloir supprimer ce rendez-vous SPA ? Cette
              action est irréversible.
            </p>
            {/* Show action loading state passed from parent */}
            {actionLoading && (
              <div className="p-2 mb-3 text-center text-blue-600">
                Action en cours...
              </div>
            )}
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  console.log("Modal: Annuler (delete confirm) clicked");
                  onRequestOptionsStep();
                }} // <-- CORRECTED: CALL PROP + log
                className="px-4 py-2 text-sm bg-gray-200 rounded hover:bg-gray-300"
                disabled={actionLoading}
              >
                Annuler
              </button>
              <button
                onClick={() => {
                  console.log("Modal: Oui, Supprimer (confirm) clicked");
                  onDeleteConfirm();
                }} // Use passed handler for confirmation + log
                className="px-4 py-2 text-sm text-white bg-red-500 rounded hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={actionLoading} // Disable during action
              >
                Oui, Supprimer
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default EditDeleteSpaModal;
