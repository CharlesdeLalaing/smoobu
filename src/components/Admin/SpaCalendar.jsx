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
  const [selectedDateBookings, setSelectedDateBookings] = useState([]);
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
      const apiUrl = "http://localhost:3000";

      console.log(
        `Fetching slots from: ${apiUrl}/api/spa/availability?date=${dateStr}`
      );
      const response = await fetch(
        `${apiUrl}/api/spa/availability?date=${dateStr}`
      );

      if (!response.ok) {
        throw new Error(`API responded with status: ${response.status}`);
      }

      const data = await response.json();
      console.log("Received slots data:", data);

      setAvailableSlots(data.slots || []);
    } catch (error) {
      console.error("Error fetching available slots:", error);
      setAvailableSlots([]);
    } finally {
      setLoading(false);
    }
  };

  // Update a booking's SPA datetime
  const updateBookingSpaDate = async (bookingId, dateTime, spaSlots) => {
    try {
      setLoading(true);
      const bookingRef = doc(db, "bookings", bookingId);

      // Calculate end time (1 hour after start by default, or configured duration)
      const slotDurationMinutes = spaSettings?.slotDurationMinutes || 60;
      const endDateTime = new Date(
        dateTime.getTime() + slotDurationMinutes * 60000
      );

      await updateDoc(bookingRef, {
        spaDateTime: dateTime,
        spaBookingPreference: "scheduled",
        spaSlots: spaSlots, // Save the array of booked slots
        spaEndDateTime: endDateTime, // Add end time
        // Update spaInfo for better display
        spaInfo: {
          hasSpaTreatment: true,
          scheduledDateTime: dateTime,
          endDateTime: endDateTime,
          preference: "scheduled",
          formattedDateTime: format(dateTime, "PPPp", { locale: fr }),
          slots: spaSlots,
          status: "scheduled",
        },
      });

      // Refresh bookings and reset selection
      fetchBookingsForMonth(currentMonth);
      setSelectedBooking(null);

      // Show confirmation
      alert(
        `SPA appointment scheduled for ${format(dateTime, "EEEE d MMMM", {
          locale: fr,
        })} at ${format(dateTime, "HH:mm", { locale: fr })}-${format(
          endDateTime,
          "HH:mm",
          { locale: fr }
        )}`
      );
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

    // Get existing bookings for this date
    const dateStr = format(date, "yyyy-MM-dd");
    const dateBookings = bookings.filter((booking) => {
      if (!booking.spaDateTime) return false;

      // Handle different datetime formats
      const bookingDate = booking.spaDateTime.toDate
        ? booking.spaDateTime.toDate()
        : booking.spaDateTime.seconds
        ? new Date(booking.spaDateTime.seconds * 1000)
        : new Date(booking.spaDateTime);

      return format(bookingDate, "yyyy-MM-dd") === dateStr;
    });

    // Sort bookings by time
    dateBookings.sort((a, b) => {
      const timeA = a.spaDateTime.toDate
        ? a.spaDateTime.toDate()
        : a.spaDateTime.seconds
        ? new Date(a.spaDateTime.seconds * 1000)
        : new Date(a.spaDateTime);

      const timeB = b.spaDateTime.toDate
        ? b.spaDateTime.toDate()
        : b.spaDateTime.seconds
        ? new Date(b.spaDateTime.seconds * 1000)
        : new Date(b.spaDateTime);

      return timeA - timeB;
    });

    setSelectedDateBookings(dateBookings);
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

    // Calculate the next slot time (1 hour later by default)
    const slotDurationMinutes = spaSettings?.slotDurationMinutes || 60;
    const nextSlotDateTime = new Date(dateTime);
    nextSlotDateTime.setMinutes(
      nextSlotDateTime.getMinutes() + slotDurationMinutes
    );

    // Get the time strings for both slots
    const firstSlotTime = format(dateTime, "HH:mm");
    const secondSlotTime = format(nextSlotDateTime, "HH:mm");

    // Include both slots in the update
    const spaSlots = [firstSlotTime, secondSlotTime];

    // Update Firebase document with both slots
    updateBookingSpaDate(selectedBooking.id, dateTime, spaSlots);
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

      {/* Main content area - 3 panels */}
      <div className="grid grid-cols-1 gap-4 mb-6 md:grid-cols-3">
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

              // Find bookings for this date
              const dateSpaBookings = bookings.filter((booking) => {
                if (!booking.spaDateTime) return false;

                const bookingDate = booking.spaDateTime.toDate
                  ? booking.spaDateTime.toDate()
                  : booking.spaDateTime.seconds
                  ? new Date(booking.spaDateTime.seconds * 1000)
                  : new Date(booking.spaDateTime);

                return format(bookingDate, "yyyy-MM-dd") === dateStr;
              });

              const hasSpaBookings = dateSpaBookings.length > 0;

              return (
                <button
                  key={dateStr}
                  onClick={() => handleDateSelect(date)}
                  className={`p-2 text-sm rounded relative ${
                    isToday ? "bg-blue-100" : ""
                  } ${isSelected ? "bg-blue-500 text-white" : ""}
                  hover:bg-gray-100`}
                >
                  <div className="text-center">{format(date, "d")}</div>

                  {/* Show colored dots for each booking */}
                  {hasSpaBookings && (
                    <div className="flex justify-center mt-1 space-x-1">
                      {dateSpaBookings.length <= 3 ? (
                        // Show up to 3 dots
                        dateSpaBookings.map((_, i) => (
                          <div
                            key={i}
                            className="w-2 h-2 bg-green-500 rounded-full"
                            title="SPA booking"
                          ></div>
                        ))
                      ) : (
                        // Show count for more than 3
                        <div className="px-1 text-xs text-green-800 bg-green-100 rounded-full">
                          {dateSpaBookings.length}
                        </div>
                      )}
                    </div>
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
                <h4 className="text-sm font-medium">Créneaux disponibles</h4>
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
                        title={
                          !selectedBooking
                            ? "Sélectionnez d'abord une réservation"
                            : null
                        }
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

      {/* Timeline Section */}
      {/* Timeline Section */}
      {selectedDate && (
        <div className="p-4 mt-4 bg-white border rounded">
          <h3 className="mb-4 text-lg font-semibold">
            Agenda du {format(selectedDate, "EEEE d MMMM", { locale: fr })}
          </h3>

          {/* Timeline header - hours */}
          <div className="flex border-b">
            <div className="w-24 px-2 py-1 text-sm font-medium">Heure</div>
            <div className="flex-1 px-2 py-1 text-sm font-medium">
              Réservations
            </div>
          </div>

          {/* Timeline rows - each hour */}
          <div className="divide-y">
            {Array.from({ length: 10 }, (_, i) => i + 14).map((hour) => {
              // Hours from 14:00 to 23:00
              // Format hour
              const formattedHour = `${hour < 10 ? "0" + hour : hour}:00`;

              // Find bookings that specifically start at this hour
              const startingBookings = selectedDateBookings.filter(
                (booking) => {
                  const startTime = booking.spaDateTime.toDate
                    ? booking.spaDateTime.toDate()
                    : booking.spaDateTime.seconds
                    ? new Date(booking.spaDateTime.seconds * 1000)
                    : new Date(booking.spaDateTime);

                  return format(startTime, "HH:mm") === formattedHour;
                }
              );

              // Get the color for each booking based on apartmentId
              const getPropertyColor = (booking) => {
                // Define a map of apartmentId to color index
                const propertyColors = {
                  2565753: 0, // La Cabane du Chêne - Blue
                  1946282: 1, // Le Dôme des Libellules - Green
                  1644643: 2, // La Bulle du Ruisseau - Purple
                  1946279: 3, // Le Moulin - Yellow
                  1946276: 4, // La Chambre de Blé - Pink
                  1946270: 5, // Le Logis - Orange
                };

                const bgColors = [
                  "bg-blue-100",
                  "bg-green-100",
                  "bg-purple-100",
                  "bg-yellow-100",
                  "bg-pink-100",
                  "bg-orange-100",
                ];
                const textColors = [
                  "text-blue-800",
                  "text-green-800",
                  "text-purple-800",
                  "text-yellow-800",
                  "text-pink-800",
                  "text-orange-800",
                ];
                const borderColors = [
                  "border-blue-300",
                  "border-green-300",
                  "border-purple-300",
                  "border-yellow-300",
                  "border-pink-300",
                  "border-orange-300",
                ];

                // Get color index for this apartmentId (default to 0 if not found)
                const colorIndex = propertyColors[booking.apartmentId] || 0;

                return {
                  bg: bgColors[colorIndex],
                  text: textColors[colorIndex],
                  border: borderColors[colorIndex],
                };
              };

              return (
                <div key={hour} className="flex min-h-[60px]">
                  <div className="w-24 px-2 py-2 text-sm font-medium text-gray-700">
                    {formattedHour}
                  </div>
                  <div className="relative flex-1 py-1">
                    {/* Show bookings that start at this hour */}
                    {startingBookings.map((booking, index) => {
                      const colors = getPropertyColor(booking);
                      // Figure out duration in hours
                      const slotCount = booking.spaSlots
                        ? booking.spaSlots.length
                        : 1;
                      // Double the height for two hours
                      const heightClass =
                        slotCount > 1 ? "h-[120px]" : "h-full";

                      return (
                        <div
                          key={index}
                          className={`w-full ${heightClass} ${colors.bg} ${colors.text} border ${colors.border} rounded p-2 absolute top-0 left-0`}
                          style={{ zIndex: 10 }} // Make sure content is on top
                        >
                          <div className="font-medium">
                            {booking.spaSlots[0]} -{" "}
                            {booking.spaSlots[booking.spaSlots.length - 1]}
                          </div>
                          <div>
                            {booking.guestName ||
                              `${booking.firstName} ${booking.lastName}`}
                          </div>
                          <div className="text-xs">{booking.property}</div>
                        </div>
                      );
                    })}

                    {/* If hour is not the start of a booking, leave it empty */}
                    {startingBookings.length === 0 && (
                      <div className="h-full border-l border-gray-200 border-dashed"></div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {selectedDateBookings.length === 0 && (
            <div className="p-4 text-center text-gray-500">
              Aucune réservation SPA pour cette date
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SpaCalendar;