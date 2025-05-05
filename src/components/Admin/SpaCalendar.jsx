// File: src/components/Admin/SpaCalendar.jsx
import React, { useState, useEffect } from "react";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  parseISO,
} from "date-fns";
import { fr } from "date-fns/locale";
import {
  collection,
  getDoc,
  getDocs,
  query,
  where,
  doc,
  updateDoc,
} from "firebase/firestore";
import { db } from "../../firebase";

const SpaCalendar = () => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [bookings, setBookings] = useState([]);
  const [spaSettings, setSpaSettings] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [bookedSlots, setBookedSlots] = useState({});
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [loading, setLoading] = useState(true);

  // Fetch bookings and settings on month change
  useEffect(() => {
    fetchBookingsForMonth(currentMonth);
    fetchSpaSettings();
  }, [currentMonth]);

  // Fetch all bookings for the current month
  const fetchBookingsForMonth = async (month) => {
    setLoading(true);
    try {
      const startDate = format(startOfMonth(month), "yyyy-MM-dd");
      const endDate = format(endOfMonth(month), "yyyy-MM-dd");

      const bookingsRef = collection(db, "bookings");
      const q = query(
        bookingsRef,
        where("arrivalDate", ">=", startDate),
        where("arrivalDate", "<=", endDate)
      );

      const querySnapshot = await getDocs(q);
      const fetchedBookings = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        fetchedBookings.push({
          id: doc.id,
          ...data,
          // Add a flag for "to be scheduled" bookings
          needsScheduling:
            data.spaBookingPreference === "later" && !data.spaDateTime,
        });
      });

      setBookings(fetchedBookings);

      // Organize booked slots by date
      const slots = {};
      fetchedBookings.forEach((booking) => {
        if (booking.spaDateTime) {
          const date = booking.spaDateTime.toDate
            ? booking.spaDateTime.toDate()
            : new Date(booking.spaDateTime.seconds * 1000);

          const dateStr = format(date, "yyyy-MM-dd");
          const timeStr = format(date, "HH:mm");

          if (!slots[dateStr]) slots[dateStr] = [];
          slots[dateStr].push({
            time: timeStr,
            booking: booking,
          });
        }
      });

      setBookedSlots(slots);
    } catch (error) {
      console.error("Error fetching bookings:", error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch SPA settings (slot duration, default hours)
  const fetchSpaSettings = async () => {
    try {
      const settingsRef = doc(db, "spaSettings", "default");
      const settingsDoc = await getDoc(settingsRef);

      if (settingsDoc.exists()) {
        setSpaSettings(settingsDoc.data());
      }
    } catch (error) {
      console.error("Error fetching SPA settings:", error);
    }
  };

  // Calculate available slots for a selected date
const fetchAvailableSlotsForDate = async (date) => {
  setLoading(true);
  try {
    const dateStr = format(date, "yyyy-MM-dd");
    const apiUrl = process.env.REACT_APP_API_URL || "http://localhost:3000";

    // Use your actual API URL (make sure it matches what's in server.js)
    const response = await fetch(
      `${apiUrl}/api/spa/availability?date=${dateStr}`
    );

    // Check if response is OK
    if (!response.ok) {
      throw new Error(`API responded with status: ${response.status}`);
    }

    // Log the raw response for debugging
    const rawText = await response.text();
    console.log("Raw API response:", rawText);

    // Try to parse as JSON
    let data;
    try {
      data = JSON.parse(rawText);
    } catch (parseError) {
      console.error("Failed to parse JSON:", parseError);
      throw new Error("Invalid JSON response from API");
    }

    setAvailableSlots(data.slots || []);
  } catch (error) {
    console.error("Error fetching available slots:", error);
    setAvailableSlots([]);
  } finally {
    setLoading(false);
  }
};

  // Update a booking's SPA datetime
  const updateBookingSpaDate = async (bookingId, dateTime) => {
    try {
      setLoading(true);
      const bookingRef = doc(db, "bookings", bookingId);

      await updateDoc(bookingRef, {
        spaDateTime: dateTime,
        spaBookingPreference: "scheduled",
        // Update spaInfo for better display
        spaInfo: {
          hasSpaTreatment: true,
          scheduledDateTime: dateTime,
          preference: "scheduled",
          formattedDateTime: format(dateTime, "PPPp", { locale: fr }),
          status: "scheduled",
        },
      });

      // Refresh bookings
      fetchBookingsForMonth(currentMonth);
      setSelectedBooking(null);
    } catch (error) {
      console.error("Error updating booking:", error);
      alert("Failed to update booking.");
    } finally {
      setLoading(false);
    }
  };

  // Handle date selection
  const handleDateSelect = (date) => {
    setSelectedDate(date);
    fetchAvailableSlotsForDate(date);
  };

  // Handle booking a slot
  const handleBookSlot = (date, timeSlot) => {
    if (!selectedBooking) {
      alert("Please select a booking first.");
      return;
    }

    // Create a Date object for the selected date and time
    const [hours, minutes] = timeSlot.split(":").map(Number);
    const dateTime = new Date(date);
    dateTime.setHours(hours, minutes, 0, 0);

    updateBookingSpaDate(selectedBooking.id, dateTime);
  };

  // Render calendar UI
  return (
    <div className="p-4 bg-white rounded-lg shadow">
      <h2 className="mb-4 text-xl font-bold">Calendrier SPA Admin</h2>

      {/* Month navigation */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() =>
            setCurrentMonth(
              new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1)
            )
          }
          className="px-3 py-1 text-sm bg-gray-100 rounded hover:bg-gray-200"
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
          className="px-3 py-1 text-sm bg-gray-100 rounded hover:bg-gray-200"
        >
          Mois suivant
        </button>
      </div>

      {/* Main content area */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {/* Left: Calendar */}
        <div className="p-3 border rounded">
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
              const hasSpaBookings = bookedSlots[dateStr]?.length > 0;

              return (
                <button
                  key={dateStr}
                  onClick={() => handleDateSelect(date)}
                  className={`p-2 text-sm rounded ${
                    isToday ? "bg-blue-100" : ""
                  } ${isSelected ? "bg-blue-500 text-white" : ""}
                  ${hasSpaBookings ? "border border-green-500" : ""}
                  hover:bg-gray-100`}
                >
                  <div className="text-center">{format(date, "d")}</div>
                  {hasSpaBookings && (
                    <div className="w-2 h-2 mx-auto mt-1 bg-green-500 rounded-full"></div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Middle: Bookings to schedule */}
        <div className="p-3 border rounded">
          <h3 className="mb-2 text-lg font-semibold">À programmer</h3>
          {loading ? (
            <div className="p-2 text-center">Chargement...</div>
          ) : (
            <div className="space-y-2">
              {bookings.filter((b) => b.needsScheduling).length === 0 ? (
                <div className="p-2 text-sm text-center text-gray-500">
                  Aucune réservation SPA à programmer
                </div>
              ) : (
                bookings
                  .filter((b) => b.needsScheduling)
                  .map((booking) => (
                    <div
                      key={booking.id}
                      className={`p-2 border rounded cursor-pointer hover:bg-gray-50 ${
                        selectedBooking?.id === booking.id
                          ? "bg-blue-50 border-blue-300"
                          : ""
                      }`}
                      onClick={() => setSelectedBooking(booking)}
                    >
                      <div className="font-semibold">
                        {booking.guestName ||
                          `${booking.firstName} ${booking.lastName}`}
                      </div>
                      <div className="text-xs text-gray-500">
                        Séjour:{" "}
                        {format(new Date(booking.arrivalDate), "dd/MM/yyyy")} -{" "}
                        {format(new Date(booking.departureDate), "dd/MM/yyyy")}
                      </div>
                      <div className="text-xs text-gray-500">
                        Chambre: {booking.property}
                      </div>
                    </div>
                  ))
              )}
            </div>
          )}
        </div>

        {/* Right: Available slots */}
        <div className="p-3 border rounded">
          <h3 className="mb-2 text-lg font-semibold">
            {selectedDate
              ? `Créneaux - ${format(selectedDate, "EEEE d MMMM", {
                  locale: fr,
                })}`
              : "Sélectionnez une date"}
          </h3>

          {selectedDate ? (
            loading ? (
              <div className="p-2 text-center">Chargement des créneaux...</div>
            ) : (
              <div className="space-y-2">
                {availableSlots.length === 0 ? (
                  <div className="p-2 text-sm text-center text-gray-500">
                    Aucun créneau disponible
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {availableSlots.map((slot) => (
                      <button
                        key={slot}
                        onClick={() => handleBookSlot(selectedDate, slot)}
                        disabled={!selectedBooking}
                        className={`p-2 text-sm rounded border ${
                          !selectedBooking
                            ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                            : "bg-white hover:bg-green-50 hover:border-green-500"
                        }`}
                      >
                        {slot}
                      </button>
                    ))}
                  </div>
                )}

                {!selectedBooking && (
                  <div className="p-2 mt-4 text-sm text-center text-yellow-600 rounded bg-yellow-50">
                    Sélectionnez d'abord une réservation à programmer
                  </div>
                )}
              </div>
            )
          ) : (
            <div className="p-2 text-sm text-center text-gray-500">
              Sélectionnez une date pour voir les créneaux disponibles
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SpaCalendar;
