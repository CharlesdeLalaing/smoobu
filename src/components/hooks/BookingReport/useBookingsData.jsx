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


import { parseBookingDateTime } from "../../spa/spaCalendarUtils.js";


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
    // bookingInput is an object from Firestore, enriched with its Firestore doc ID as 'id'
    // by the calling code in fetchFromFirebase
    try {
      const {
        id, // This is the Firestore document ID
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
        arrivalDate, // Expected as "YYYY-MM-DD" string
        departureDate, // Expected as "YYYY-MM-DD" string
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
        // Raw SPA fields from Firestore (could be Timestamp objects or plain { _seconds, _nanoseconds } objects)
        spaDateTime,
        spaEndDateTime,
        spaBookingPreference,
        spaInfo, // This object itself might contain nested date-like structures
        spaSlots,
      } = bookingInput;

      // --- PARSE DATES ---
      const arrivalDateObj = arrivalDate ? parseISO(arrivalDate) : null;
      const departureDateObj = departureDate ? parseISO(departureDate) : null;

      const rawSpaDateTimeFromInput = spaDateTime;
      const rawSpaEndDateTimeFromInput = spaEndDateTime;

      const tempSpaDateTimeObj = parseBookingDateTime(rawSpaDateTimeFromInput);
      const tempSpaEndDateTimeObj = parseBookingDateTime(
        rawSpaEndDateTimeFromInput
      );

      const createdDateObj = parseBookingDateTime(createdAt); // Also parse createdAt if used as Date
      const updatedDateObj = parseBookingDateTime(updatedAt || lastSyncedAt); // And updatedAt/lastSyncedAt

      // --- CRITICAL LOGGING INSIDE useBookingsData.js -> processBookingData ---
      const bookingIdentifierForLog = id; // Using Firestore doc ID from bookingInput

      if (bookingIdentifierForLog === "0QuPIsh53w00kiBINavp") {
        console.log(
          `--- Debugging useBookingsData.js -> processBookingData for Booking ID: ${bookingIdentifierForLog} ---`
        );
        console.log(
          "   Input bookingInput.spaDateTime:",
          JSON.stringify(rawSpaDateTimeFromInput)
        );
        // parseBookingDateTime should log its own internal steps if those logs are still active
        console.log(
          "   Output of parseBookingDateTime for spaDateTime (tempSpaDateTimeObj):",
          tempSpaDateTimeObj
        );
        console.log(
          "     Is tempSpaDateTimeObj a Date instance?",
          tempSpaDateTimeObj instanceof Date
        );
        console.log(
          "     Is tempSpaDateTimeObj valid (date-fns isValid)?",
          tempSpaDateTimeObj
            ? isValid(tempSpaDateTimeObj)
            : "N/A (value is null/undefined)"
        );
        if (tempSpaDateTimeObj && isValid(tempSpaDateTimeObj)) {
          console.log(
            "     tempSpaDateTimeObj.toString():",
            tempSpaDateTimeObj.toString()
          );
        }

        console.log(
          "   Input bookingInput.spaEndDateTime:",
          JSON.stringify(rawSpaEndDateTimeFromInput)
        );
        console.log(
          "   Output of parseBookingDateTime for spaEndDateTime (tempSpaEndDateTimeObj):",
          tempSpaEndDateTimeObj
        );
        console.log(
          "     Is tempSpaEndDateTimeObj a Date instance?",
          tempSpaEndDateTimeObj instanceof Date
        );
        console.log(
          "     Is tempSpaEndDateTimeObj valid (date-fns isValid)?",
          tempSpaEndDateTimeObj
            ? isValid(tempSpaEndDateTimeObj)
            : "N/A (value is null/undefined)"
        );
        if (tempSpaEndDateTimeObj && isValid(tempSpaEndDateTimeObj)) {
          console.log(
            "     tempSpaEndDateTimeObj.toString():",
            tempSpaEndDateTimeObj.toString()
          );
        }
        console.log(
          `--- End Debugging useBookingsData.js for Booking ID: ${bookingIdentifierForLog} ---`
        );
      }
      // --- END CRITICAL LOGGING ---

      let spaInfoProcessed = null;
      if (spaInfo) {
        spaInfoProcessed = {
          ...spaInfo,
          // Ensure nested dates within spaInfo are also parsed if they exist and are used
          scheduledDateTimeObj: parseBookingDateTime(spaInfo.scheduledDateTime),
          endDateTimeObj: parseBookingDateTime(spaInfo.endDateTime),
        };
      }

      const formattedBooking = {
        id: smoobuId || smoobuReservationId || id, // Prefer Smoobu ID for report, fallback to Firestore ID
        firestoreId: id, // Explicitly store Firestore document ID
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
        checkIn: arrivalDate, // Keep original string for display or simple cases
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
        coupon: appliedCoupon || couponApplied || null, // Keep the more detailed coupon object if available
        created: createdAt, // Keep original string
        updated: updatedAt || lastSyncedAt, // Keep original string

        // --- ADD/OVERWRITE WITH PARSED JAVASCRIPT DATE OBJECTS ---
        arrivalDateObj:
          arrivalDateObj && isValid(arrivalDateObj) ? arrivalDateObj : null,
        departureDateObj:
          departureDateObj && isValid(departureDateObj)
            ? departureDateObj
            : null,
        spaDateTimeObj: tempSpaDateTimeObj, // Assign the parsed object
        spaEndDateTimeObj: tempSpaEndDateTimeObj, // Assign the parsed object
        createdDateObj:
          createdDateObj && isValid(createdDateObj) ? createdDateObj : null,
        updatedDateObj:
          updatedDateObj && isValid(updatedDateObj) ? updatedDateObj : null,

        // Keep original raw SPA fields as well, in case they are needed for some other logic
        // though the ...Obj versions should be prioritized for date operations.
        spaDateTime: rawSpaDateTimeFromInput,
        spaEndDateTime: rawSpaEndDateTimeFromInput,
        spaBookingPreference: spaBookingPreference,
        spaInfo: spaInfoProcessed, // Use the version of spaInfo that has its own dates parsed
        spaSlots: spaSlots,

        hasSpaBooking: !!(
          tempSpaDateTimeObj ||
          spaBookingPreference ||
          spaInfoProcessed?.hasSpaTreatment
        ),
      };

      bookingMap.set(formattedBooking.id, formattedBooking);
      // No explicit return is strictly necessary as bookingMap is modified by reference.
      // However, if other parts of the code expect it, you can return formattedBooking.
      // For the current structure of fetchFromFirebase, modifying bookingMap is sufficient.
    } catch (error) {
      console.error(
        "Error processing booking data in useBookingsData (booking ID: " +
          (bookingInput?.id || "N/A") +
          "):",
        error,
        bookingInput
      );
      // Decide how to handle: skip this booking, add it with an error flag, etc.
      // For now, it just logs and this booking won't be added to the map if an error occurs before map.set.
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
      // Header row
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
        "Prix Base (€)",
        "Nom Coupon Appliqué",
        "Valeur Coupon (€)",
        "Frais Linge (€)",
        "Promo Long Séjour (€)",
        "Commission (€)",
        "SPA",
        "Extras Liste",
        "Extras Total (€)",
        "Prix Total Payé (€)",
        "Prix Sans Coupon (€)",
      ],
      ...reportData.map((booking) => {
        // Extras processing logic (assuming this part is correct from your previous code)
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

        // --- CORRECTED COUPON LOGIC FOR EXPORT ---
        let exportCouponName = "";
        let exportCouponValue = 0; // Should be the monetary value of the discount

        if (
          booking.coupon &&
          typeof booking.coupon.code === "string" &&
          booking.coupon.code.trim() !== ""
        ) {
          exportCouponName = booking.coupon.code;
        } else if (booking.appliedCoupon?.code) {
          // Fallback
          exportCouponName = booking.appliedCoupon.code;
        } else if (booking.couponApplied?.code) {
          // Further fallback
          exportCouponName = booking.couponApplied.code;
        } else if (
          booking.priceDetails?.promoCode?.code &&
          booking.priceDetails.promoCode.code.toLowerCase() !== "code"
        ) {
          exportCouponName = booking.priceDetails.promoCode.code;
        } else if (
          booking.priceDetails?.promoCode?.name &&
          booking.priceDetails.promoCode.name.toLowerCase() !== "code" &&
          exportCouponName === ""
        ) {
          exportCouponName = booking.priceDetails.promoCode.name;
        }
        // If still no specific name, and there's a discount, use a generic placeholder
        if (
          exportCouponName === "" &&
          (booking.priceDetails?.couponDiscount ||
            booking.priceDetails?.promoCode?.amount)
        ) {
          exportCouponName = "PROMO APPLIQUÉ";
        }

        // Get the monetary discount value
        if (typeof booking.priceDetails?.couponDiscount === "number") {
          exportCouponValue = parseFloat(booking.priceDetails.couponDiscount);
        } else if (
          typeof booking.priceDetails?.promoCode?.amount === "number"
        ) {
          exportCouponValue = parseFloat(booking.priceDetails.promoCode.amount);
        } else if (
          booking.coupon?.discount &&
          booking.coupon?.type !== "percentage"
        ) {
          exportCouponValue = parseFloat(booking.coupon.discount);
        }
        // Ensure coupon value is negative for display if it's a discount and a coupon was applied
        if (exportCouponValue > 0 && exportCouponName !== "") {
          exportCouponValue = -exportCouponValue;
        } else if (exportCouponName === "" && exportCouponValue !== 0) {
          // If there's a value but no name, something is off, but still record the value
          // Potentially make it negative if it's a positive discount amount without a clear coupon code
          if (
            exportCouponValue > 0 &&
            (booking.priceDetails?.couponDiscount > 0 ||
              booking.priceDetails?.promoCode?.amount > 0)
          ) {
            exportCouponValue = -exportCouponValue;
          }
        }
        // --- END CORRECTED COUPON LOGIC ---

        // SPA info export (uses booking.spaDateTimeObj)
        let spaInfoExport = "-";
        if (booking.spaDateTimeObj && isValid(booking.spaDateTimeObj)) {
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
          // If pref is scheduled but obj is bad/missing
          spaInfoExport = "Date Programmée Invalide";
        }

        const arrivalExport =
          booking.arrivalDateObj && isValid(booking.arrivalDateObj)
            ? booking.arrivalDateObj.toLocaleDateString("fr-FR")
            : booking.checkIn || "N/A";
        const departureExport =
          booking.departureDateObj && isValid(booking.departureDateObj)
            ? booking.departureDateObj.toLocaleDateString("fr-FR")
            : booking.checkOut || "N/A";
        const createdDateObj = parseBookingDateTime(booking.created); // Use your parser

        // Base Price for export
        const exportBasePrice = parseFloat(
          booking.priceDetails?.basePrice || booking.basePrice || 0
        );
        // Long Stay Discount for export (ensure negative)
        const exportLongStayDiscount = parseFloat(
          booking.priceDetails?.longStayDiscount || 0
        );

        return [
          booking.id, // Smoobu ID or Firestore ID
          booking.guest,
          createdDateObj && isValid(createdDateObj)
            ? createdDateObj.toLocaleDateString("fr-FR")
            : booking.created || "N/A",
          booking.portal,
          booking.property || "",
          booking.email || "",
          booking.phone || "",
          booking.address || "",
          booking.adults || 0,
          booking.children || 0,
          arrivalExport,
          booking.arrivalTime || "",
          departureExport,
          booking.nights || 0,
          exportBasePrice, // Prix Base (€)
          exportCouponName, // Nom Coupon Appliqué
          exportCouponValue, // Valeur Coupon (€)
          parseFloat(booking.priceDetails?.linenFee || booking.linenFee || 0), // Frais Linge (€)
          exportLongStayDiscount > 0 ? -exportLongStayDiscount : 0, // Promo Long Séjour (€)
          parseFloat(booking.commission || 0), // Commission (€)
          spaInfoExport,
          extrasList || "",
          extrasTotal || 0, // Extras Total (€)
          parseFloat(booking.price || 0), // Prix Total Payé (€)
          // Prix Sans Coupon: final price paid + absolute value of coupon discount
          parseFloat(booking.price || 0) + Math.abs(exportCouponValue),
        ];
      }),
    ];
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Column widths - ensure this array has the same number of elements as your header row (25 columns)
    const colWidths = [
      { wch: 12 },
      { wch: 25 },
      { wch: 12 },
      { wch: 15 },
      { wch: 25 },
      { wch: 30 },
      { wch: 15 },
      { wch: 35 },
      { wch: 7 },
      { wch: 7 }, // 10
      { wch: 12 },
      { wch: 10 },
      { wch: 12 },
      { wch: 7 },
      { wch: 10 },
      { wch: 20 },
      { wch: 10 },
      { wch: 10 },
      { wch: 10 },
      { wch: 10 }, // 20
      { wch: 20 },
      { wch: 40 },
      { wch: 10 },
      { wch: 10 },
      { wch: 15 }, // 25
    ];
    ws["!cols"] = colWidths;

    // Price columns indices for currency formatting (0-indexed)
    // Check these indices carefully against your header row!
    // Prix Base (14), Valeur Coupon (16), Frais Linge (17), Promo Long (18), Commission (19)
    // Extras Total (22), Prix Total Payé (23), Prix Sans Coupon (24)
    const priceColumns = [14, 16, 17, 18, 19, 22, 23, 24];
    priceColumns.forEach((col) => {
      const range = XLSX.utils.decode_range(ws["!ref"]);
      for (let row = 1; row <= range.e.r; row++) {
        // Start from row 1 (data)
        const cellRef = XLSX.utils.encode_cell({ r: row, c: col });
        if (ws[cellRef] && typeof ws[cellRef].v === "number") {
          ws[cellRef].z = "#,##0.00 €";
        }
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
