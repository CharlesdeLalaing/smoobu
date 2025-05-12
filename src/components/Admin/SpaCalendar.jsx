// File: src/components/Admin/SpaCalendar.jsx
import React, { useState, useEffect, useMemo } from "react";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  startOfDay,
  parseISO,
  addDays,
  isAfter,
  isValid as isDateValid,
} from "date-fns";
import { fr } from "date-fns/locale";


import {
  // Firebase imports needed for actions (update/delete)
  doc,
  updateDoc,
  deleteField,
} from "firebase/firestore";
import { db } from "../../firebase"; // Adjust path as needed

// Import utility functions from src/utils
import {
  parseBookingDateTime,
  isDateWithinBookingStay,
  getPropertyColor,
  calculateBookingSlots,
} from "../spa/spaCalendarUtils";

// Import custom hooks from src/hooks
import {
  useSpaSettings,
  useBookingsForMonth,
  useAvailableSlots,
} from "../spa/useSpaCalendarData";

// Import extracted UI components from the same directory (src/components/Admin)
import BookingsToSchedulePanel from "../spa/BookingsToSchedulePanel";
import SelectedDateDetailsPanel from "../spa/SelectedDateDetailsPanel";
import SpaTimeline from "../spa/SpaTimeline";
import EditDeleteSpaModal from "../spa/EditDeleteSpaModal"; // Ensure this path and filename are correct

// --- Main Component ---
const SpaCalendar = () => {
  console.log("SpaCalendar rendering...");
  // --- State Variables (Managed by this component) ---
  const [currentMonth, setCurrentMonth] = useState(new Date()); // Month for calendar navigation
  const [selectedDate, setSelectedDate] = useState(null); // The date selected in the calendar
  const [selectedBooking, setSelectedBooking] = useState(null); // The booking selected from 'À programmer' list for scheduling
  const [bookingToEdit, setBookingToEdit] = useState(null); // The scheduled booking selected for editing/deleting
  const [showEditDeleteModal, setShowEditDeleteModal] = useState(false); // State for modal visibility
  const [modalStep, setModalStep] = useState("options"); // 'options' | 'confirm-reschedule' | 'confirm-delete'

  // State for actions initiated from the UI (Saving booking, deleting booking)
  const [actionLoading, setActionLoading] = useState(false);

   // --- State for Settings Editing ---
   const [editableSpaSettings, setEditableSpaSettings] = useState(null); // Holds settings data while editing
   const [settingsSavingLoading, setSettingsSavingLoading] = useState(false); // Loading state for saving settings
   const [settingsSavingError, setSettingsSavingError] = useState(null); // Error state for saving settings
   // --- End State for Settings Editing ---


   console.log("SpaCalendar state:", {
       currentMonth: format(currentMonth, 'yyyy-MM'),
       selectedDate: selectedDate ? format(selectedDate, 'yyyy-MM-dd') : null,
       selectedBooking: selectedBooking?.id || null,
       bookingToEdit: bookingToEdit?.id || null,
       showEditDeleteModal,
       modalStep,
       actionLoading,
       editableSpaSettings, // Add to log
       settingsSavingLoading, // Add to log
       settingsSavingError // Add to log
   });


  // --- Use Custom Hooks to Fetch Data ---
  const {
    spaSettings, // The current settings from Firebase
    loading: settingsLoading, // Loading for fetching settings
    error: settingsError, // Error for fetching settings
    refetch: refetchSpaSettings, // Function to refetch settings
  } = useSpaSettings(); // This hook fetches settings
   console.log("useSpaSettings hook data:", { spaSettings, settingsLoading, settingsError });

  const {
    bookings,
    loading: bookingsLoading,
    error: bookingsError,
    refetch: refetchBookings,
  } = useBookingsForMonth(currentMonth);
   console.log("useBookingsForMonth hook data:", { bookings: bookings.length, bookingsLoading, bookingsError });


  const {
    availableSlots,
    loading: slotsLoading,
    error: slotsError,
    refetch: refetchSlots,
  } = useAvailableSlots(selectedDate, selectedBooking, spaSettings); // Pass spaSettings from hook
   console.log("useAvailableSlots hook data:", { availableSlots: availableSlots.length, slotsLoading, slotsError });


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
      console.log(`useMemo selectedDateBookings: Found ${filtered.length} bookings for ${selectedDate ? format(selectedDate, 'yyyy-MM-dd') : 'N/A'}`);
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
       console.log(`useMemo bookingsToSchedule: Found ${filtered.length} bookings needing scheduling.`);
       return filtered;
  }, [bookings]); // Recalculate when bookings change

  // --- Combined Loading State for Main UI ---
  const overallLoading = bookingsLoading || settingsLoading; // Note: slotsLoading is NOT included here


   // --- Effect to Synchronize Fetched Settings with Editable State ---
   useEffect(() => {
       console.log("SpaCalendar Effect: spaSettings changed", spaSettings);
       if (spaSettings) {
           // Only update editable state if spaSettings is loaded
           setEditableSpaSettings(spaSettings);
           console.log("SpaCalendar Effect: Synchronized editableSpaSettings with fetched spaSettings.");
       } else {
           // Optionally clear editable settings if fetched settings become null (e.g. error?)
           setEditableSpaSettings(null);
           console.log("SpaCalendar Effect: spaSettings is null, cleared editableSpaSettings.");
       }
        // Depend on spaSettings changing
   }, [spaSettings]);


  // --- Data Mutation Functions (Remain here, called by handlers) ---

  const handleUpdateBookingSpaDate = async (
    bookingId,
    dateTime,
    slotsToBook
  ) => {
    console.log("handleUpdateBookingSpaDate started");
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

      // Calculate end time based on the START time plus the total duration covered by the slots.
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
      // Refetch bookings for the month to see the changes reflected in all lists/timeline
      console.log("Refetching bookings after update...");
      refetchBookings(currentMonth);
      // Refetch slots for the selected date as availability might have changed
      if (selectedDate) {
          console.log("Refetching slots after update...");
          refetchSlots(selectedDate, selectedBooking, spaSettings);
      }
      // --- End Refetch ---


      setSelectedBooking(null); // Clear selected booking after successful scheduling

      // Show confirmation (consider using a more modern notification system instead of alert)
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
    // No window.confirm here, confirmation is handled in the modal UI
    if (!bookingToEdit) {
      console.log("Delete action called but bookingToEdit is null. Aborting.");
      // closeEditDeleteModal(); // Called in finally
      return;
    }

    try {
      setActionLoading(true); // Start action loading
      console.log("Starting delete action for booking:", bookingToEdit.id);
      await updateDoc(doc(db, "bookings", bookingToEdit.id), {
        spaDateTime: deleteField(), // Remove the field
        spaEndDateTime: deleteField(), // Remove the field
        spaSlots: deleteField(), // Remove the field
        spaBookingPreference: "none", // Set preference to none
        spaInfo: {
          // Reset spaInfo
          hasSpaTreatment: false,
          scheduledDateTime: null,
          endDateTime: null,
          preference: "none",
          formattedDateTime: null,
          slots: [],
          status: "cancelled", // Or "deleted"
        },
      });

      console.log(
        `Booking ${bookingToEdit.id} deleted successfully in Firebase.`
      );
      alert("Rendez-vous SPA supprimé.");
       console.log("handleDeleteSpaAppointment finished successfully");

      // --- Refetch Data After Write ---
      // Refetch bookings for the month to see the changes
      console.log("Refetching bookings after delete...");
      refetchBookings(currentMonth);
      // Refetch slots for the selected date as availability might have changed
      // Pass null for selectedBooking as the one being edited is now deleted or pending reschedule
      if (selectedDate) {
           console.log("Refetching slots after delete...");
           refetchSlots(selectedDate, null, spaSettings); // Pass spaSettings
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

  // This handles the actual async Firebase action to mark for rescheduling
  const handleMarkBookingForRescheduling = async () => {
    console.log("handleMarkBookingForRescheduling called");
    // No window.confirm here, confirmation is handled in the modal UI
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
        spaDateTime: deleteField(), // Remove the field
        spaEndDateTime: deleteField(), // Remove the field
        spaSlots: deleteField(), // Remove the field
        // Set preference back to 'later' so it appears in the middle list
        spaBookingPreference: "later",
        spaInfo: {
          // Update spaInfo status
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
      // Refetch bookings for the month
      console.log("Refetching bookings after reschedule...");
      refetchBookings(currentMonth);
      // Refetch slots for the selected date as availability might have changed
      // Pass null for selectedBooking as the one being edited is now deleted or pending reschedule
      if (selectedDate) {
          console.log("Refetching slots after reschedule...");
          refetchSlots(selectedDate, null, spaSettings); // Pass spaSettings
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
      if (!editableSpaSettings) {
          console.warn("handleSaveSpaSettings: editableSpaSettings is null. Aborting.");
          return;
      }

       // --- Validation ---
      setSettingsSavingError(null); // Clear previous error
      const { startTime, endTime, slotDurationMinutes } = editableSpaSettings;

       // Basic validation for time strings (HH:mm format)
      const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
      if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
          const errorMsg = "Les heures de début et de fin doivent être au format HH:mm.";
          setSettingsSavingError(errorMsg);
          console.warn("Settings validation failed:", errorMsg);
          alert(errorMsg);
          return;
      }

       // Basic validation for duration
       if (typeof slotDurationMinutes !== 'number' || slotDurationMinutes <= 0 || !Number.isInteger(slotDurationMinutes)) {
           const errorMsg = "La durée du créneau doit être un nombre entier positif (en minutes).";
           setSettingsSavingError(errorMsg);
           console.warn("Settings validation failed:", errorMsg);
           alert(errorMsg);
           return;
       }

       // Optional: More complex validation, e.g., startTime is before endTime on the same day
       // Create temporary dates on an arbitrary day to compare times
       try {
           const today = startOfDay(new Date());
           const startTimeDate = parseISO(format(today, 'yyyy-MM-dd') + 'T' + startTime);
           const endTimeDate = parseISO(format(today, 'yyyy-MM-dd') + 'T' + endTime);

           if (!isDateValid(startTimeDate) || !isDateValid(endTimeDate) || isAfter(startTimeDate, endTimeDate)) {
                const errorMsg = "L'heure de début doit être avant l'heure de fin le même jour.";
                setSettingsSavingError(errorMsg);
                console.warn("Settings validation failed:", errorMsg);
                alert(errorMsg);
                return;
           }
       } catch (e) {
            console.error("Error during settings time comparison validation:", e);
            const errorMsg = "Erreur lors de la validation des heures.";
            setSettingsSavingError(errorMsg);
            alert(errorMsg);
            return;
       }

       // --- End Validation ---


      try {
          setSettingsSavingLoading(true); // Start saving loading
          console.log("Saving SPA settings to Firebase:", editableSpaSettings);

          // Create a clean object to save, only including the fields we want to update
          const settingsToSave = {
              startTime: editableSpaSettings.startTime,
              endTime: editableSpaSettings.endTime,
              slotDurationMinutes: editableSpaSettings.slotDurationMinutes,
              // Add any other relevant settings fields here
          };

          // Update the document in Firebase
          await updateDoc(doc(db, "spaSettings", "default"), settingsToSave);

          console.log("SPA settings saved successfully.");
          alert("Paramètres SPA enregistrés avec succès.");

          // --- Refetch Data After Settings Save ---
          // Refetch settings first to ensure state is updated from source of truth
          console.log("Refetching settings after save...");
          refetchSpaSettings();
           // Refetch bookings as settings like slot duration/hours might affect display/availability calculation
          console.log("Refetching bookings and slots after settings save...");
          refetchBookings(currentMonth); // Refetch bookings for the current month
           if (selectedDate) {
               refetchSlots(selectedDate, selectedBooking, editableSpaSettings); // Refetch slots for the selected date with NEW settings
           } else {
               // If no date is selected, refetchSlots won't do anything, which is fine.
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


  // --- Event Handlers ---

  const handleDateSelect = (date) => {
    console.log("handleDateSelect called for date:", format(date, 'yyyy-MM-dd'));
    // Avoid actions if overall data is loading, an action is in progress, OR settings are being saved
    if (overallLoading || actionLoading || settingsSavingLoading) { // Add settingsSavingLoading
      console.log("handleDateSelect blocked due to loading or actionLoading or settingsSavingLoading");
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

    setSelectedDate(date);
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

    // Prevent booking if an action is already in progress (e.g., modal open) OR settings are being saved
    if (actionLoading || showEditDeleteModal || settingsSavingLoading) { // Add settingsSavingLoading
      console.log(
        "handleBookSlot blocked due to actionLoading or showEditDeleteModal or settingsSavingLoading"
      );
      return;
    }

    if (!isDateWithinBookingStay(date, selectedBooking)) {
      alert("Cannot book SPA outside of the client's stay dates.");
      console.warn("handleBookSlot: Selected date is outside booking stay.");
      return;
    }

    if (!availableSlots.includes(timeSlot)) {
       console.error("handleBookSlot: Selected time slot is not in the current availableSlots list:", timeSlot, availableSlots);
       alert("Le créneau horaire sélectionné n'est pas disponible.");
       refetchSlots(selectedDate, selectedBooking, spaSettings);
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
        : 120;

    const slotDurationMinutes = spaSettings?.slotDurationMinutes || 30; // Use settings from hook state

     if (slotDurationMinutes <= 0 || treatmentDurationMinutes <= 0) {
          console.error("Invalid duration settings:", {treatmentDurationMinutes, slotDurationMinutes});
          alert("Erreur de configuration des durées SPA. Impossible de calculer les créneaux nécessaires.");
          console.log("handleBookSlot aborted due to invalid duration settings.");
          return;
     }


    try {
         const slotsToBook = calculateBookingSlots(dateTime, treatmentDurationMinutes, slotDurationMinutes);
         console.log("handleBookSlot: Calculated bookedSlots array:", slotsToBook);

         const requiredSlotsCount = Math.ceil(treatmentDurationMinutes / slotDurationMinutes);
         if (slotsToBook.length !== requiredSlotsCount || slotsToBook[0] !== timeSlot) {
              console.error("handleBookSlot: Slot calculation mismatch or start time inconsistency:", {
                calculated: slotsToBook,
                requiredCount: requiredSlotsCount,
                selectedSlot: timeSlot,
              });
              refetchSlots(selectedDate, selectedBooking, spaSettings);
              alert("Erreur interne: Le créneau sélectionné ne correspond pas à la durée du traitement calculée.");
               console.log("handleBookSlot aborted due to slot calculation mismatch.");
              return;
         }

         const requiredSlotsAvailable = slotsToBook.every(requiredSlot => availableSlots.includes(requiredSlot));

          if (!requiredSlotsAvailable) {
              console.error("handleBookSlot: Not all calculated slots are in the available list.", {
                  selectedSlot: timeSlot,
                  slotsToBook: slotsToBook,
                  availableSlots: availableSlots
              });
              refetchSlots(selectedDate, selectedBooking, spaSettings);
              alert("Le créneau horaire sélectionné nécessite des créneaux consécutifs qui ne sont pas tous disponibles.");
               console.log("handleBookSlot aborted due to consecutive slot unavailability.");
              return;
          }

         console.log("handleBookSlot proceeding to call handleUpdateBookingSpaDate");
         handleUpdateBookingSpaDate(selectedBooking.id, dateTime, slotsToBook);

    } catch (error) {
         console.error("Slot calculation or validation failed:", error);
         alert(`Erreur lors du calcul des créneaux : ${error.message || "une erreur inconnue est survenue"}`);
          console.log("handleBookSlot finished with sync error.");
    }
     console.log("handleBookSlot finished.");
  };


  const handleTimelineSlotClick = (booking) => {
    console.log("handleTimelineSlotClick called for booking:", booking.id);
    // Prevent opening modal if an action is already in progress OR settings are being saved
    if (actionLoading || settingsSavingLoading) { // Add settingsSavingLoading
      console.log("handleTimelineSlotClick blocked due to actionLoading or settingsSavingLoading");
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
       console.log("requestRescheduleStep called, setting modalStep to 'confirm-reschedule'");
       setModalStep('confirm-reschedule');
   }
   const requestDeleteStep = () => {
       console.log("requestDeleteStep called, setting modalStep to 'confirm-delete'");
       setModalStep('confirm-delete');
   }
   const requestOptionsStep = () => {
       console.log("requestOptionsStep called, setting modalStep to 'options'");
       setModalStep('options');
   }


  // --- Render UI ---

  return (
    <div className="p-4 bg-white rounded-lg shadow">
      {console.log("Rendering SpaCalendar JSX")}
      <h2 className="mb-4 text-xl font-bold">Calendrier SPA Admin</h2>
      {/* Overall Loading Indicator - Uses combined loading from hooks */}
      {overallLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white bg-opacity-75">
          <div className="text-lg font-semibold text-blue-600">
            Chargement des données...
          </div>
        </div>
      )}
      {/* Overall Error Message - Uses errors from hooks */}
      {(bookingsError || settingsError) && !overallLoading && (
        <div className="p-4 mb-4 text-center text-red-700 bg-red-100 border border-red-300 rounded">
          Erreur lors du chargement des données :{" "}
          {bookingsError?.message ||
            settingsError?.message ||
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
      {/* Disabled using overallLoading and actionLoading */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() =>
            setCurrentMonth(
              new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1)
            )
          }
          className="px-3 py-1 text-sm bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={overallLoading || actionLoading || settingsSavingLoading} // Add settingsSavingLoading
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
          disabled={overallLoading || actionLoading || settingsSavingLoading} // Add settingsSavingLoading
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
                overallLoading || actionLoading || settingsSavingLoading; // Add settingsSavingLoading

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
                    selectedBooking &&
                    !overallLoading &&
                    !actionLoading &&
                    !settingsSavingLoading
                      ? `Cette date (${format(
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
                        })`
                      : null
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
          isActionLoading={actionLoading || settingsSavingLoading} // Disable while saving settings
        />

        {/* Right: Selected date details panel (Extracted Component) */}
        <SelectedDateDetailsPanel
          selectedDate={selectedDate} // Pass state
          selectedBooking={selectedBooking} // Pass state
          availableSlots={availableSlots} // Pass data from hook
          selectedDateBookings={selectedDateBookings} // Pass derived state
          spaSettings={spaSettings} // Pass data from hook (current settings)
          onBookSlot={handleBookSlot} // Pass handler
          onScheduledBookingClick={handleTimelineSlotClick} // Pass handler
          isLoading={overallLoading} // Pass main loading state from hooks (for bookings list)
          isSlotsLoading={slotsLoading} // Pass specific slots loading state from hook (for slots list)
          slotsError={slotsError} // Pass slotsError prop
          bookingsError={bookingsError} // Pass bookingsError prop (needed for scheduled list error display)
          isActionLoading={actionLoading || settingsSavingLoading} // Disable while saving settings
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
            onScheduledBookingClick={handleTimelineSlotClick} // Pass handler
            actionLoading={actionLoading || settingsSavingLoading} // Disable while saving settings
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
          actionLoading={actionLoading || settingsSavingLoading} // Disable while saving settings
          // Pass handlers to request step changes
          onRequestRescheduleStep={requestRescheduleStep}
          onRequestDeleteStep={requestDeleteStep}
          onRequestOptionsStep={requestOptionsStep}
        />
      )}
    </div>
  );
};

export default SpaCalendar;
