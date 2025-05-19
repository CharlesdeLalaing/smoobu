// File: src/hooks/BookingReport/useBookingsData.js
import { useState, useEffect, useCallback } from "react";
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { db } from "../../../firebase.js"; // Verify this path is correct for your project structure
import * as XLSX from "xlsx";
import axios from "axios";
import {
  getCleanExtrasFromPriceElements,
  mergeAndSortExtras,
} from "../../Admin/BookingReport/utils/extrasUtils.js"; // Verify this path


import { parseBookingDateTime } from "../../spa/spaCalendarUtils.jsx";


import { parseISO, isValid } from "date-fns"; 

export const useBookingsData = () => {
  const [reportData, setReportData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deduplicating, setDeduplicating] = useState(false);

  const [startMonth, setStartMonth] = useState(new Date().getMonth() + 1);
  const [startYear, setStartYear] = useState(new Date().getFullYear());
  const [endMonth, setEndMonth] = useState(new Date().getMonth() + 1);
  const [endYear, setEndYear] = useState(new Date().getFullYear());

  useEffect(() => {
    if (startMonth === endMonth && startYear === endYear) {
      setEndMonth(startMonth);
    }
  }, [startMonth, startYear, endMonth, endYear]);

  useEffect(() => {
    if (startYear === endYear) {
      setEndYear(startYear);
    }
  }, [startYear, endYear]);

  useEffect(() => {
    if (
      endYear < startYear ||
      (endYear === startYear && endMonth < startMonth)
    ) {
      setEndYear(startYear);
      setEndMonth(startMonth);
    }
  }, [startYear, startMonth, endYear, endMonth]);

  const processBookingData = (bookingInput, bookingMap) => {
    // bookingInput is an object from Firestore with its Firestore doc ID as 'id'
    try {
      const {
        id, // Firestore document ID
        smoobuId,
        smoobuReservationId,
        firstName,
        lastName,
        guestName,
        email,
        phone,
        address,
        street,
        postalCode,
        location,
        country,
        adults,
        children,
        arrivalDate,
        departureDate,
        checkInTime,
        checkOutTime,
        nights,
        property,
        apartmentId,
        channelId,
        channelName,
        portalName,
        price,
        basePrice,
        linenFee,
        commission,
        deposit,
        depositStatus,
        priceStatus,
        paymentIntentId,
        stripePaymentStatus,
        extras,
        priceDetails,
        couponApplied,
        appliedCoupon,
        conditions,
        language,
        createdAt,
        updatedAt,
        lastSyncedAt,
        // Raw SPA fields from Firestore
        spaDateTime,
        spaEndDateTime,
        spaBookingPreference,
        spaInfo,
        spaSlots,
      } = bookingInput;

      // --- PARSE DATES ---
      const arrivalDateObj = arrivalDate ? parseISO(arrivalDate) : null;
      const departureDateObj = departureDate ? parseISO(departureDate) : null;

      const spaDateTimeObj = parseBookingDateTime(spaDateTime);
      const spaEndDateTimeObj = parseBookingDateTime(spaEndDateTime);

      let spaInfoProcessed = null;
      if (spaInfo) {
        spaInfoProcessed = {
          ...spaInfo,
          scheduledDateTimeObj: parseBookingDateTime(spaInfo.scheduledDateTime),
          endDateTimeObj: parseBookingDateTime(spaInfo.endDateTime),
        };
      }
      // --- END PARSE DATES ---

      const formattedBooking = {
        id: smoobuId || smoobuReservationId || id, // Smoobu ID is primary, fallback to Firestore ID
        firestoreId: id, // Keep Firestore document ID
        guest: guestName || `${firstName || ""} ${lastName || ""}`.trim(),
        email: email || "",
        phone: phone || "",
        address:
          address ||
          `${street || ""} ${postalCode || ""} ${location || ""} ${
            country || ""
          }`.trim(),
        adults: Number(adults) || 0,
        children: Number(children) || 0,
        checkIn: arrivalDate, // Keep original string for basic display if needed
        arrivalTime: checkInTime || "",
        checkOut: departureDate, // Keep original string
        departureTime: checkOutTime || "",
        nights: Number(nights) || 0,
        property: property || "",
        apartmentId: apartmentId || "",
        portal: portalName || channelName || "",
        channelId: channelId,
        price: Number(price) || 0,
        basePrice: Number(basePrice) || 0,
        linenFee: Number(linenFee) || 0,
        commission: Number(commission) || 0,
        extras: extras || [],
        priceDetails: priceDetails || {},
        coupon: appliedCoupon || couponApplied || null,
        created: createdAt || new Date().toISOString(), // Fallback for created
        updated: updatedAt || lastSyncedAt || new Date().toISOString(), // Fallback for updated

        // --- ADD/OVERWRITE WITH PARSED DATE OBJECTS ---
        arrivalDateObj:
          arrivalDateObj && isValid(arrivalDateObj) ? arrivalDateObj : null,
        departureDateObj:
          departureDateObj && isValid(departureDateObj)
            ? departureDateObj
            : null,
        spaDateTimeObj: spaDateTimeObj, // This is now a Date object or null
        spaEndDateTimeObj: spaEndDateTimeObj, // This is now a Date object or null

        // Store original raw SPA fields if needed for any reason, but prefer ...Obj
        spaDateTime: spaDateTime, // Raw original value
        spaEndDateTime: spaEndDateTime, // Raw original value
        spaBookingPreference: spaBookingPreference,
        spaInfo: spaInfoProcessed, // spaInfo with its own ...Obj dates
        spaSlots: spaSlots,

        hasSpaBooking: !!(
          spaDateTimeObj ||
          spaBookingPreference ||
          spaInfoProcessed?.hasSpaTreatment
        ),
      };

      // Optional detailed logging for the specific problematic booking
      if (
        formattedBooking.id === "97475833" ||
        (spaDateTime &&
          typeof spaDateTime === "object" &&
          spaDateTime._seconds === 1747746000)
      ) {
        console.log(
          `useBookingsData -> processBookingData (FINAL for ID: ${formattedBooking.id}):`
        );
        console.log(
          `   Formatted spaDateTimeObj:`,
          formattedBooking.spaDateTimeObj
        );
        console.log(
          `   Is Formatted spaDateTimeObj valid:`,
          formattedBooking.spaDateTimeObj
            ? isValid(formattedBooking.spaDateTimeObj)
            : "N/A"
        );
      }

      bookingMap.set(formattedBooking.id, formattedBooking);
      // No explicit return needed as we are modifying bookingMap by reference
    } catch (error) {
      console.error(
        "Error processing booking data in useBookingsData:",
        error,
        bookingInput
      );
      // Optionally, you might want to skip adding this booking to the map or add a flag
    }
  };

  const calculateCompletenessScore = (booking) => {
    let score = 0;
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
    // SPA data score (using parsed objects if available, or raw as fallback for scoring)
    if (booking.spaDateTimeObj || booking.spaDateTime) score += 5; // Check parsed first
    if (booking.spaBookingPreference) score += 3;
    if (booking.spaInfo?.hasSpaTreatment || booking.spaInfo) score += 5; // Check processed or raw
    if (booking.spaSlots && booking.spaSlots.length) score += 3;
    if (booking.updatedAt) {
      const updateDate = parseBookingDateTime(booking.updatedAt); // Use parser for safety
      if (updateDate && isValid(updateDate)) {
        const daysAgo =
          (Date.now() - updateDate.getTime()) / (1000 * 60 * 60 * 24);
        score += Math.max(0, 1 - daysAgo / 100);
      }
    }
    return score;
  };

  const fetchFromFirebase = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const startDate = new Date(startYear, startMonth - 1, 1);
      const endDate = new Date(endYear, endMonth, 0, 23, 59, 59);
      // console.log("Fetching data with date range:", { startDateStr: startDate.toISOString().split("T")[0], endDateStr: endDate.toISOString().split("T")[0] });

      const bookingsRef = collection(db, "bookings");
      const q = query(
        bookingsRef,
        where("arrivalDate", ">=", startDate.toISOString().split("T")[0]),
        where("arrivalDate", "<=", endDate.toISOString().split("T")[0]),
        orderBy("arrivalDate", "desc")
      );
      const querySnapshot = await getDocs(q);
      // console.log(`Query returned ${querySnapshot.docs.length} documents`);

      const bookingsBySmoobuId = {};
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        const smoobuId = data.smoobuId || data.smoobuReservationId;
        if (!smoobuId) {
          // console.warn("Skipping document without Smoobu ID:", doc.id, data);
          return;
        }
        if (!bookingsBySmoobuId[smoobuId]) {
          bookingsBySmoobuId[smoobuId] = [];
        }
        // Push the raw data along with the Firestore ID
        bookingsBySmoobuId[smoobuId].push({ id: doc.id, ...data });
      });

      const bookingMap = new Map();
      Object.entries(bookingsBySmoobuId).forEach(([smoobuId, bookingsList]) => {
        if (bookingsList.length === 1) {
          processBookingData(bookingsList[0], bookingMap);
        } else {
          bookingsList.sort(
            (a, b) =>
              calculateCompletenessScore(b) - calculateCompletenessScore(a)
          );
          processBookingData(bookingsList[0], bookingMap); // Process the "best" one
        }
      });

      const finalBookingsArray = Array.from(bookingMap.values());
      // Log the specific booking if found in the final array
      // const problemBooking = finalBookingsArray.find(b => b.id === "97475833" || (b.spaDateTime && typeof b.spaDateTime === 'object' && b.spaDateTime._seconds === 1747746000) );
      // if (problemBooking) {
      //   console.log("useBookingsData -> fetchFromFirebase (Problematic Booking in FINAL ARRAY):", problemBooking.id, "spaDateTimeObj:", problemBooking.spaDateTimeObj, "isValid:", problemBooking.spaDateTimeObj ? isValid(problemBooking.spaDateTimeObj) : 'N/A');
      // }

      setReportData(finalBookingsArray);
    } catch (err) {
      console.error("Error fetching bookings from Firebase:", err);
      setError("Failed to fetch bookings: " + err.message);
    } finally {
      setLoading(false);
    }
  }, [startMonth, startYear, endMonth, endYear]); // Dependencies kept as per original

  useEffect(() => {
    fetchFromFirebase();
  }, [fetchFromFirebase]);

  const handleFetchAndSync = async () => {
    try {
      setLoading(true);
      const backendUrl =
        import.meta.env.VITE_API_URL || "http://localhost:3000";
      const response = await axios.get(`${backendUrl}/api/fetch-and-sync`, {
        params: {
          startDate: new Date(startYear - 1, startMonth - 1, 1)
            .toISOString()
            .split("T")[0],
          endDate: new Date(endYear, endMonth, 0).toISOString().split("T")[0],
        },
      });
      if (response.data.success) {
        alert(
          `Fetch and sync completed!\nFetched: ${response.data.stats.fetched}\nAdded: ${response.data.stats.added}\nUpdated: ${response.data.stats.updated}`
        );
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
      const backendUrl =
        import.meta.env.VITE_API_URL || "http://localhost:3000"; // Use consistent backendUrl
      const response = await axios.get(
        `${backendUrl}/api/deduplicate-bookings`
      );
      if (response.data.success) {
        alert(
          `Deduplication completed!\nFound ${response.data.stats.duplicateGroups} groups\nDeleted ${response.data.stats.deletedBookings} entries`
        );
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
        "Logement",
        "Email",
        "Téléphone",
        "Adresse",
        "Adulte",
        "Enfant",
        "Arrivée",
        "Check-in",
        "Départ",
        "Nuits",
        "Prix Base",
        "Coupon Nom",
        "Coupon Val.",
        "Frais Linge",
        "Promo Long",
        "Commission",
        "SPA",
        "Extras Liste",
        "Extras Total",
        "Prix Total",
        "Prix Sans Coupon",
      ],
      ...reportData.map((booking) => {
        const portalName =
          booking.portalName || booking.channelName || booking.portal;
        const isBookingCom = portalName === "Booking.com";
        let displayExtras = [];
        if (booking.priceDetails?.priceElements?.length > 0) {
          displayExtras = getCleanExtrasFromPriceElements(
            booking.priceDetails.priceElements,
            portalName
          );
          if (isBookingCom)
            displayExtras = displayExtras.filter(
              (extra) =>
                !extra.name.includes("TVA") &&
                !extra.name.toLowerCase().includes("taxe de séjour")
            );
        } else if (booking.extras?.length > 0) {
          displayExtras = booking.extras;
          if (isBookingCom)
            displayExtras = displayExtras.filter(
              (extra) =>
                !extra.name.includes("TVA") &&
                !extra.name.toLowerCase().includes("taxe de séjour")
            );
        }
        const mergedAndSortedExtras = mergeAndSortExtras(displayExtras);
        const extrasTotal = mergedAndSortedExtras.reduce(
          (sum, extra) => sum + parseFloat(extra.amount || 0),
          0
        );
        const extrasList = mergedAndSortedExtras
          .map(
            (extra) =>
              `${extra.name}${
                parseInt(extra.quantity || 1, 10) > 1
                  ? ` (${extra.quantity}x)`
                  : ""
              }`
          )
          .join(", ");

        let spaInfoExport = "-";
        if (booking.spaDateTimeObj && isValid(booking.spaDateTimeObj)) {
          // Use spaDateTimeObj
          try {
            spaInfoExport = booking.spaDateTimeObj.toLocaleString("fr-BE", {
              dateStyle: "short",
              timeStyle: "short",
            });
          } catch (e) {
            spaInfoExport = "Date programmée (err format)";
          }
        } else if (booking.spaBookingPreference === "later") {
          spaInfoExport = "À programmer";
        } else if (booking.spaBookingPreference === "scheduled") {
          // If pref is scheduled but obj is bad
          spaInfoExport = "Date Programmée Invalide";
        }

        // Ensure arrival/departure dates for export are valid before formatting
        const arrivalExport =
          booking.arrivalDateObj && isValid(booking.arrivalDateObj)
            ? booking.arrivalDateObj.toLocaleDateString("fr-FR")
            : booking.checkIn || "N/A"; // Fallback to original string or N/A
        const departureExport =
          booking.departureDateObj && isValid(booking.departureDateObj)
            ? booking.departureDateObj.toLocaleDateString("fr-FR")
            : booking.checkOut || "N/A"; // Fallback to original string or N/A
        const createdExport = parseBookingDateTime(booking.created); // Parse created date string

        return [
          booking.id,
          booking.guest,
          createdExport && isValid(createdExport)
            ? createdExport.toLocaleDateString("fr-FR")
            : booking.created,
          booking.portal,
          booking.property || "",
          booking.email || "",
          booking.phone || "",
          booking.address || "",
          booking.adults,
          booking.children,
          arrivalExport,
          booking.arrivalTime || "",
          departureExport,
          booking.nights,
          booking.priceDetails?.basePrice || 0,
          booking.priceDetails?.promoCode?.name || "",
          booking.priceDetails?.promoCode?.amount || "",
          booking.priceDetails?.linenFee || 0, // Ensure numeric
          booking.priceDetails?.longStayDiscount || 0, // Ensure numeric
          booking.commission || 0, // Ensure numeric
          spaInfoExport,
          extrasList || "",
          extrasTotal || 0,
          booking.price,
          parseFloat(booking.price || 0) +
            parseFloat(booking.priceDetails?.promoCode?.amount || 0),
        ];
      }),
    ];
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const colWidths = [
      { wch: 15 },
      { wch: 25 },
      { wch: 20 },
      { wch: 20 },
      { wch: 25 },
      { wch: 30 },
      { wch: 20 },
      { wch: 35 },
      { wch: 10 },
      { wch: 10 },
      { wch: 15 },
      { wch: 15 },
      { wch: 15 },
      { wch: 10 },
      { wch: 15 },
      { wch: 20 },
      { wch: 15 },
      { wch: 15 },
      { wch: 20 },
      { wch: 15 },
      { wch: 25 },
      { wch: 50 },
      { wch: 15 },
      { wch: 15 },
      { wch: 18 },
    ];
    ws["!cols"] = colWidths;
    const priceColumns = [14, 16, 17, 18, 19, 22, 23, 24]; // Adjusted for SPA column
    priceColumns.forEach((col) => {
      const range = XLSX.utils.decode_range(ws["!ref"]);
      for (let row = 1; row <= range.e.r; row++) {
        const cellRef = XLSX.utils.encode_cell({ r: row, c: col });
        if (ws[cellRef] && typeof ws[cellRef].v === "number")
          ws[cellRef].z = "#,##0.00 €";
      }
    });
    XLSX.utils.book_append_sheet(wb, ws, "Rapport Réservations");
    const startDateStr = `${startYear}-${String(startMonth).padStart(2, "0")}`;
    const endDateStr = `${endYear}-${String(endMonth).padStart(2, "0")}`;
    XLSX.writeFile(
      wb,
      `rapport-reservations_${startDateStr}_${endDateStr}.xlsx`
    );
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
