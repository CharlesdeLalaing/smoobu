import React, { useState, useEffect, useMemo } from "react";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  startOfDay,
  addMinutes,
  addDays, // Keep addDays for month navigation logic if simplified
  isAfter,
  isValid as isDateValid,
  parseISO,
} from "date-fns";
import { fr } from "date-fns/locale";
import {
  doc,
  updateDoc,
  deleteField,
  setDoc,
  deleteDoc,
} from "firebase/firestore";
import { db } from "../../firebase";

import {
  // parseBookingDateTime, // Not directly used in SpaCalendar, but utils might be
  isDateWithinBookingStay, // Crucial for disabling dates
  getPropertyColor,
  calculateBookingSlots,
} from "../spa/spaCalendarUtils";

import {
  useSpaSettings,
  useBookingsForMonth,
  useAvailableSlots,
} from "../spa/useSpaCalendarData";

import BookingsToSchedulePanel from "../spa/BookingsToSchedulePanel";
import SelectedDateDetailsPanel from "../spa/SelectedDateDetailsPanel";
import SpaTimeline from "../spa/SpaTimeline";
import EditDeleteSpaModal from "../spa/EditDeleteSpaModal";

const SpaCalendar = () => {
  console.log("SpaCalendar rendering...");
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [bookingToEdit, setBookingToEdit] = useState(null);
  const [showEditDeleteModal, setShowEditDeleteModal] = useState(false);
  const [modalStep, setModalStep] = useState("options");
  const [actionLoading, setActionLoading] = useState(false);

  const [editableSpaSettings, setEditableSpaSettings] = useState(null);
  const [settingsSavingLoading, setSettingsSavingLoading] = useState(false);
  const [settingsSavingError, setSettingsSavingError] = useState(null);

  const [editableOverrideSettings, setEditableOverrideSettings] =
    useState(null);
  const [overrideSavingLoading, setOverrideSavingLoading] = useState(false);
  const [overrideSavingError, setOverrideSavingError] = useState(null);

  const {
    spaSettings,
    loading: settingsLoading,
    error: settingsError,
    refetch: refetchSpaSettings,
  } = useSpaSettings();

  const {
    bookings,
    loading: bookingsLoading,
    error: bookingsError,
    refetch: refetchBookings,
  } = useBookingsForMonth(currentMonth);

  const {
    availableSlots,
    manuallyDeactivatedSlots,
    isDayClosed,
    loading: slotsAndOverrideHookLoading,
    error: slotsAndOverrideHookError,
    overrideData,
    // Individual loading/error states from hook if needed for finer UI distinctions:
    // slotsLoading: apiSlotsLoading,
    // slotsError: apiSlotsError,
    // overrideLoading: docOverrideLoading, // Loading for the override document fetch
    // overrideError: docOverrideError,   // Error for the override document fetch
    refetch: refetchSlotsAndOverride,
  } = useAvailableSlots(selectedDate, selectedBooking, spaSettings);

  const selectedDateBookings = useMemo(() => {
    if (!selectedDate || !bookings || bookings.length === 0) return [];
    return bookings
      .filter(
        (booking) =>
          booking.spaDateTimeObj &&
          isSameDay(
            startOfDay(booking.spaDateTimeObj),
            startOfDay(selectedDate)
          )
      )
      .sort(
        (a, b) =>
          (a.spaDateTimeObj?.getTime() || 0) -
          (b.spaDateTimeObj?.getTime() || 0)
      );
  }, [bookings, selectedDate]);

  const bookingsToSchedule = useMemo(() => {
    if (!bookings || bookings.length === 0) return [];
    return bookings
      .filter((b) => b.needsScheduling)
      .sort((a, b) => {
        let arrivalA = a.arrivalDateObj || new Date(0);
        let arrivalB = b.arrivalDateObj || new Date(0);
        if (arrivalA.getTime() - arrivalB.getTime() !== 0)
          return arrivalA.getTime() - arrivalB.getTime();
        return a.property?.localeCompare(b.property || "") || 0;
      });
  }, [bookings]);

  const overallLoading =
    bookingsLoading || settingsLoading || slotsAndOverrideHookLoading;
  const overallError =
    bookingsError || settingsError || slotsAndOverrideHookError;

  useEffect(() => {
    if (spaSettings) {
      setEditableSpaSettings({
        startTime: spaSettings.startTime || "14:00",
        endTime: spaSettings.endTime || "23:59",
        slotDurationMinutes: spaSettings.slotDurationMinutes || 60,
      });
    } else {
      setEditableSpaSettings(null);
    }
  }, [spaSettings]);

  useEffect(() => {
    if (selectedDate) {
      if (overrideData) {
        setEditableOverrideSettings({
          startTime: overrideData.startTime || "",
          endTime: overrideData.endTime || "",
          isClosed: overrideData.isClosed || false,
          manuallyDeactivatedSlots: overrideData.manuallyDeactivatedSlots || [],
        });
      } else {
        setEditableOverrideSettings({
          startTime: "",
          endTime: "",
          isClosed: isDayClosed || false,
          manuallyDeactivatedSlots: [],
        });
      }
    } else {
      setEditableOverrideSettings(null);
    }
  }, [overrideData, selectedDate, isDayClosed]);

  const handleUpdateBookingSpaDate = async (
    bookingId,
    dateTime,
    slotsToBook
  ) => {
    if (actionLoading || settingsSavingLoading || overrideSavingLoading) return;
    setActionLoading(true);
    try {
      const slotDurationMinutes = spaSettings?.slotDurationMinutes || 30;
      const totalDurationMinutes =
        (slotsToBook?.length || 0) * slotDurationMinutes;
      const endDateTime = new Date(
        dateTime.getTime() + totalDurationMinutes * 60000
      );

      await updateDoc(doc(db, "bookings", bookingId), {
        spaDateTime: dateTime,
        spaEndDateTime: endDateTime,
        spaSlots: slotsToBook,
        spaBookingPreference: "scheduled",
        spaInfo: {
          hasSpaTreatment: true,
          scheduledDateTime: dateTime,
          endDateTime: endDateTime,
          preference: "scheduled",
          formattedDateTime: format(dateTime, "PPPp", { locale: fr }),
          slots: slotsToBook,
          status: "scheduled",
        },
      });
      alert(
        `Rendez-vous SPA planifié pour le ${format(
          dateTime,
          "EEEE d MMMM HH:mm",
          { locale: fr }
        )}.`
      );
      refetchBookings(currentMonth);
      if (selectedDate)
        refetchSlotsAndOverride(selectedDate, selectedBooking, spaSettings);
      setSelectedBooking(null);
    } catch (error) {
      console.error("Error updating booking:", error);
      alert("Échec de la planification du rendez-vous.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteSpaAppointment = async () => {
    if (
      actionLoading ||
      settingsSavingLoading ||
      overrideSavingLoading ||
      !bookingToEdit
    )
      return;
    setActionLoading(true);
    try {
      await updateDoc(doc(db, "bookings", bookingToEdit.id), {
        spaDateTime: deleteField(),
        spaEndDateTime: deleteField(),
        spaSlots: deleteField(),
        spaBookingPreference: "none",
        spaInfo: { hasSpaTreatment: false, status: "cancelled" },
      });
      alert("Rendez-vous SPA supprimé.");
      refetchBookings(currentMonth);
      if (selectedDate)
        refetchSlotsAndOverride(selectedDate, null, spaSettings);
      if (selectedBooking?.id === bookingToEdit.id) setSelectedBooking(null);
    } catch (error) {
      console.error("Error deleting SPA appointment:", error);
      alert("Échec de la suppression.");
    } finally {
      closeEditDeleteModal();
      setActionLoading(false);
    }
  };

  const handleMarkBookingForRescheduling = async () => {
    if (
      actionLoading ||
      settingsSavingLoading ||
      overrideSavingLoading ||
      !bookingToEdit
    )
      return;
    setActionLoading(true);
    try {
      await updateDoc(doc(db, "bookings", bookingToEdit.id), {
        spaDateTime: deleteField(),
        spaEndDateTime: deleteField(),
        spaSlots: deleteField(),
        spaBookingPreference: "later",
        spaInfo: { hasSpaTreatment: true, status: "pending" },
      });
      alert("Rendez-vous SPA marqué pour être reprogrammé.");
      refetchBookings(currentMonth);
      if (selectedDate)
        refetchSlotsAndOverride(selectedDate, null, spaSettings);
      if (selectedBooking?.id === bookingToEdit.id) setSelectedBooking(null);
    } catch (error) {
      console.error("Error marking for rescheduling:", error);
      alert("Échec de la mise à jour.");
    } finally {
      closeEditDeleteModal();
      setActionLoading(false);
    }
  };

  const handleSaveSpaSettings = async () => {
    if (
      actionLoading ||
      settingsSavingLoading ||
      overrideSavingLoading ||
      !editableSpaSettings
    )
      return;
    setSettingsSavingError(null);
    const { startTime, endTime, slotDurationMinutes } = editableSpaSettings;

    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
      const errorMsg =
        "Les heures de début et de fin doivent être au format HH:mm.";
      setSettingsSavingError(errorMsg);
      alert(errorMsg);
      return;
    }
    if (!Number.isInteger(slotDurationMinutes) || slotDurationMinutes <= 0) {
      const errorMsg =
        "La durée du créneau doit être un nombre entier positif.";
      setSettingsSavingError(errorMsg);
      alert(errorMsg);
      return;
    }
    try {
      const today = startOfDay(new Date());
      const startTimeDate = parseISO(
        `${format(today, "yyyy-MM-dd")}T${startTime}`
      );
      const endTimeDate = parseISO(`${format(today, "yyyy-MM-dd")}T${endTime}`);
      if (
        !isDateValid(startTimeDate) ||
        !isDateValid(endTimeDate) ||
        !isAfter(endTimeDate, startTimeDate)
      ) {
        const errorMsg = "L'heure de fin doit être après l'heure de début.";
        setSettingsSavingError(errorMsg);
        alert(errorMsg);
        return;
      }
      if (
        isAfter(addMinutes(startTimeDate, slotDurationMinutes), endTimeDate)
      ) {
        const errorMsg =
          "La durée du créneau dépasse l'intervalle entre début et fin.";
        setSettingsSavingError(errorMsg);
        alert(errorMsg);
        return;
      }
    } catch (e) {
      const errorMsg = "Erreur de validation des heures.";
      setSettingsSavingError(errorMsg);
      alert(errorMsg);
      return;
    }

    setSettingsSavingLoading(true);
    try {
      await updateDoc(doc(db, "spaSettings", "default"), {
        startTime,
        endTime,
        slotDurationMinutes,
      });
      alert("Paramètres SPA enregistrés.");
      refetchSpaSettings();
      refetchBookings(currentMonth); // Refetch bookings as settings might affect display
      if (selectedDate)
        refetchSlotsAndOverride(
          selectedDate,
          selectedBooking,
          editableSpaSettings
        ); // Pass new settings for refetch
    } catch (error) {
      console.error("Error saving SPA settings:", error);
      setSettingsSavingError(`Échec: ${error.message}`);
      alert(`Échec: ${error.message}`);
    } finally {
      setSettingsSavingLoading(false);
    }
  };

  const handleSaveOverride = async () => {
    if (
      !selectedDate ||
      !editableOverrideSettings ||
      actionLoading ||
      settingsSavingLoading ||
      overrideSavingLoading
    )
      return;
    setOverrideSavingError(null);
    const { startTime, endTime, isClosed, manuallyDeactivatedSlots } =
      editableOverrideSettings;

    if (!isClosed) {
      const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
      if (startTime && !timeRegex.test(startTime)) {
        const errorMsg = "Override: Heure début invalide.";
        setOverrideSavingError(errorMsg);
        alert(errorMsg);
        return;
      }
      if (endTime && !timeRegex.test(endTime)) {
        const errorMsg = "Override: Heure fin invalide.";
        setOverrideSavingError(errorMsg);
        alert(errorMsg);
        return;
      }
      if (startTime && endTime) {
        try {
          const today = startOfDay(selectedDate);
          const startTimeDate = parseISO(
            `${format(today, "yyyy-MM-dd")}T${startTime}`
          );
          const endTimeDate = parseISO(
            `${format(today, "yyyy-MM-dd")}T${endTime}`
          );
          if (
            !isDateValid(startTimeDate) ||
            !isDateValid(endTimeDate) ||
            !isAfter(endTimeDate, startTimeDate)
          ) {
            const errorMsg = "Override: Heure fin doit être après heure début.";
            setOverrideSavingError(errorMsg);
            alert(errorMsg);
            return;
          }
        } catch (e) {
          const errorMsg = "Override: Erreur validation heures.";
          setOverrideSavingError(errorMsg);
          alert(errorMsg);
          return;
        }
      }
    }

    setOverrideSavingLoading(true);
    const dateStr = format(selectedDate, "yyyy-MM-dd");
    try {
      const overrideToSave = {
        startTime: startTime || "",
        endTime: endTime || "",
        isClosed: isClosed || false,
        manuallyDeactivatedSlots: manuallyDeactivatedSlots || [],
      };
      await setDoc(
        doc(db, "spaAvailabilityOverrides", dateStr),
        overrideToSave,
        { merge: true }
      );
      alert(`Override pour ${dateStr} enregistré.`);
      refetchSlotsAndOverride(selectedDate, selectedBooking, spaSettings);
    } catch (error) {
      console.error(`Error saving override for ${dateStr}:`, error);
      setOverrideSavingError(`Échec: ${error.message}`);
      alert(`Échec: ${error.message}`);
    } finally {
      setOverrideSavingLoading(false);
    }
  };

  const handleDeleteOverride = async () => {
    if (
      !selectedDate ||
      !overrideData ||
      actionLoading ||
      settingsSavingLoading ||
      overrideSavingLoading
    )
      return;
    const dateStr = format(selectedDate, "yyyy-MM-dd");
    if (!window.confirm(`Supprimer l'override pour ${dateStr} ?`)) return;

    setOverrideSavingLoading(true);
    try {
      await deleteDoc(doc(db, "spaAvailabilityOverrides", dateStr));
      alert(`Override pour ${dateStr} supprimé.`);
      refetchSlotsAndOverride(selectedDate, selectedBooking, spaSettings); // Refetch after delete
    } catch (error) {
      console.error(`Error deleting override for ${dateStr}:`, error);
      setOverrideSavingError(`Échec suppression: ${error.message}`);
      alert(`Échec suppression: ${error.message}`);
    } finally {
      setOverrideSavingLoading(false);
    }
  };

  const handleToggleSlotActivation = async (slotToToggle) => {
    if (!selectedDate || !editableOverrideSettings) {
      alert("Veuillez sélectionner une date.");
      return;
    }
    if (actionLoading || settingsSavingLoading || overrideSavingLoading) {
      alert("Une autre opération est en cours. Veuillez patienter.");
      return;
    }

    setOverrideSavingLoading(true);
    setOverrideSavingError(null);

    try {
      const currentDeactivatedSlots =
        editableOverrideSettings.manuallyDeactivatedSlots || [];
      let newDeactivatedSlots;
      let actionMessagePart;

      if (currentDeactivatedSlots.includes(slotToToggle)) {
        newDeactivatedSlots = currentDeactivatedSlots.filter(
          (s) => s !== slotToToggle
        );
        actionMessagePart = "réactivé";
      } else {
        const canDeactivate =
          !selectedBooking ||
          (selectedBooking && selectedBooking.spaBookingPreference !== "later");
        if (!canDeactivate) {
          alert(
            "La désactivation est bloquée si une réservation 'Plus tard' est sélectionnée."
          );
          setOverrideSavingLoading(false);
          return;
        }
        newDeactivatedSlots = [...currentDeactivatedSlots, slotToToggle];
        actionMessagePart = "désactivé";
      }

      const validatedStartTime =
        editableOverrideSettings.startTime &&
        /^\d{2}:\d{2}$/.test(editableOverrideSettings.startTime)
          ? editableOverrideSettings.startTime
          : "";
      const validatedEndTime =
        editableOverrideSettings.endTime &&
        /^\d{2}:\d{2}$/.test(editableOverrideSettings.endTime)
          ? editableOverrideSettings.endTime
          : "";

      const overridePayload = {
        startTime: validatedStartTime,
        endTime: validatedEndTime,
        isClosed: editableOverrideSettings.isClosed || false,
        manuallyDeactivatedSlots: newDeactivatedSlots,
      };

      const dateStr = format(selectedDate, "yyyy-MM-dd");
      await setDoc(
        doc(db, "spaAvailabilityOverrides", dateStr),
        overridePayload,
        { merge: true }
      );
      console.log(`Slot ${slotToToggle} ${actionMessagePart} for ${dateStr}.`);

      setEditableOverrideSettings((prev) => ({
        ...prev,
        manuallyDeactivatedSlots: newDeactivatedSlots,
      }));
      refetchSlotsAndOverride(selectedDate, selectedBooking, spaSettings);
    } catch (error) {
      console.error(`Error toggling slot ${slotToToggle}:`, error);
      setOverrideSavingError(`Échec: ${error.message}`);
      alert(`Échec: ${error.message}`);
    } finally {
      setOverrideSavingLoading(false);
    }
  };

  const handleDateSelect = (date) => {
    // This condition is already checked by the button's disabled state, but good for safety.
    if (
      overallLoading ||
      actionLoading ||
      settingsSavingLoading ||
      overrideSavingLoading
    )
      return;
    // This check is also partly handled by button's disabled state.
    if (selectedBooking && !isDateWithinBookingStay(date, selectedBooking)) {
      console.warn("Date select blocked: outside booking stay or loading.");
      return;
    }
    setSelectedDate(date);
  };

  const handleBookSlot = (date, timeSlot) => {
    if (!selectedBooking) {
      alert("Sélectionnez une réservation 'À programmer'.");
      return;
    }
    if (
      actionLoading ||
      showEditDeleteModal ||
      settingsSavingLoading ||
      overrideSavingLoading
    )
      return;

    if (isDayClosed) {
      // isDayClosed from useAvailableSlots hook is the source of truth
      alert("Impossible de réserver, le SPA est fermé pour cette date.");
      return;
    }

    if (!availableSlots.includes(timeSlot)) {
      alert("Créneau non disponible.");
      refetchSlotsAndOverride(selectedDate, selectedBooking, spaSettings);
      return;
    }

    const [hours, minutes] = timeSlot.split(":").map(Number);
    const dateTime = new Date(date);
    dateTime.setHours(hours, minutes, 0, 0);

    const treatmentDurationMinutes =
      selectedBooking.spaTreatmentDuration || 120;
    const slotDurationMinutes = spaSettings?.slotDurationMinutes || 60;

    if (slotDurationMinutes <= 0 || treatmentDurationMinutes <= 0) {
      alert("Erreur configuration durées SPA.");
      return;
    }

    try {
      const slotsToBook = calculateBookingSlots(
        dateTime,
        treatmentDurationMinutes,
        slotDurationMinutes
      );
      if (
        slotsToBook.length !==
          Math.ceil(treatmentDurationMinutes / slotDurationMinutes) ||
        slotsToBook[0] !== timeSlot
      ) {
        alert("Erreur interne: Calcul de créneau invalide.");
        refetchSlotsAndOverride(selectedDate, selectedBooking, spaSettings);
        return;
      }
      if (!slotsToBook.every((s) => availableSlots.includes(s))) {
        alert("Créneaux consécutifs non disponibles.");
        refetchSlotsAndOverride(selectedDate, selectedBooking, spaSettings);
        return;
      }
      handleUpdateBookingSpaDate(selectedBooking.id, dateTime, slotsToBook);
    } catch (error) {
      alert(`Erreur calcul créneaux: ${error.message || "inconnue"}`);
    }
  };

  const handleTimelineSlotClick = (booking) => {
    if (actionLoading || settingsSavingLoading || overrideSavingLoading) return;
    setBookingToEdit(booking);
    setModalStep("options");
    setShowEditDeleteModal(true);
  };

  const closeEditDeleteModal = () => {
    setBookingToEdit(null);
    setModalStep("options");
    setShowEditDeleteModal(false);
  };

  const requestRescheduleStep = () => setModalStep("confirm-reschedule");
  const requestDeleteStep = () => setModalStep("confirm-delete");
  const requestOptionsStep = () => setModalStep("options");

  // Month Navigation Simplified
  const goToPreviousMonth = () =>
    setCurrentMonth((prev) => addDays(startOfMonth(prev), -1));
  const goToNextMonth = () =>
    setCurrentMonth((prev) => addDays(startOfMonth(prev), 32)); // Go to start of next month

  return (
    <div className="p-4 bg-white rounded-lg shadow">
      <h2 className="mb-4 text-xl font-bold">Calendrier SPA Admin</h2>
      {overallLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white bg-opacity-75">
          <div className="text-lg font-semibold text-blue-600">
            Chargement des données...
          </div>
        </div>
      )}
      {overallError && !overallLoading && (
        <div className="p-4 mb-4 text-center text-red-700 bg-red-100 border border-red-300 rounded">
          Erreur lors du chargement:{" "}
          {overallError.message || "Une erreur inconnue est survenue."}
        </div>
      )}

      {!settingsLoading && spaSettings && editableSpaSettings && (
        <div className="p-3 mb-4 bg-white border rounded-lg shadow-sm">
          <h3 className="flex items-center gap-1 mb-2 text-base font-medium">
            Paramètres SPA
          </h3>
          <div className="flex flex-wrap gap-3">
            <div className="flex-1 min-w-[120px]">
              <label
                htmlFor="settingsStartTime"
                className="block text-xs font-medium text-gray-600"
              >
                Début
              </label>
              <input
                type="time"
                id="settingsStartTime"
                value={editableSpaSettings.startTime}
                onChange={(e) =>
                  setEditableSpaSettings({
                    ...editableSpaSettings,
                    startTime: e.target.value,
                  })
                }
                className="block w-full px-2 py-1 text-sm border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50"
                disabled={settingsSavingLoading}
              />
            </div>
            <div className="flex-1 min-w-[120px]">
              <label
                htmlFor="settingsEndTime"
                className="block text-xs font-medium text-gray-600"
              >
                Fin
              </label>
              <input
                type="time"
                id="settingsEndTime"
                value={editableSpaSettings.endTime}
                onChange={(e) =>
                  setEditableSpaSettings({
                    ...editableSpaSettings,
                    endTime: e.target.value,
                  })
                }
                className="block w-full px-2 py-1 text-sm border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50"
                disabled={settingsSavingLoading}
              />
            </div>
            <div className="flex-1 min-w-[120px]">
              <label
                htmlFor="settingsSlotDuration"
                className="block text-xs font-medium text-gray-600"
              >
                Durée (min)
              </label>
              <input
                type="number"
                id="settingsSlotDuration"
                value={editableSpaSettings.slotDurationMinutes}
                onChange={(e) =>
                  setEditableSpaSettings({
                    ...editableSpaSettings,
                    slotDurationMinutes: parseInt(e.target.value) || 0,
                  })
                }
                min="15"
                step="5"
                className="block w-full px-2 py-1 text-sm border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50"
                disabled={settingsSavingLoading}
              />
            </div>
          </div>
          <div className="flex items-center justify-end pt-2 mt-3 border-t border-gray-100">
            {settingsSavingLoading && (
              <span className="mr-2 text-xs text-blue-500">
                Enregistrement...
              </span>
            )}
            {settingsSavingError && (
              <span className="mr-2 text-xs text-red-500">
                {settingsSavingError}
              </span>
            )}
            <button
              onClick={handleSaveSpaSettings}
              className="flex items-center px-3 py-1.5 text-xs font-medium text-white bg-blue-500 rounded hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 disabled:opacity-60"
              disabled={settingsSavingLoading}
            >
              Enregistrer
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <button
          onClick={goToPreviousMonth}
          className="px-3 py-1 text-sm bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={
            overallLoading ||
            actionLoading ||
            settingsSavingLoading ||
            overrideSavingLoading
          }
        >
          Mois précédent
        </button>
        <h3 className="text-lg font-semibold">
          {format(currentMonth, "MMMM yyyy", { locale: fr })}
        </h3>
        <button
          onClick={goToNextMonth}
          className="px-3 py-1 text-sm bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={
            overallLoading ||
            actionLoading ||
            settingsSavingLoading ||
            overrideSavingLoading
          }
        >
          Mois suivant
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 mb-6 md:grid-cols-3">
        <div className="p-3 border rounded">
          <h3 className="mb-2 text-lg font-semibold">Calendrier</h3>
          {selectedBooking && (
            <div className="p-2 mb-3 text-sm text-center text-blue-700 border border-blue-300 rounded bg-blue-50">
              Sélectionnez une date entre le{" "}
              {selectedBooking.arrivalDateObj
                ? format(selectedBooking.arrivalDateObj, "dd/MM")
                : "?"}{" "}
              et le{" "}
              {selectedBooking.departureDateObj
                ? format(selectedBooking.departureDateObj, "dd/MM")
                : "?"}{" "}
              pour{" "}
              {selectedBooking.guestName ||
                `${selectedBooking.firstName} ${selectedBooking.lastName}`}
              .
            </div>
          )}
          <div className="grid grid-cols-7 gap-1">
            {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((day) => (
              <div key={day} className="p-1 text-sm font-semibold text-center">
                {day}
              </div>
            ))}
            {eachDayOfInterval({
              start: startOfMonth(currentMonth),
              end: endOfMonth(currentMonth),
            }).map((date) => {
              const dateStr = format(date, "yyyy-MM-dd");
              const isToday = isSameDay(date, new Date());
              const isSelected = selectedDate && isSameDay(date, selectedDate);

              let isDisabled =
                overallLoading ||
                actionLoading ||
                settingsSavingLoading ||
                overrideSavingLoading;
              let disabledTitle = isDisabled
                ? "Chargement ou action en cours..."
                : "";

              if (!isDisabled && selectedBooking) {
                if (!isDateWithinBookingStay(date, selectedBooking)) {
                  isDisabled = true;
                  disabledTitle = `Cette date (${format(
                    date,
                    "dd/MM"
                  )}) est hors du séjour du client (${
                    selectedBooking.arrivalDateObj
                      ? format(selectedBooking.arrivalDateObj, "dd/MM")
                      : "?"
                  } - ${
                    selectedBooking.departureDateObj
                      ? format(selectedBooking.departureDateObj, "dd/MM")
                      : "?"
                  })`;
                }
              }

              const dateSpaBookingsForDots = bookings.filter(
                (b) => b.spaDateTimeObj && isSameDay(b.spaDateTimeObj, date)
              );
              const hasSpaBookings = dateSpaBookingsForDots.length > 0;

              return (
                <button
                  key={dateStr}
                  onClick={() => !isDisabled && handleDateSelect(date)}
                  disabled={isDisabled}
                  className={`p-2 text-sm rounded relative
                    ${
                      isDisabled
                        ? "text-gray-400 bg-gray-50 cursor-not-allowed"
                        : isSelected
                        ? "bg-blue-500 text-white"
                        : `${isToday ? "bg-blue-100" : ""} hover:bg-gray-100`
                    }
                  `}
                  title={
                    disabledTitle ||
                    (isSelected
                      ? "Date sélectionnée"
                      : `Sélectionner ${format(date, "d MMMM")}`)
                  }
                >
                  <div className="text-center">{format(date, "d")}</div>
                  {hasSpaBookings && (
                    <div className="flex justify-center mt-1 space-x-1">
                      {dateSpaBookingsForDots.slice(0, 3).map((b, i) => {
                        const colors = getPropertyColor(b);
                        return (
                          <div
                            key={i}
                            className={`w-2 h-2 rounded-full ${colors.bg.replace(
                              "-100",
                              "-500"
                            )}`}
                            title={b.property}
                          ></div>
                        );
                      })}
                      {dateSpaBookingsForDots.length > 3 && (
                        <div className="px-1 leading-none text-gray-800 bg-gray-100 rounded-full text-xxs">
                          {dateSpaBookingsForDots.length}
                        </div>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <BookingsToSchedulePanel
          bookingsToSchedule={bookingsToSchedule}
          selectedBooking={selectedBooking}
          onBookingSelect={setSelectedBooking}
          isLoading={overallLoading}
          isActionLoading={
            actionLoading || settingsSavingLoading || overrideSavingLoading
          }
        />

        <SelectedDateDetailsPanel
          selectedDate={selectedDate}
          selectedBooking={selectedBooking}
          availableSlots={availableSlots}
          manuallyDeactivatedSlots={manuallyDeactivatedSlots}
          isDayClosed={isDayClosed}
          selectedDateBookings={selectedDateBookings}
          spaSettings={spaSettings}
          overrideData={overrideData} // Raw override doc content for "Gestion Horaire" tab
          // For "Gestion Horaire" tab (override document specific loading/error)
          // Use the more specific states from the hook if you need to distinguish.
          // For simplicity, we can use the combined states from the hook.
          overrideLoading={slotsAndOverrideHookLoading} // Loading for override doc fetch is part of this
          overrideError={slotsAndOverrideHookError} // Error for override doc fetch is part of this
          editableOverrideSettings={editableOverrideSettings}
          onEditableOverrideChange={setEditableOverrideSettings}
          onSaveOverride={handleSaveOverride}
          onDeleteOverride={handleDeleteOverride}
          onBookSlot={handleBookSlot}
          onScheduledBookingClick={handleTimelineSlotClick}
          isLoading={overallLoading} // Global loading state for the whole panel
          // For "Créneaux" tab (slot display):
          isSlotsLoading={slotsAndOverrideHookLoading} // Loading for the API call that fetches all slot data
          slotsError={slotsAndOverrideHookError} // Error for that API call
          bookingsError={bookingsError}
          isActionLoading={actionLoading || settingsSavingLoading} // General save actions NOT including override save itself
          isOverrideSaving={overrideSavingLoading} // Specific to *saving/deleting* an override (via button or slot toggle)
          onToggleSlotActivation={handleToggleSlotActivation}
        />
      </div>

      {selectedDate &&
        !overallLoading &&
        selectedDateBookings.length > 0 &&
        spaSettings && (
          <SpaTimeline
            selectedDate={selectedDate}
            selectedDateBookings={selectedDateBookings}
            spaSettings={spaSettings}
            overrideData={overrideData}
            onScheduledBookingClick={handleTimelineSlotClick}
            actionLoading={
              actionLoading || settingsSavingLoading || overrideSavingLoading
            }
          />
        )}

      {showEditDeleteModal && bookingToEdit && (
        <EditDeleteSpaModal
          bookingToEdit={bookingToEdit}
          modalStep={modalStep}
          onClose={closeEditDeleteModal}
          onRescheduleConfirm={handleMarkBookingForRescheduling}
          onDeleteConfirm={handleDeleteSpaAppointment}
          actionLoading={
            actionLoading || settingsSavingLoading || overrideSavingLoading
          }
          onRequestRescheduleStep={requestRescheduleStep}
          onRequestDeleteStep={requestDeleteStep}
          onRequestOptionsStep={requestOptionsStep}
        />
      )}
    </div>
  );
};

export default SpaCalendar;
