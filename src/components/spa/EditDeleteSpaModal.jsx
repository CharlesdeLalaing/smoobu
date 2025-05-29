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
  onRequestRescheduleStep,
  onRequestDeleteStep,
  onRequestOptionsStep,
}) => {


  if (!bookingToEdit) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
      <div className="w-full max-w-md p-6 bg-white rounded-lg shadow-xl">
        {/* Modal Content based on step */}
        {modalStep === "options" && (
          <>
            <h3 className="mb-4 text-lg font-semibold text-gray-800">
              Options pour le rendez-vous SPA
            </h3>

            {/* Booking Details */}
            <div className="mb-4 space-y-1 text-sm text-gray-700">
              <div className="text-base font-medium">
                Client:{" "}
                {bookingToEdit.guestName ||
                  `${bookingToEdit.firstName} ${bookingToEdit.lastName}`}
              </div>
              <div className="">Chambre: {bookingToEdit.property}</div>
              {(() => {
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
                      ) : bookingToEdit.spaSlots?.length > 0 ? (
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
                );
              })()}
              {bookingToEdit.notes && (
                <div className="mt-1 text-xs italic text-gray-700">
                  Notes: {bookingToEdit.notes}
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col items-center pt-4 mt-4 space-y-3 border-t sm:flex-row sm:justify-between sm:space-y-0 sm:space-x-2">
              {/* MODIFIED "Supprimer" BUTTON */}
              <button
                onClick={() => {
                  onRequestDeleteStep();
                }}
                className="py-1 text-xs font-medium text-red-600 sm:w-auto hover:text-red-700 hover:underline focus:outline-none focus:underline focus:text-red-700 disabled:opacity-50 disabled:no-underline disabled:cursor-not-allowed"
                disabled={actionLoading}
              >
                Supprimer
              </button>
              <div className="flex flex-col w-full space-y-3 sm:flex-row sm:justify-end sm:space-y-0 sm:space-x-2 sm:w-auto">
                <button
                  onClick={() => {
                    onClose();
                  }}
                  className="w-full px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md sm:w-auto hover:bg-gray-200"
                  disabled={actionLoading}
                >
                  Fermer
                </button>
                <button
                  onClick={() => {
                    onRequestRescheduleStep();
                  }}
                  className="w-full px-4 py-2 text-sm font-medium text-white bg-yellow-500 border border-transparent rounded-md sm:w-auto hover:bg-yellow-600"
                  disabled={actionLoading}
                >
                  Reprogrammer
                </button>
              </div>
            </div>
          </>
        )}

        {modalStep === "confirm-reschedule" && (
          <>
            <h3 className="mb-4 text-lg font-semibold text-gray-800">
              Confirmer la Reprogrammation
            </h3>
            <p className="mb-6 text-sm text-gray-700">
              Êtes-vous sûr de vouloir retirer ce rendez-vous planifié pour le
              reprogrammer ? Il apparaîtra de nouveau dans la liste "À
              programmer".
            </p>
            {actionLoading && (
              <div className="p-2 mb-3 text-sm text-center text-blue-600 animate-pulse">
                Action en cours...
              </div>
            )}
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  onRequestOptionsStep();
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200"
                disabled={actionLoading}
              >
                Annuler
              </button>
              <button
                onClick={() => {
                  onRescheduleConfirm();
                }}
                className="px-4 py-2 text-sm font-medium text-white bg-yellow-500 rounded-md hover:bg-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={actionLoading}
              >
                Oui, Reprogrammer
              </button>
            </div>
          </>
        )}

        {modalStep === "confirm-delete" && (
          <>
            <h3 className="mb-4 text-lg font-semibold text-gray-800">
              Confirmer la Suppression
            </h3>
            <p className="mb-6 text-sm text-gray-700">
              Êtes-vous sûr de vouloir supprimer ce rendez-vous SPA ?{" "}
              <span className="font-semibold">
                Cette action est irréversible.
              </span>
            </p>
            {actionLoading && (
              <div className="p-2 mb-3 text-sm text-center text-blue-600 animate-pulse">
                Action en cours...
              </div>
            )}
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  onRequestOptionsStep();
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200"
                disabled={actionLoading}
              >
                Annuler
              </button>
              <button
                onClick={() => {
                  console.log("Modal: Oui, Supprimer (confirm) clicked");
                  onDeleteConfirm();
                }}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={actionLoading}
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