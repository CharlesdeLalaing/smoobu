import React, { useState, useEffect, useMemo } from "react";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  startOfDay,
  addMinutes,
  addDays,
  isAfter,
  isValid as isDateValid,
  parseISO, // Needed for parsing time strings with date context
} from "date-fns";
import { fr } from "date-fns/locale";
import {
  // Firebase imports needed for actions (update/delete), settings save, and override save/delete
  doc,
  updateDoc,
  deleteField,
  setDoc, // Needed for creating a new override document
  deleteDoc, // Needed for deleting an override document
} from "firebase/firestore";
import { db } from "../../firebase"; // Adjust path as needed

// Import utility functions from src/utils
import {
  parseBookingDateTime,
  isDateWithinBookingStay,
  getPropertyColor,
  calculateBookingSlots,
} from "../spa/spaCalendarUtils"; // Correct path

// Import custom hooks from src/hooks
import {
  useSpaSettings,
  useBookingsForMonth,
  useAvailableSlots, // This hook now returns override data too
} from "../spa/useSpaCalendarData";

// Import extracted UI components
import BookingsToSchedulePanel from "../spa/BookingsToSchedulePanel";
import SelectedDateDetailsPanel from "../spa/SelectedDateDetailsPanel";
import SpaTimeline from "../spa/SpaTimeline";
import EditDeleteSpaModal from "../spa/EditDeleteSpaModal";

// --- Main Component ---
const SpaCalendar = () => {
  console.log("SpaCalendar rendering...");
  // --- State Variables (Managed by this component) ---
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [bookingToEdit, setBookingToEdit] = useState(null);
  const [showEditDeleteModal, setShowEditDeleteModal] = useState(false);
  const [modalStep, setModalStep] = useState("options");

  const [actionLoading, setActionLoading] = useState(false); // For booking actions (save/delete/reschedule)

  // --- State for Settings Editing ---
  const [editableSpaSettings, setEditableSpaSettings] = useState(null);
  const [settingsSavingLoading, setSettingsSavingLoading] = useState(false);
  const [settingsSavingError, setSettingsSavingError] = useState(null);
  // --- End State for Settings Editing ---

  // --- State for Override Editing ---
  const [editableOverrideSettings, setEditableOverrideSettings] =
    useState(null); // { startTime, endTime, isClosed }
  const [overrideSavingLoading, setOverrideSavingLoading] = useState(false); // Loading state for saving/deleting override
  const [overrideSavingError, setOverrideSavingError] = useState(null); // Error state for saving/deleting override
  // --- End State for Override Editing ---

  console.log("SpaCalendar state:", {
    currentMonth: format(currentMonth, "yyyy-MM"),
    selectedDate: selectedDate ? format(selectedDate, "yyyy-MM-dd") : null,
    selectedBooking: selectedBooking?.id || null,
    bookingToEdit: bookingToEdit?.id || null,
    showEditDeleteModal,
    modalStep,
    actionLoading,
    editableSpaSettings,
    settingsSavingLoading,
    settingsSavingError,
    editableOverrideSettings, // Add to log
    overrideSavingLoading, // Add to log
    overrideSavingError, // Add to log
  });

  // --- Use Custom Hooks to Fetch Data ---
  const {
    spaSettings,
    loading: settingsLoading,
    error: settingsError,
    refetch: refetchSpaSettings,
  } = useSpaSettings();
  console.log("useSpaSettings hook data:", {
    spaSettings,
    settingsLoading,
    settingsError,
  });

  const {
    bookings,
    loading: bookingsLoading,
    error: bookingsError,
    refetch: refetchBookings,
  } = useBookingsForMonth(currentMonth);
  console.log("useBookingsForMonth hook data:", {
    bookings: bookings.length,
    bookingsLoading,
    bookingsError,
  });

  const {
    availableSlots, // Slots from API (might be empty if override.isClosed)
    loading: slotsLoading, // Loading for API call
    error: slotsError, // Error for API call
    overrideData, // <--- Override data from hook
    overrideLoading, // <--- Loading for override fetch
    overrideError, // <--- Error for override fetch
    refetch: refetchSlotsAndOverride, // Refetch includes both override and slots
  } = useAvailableSlots(selectedDate, selectedBooking, spaSettings); // Pass spaSettings

  

  // --- Derived State (Calculated using useMemo) ---
  const selectedDateBookings = useMemo(() => {
    console.log(
      "useMemo: Calculating selectedDateBookings...",
      selectedDate,
      bookings.length
    );
    if (!selectedDate || !bookings || bookings.length === 0) {
      console.log("useMemo selectedDateBookings: Returning empty array.");
      return [];
    }

    const filtered = bookings
      .filter((booking) => {
        if (
          !booking.spaDateTimeObj ||
          isNaN(booking.spaDateTimeObj.getTime())
        ) {
          return false;
        }
        return isSameDay(
          startOfDay(booking.spaDateTimeObj),
          startOfDay(selectedDate)
        );
      })
      .sort((a, b) => {
        const timeA = a.spaDateTimeObj;
        const timeB = b.spaDateTimeObj;

        if (!timeA || isNaN(timeA.getTime())) return 1;
        if (!timeB || isNaN(timeB.getTime())) return -1;

        return timeA.getTime() - timeB.getTime();
      });
    console.log(
      `useMemo selectedDateBookings: Found ${filtered.length} bookings for ${
        selectedDate ? format(selectedDate, "yyyy-MM-dd") : "N/A"
      }`
    );
    return filtered;
  }, [bookings, selectedDate]); // Recalculate when bookings or selectedDate change

  const bookingsToSchedule = useMemo(() => {
    console.log("useMemo: Calculating bookingsToSchedule...", bookings.length);
    if (!bookings || bookings.length === 0) {
      console.log("useMemo bookingsToSchedule: Returning empty array.");
      return [];
    }
    const filtered = bookings
      .filter((b) => b.needsScheduling)
      .sort((a, b) => {
        let arrivalA = a.arrivalDateObj;
        let arrivalB = b.arrivalDateObj;

        if (!arrivalA || isNaN(arrivalA.getTime())) arrivalA = new Date(0);
        if (!arrivalB || isNaN(arrivalB.getTime())) arrivalB = new Date(0);

        if (arrivalA.getTime() - arrivalB.getTime() !== 0)
          return arrivalA.getTime() - arrivalB.getTime();
        return a.property?.localeCompare(b.property || "") || 0;
      });
    console.log(
      `useMemo bookingsToSchedule: Found ${filtered.length} bookings needing scheduling.`
    );
    return filtered;
  }, [bookings]); // Recalculate when bookings change

  // --- Combined Loading State for Main UI ---
  // Include override loading in overall loading
  const overallLoading = bookingsLoading || settingsLoading || overrideLoading; // Added overrideLoading

  // --- Effect to Synchronize Fetched Settings with Editable State ---
  useEffect(() => {
    console.log("SpaCalendar Effect: spaSettings changed", spaSettings);
    if (spaSettings) {
      setEditableSpaSettings({
        startTime: spaSettings.startTime || "14:00",
        endTime: spaSettings.endTime || "23:59",
        slotDurationMinutes: spaSettings.slotDurationMinutes || 60,
      });
      console.log(
        "SpaCalendar Effect: Synchronized editableSpaSettings with fetched spaSettings."
      );
    } else {
      setEditableSpaSettings(null);
      console.log(
        "SpaCalendar Effect: spaSettings is null, cleared editableSpaSettings."
      );
    }
  }, [spaSettings]);

  // --- Effect to Synchronize Fetched Override with Editable State ---
  useEffect(() => {
    console.log("SpaCalendar Effect: overrideData or selectedDate changed", {
      overrideData,
      selectedDate,
    });
    // Reset editable override state whenever selectedDate changes
    if (selectedDate) {
      if (overrideData) {
        // If override data exists for the selected date, set it for editing
        setEditableOverrideSettings({
          startTime: overrideData.startTime || "",
          endTime: overrideData.endTime || "",
          isClosed: overrideData.isClosed || false,
        });
        console.log(
          "SpaCalendar Effect: Initialized editableOverrideSettings from fetched overrideData."
        );
      } else {
        // If no override data for the selected date, initialize with default empty/false state
        setEditableOverrideSettings({
          startTime: "",
          endTime: "",
          isClosed: false,
        });
        console.log(
          "SpaCalendar Effect: Initialized editableOverrideSettings with empty defaults as no override data found."
        );
      }
    } else {
      // If no date is selected, clear the editable override state
      setEditableOverrideSettings(null);
      console.log(
        "SpaCalendar Effect: selectedDate is null, cleared editableOverrideSettings."
      );
    }
    // Depend on overrideData and selectedDate
  }, [overrideData, selectedDate]);

  // --- Data Mutation Functions (Remain here, called by handlers) ---

  const handleUpdateBookingSpaDate = async (
    bookingId,
    dateTime,
    slotsToBook
  ) => {
    console.log("handleUpdateBookingSpaDate started");
    // Prevent action if another action is in progress
    if (actionLoading || settingsSavingLoading || overrideSavingLoading) {
      console.log("handleUpdateBookingSpaDate blocked by other loading states");
      return;
    }
    try {
      setActionLoading(true); // Start action loading
      console.log(
        "handleUpdateBookingSpaDate called for booking:",
        bookingId,
        "dateTime:",
        format(dateTime, "yyyy-MM-dd HH:mm"),
        "spaSlots:",
        slotsToBook
      );

      const slotDurationMinutes = spaSettings?.slotDurationMinutes || 30; // Use settings from hook state
      const totalDurationMinutes =
        (slotsToBook?.length || 0) * slotDurationMinutes;
      const endDateTime = new Date(
        dateTime.getTime() + totalDurationMinutes * 60000
      );

      console.log(
        `Saving SPA booking for ${bookingId}. Start: ${format(
          dateTime,
          "yyyy-MM-dd HH:mm:ss"
        )}, Calculated End: ${format(
          endDateTime,
          "yyyy-MM-dd HH:mm:ss"
        )}, Slots: ${slotsToBook}`
      );

      await updateDoc(doc(db, "bookings", bookingId), {
        spaDateTime: dateTime, // Firestore will convert Date to Timestamp
        spaEndDateTime: endDateTime, // Firestore will convert Date to Timestamp
        spaSlots: slotsToBook, // Array of strings (e.g., ["14:00", "14:30"])
        spaBookingPreference: "scheduled",
        // Update spaInfo for better display (optional, but good practice)
        spaInfo: {
          hasSpaTreatment: true,
          scheduledDateTime: dateTime, // Store Date or Timestamp
          endDateTime: endDateTime, // Store Date or Timestamp
          preference: "scheduled",
          formattedDateTime: format(dateTime, "PPPp", { locale: fr }), // Format for display
          slots: slotsToBook,
          status: "scheduled",
        },
      });

      console.log(`Booking ${bookingId} updated successfully in Firebase.`);

      // --- Refetch Data After Write ---
      console.log("Refetching bookings after update...");
      refetchBookings(currentMonth);
      // Refetch slots and override data for the selected date
      if (selectedDate) {
        console.log("Refetching slots and override after update...");
        refetchSlotsAndOverride(selectedDate, selectedBooking, spaSettings);
      }
      // --- End Refetch ---

      setSelectedBooking(null); // Clear selected booking after successful scheduling

      // Show confirmation
      alert(
        `Rendez-vous SPA planifié pour le ${format(dateTime, "EEEE d MMMM", {
          locale: fr,
        })} de ${format(dateTime, "HH:mm", { locale: fr })} à ${format(
          endDateTime,
          "HH:mm",
          { locale: fr }
        )}`
      );
      console.log("handleUpdateBookingSpaDate finished successfully");
    } catch (error) {
      console.error("Error updating booking:", error);
      alert("Échec de la planification du rendez-vous.");
      console.log("handleUpdateBookingSpaDate finished with error");
    } finally {
      setActionLoading(false); // End action loading
      console.log("handleUpdateBookingSpaDate actionLoading set to false");
    }
  };

  const handleDeleteSpaAppointment = async () => {
    console.log("handleDeleteSpaAppointment called");
    // Prevent action if another action is in progress
    if (actionLoading || settingsSavingLoading || overrideSavingLoading) {
      console.log("handleDeleteSpaAppointment blocked by other loading states");
      return;
    }
    if (!bookingToEdit) {
      console.log("Delete action called but bookingToEdit is null. Aborting.");
      // closeEditDeleteModal(); // Called in finally
      return;
    }

    try {
      setActionLoading(true); // Start action loading
      console.log("Starting delete action for booking:", bookingToEdit.id);
      await updateDoc(doc(db, "bookings", bookingToEdit.id), {
        spaDateTime: deleteField(),
        spaEndDateTime: deleteField(),
        spaSlots: deleteField(),
        spaBookingPreference: "none",
        spaInfo: {
          hasSpaTreatment: false,
          scheduledDateTime: null,
          endDateTime: null,
          preference: "none",
          formattedDateTime: null,
          slots: [],
          status: "cancelled",
        },
      });

      console.log(
        `Booking ${bookingToEdit.id} deleted successfully in Firebase.`
      );
      alert("Rendez-vous SPA supprimé.");
      console.log("handleDeleteSpaAppointment finished successfully");

      // --- Refetch Data After Write ---
      console.log("Refetching bookings after delete...");
      refetchBookings(currentMonth);
      // Refetch slots and override data for the selected date
      if (selectedDate) {
        console.log("Refetching slots and override after delete...");
        refetchSlotsAndOverride(selectedDate, null, spaSettings); // Pass spaSettings
      }
      // Also clear selectedBooking if it was the one deleted (less likely but safe)
      if (selectedBooking?.id === bookingToEdit.id) {
        setSelectedBooking(null);
      }
      // --- End Refetch ---
    } catch (error) {
      console.error("Error deleting SPA appointment:", error);
      alert("Échec de la suppression du rendez-vous SPA.");
      console.log("handleDeleteSpaAppointment finished with error");
    } finally {
      closeEditDeleteModal(); // Close modal regardless of success/failure
      setActionLoading(false); // End action loading
      console.log("handleDeleteSpaAppointment actionLoading set to false");
    }
  };

  const handleMarkBookingForRescheduling = async () => {
    console.log("handleMarkBookingForRescheduling called");
    // Prevent action if another action is in progress
    if (actionLoading || settingsSavingLoading || overrideSavingLoading) {
      console.log(
        "handleMarkBookingForRescheduling blocked by other loading states"
      );
      return;
    }
    if (!bookingToEdit) {
      console.log(
        "Reschedule action called but bookingToEdit is null. Aborting."
      );
      // closeEditDeleteModal(); // Called in finally
      return;
    }

    try {
      setActionLoading(true); // Start action loading
      console.log("Starting reschedule action for booking:", bookingToEdit.id);
      await updateDoc(doc(db, "bookings", bookingToEdit.id), {
        spaDateTime: deleteField(),
        spaEndDateTime: deleteField(),
        spaSlots: deleteField(),
        spaBookingPreference: "later",
        spaInfo: {
          hasSpaTreatment: true, // Still wants treatment, just needs scheduling
          scheduledDateTime: null,
          endDateTime: null,
          preference: "later",
          formattedDateTime: null,
          slots: [],
          status: "pending", // Or similar status
        },
      });

      console.log(
        `Booking ${bookingToEdit.id} marked for rescheduling successfully.`
      );
      alert("Rendez-vous SPA marqué pour être reprogrammé.");
      console.log("handleMarkBookingForRescheduling finished successfully");

      // --- Refetch Data After Write ---
      console.log("Refetching bookings after reschedule...");
      refetchBookings(currentMonth);
      // Refetch slots and override data for the selected date
      if (selectedDate) {
        console.log("Refetching slots and override after reschedule...");
        refetchSlotsAndOverride(selectedDate, null, spaSettings); // Pass spaSettings
      }
      // If the booking being edited was also the selectedBooking, clear selectedBooking
      if (selectedBooking?.id === bookingToEdit.id) {
        setSelectedBooking(null);
      }
      // --- End Refetch ---
    } catch (error) {
      console.error("Error marking SPA appointment for rescheduling:", error);
      alert("Échec de la mise à jour pour la reprogrammation.");
      console.log("handleMarkBookingForRescheduling finished with error");
    } finally {
      closeEditDeleteModal(); // Close modal regardless of success/failure
      setActionLoading(false); // End action loading
      console.log(
        "handleMarkBookingForRescheduling actionLoading set to false"
      );
    }
  };

  // --- Settings Save Function ---
  const handleSaveSpaSettings = async () => {
    console.log("handleSaveSpaSettings called", editableSpaSettings);
    // Prevent action if another action is in progress
    if (actionLoading || settingsSavingLoading || overrideSavingLoading) {
      console.log("handleSaveSpaSettings blocked by other loading states");
      return;
    }
    if (!editableSpaSettings) {
      console.warn(
        "handleSaveSpaSettings: editableSpaSettings is null. Aborting."
      );
      return;
    }

    // --- Validation ---
    setSettingsSavingError(null); // Clear previous error
    const { startTime, endTime, slotDurationMinutes } = editableSpaSettings;

    // Basic validation for time strings (HH:mm format)
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
      const errorMsg =
        "Les heures de début et de fin doivent être au format HH:mm.";
      setSettingsSavingError(errorMsg);
      console.warn("Settings validation failed:", errorMsg);
      alert(errorMsg);
      return;
    }

    // Basic validation for duration
    if (
      typeof slotDurationMinutes !== "number" ||
      !Number.isInteger(slotDurationMinutes) ||
      slotDurationMinutes <= 0
    ) {
      const errorMsg =
        "La durée du créneau doit être un nombre entier positif (en minutes).";
      setSettingsSavingError(errorMsg);
      console.warn("Settings validation failed:", errorMsg);
      alert(errorMsg);
      return;
    }

    // Validation: startTime is before endTime on the same day
    try {
      const today = startOfDay(new Date());
      const startTimeDate = parseISO(
        format(today, "yyyy-MM-dd") + "T" + startTime
      );
      const endTimeDate = parseISO(format(today, "yyyy-MM-dd") + "T" + endTime);

      if (!isDateValid(startTimeDate) || !isDateValid(endTimeDate)) {
        const errorMsg = "Format d'heure invalide pour le début ou la fin.";
        setSettingsSavingError(errorMsg);
        console.warn("Settings validation failed:", errorMsg);
        alert(errorMsg);
        return;
      }

      const startHours = startTimeDate.getHours();
      const startMinutes = startTimeDate.getMinutes();
      const endHours = endTimeDate.getHours();
      const endMinutes = endTimeDate.getMinutes();

      if (
        endHours < startHours ||
        (endHours === startHours && endMinutes <= startMinutes)
      ) {
        const errorMsg =
          "L'heure de fin doit être strictement après l'heure de début le même jour.";
        setSettingsSavingError(errorMsg);
        console.warn("Settings validation failed:", errorMsg);
        alert(errorMsg);
        return;
      }
      // Also check if the start time plus slot duration goes past the end time
      const testBookingStart = new Date(today);
      testBookingStart.setHours(startHours, startMinutes, 0, 0);
      const testBookingEndIfOneSlot = addMinutes(
        testBookingStart,
        slotDurationMinutes
      );

      if (isAfter(testBookingEndIfOneSlot, endTimeDate)) {
        const errorMsg =
          "La durée du créneau dépasse l'intervalle entre l'heure de début et de fin.";
        setSettingsSavingError(errorMsg);
        console.warn("Settings validation failed:", errorMsg);
        alert(errorMsg);
        return;
      }
    } catch (e) {
      console.error("Error during settings time comparison validation:", e);
      const errorMsg = "Erreur inattendue lors de la validation des heures.";
      setSettingsSavingError(errorMsg);
      alert(errorMsg);
      return;
    }

    // --- End Validation ---

    try {
      setSettingsSavingLoading(true); // Start saving loading
      console.log("Saving SPA settings to Firebase:", editableSpaSettings);

      const settingsToSave = {
        startTime: editableSpaSettings.startTime,
        endTime: editableSpaSettings.endTime,
        slotDurationMinutes: editableSpaSettings.slotDurationMinutes,
      };

      // Update the document in Firebase (using doc with id 'default')
      await updateDoc(doc(db, "spaSettings", "default"), settingsToSave);

      console.log("SPA settings saved successfully.");
      alert("Paramètres SPA enregistrés avec succès.");

      // --- Refetch Data After Settings Save ---
      console.log("Refetching settings after save...");
      refetchSpaSettings(); // Refetch settings first to ensure state is updated from source of truth
      // Refetch bookings as settings like slot duration/hours might affect display/availability calculation
      console.log("Refetching bookings and slots after settings save...");
      refetchBookings(currentMonth); // Refetch bookings for the current month
      if (selectedDate) {
        // Pass the *newly saved* settings (from editable state, which will sync with fetched)
        refetchSlotsAndOverride(
          selectedDate,
          selectedBooking,
          editableSpaSettings
        ); // Refetch slots for the selected date with NEW settings
      }
      // --- End Refetch ---
    } catch (error) {
      console.error("Error saving SPA settings:", error);
      const errorMsg = `Échec de l'enregistrement des paramètres SPA: ${error.message}`;
      setSettingsSavingError(errorMsg);
      alert(errorMsg);
    } finally {
      setSettingsSavingLoading(false); // End saving loading
      console.log("handleSaveSpaSettings finished.");
    }
  };

  // --- Override Save Function ---
  const handleSaveOverride = async () => {
    console.log(
      "handleSaveOverride called",
      editableOverrideSettings,
      selectedDate
    );
    if (!selectedDate || !editableOverrideSettings) {
      console.warn(
        "handleSaveOverride: selectedDate or editableOverrideSettings is null. Aborting."
      );
      return;
    }
    // Prevent action if another action is in progress
    if (actionLoading || settingsSavingLoading || overrideSavingLoading) {
      console.log("handleSaveOverride blocked by other loading states");
      return;
    }

    // --- Validation ---
    setOverrideSavingError(null); // Clear previous error

    const { startTime, endTime, isClosed } = editableOverrideSettings;

    if (!isClosed) {
      // Only validate times if not closed
      const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
      if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
        const errorMsg =
          "Les heures de début et de fin pour l'override doivent être au format HH:mm.";
        setOverrideSavingError(errorMsg);
        console.warn("Override validation failed:", errorMsg);
        alert(errorMsg);
        return;
      }
      // Validation: startTime is before endTime on the same day
      try {
        const today = startOfDay(selectedDate); // Use the selected date for context
        const startTimeDate = parseISO(
          format(today, "yyyy-MM-dd") + "T" + startTime
        );
        const endTimeDate = parseISO(
          format(today, "yyyy-MM-dd") + "T" + endTime
        );

        if (!isDateValid(startTimeDate) || !isDateValid(endTimeDate)) {
          const errorMsg =
            "Format d'heure invalide pour le début ou la fin de l'override.";
          setOverrideSavingError(errorMsg);
          console.warn("Override validation failed:", errorMsg);
          alert(errorMsg);
          return;
        }

        const startHours = startTimeDate.getHours();
        const startMinutes = startTimeDate.getMinutes();
        const endHours = endTimeDate.getHours();
        const endMinutes = endTimeDate.getMinutes();

        if (
          endHours < startHours ||
          (endHours === startHours && endMinutes <= startMinutes)
        ) {
          const errorMsg =
            "L'heure de fin de l'override doit être strictement après l'heure de début le même jour.";
          setOverrideSavingError(errorMsg);
          console.warn("Override validation failed:", errorMsg);
          alert(errorMsg);
          return;
        }
      } catch (e) {
        console.error("Error during override time comparison validation:", e);
        const errorMsg =
          "Erreur inattendue lors de la validation des heures d'override.";
        setOverrideSavingError(errorMsg);
        alert(errorMsg);
        return;
      }
    }

    // --- End Validation ---

    const dateStr = format(selectedDate, "yyyy-MM-dd");

    try {
      setOverrideSavingLoading(true); // Start saving loading
      console.log(
        "Saving override for",
        dateStr,
        ":",
        editableOverrideSettings
      );

      const overrideToSave = {
        startTime: editableOverrideSettings.startTime,
        endTime: editableOverrideSettings.endTime,
        isClosed: editableOverrideSettings.isClosed,
      };

      // Use setDoc with merge: true or updateDoc if the document is guaranteed to exist
      // setDoc is safer if it might be a new override
      await setDoc(
        doc(db, "spaAvailabilityOverrides", dateStr),
        overrideToSave,
        { merge: true }
      );

      console.log(`Override for ${dateStr} saved successfully.`);
      alert(`Override pour le ${dateStr} enregistré avec succès.`);

      // --- Refetch Data After Override Save ---
      // Refetch slots and override data for the selected date
      console.log("Refetching slots and override after override save...");
      refetchSlotsAndOverride(selectedDate, selectedBooking, spaSettings); // Pass spaSettings
      // No need to refetch bookings unless override affects which bookings are shown (it doesn't in this logic)
      // No need to refetch settings
      // --- End Refetch ---
    } catch (error) {
      console.error(`Error saving override for ${dateStr}:`, error);
      const errorMsg = `Échec de l'enregistrement de l'override: ${error.message}`;
      setOverrideSavingError(errorMsg);
      alert(errorMsg);
    } finally {
      setOverrideSavingLoading(false); // End saving loading
      console.log("handleSaveOverride finished.");
    }
  };

  // --- Override Delete Function ---
  const handleDeleteOverride = async () => {
    console.log("handleDeleteOverride called", selectedDate);
    if (!selectedDate || !overrideData) {
      // Can only delete if a date is selected and an override exists
      console.warn(
        "handleDeleteOverride: selectedDate is null or no override exists. Aborting."
      );
      return;
    }
    // Prevent action if another action is in progress
    if (actionLoading || settingsSavingLoading || overrideSavingLoading) {
      console.log("handleDeleteOverride blocked by other loading states");
      return;
    }

    const dateStr = format(selectedDate, "yyyy-MM-dd");
    // Add confirmation dialog
    if (
      !window.confirm(
        `Êtes-vous sûr de vouloir supprimer l'override pour le ${dateStr} ?`
      )
    ) {
      console.log("Delete override cancelled by user.");
      return;
    }

    try {
      setOverrideSavingLoading(true); // Start saving loading
      console.log("Deleting override for", dateStr);

      // Delete the document in Firebase
      await deleteDoc(doc(db, "spaAvailabilityOverrides", dateStr));

      console.log(`Override for ${dateStr} deleted successfully.`);
      alert(`Override pour le ${dateStr} supprimé.`);

      // --- Refetch Data After Override Delete ---
      // Refetch slots and override data for the selected date
      console.log("Refetching slots and override after override delete...");
      refetchSlotsAndOverride(selectedDate, selectedBooking, spaSettings); // Pass spaSettings
      // --- End Refetch ---
    } catch (error) {
      console.error(`Error deleting override for ${dateStr}:`, error);
      const errorMsg = `Échec de la suppression de l'override: ${error.message}`;
      setOverrideSavingError(errorMsg);
      alert(errorMsg);
    } finally {
      setOverrideSavingLoading(false); // End saving loading
      console.log("handleDeleteOverride finished.");
    }
  };

  // --- Event Handlers ---

  const handleDateSelect = (date) => {
    console.log(
      "handleDateSelect called for date:",
      format(date, "yyyy-MM-dd")
    );
    // Avoid actions if overall data is loading, an action is in progress, OR settings/overrides are being saved
    if (
      overallLoading ||
      actionLoading ||
      settingsSavingLoading ||
      overrideSavingLoading
    ) {
      // Add overrideSavingLoading
      console.log(
        "handleDateSelect blocked due to loading or actionLoading or settings/overrideSavingLoading"
      );
      return;
    }

    if (selectedBooking) {
      if (!isDateWithinBookingStay(date, selectedBooking)) {
        console.log(
          "handleDateSelect blocked: Date is outside selected booking stay:",
          format(date, "yyyy-MM-dd"),
          selectedBooking.id
        );
        return;
      }
      console.log(
        "handleDateSelect allowed: Date is within selected booking stay:",
        format(date, "yyyy-MM-dd"),
        selectedBooking.id
      );
    } else {
      console.log(
        "handleDateSelect allowed: No booking selected, any date selectable:",
        format(date, "yyyy-MM-dd")
      );
    }

    setSelectedDate(date); // This will trigger the useAvailableSlots hook
    console.log("Date selected:", format(date, "yyyy-MM-dd"));
    console.log("handleDateSelect finished.");
  };

  const handleBookSlot = (date, timeSlot) => {
    console.log(
      "handleBookSlot called with date:",
      format(date, "yyyy-MM-dd"),
      "timeSlot:",
      timeSlot
    );
    if (!selectedBooking) {
      alert("Please select a booking from the 'À programmer' list first.");
      console.warn("handleBookSlot: No booking selected.");
      return;
    }

    // Prevent booking if an action is already in progress (e.g., modal open) OR settings/overrides are being saved
    if (
      actionLoading ||
      showEditDeleteModal ||
      settingsSavingLoading ||
      overrideSavingLoading
    ) {
      // Add overrideSavingLoading
      console.log(
        "handleBookSlot blocked due to actionLoading or showEditDeleteModal or settings/overrideSavingLoading"
      );
      return;
    }

    // Check if the date is marked as closed by an override
    if (
      overrideData?.isClosed &&
      selectedDate &&
      isSameDay(selectedDate, parseISO(overrideData.id))
    ) {
      // Check overrideData exists and its ID matches selectedDate
      alert("Cannot book a slot on a day marked as closed.");
      console.warn(
        "handleBookSlot aborted: Date is marked as closed by override."
      );
      return;
    }

    if (!availableSlots.includes(timeSlot)) {
      console.error(
        "handleBookSlot: Selected time slot is not in the current availableSlots list:",
        timeSlot,
        availableSlots
      );
      alert("Le créneau horaire sélectionné n'est pas disponible.");
      refetchSlotsAndOverride(selectedDate, selectedBooking, spaSettings); // Pass spaSettings
      console.log("handleBookSlot aborted due to slot unavailability.");
      return;
    }

    const [hours, minutes] = timeSlot.split(":").map(Number);
    const dateTime = new Date(date);
    dateTime.setHours(hours, minutes, 0, 0);
    dateTime.setSeconds(0, 0);
    console.log(
      "handleBookSlot: Calculated start DateTime:",
      format(dateTime, "yyyy-MM-dd HH:mm:ss")
    );

    const treatmentDurationMinutes =
      selectedBooking.spaTreatmentDuration &&
      typeof selectedBooking.spaTreatmentDuration === "number"
        ? selectedBooking.spaTreatmentDuration
        : 120; // Default 120 min assumed

    const slotDurationMinutes = spaSettings?.slotDurationMinutes || 60; // Use settings from hook state, fallback to 60

    if (slotDurationMinutes <= 0 || treatmentDurationMinutes <= 0) {
      console.error("Invalid duration settings:", {
        treatmentDurationMinutes,
        slotDurationMinutes,
      });
      alert(
        "Erreur de configuration des durées SPA. Impossible de calculer les créneaux nécessaires."
      );
      console.log("handleBookSlot aborted due to invalid duration settings.");
      return;
    }

    try {
      const slotsToBook = calculateBookingSlots(
        dateTime,
        treatmentDurationMinutes,
        slotDurationMinutes
      );
      console.log("handleBookSlot: Calculated bookedSlots array:", slotsToBook);

      const requiredSlotsCount = Math.ceil(
        treatmentDurationMinutes / slotDurationMinutes
      );
      if (
        slotsToBook.length !== requiredSlotsCount ||
        slotsToBook[0] !== timeSlot
      ) {
        console.error(
          "handleBookSlot: Slot calculation mismatch or start time inconsistency:",
          {
            calculated: slotsToBook,
            requiredCount: requiredSlotsCount,
            selectedSlot: timeSlot,
          }
        );
        refetchSlotsAndOverride(selectedDate, selectedBooking, spaSettings); // Pass spaSettings
        alert(
          "Erreur interne: Le créneau sélectionné ne correspond pas à la durée du traitement calculée."
        );
        console.log("handleBookSlot aborted due to slot calculation mismatch.");
        return;
      }

      const requiredSlotsAvailable = slotsToBook.every((requiredSlot) =>
        availableSlots.includes(requiredSlot)
      );

      if (!requiredSlotsAvailable) {
        console.error(
          "handleBookSlot: Not all calculated slots are in the available list.",
          {
            selectedSlot: timeSlot,
            slotsToBook: slotsToBook,
            availableSlots: availableSlots,
          }
        );
        refetchSlotsAndOverride(selectedDate, selectedBooking, spaSettings); // Pass spaSettings
        alert(
          "Le créneau horaire sélectionné nécessite des créneaux consécutifs qui ne sont pas tous disponibles."
        );
        console.log(
          "handleBookSlot aborted due to consecutive slot unavailability."
        );
        return;
      }

      console.log(
        "handleBookSlot proceeding to call handleUpdateBookingSpaDate"
      );
      handleUpdateBookingSpaDate(selectedBooking.id, dateTime, slotsToBook);
    } catch (error) {
      console.error("Slot calculation or validation failed:", error);
      alert(
        `Erreur lors du calcul des créneaux : ${
          error.message || "une erreur inconnue est survenue"
        }`
      );
      console.log("handleBookSlot finished with sync error.");
    }
    console.log("handleBookSlot finished.");
  };

  const handleTimelineSlotClick = (booking) => {
    console.log("handleTimelineSlotClick called for booking:", booking.id);
    // Prevent opening modal if an action is already in progress OR settings/overrides are being saved
    if (actionLoading || settingsSavingLoading || overrideSavingLoading) {
      console.log(
        "handleTimelineSlotClick blocked due to actionLoading or settings/overrideSavingLoading"
      );
      return;
    }
    setBookingToEdit(booking);
    setModalStep("options");
    setShowEditDeleteModal(true);
    console.log("Modal state set to true, bookingToEdit:", booking.id);
    console.log("handleTimelineSlotClick finished.");
  };

  const closeEditDeleteModal = () => {
    console.log("closeEditDeleteModal called");
    setBookingToEdit(null);
    setModalStep("options");
    setShowEditDeleteModal(false);
    console.log("Modal state set to false");
  };

  // Handlers to change modal step state managed in THIS component
  const requestRescheduleStep = () => {
    console.log(
      "requestRescheduleStep called, setting modalStep to 'confirm-reschedule'"
    );
    setModalStep("confirm-reschedule");
  };
  const requestDeleteStep = () => {
    console.log(
      "requestDeleteStep called, setting modalStep to 'confirm-delete'"
    );
    setModalStep("confirm-delete");
  };
  const requestOptionsStep = () => {
    console.log("requestOptionsStep called, setting modalStep to 'options'");
    setModalStep("options");
  };

  // --- Render UI ---

  return (
    <div className="p-4 bg-white rounded-lg shadow">
      {console.log("Rendering SpaCalendar JSX")}
      <h2 className="mb-4 text-xl font-bold">Calendrier SPA Admin</h2>
      {/* Overall Loading Indicator - Uses combined loading from hooks */}
      {(overallLoading || settingsSavingLoading || overrideSavingLoading) && ( // Include overrideSavingLoading
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white bg-opacity-75">
          <div className="text-lg font-semibold text-blue-600">
            Chargement des données...
          </div>
        </div>
      )}
      {/* Overall Error Message - Uses errors from hooks */}
      {(bookingsError || settingsError || overrideError) &&
        !overallLoading && ( // Include overrideError
          <div className="p-4 mb-4 text-center text-red-700 bg-red-100 border border-red-300 rounded">
            Erreur lors du chargement des données :{" "}
            {bookingsError?.message ||
              settingsError?.message ||
              overrideError?.message ||
              "Une erreur inconnue est survenue."}
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
                value={editableSpaSettings.startTime || ""}
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
                value={editableSpaSettings.endTime || ""}
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
                value={editableSpaSettings.slotDurationMinutes || ""}
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
      {settingsError && !settingsLoading && (
        <div className="p-2 mb-3 text-xs text-center text-red-600 border border-red-200 rounded bg-red-50">
          Erreur: {settingsError.message}
        </div>
      )}
      {/* Month navigation */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() =>
            setCurrentMonth(
              new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1)
            )
          }
          className="px-3 py-1 text-sm bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={
            overallLoading ||
            actionLoading ||
            settingsSavingLoading ||
            overrideSavingLoading
          } // Add overrideSavingLoading
        >
          Mois précédent
        </button>
        <h3 className="text-lg font-semibold">
          {format(currentMonth, "MMMM yyyy", { locale: fr })}
        </h3>
        <button
          onClick={() =>
            setCurrentMonth(
              new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1)
            )
          }
          className="px-3 py-1 text-sm bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={
            overallLoading ||
            actionLoading ||
            settingsSavingLoading ||
            overrideSavingLoading
          } // Add overrideSavingLoading
        >
          Mois suivant
        </button>
      </div>
      {/* Main content area - 3 panels */}
      <div className="grid grid-cols-1 gap-4 mb-6 md:grid-cols-3">
        {/* Left: Calendar Panel (Remains inline for now) */}
        <div className="p-3 border rounded">
          <h3 className="mb-2 text-lg font-semibold">Calendrier</h3>
          {/* Info message if a booking is selected */}
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
              <span className="font-medium">
                {selectedBooking.guestName ||
                  `${selectedBooking.firstName} ${selectedBooking.lastName}`}{" "}
                ({selectedBooking.property})
              </span>
              .
            </div>
          )}
          <div className="grid grid-cols-7 gap-1">
            {/* Day headers */}
            {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((day) => (
              <div key={day} className="p-1 text-sm font-semibold text-center">
                {day}
              </div>
            ))}

            {/* Calendar days */}
            {eachDayOfInterval({
              start: startOfMonth(currentMonth),
              end: endOfMonth(currentMonth),
            }).map((date) => {
              const dateStr = format(date, "yyyy-MM-dd");
              const isToday = isSameDay(date, new Date());
              const isSelected = selectedDate && isSameDay(date, selectedDate);

              // Determine if date should be disabled
              let isDisabled =
                overallLoading ||
                actionLoading ||
                settingsSavingLoading ||
                overrideSavingLoading; // Add overrideSavingLoading

              // Disable date if a booking is selected AND the date is outside its stay
              if (!isDisabled && selectedBooking) {
                isDisabled = !isDateWithinBookingStay(date, selectedBooking);
              }

              // Find bookings for this date (for dots indicator) - Use 'bookings' from hook
              const dateSpaBookingsForDots = bookings.filter((booking) => {
                if (!booking.spaDateTimeObj) return false;
                return isSameDay(booking.spaDateTimeObj, date);
              });

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
                    isDisabled &&
                    (selectedBooking ||
                      overallLoading ||
                      actionLoading ||
                      settingsSavingLoading ||
                      overrideSavingLoading) // Add other loading states to title condition
                      ? selectedBooking &&
                        !overallLoading &&
                        !actionLoading &&
                        !settingsSavingLoading &&
                        !overrideSavingLoading
                        ? `Cette date (${format(
                            date,
                            "dd/MM"
                          )}) est hors du séjour du client (${
                            selectedBooking.arrivalDateObj
                              ? format(selectedBooking.arrivalDateObj, "dd/MM")
                              : "?"
                          } - ${
                            selectedBooking.departureDateObj
                              ? format(
                                  selectedBooking.departureDateObj,
                                  "dd/MM"
                                )
                              : "?"
                          })`
                        : overallLoading ||
                          actionLoading ||
                          settingsSavingLoading ||
                          overrideSavingLoading
                        ? "Chargement ou action en cours..."
                        : null // General loading tooltip
                      : null // No title if not disabled or disabled by other factors
                  }
                >
                  <div className="text-center">{format(date, "d")}</div>

                  {/* Show colored dots for each booking */}
                  {hasSpaBookings && (
                    <div className="flex justify-center mt-1 space-x-1">
                      {/* Use the first few bookings for color dots */}
                      {dateSpaBookingsForDots.slice(0, 3).map((booking, i) => {
                        const colors = getPropertyColor(booking);
                        return (
                          <div
                            key={i}
                            className={`w-2 h-2 rounded-full ${colors.bg.replace(
                              "-100",
                              "-500"
                            )}`}
                            title={`SPA booking: ${booking.property}`}
                          ></div>
                        );
                      })}
                      {/* Show count if more than 3 */}
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

        {/* Middle: Bookings to schedule panel (Extracted Component) */}
        <BookingsToSchedulePanel
          bookingsToSchedule={bookingsToSchedule} // Pass derived state
          selectedBooking={selectedBooking} // Pass state
          onBookingSelect={setSelectedBooking} // Pass setter
          isLoading={overallLoading} // Pass main loading state from hooks
          isActionLoading={
            actionLoading || settingsSavingLoading || overrideSavingLoading
          } // Disable while any action is loading
        />

        {/* Right: Selected date details panel (Extracted Component) */}
        <SelectedDateDetailsPanel
          selectedDate={selectedDate} // Pass state
          selectedBooking={selectedBooking} // Pass state
          availableSlots={availableSlots} // Pass data from hook
          selectedDateBookings={selectedDateBookings} // Pass derived state
          spaSettings={spaSettings} // Pass data from hook (current settings)
          overrideData={overrideData} // <--- Pass override data from hook
          overrideLoading={overrideLoading} // <--- Pass override loading from hook
          overrideError={overrideError} // <--- Pass override error from hook
          editableOverrideSettings={editableOverrideSettings} // <--- Pass editable override state
          onEditableOverrideChange={setEditableOverrideSettings} // <--- Pass setter for editable override state
          onSaveOverride={handleSaveOverride} // <--- Pass handler for saving override
          onDeleteOverride={handleDeleteOverride} // <--- Pass handler for deleting override
          onBookSlot={handleBookSlot} // Pass handler
          onScheduledBookingClick={handleTimelineSlotClick} // Pass handler
          isLoading={overallLoading} // Pass main loading state from hooks (for bookings list)
          isSlotsLoading={slotsLoading} // Pass specific slots loading state from hook (for slots list)
          slotsError={slotsError} // Pass slotsError prop
          bookingsError={bookingsError} // Pass bookingsError prop (needed for scheduled list error display)
          isActionLoading={
            actionLoading || settingsSavingLoading || overrideSavingLoading
          } // Disable while any action is loading
          isOverrideSaving={overrideSavingLoading} // <--- Pass specific override saving loading
        />
      </div>{" "}
      {/* End of 3-panel grid */}
      {/* Timeline Section (Extracted Component) */}
      {/* Only render if selected date, not overall loading, scheduled bookings exist, and settings are loaded */}
      {selectedDate &&
        !overallLoading && // Use overallLoading to prevent rendering timeline before bookings are loaded
        selectedDateBookings.length > 0 && // Use derived state to check if there's anything to display
        spaSettings && ( // Ensure settings are loaded as timeline calculation depends on them
          <SpaTimeline
            selectedDate={selectedDate} // Pass state
            selectedDateBookings={selectedDateBookings} // Pass derived state
            spaSettings={spaSettings} // Pass data from hook (current settings)
            overrideData={overrideData} // <--- Pass override data to timeline
            onScheduledBookingClick={handleTimelineSlotClick} // Pass handler
            actionLoading={
              actionLoading || settingsSavingLoading || overrideSavingLoading
            } // Disable while any action is loading
          />
        )}
      {/* Edit/Delete Modal (Extracted Component) */}
      {/* Only render if showEditDeleteModal is true and a booking is selected for editing */}
      {showEditDeleteModal && bookingToEdit && (
        <EditDeleteSpaModal
          bookingToEdit={bookingToEdit} // Pass state
          modalStep={modalStep} // Pass state
          onClose={closeEditDeleteModal} // Pass handler
          onRescheduleConfirm={handleMarkBookingForRescheduling} // Pass async wrapper handler
          onDeleteConfirm={handleDeleteSpaAppointment} // Pass async wrapper handler
          actionLoading={
            actionLoading || settingsSavingLoading || overrideSavingLoading
          } // Disable while any action is loading

          onRequestRescheduleStep={requestRescheduleStep}
          onRequestDeleteStep={requestDeleteStep}
          onRequestOptionsStep={requestOptionsStep}
        />
      )}
    </div>
  );
};

export default SpaCalendar;
