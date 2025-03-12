// File: src/hooks/useBookingsData.js
import { useState, useEffect, useCallback } from "react";
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { db } from "../../../firebase.js";
import * as XLSX from "xlsx";
import axios from "axios";
import { processBookingData } from "../../utils/bookingProcessors.js";

export const useBookingsData = () => {
  const [reportData, setReportData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deduplicating, setDeduplicating] = useState(false);

  // Keep date state in this hook, matching the original implementation
  const [startMonth, setStartMonth] = useState(new Date().getMonth() + 1);
  const [startYear, setStartYear] = useState(new Date().getFullYear());
  const [endMonth, setEndMonth] = useState(new Date().getMonth() + 1);
  const [endYear, setEndYear] = useState(new Date().getFullYear());

  // Add this effect to sync months and years when appropriate
  useEffect(() => {
    // If start and end months were the same before the change
    // then update end month to match the new start month
    if (startMonth === endMonth && startYear === endYear) {
      setEndMonth(startMonth);
    }
  }, [startMonth, startYear, endMonth, endYear]);

  // Similar for years
  useEffect(() => {
    // If years were the same, keep them in sync
    if (startYear === endYear) {
      setEndYear(startYear);
    }
  }, [startYear, endYear]);

  // Ensure end date is not before start date
  useEffect(() => {
    if (
      endYear < startYear ||
      (endYear === startYear && endMonth < startMonth)
    ) {
      setEndYear(startYear);
      setEndMonth(startMonth);
    }
  }, [startYear, startMonth, endYear, endMonth]);

  // Fetch data from Firebase - keep dependency array matching original
  const fetchFromFirebase = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Create date range for query
      const startDate = new Date(startYear, startMonth - 1, 1);
      const endDate = new Date(endYear, endMonth, 0, 23, 59, 59);

      console.log("Fetching data with date range:", {
        startMonth,
        startYear,
        endMonth,
        endYear,
        startDateStr: startDate.toISOString().split("T")[0],
        endDateStr: endDate.toISOString().split("T")[0],
      });

      // Create Firebase query
      const bookingsRef = collection(db, "bookings");
      const q = query(
        bookingsRef,
        where("arrivalDate", ">=", startDate.toISOString().split("T")[0]),
        where("arrivalDate", "<=", endDate.toISOString().split("T")[0]),
        orderBy("arrivalDate", "desc")
      );

      const querySnapshot = await getDocs(q);
      console.log(`Query returned ${querySnapshot.docs.length} documents`);

      // Create a map for deduplicated bookings
      const bookingMap = new Map();

      // First, go through all documents and group by smoobuId
      const bookingsBySmoobuId = {};
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        const smoobuId = data.smoobuId || data.smoobuReservationId;

        if (!smoobuId) return; // Skip entries without smoobuId

        if (!bookingsBySmoobuId[smoobuId]) {
          bookingsBySmoobuId[smoobuId] = [];
        }

        bookingsBySmoobuId[smoobuId].push({
          id: doc.id,
          ...data,
          firestoreId: doc.id, // Store the Firestore document ID
        });
      });

      // For each smoobuId, pick the most complete entry
      Object.entries(bookingsBySmoobuId).forEach(([smoobuId, bookings]) => {
        if (bookings.length === 1) {
          // If only one entry, use it
          const booking = bookings[0];
          processBookingData(booking, bookingMap);
        } else {
          // If multiple entries, choose the one with the most data
          bookings.sort((a, b) => {
            // Calculate "completeness" score
            const scoreA = calculateCompletenessScore(a);
            const scoreB = calculateCompletenessScore(b);

            // Higher score is more complete
            return scoreB - scoreA;
          });

          // Use the most complete entry
          const bestBooking = bookings[0];
          processBookingData(bestBooking, bookingMap);
        }
      });

      // Convert map values to array
      const bookings = Array.from(bookingMap.values());
      setReportData(bookings);
    } catch (err) {
      console.error("Error fetching bookings from Firebase:", err);
      setError("Failed to fetch bookings: " + err.message);
    } finally {
      setLoading(false);
    }
  }, [startMonth, startYear, endMonth, endYear]); // Match original dependency array

  // Call fetchFromFirebase when the hook is first used
  useEffect(() => {
    fetchFromFirebase();
  }, [fetchFromFirebase]);

  // Helper function to calculate how complete a booking record is
  const calculateCompletenessScore = (booking) => {
    let score = 0;

    // Check for key data that indicates a complete record
    if (booking.extras && booking.extras.length > 0) score += 10;
    if (
      booking.priceDetails?.priceElements &&
      booking.priceDetails.priceElements.length > 0
    )
      score += 5;
    if (booking.priceDetails?.extrasTotal) score += 3;
    if (booking.commission) score += 2;
    if (booking.linenFee) score += 2;
    if (booking.email) score += 1;
    if (booking.phone) score += 1;
    if (booking.address) score += 1;
    if (booking.notes) score += 1;

    // More recent updates are preferred
    if (booking.updatedAt) {
      const updateDate = new Date(booking.updatedAt);
      if (!isNaN(updateDate)) {
        // Add a small score based on recency (newer is better)
        const daysAgo = (Date.now() - updateDate) / (1000 * 60 * 60 * 24);
        score += Math.max(0, 1 - daysAgo / 100); // Small bonus for recency
      }
    }

    return score;
  };

  const handleFetchAndSync = async () => {
    try {
      setLoading(true);

      // UPDATED: Call your production server endpoint instead of localhost
      const response = await axios.get(
        "https://booking-9u8u.onrender.com/api/fetch-and-sync",
        {
          params: {
            startDate: new Date(startYear - 1, startMonth - 1, 1)
              .toISOString()
              .split("T")[0],
            endDate: new Date(endYear, endMonth, 0).toISOString().split("T")[0],
          },
        }
      );

      if (response.data.success) {
        alert(
          `Fetch and sync completed successfully!\nFetched: ${response.data.stats.fetched}\nAdded: ${response.data.stats.added}\nUpdated: ${response.data.stats.updated}`
        );

        // Refresh data from Firebase
        fetchFromFirebase();
      } else {
        throw new Error(response.data.error || "Fetch and sync failed");
      }
    } catch (error) {
      console.error("Error in fetch and sync:", error);
      alert(`Failed to fetch and sync: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDeduplicate = async () => {
    try {
      setDeduplicating(true);

      // UPDATED: Call your production server endpoint instead of localhost
      const response = await axios.get(
        "https://booking-9u8u.onrender.com/api/deduplicate-bookings"
      );

      if (response.data.success) {
        alert(
          `Deduplication completed successfully!\n` +
            `Found ${response.data.stats.duplicateGroups} bookings with duplicates\n` +
            `Deleted ${response.data.stats.deletedBookings} duplicate entries`
        );

        // Refresh data from Firebase
        fetchFromFirebase();
      } else {
        throw new Error(response.data.error || "Deduplication failed");
      }
    } catch (error) {
      console.error("Error in deduplication:", error);
      alert(`Failed to deduplicate: ${error.message}`);
    } finally {
      setDeduplicating(false);
    }
  };

  const handleExport = () => {
    const wsData = [
      [
        "ID",
        "Client",
        "Création",
        "Portail",
        "Email",
        "Téléphone",
        "Adresse",
        "Adulte",
        "Enfant",
        "Arrivée",
        "Check-in",
        "Départ",
        "Nombre de nuits",
        "Prix de base",
        "Nom coupon",
        "Valeur coupon",
        "Frais de linge",
        "Promotion long séjour",
        "Commission",
        "Liste des extras",
        "Total des extras",
        "Prix total",
      ],
      ...reportData.map((booking) => [
        booking.id,
        booking.guest,
        new Date(booking.created).toLocaleDateString("fr-FR"),
        booking.portal,
        booking.email || "",
        booking.phone || "",
        booking.address || "",
        booking.adults,
        booking.children,
        new Date(booking.checkIn).toLocaleDateString("fr-FR"),
        booking.arrivalTime || "",
        new Date(booking.checkOut).toLocaleDateString("fr-FR"),
        booking.nights,
        booking.priceDetails?.basePrice || 0,
        booking.priceDetails?.promoCode?.name || "",
        booking.priceDetails?.promoCode?.amount || "",
        booking.priceDetails?.linenFee || "",
        booking.priceDetails?.longStayDiscount || "",
        booking.commission || "",
        booking.extras?.map((e) => `${e.name} (${e.quantity}x)`).join(", ") ||
          "",
        booking.extras?.reduce(
          (sum, extra) => sum + parseFloat(extra.amount || 0),
          0
        ) || 0,
        booking.price,
      ]),
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    const colWidths = [
      { wch: 15 }, // ID de réservation
      { wch: 25 }, // Client
      { wch: 20 }, // Création de la réservation
      { wch: 20 }, // Portail de réservation
      { wch: 30 }, // Email du client
      { wch: 20 }, // Téléphone du client
      { wch: 35 }, // Adresse du client
      { wch: 15 }, // Nombre d'adulte
      { wch: 15 }, // Nombre d'enfant
      { wch: 15 }, // Arrivée
      { wch: 15 }, // Check-in
      { wch: 15 }, // Départ
      { wch: 15 }, // Nombre de nuits
      { wch: 15 }, // Prix de base
      { wch: 20 }, // Nom du coupon
      { wch: 15 }, // Valeur du coupon
      { wch: 15 }, // Frais de linge
      { wch: 20 }, // Promotion de long séjour
      { wch: 15 }, // Commission
      { wch: 50 }, // Liste des extras
      { wch: 15 }, // Total des extras
      { wch: 15 }, // Prix total de la chambre
    ];

    ws["!cols"] = colWidths;

    XLSX.utils.book_append_sheet(wb, ws, "Rapport Réservations");

    const startDate = `${startYear}-${String(startMonth).padStart(2, "0")}`;
    const endDate = `${endYear}-${String(endMonth).padStart(2, "0")}`;
    const fileName = `rapport-reservations_${startDate}_${endDate}.xlsx`;

    XLSX.writeFile(wb, fileName);
  };

  return {
    reportData,
    loading,
    error,
    startMonth,
    setStartMonth,
    startYear,
    setStartYear,
    endMonth,
    setEndMonth,
    endYear,
    setEndYear,
    fetchFromFirebase,
    handleFetchAndSync,
    handleDeduplicate,
    handleExport,
    deduplicating,
  };
};
