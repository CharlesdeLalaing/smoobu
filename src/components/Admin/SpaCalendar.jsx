// File: src/components/Admin/SpaCalendar.jsx
import React, { useState, useEffect, useMemo } from "react";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  startOfDay,
  addDays,
  isAfter,
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

  // State for actions initiated from the UI (Saving, deleting)
  const [actionLoading, setActionLoading] = useState(false);

  console.log("SpaCalendar state:", {
    currentMonth: format(currentMonth, "yyyy-MM"),
    selectedDate: selectedDate ? format(selectedDate, "yyyy-MM-dd") : null,
    selectedBooking: selectedBooking?.id || null,
    bookingToEdit: bookingToEdit?.id || null,
    showEditDeleteModal,
    modalStep,
    actionLoading,
  });

  // --- Use Custom Hooks to Fetch Data ---
  const {
    spaSettings,
    loading: settingsLoading,
    error: settingsError,
    refetch: refetchSpaSettings, // Keep if settings could change dynamically
  } = useSpaSettings(); // This hook fetches settings
  console.log("useSpaSettings:", {
    spaSettings,
    settingsLoading,
    settingsError,
  });

  const {
    bookings, // This is the raw list of bookings for the month
    loading: bookingsLoading,
    error: bookingsError,
    refetch: refetchBookings, // Use this to manually trigger a refetch after write actions
  } = useBookingsForMonth(currentMonth); // This hook fetches bookings based on month
  console.log("useBookingsForMonth:", {
    bookings: bookings.length,
    bookingsLoading,
    bookingsError,
  });

  const {
    availableSlots,
    loading: slotsLoading, // Loading specific to the slots API call
    error: slotsError,
    refetch: refetchSlots, // Use this if you need to force a slot refresh
  } = useAvailableSlots(selectedDate, selectedBooking, spaSettings); // This hook fetches slots based on date/booking/settings
  console.log("useAvailableSlots:", {
    availableSlots: availableSlots.length,
    slotsLoading,
    slotsError,
  });

  // --- Derived State (Calculated using useMemo) ---
  // Filter and sort scheduled bookings for the *selected date*
  const selectedDateBookings = useMemo(() => {
    console.log(
      "useMemo: Calculating selectedDateBookings...",
      selectedDate,
      bookings.length
    );
    if (!selectedDate || !bookings || bookings.length === 0) {
      console.log("useMemo selectedDateBookings: Returning empty array.");
      return []; // Return empty if no date selected or no bookings fetched
    }

    const filtered = bookings
      .filter((booking) => {
        // A booking appears in the timeline/scheduled list ONLY if it has spaDateTime
        // Use the parsed object stored by the hook for filtering
        if (
          !booking.spaDateTimeObj ||
          isNaN(booking.spaDateTimeObj.getTime())
        ) {
          // console.warn("Skipping booking with invalid spaDateTimeObj:", booking.id);
          return false; // Skip invalid dates or bookings without scheduled time
        }

        // Ensure the scheduled date is the selected date (start of day comparison)
        return isSameDay(
          startOfDay(booking.spaDateTimeObj),
          startOfDay(selectedDate)
        );
      })
      .sort((a, b) => {
        // Sort by time using the parsed dates
        const timeA = a.spaDateTimeObj;
        const timeB = b.spaDateTimeObj;

        // Handle potential invalid dates during sorting (should be caught by filter, but defensive)
        if (!timeA || isNaN(timeA.getTime())) return 1; // Invalid date comes last
        if (!timeB || isNaN(timeB.getTime())) return -1; // Invalid date comes last

        return timeA.getTime() - timeB.getTime(); // Sort ascending by time (milliseconds)
      });
    console.log(
      `useMemo selectedDateBookings: Found ${filtered.length} bookings for ${
        selectedDate ? format(selectedDate, "yyyy-MM-dd") : "N/A"
      }`
    );
    return filtered;
  }, [bookings, selectedDate]); // Recalculate when bookings or selectedDate change

  // Filter bookings that need scheduling ('À programmer' list)
  const bookingsToSchedule = useMemo(() => {
    console.log("useMemo: Calculating bookingsToSchedule...", bookings.length);
    if (!bookings || bookings.length === 0) {
      console.log("useMemo bookingsToSchedule: Returning empty array.");
      return []; // Return empty if no bookings fetched
    }
    const filtered = bookings
      .filter((b) => b.needsScheduling) // Hook adds the needsScheduling flag
      .sort((a, b) => {
        // Sort by arrival date, then potentially by property or name
        // Use the parsed date objects stored during fetch
        let arrivalA = a.arrivalDateObj;
        let arrivalB = b.arrivalDateObj;

        if (!arrivalA || isNaN(arrivalA.getTime())) arrivalA = new Date(0); // Treat invalid dates as epoch for sorting
        if (!arrivalB || isNaN(arrivalB.getTime())) arrivalB = new Date(0);

        if (arrivalA.getTime() - arrivalB.getTime() !== 0)
          return arrivalA.getTime() - arrivalB.getTime();
        // Optional secondary sort by property
        return a.property?.localeCompare(b.property || "") || 0; // Safely compare property
      });
    console.log(
      `useMemo bookingsToSchedule: Found ${filtered.length} bookings needing scheduling.`
    );
    return filtered;
  }, [bookings]); // Recalculate when bookings change

  // --- Combined Loading State for Main UI ---
  // This controls the main loading spinner over the whole content
  // It does NOT include slotsLoading, as that's specific to the right panel
  const overallLoading = bookingsLoading || settingsLoading;

  // --- Data Mutation Functions (Remain here, called by handlers) ---

  // This handles the actual async Firebase update for scheduling
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

  // This handles the actual async Firebase delete action
  const handleDeleteSpaAppointment = async () => {
    console.log("handleDeleteSpaAppointment called");
    // No window.confirm here, confirmation is handled in the modal UI
    if (!bookingToEdit) {
      console.log("Delete action called but bookingToEdit is null. Aborting.");
      closeEditDeleteModal(); // Close modal if state is inconsistent
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
      // closeModal happens in finally
      console.log("handleDeleteSpaAppointment finished successfully");

      // --- Refetch Data After Write ---
      // Refetch bookings for the month to see the changes
      console.log("Refetching bookings after delete...");
      refetchBookings(currentMonth);
      // Refetch slots for the selected date as availability might have changed
      // Pass null for selectedBooking as the one being edited is now deleted or pending reschedule
      if (selectedDate) {
        console.log("Refetching slots after delete...");
        refetchSlots(selectedDate, null, spaSettings);
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
      closeEditDeleteModal(); // Close modal if state is inconsistent
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
      // closeModal happens in finally
      console.log("handleMarkBookingForRescheduling finished successfully");

      // --- Refetch Data After Write ---
      // Refetch bookings for the month
      console.log("Refetching bookings after reschedule...");
      refetchBookings(currentMonth);
      // Refetch slots for the selected date as availability might have changed
      // Pass null for selectedBooking as the one being edited is now deleted or pending reschedule
      if (selectedDate) {
        console.log("Refetching slots after reschedule...");
        refetchSlots(selectedDate, null, spaSettings);
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

  // --- Event Handlers ---

  // Handle date selection (Sole source for populating selectedDateBookings and availableSlots)
  // Updated to use hook loading states and pass selectedBooking context to isDateWithinBookingStay
  const handleDateSelect = (date) => {
    console.log(
      "handleDateSelect called for date:",
      format(date, "yyyy-MM-dd")
    );
    // Avoid actions if overall data is loading or an action is in progress
    if (overallLoading || actionLoading) {
      console.log("handleDateSelect blocked due to loading or actionLoading");
      return;
    }

    // Before setting, check if this date *should* be selectable based on selectedBooking
    // If a booking is selected, the date must be within its stay period.
    // isDateWithinBookingStay is now imported from utils
    if (selectedBooking) {
      if (!isDateWithinBookingStay(date, selectedBooking)) {
        console.log(
          "handleDateSelect blocked: Date is outside selected booking stay:",
          format(date, "yyyy-MM-dd"),
          selectedBooking.id
        );
        // The calendar day button is disabled based on this check (in JSX), but this is a final safeguard.
        return; // Do not select the date
      }
      // Console log below is kept from original for debugging clarity
      console.log(
        "handleDateSelect allowed: Date is within selected booking stay:",
        format(date, "yyyy-MM-dd"),
        selectedBooking.id
      );
    } else {
      // Console log below is kept from original for debugging clarity
      console.log(
        "handleDateSelect allowed: No booking selected, any date selectable:",
        format(date, "yyyy-MM-dd")
      );
    }

    // If the date is allowed, proceed to select it
    setSelectedDate(date);
    console.log("Date selected:", format(date, "yyyy-MM-dd"));

    // The fetching of available slots for the newly selected date
    // is now handled automatically by the useAvailableSlots hook's useEffect
    // because `selectedDate` is a dependency.
    // No need to call fetchAvailableSlotsForDate(date) directly here anymore.

    // The selectedDateBookings derived state is updated automatically by the useMemo hook
    // when the 'bookings' state (from useBookingsForMonth) changes based on the new 'selectedDate'.
    // No need to filter and set selectedDateBookings directly here anymore.
    console.log("handleDateSelect finished.");
  };

  // Handle booking a slot (from Available Slots panel)
  // Updated to use hook states, derived state, utility function, and call the new async wrapper function
  const handleBookSlot = (date, timeSlot) => {
    console.log(
      "handleBookSlot called with date:",
      format(date, "yyyy-MM-dd"),
      "timeSlot:",
      timeSlot
    );
    // Validate inputs and states
    if (!selectedBooking) {
      alert("Please select a booking from the 'À programmer' list first.");
      console.warn("handleBookSlot: No booking selected.");
      return;
    }

    // Prevent booking if an action is already in progress (e.g., modal open)
    if (actionLoading || showEditDeleteModal) {
      console.log(
        "handleBookSlot blocked due to actionLoading or showEditDeleteModal"
      );
      return;
    }

    // Redundant check here because the button should be disabled based on calendar logic, but good as a safeguard
    // isDateWithinBookingStay is imported utility
    if (!isDateWithinBookingStay(date, selectedBooking)) {
      alert("Cannot book SPA outside of the client's stay dates.");
      console.warn("handleBookSlot: Selected date is outside booking stay.");
      return;
    }

    // Validate slot availability - Use availableSlots state from the hook
    // Check if the selected timeSlot is even in the list of *currently* available slots
    if (!availableSlots.includes(timeSlot)) {
      console.error(
        "handleBookSlot: Selected time slot is not in the current availableSlots list:",
        timeSlot,
        availableSlots
      );
      alert("Le créneau horaire sélectionné n'est pas disponible.");
      refetchSlots(selectedDate, selectedBooking, spaSettings); // Refresh slots view using hook refetch
      console.log("handleBookSlot aborted due to slot unavailability.");
      return; // Abort
    }

    // Create a Date object for the selected date and time
    const [hours, minutes] = timeSlot.split(":").map(Number);
    const dateTime = new Date(date);
    dateTime.setHours(hours, minutes, 0, 0);
    dateTime.setSeconds(0, 0); // Ensure seconds/ms are 0
    console.log(
      "handleBookSlot: Calculated start DateTime:",
      format(dateTime, "yyyy-MM-dd HH:mm:ss")
    );

    // Determine the required number of slots based on selected booking duration and settings
    // Use selectedBooking state for duration
    const treatmentDurationMinutes =
      selectedBooking.spaTreatmentDuration &&
      typeof selectedBooking.spaTreatmentDuration === "number"
        ? selectedBooking.spaTreatmentDuration
        : 120; // Default 120 minutes (2 hours)

    // Get slot size from settings (use spaSettings state from hook)
    const slotDurationMinutes = spaSettings?.slotDurationMinutes || 30; // Use spaSettings from hook state

    // Validate duration settings before calculating slots
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
      // Calculate the specific slot strings that the booking will occupy
      // Use calculateBookingSlots utility (imported)
      const slotsToBook = calculateBookingSlots(
        dateTime,
        treatmentDurationMinutes,
        slotDurationMinutes
      );
      console.log("handleBookSlot: Calculated bookedSlots array:", slotsToBook);

      // Final validation: Check if the number of calculated slots matches required count
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
        // Use hook refetch
        refetchSlots(selectedDate, selectedBooking, spaSettings); // Refresh slots view
        alert(
          "Erreur interne: Le créneau sélectionné ne correspond pas à la durée du traitement calculée."
        );
        console.log("handleBookSlot aborted due to slot calculation mismatch.");
        return; // Abort if calculation result is unexpected
      }

      // --- Robust Validation against availableSlots ---
      // Ensure that *all* slots calculated as needed (`slotsToBook`) are actually present
      // in the *current* list of `availableSlots` fetched from the API.
      // Use availableSlots state from hook
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
        // Use hook refetch
        refetchSlots(selectedDate, selectedBooking, spaSettings); // Refresh slots view
        alert(
          "Le créneau horaire sélectionné nécessite des créneaux consécutifs qui ne sont pas tous disponibles."
        );
        console.log(
          "handleBookSlot aborted due to consecutive slot unavailability."
        );
        return; // Abort
      }
      // --- End Robust Validation ---

      // Call the async wrapper function that updates Firebase and triggers refetch
      // This function sets actionLoading and handles refetching internally
      console.log(
        "handleBookSlot proceeding to call handleUpdateBookingSpaDate"
      );
      handleUpdateBookingSpaDate(selectedBooking.id, dateTime, slotsToBook);
    } catch (error) {
      // Catch errors thrown by calculateBookingSlots or other sync logic
      console.error("Slot calculation or validation failed:", error);
      alert(
        `Erreur lors du calcul des créneaux : ${
          error.message || "une erreur inconnue est survenue"
        }`
      );
      // Optionally refetch slots here if calculation/validation indicates a potential data issue
      // refetchSlots(selectedDate, selectedBooking, spaSettings);
      console.log("handleBookSlot finished with sync error.");
    }
    console.log("handleBookSlot finished.");
  };

  // Handle click on a scheduled slot in the timeline or list
  // Updated to use actionLoading state
  const handleTimelineSlotClick = (booking) => {
    console.log("handleTimelineSlotClick called for booking:", booking.id);
    // Prevent opening modal if an action is already in progress
    if (actionLoading) {
      console.log("handleTimelineSlotClick blocked due to actionLoading");
      return;
    }
    setBookingToEdit(booking); // Set the booking to edit state
    setModalStep("options"); // Reset modal step to show options first
    setShowEditDeleteModal(true); // Show the modal
    console.log("Modal state set to true, bookingToEdit:", booking.id);
    console.log("handleTimelineSlotClick finished.");
  };

  // Close the edit/delete modal
  // Kept as is, used by the modal component's close button
  const closeEditDeleteModal = () => {
    console.log("closeEditDeleteModal called");
    setBookingToEdit(null); // Clear the booking being edited
    setModalStep("options"); // Reset step on close
    setShowEditDeleteModal(false); // Hide the modal
    console.log("Modal state set to false");
  };

  // --- Handlers Passed to Modal Component to Request Step Changes ---
  // These functions are defined here because they need access to the setModalStep state setter
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
          disabled={overallLoading || actionLoading}
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
          disabled={overallLoading || actionLoading}
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
              let isDisabled = overallLoading || actionLoading;

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
                    !actionLoading
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
        {/* Pass derived state and handlers */}
        <BookingsToSchedulePanel
          bookingsToSchedule={bookingsToSchedule} // Pass derived state
          selectedBooking={selectedBooking} // Pass state
          onBookingSelect={setSelectedBooking} // Pass setter
          isLoading={overallLoading} // Pass main loading state from hooks
          isActionLoading={actionLoading} // Pass action loading state
        />

        {/* Right: Selected date details panel (Extracted Component) */}
        {/* Pass state, derived state, hook data, handlers */}
        <SelectedDateDetailsPanel
          selectedDate={selectedDate} // Pass state
          selectedBooking={selectedBooking} // Pass state
          availableSlots={availableSlots} // Pass data from hook
          selectedDateBookings={selectedDateBookings} // Pass derived state
          spaSettings={spaSettings} // Pass data from hook
          onBookSlot={handleBookSlot} // Pass handler
          onScheduledBookingClick={handleTimelineSlotClick} // Pass handler
          isLoading={overallLoading} // Pass main loading state from hooks (for bookings list)
          isSlotsLoading={slotsLoading} // Pass specific slots loading state from hook (for slots list)
          slotsError={slotsError} // Pass slotsError prop
          bookingsError={bookingsError} // Pass bookingsError prop (needed for scheduled list error display)
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
            spaSettings={spaSettings} // Pass data from hook
            onScheduledBookingClick={handleTimelineSlotClick} // Pass handler
            actionLoading={actionLoading} // Pass action loading state
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
          actionLoading={actionLoading} // Pass action loading state
          // Pass handlers to request step changes
          onRequestRescheduleStep={requestRescheduleStep} // <-- PASS HANDLER
          onRequestDeleteStep={requestDeleteStep} // <-- PASS HANDLER
          onRequestOptionsStep={requestOptionsStep} // <-- PASS HANDLER
        />
      )}
    </div>
  );
};

export default SpaCalendar;
