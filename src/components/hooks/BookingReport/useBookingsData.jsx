// File: src/hooks/BookingReport/useBookingsData.js
import { useState, useEffect, useCallback } from "react";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  // Timestamp, // Not needed for the main query if arrivalDate is string
} from "firebase/firestore";
import { db } from "../../../firebase.js";
import * as XLSX from "xlsx";
import axios from "axios";
import {
  getCleanExtrasFromPriceElements,
  mergeAndSortExtras,
} from "../../Admin/BookingReport/utils/extrasUtils.js";
import { parseBookingDateTime } from "../../spa/spaCalendarUtils.js";
import { parseISO, isValid } from "date-fns";
import { calculateBookingTotal } from "../../Admin/BookingReport/BookingsDetails.jsx";

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
    const startDateObj = new Date(startYear, startMonth - 1);
    const endDateObj = new Date(endYear, endMonth - 1);
    if (endDateObj < startDateObj) {
      setEndMonth(startMonth);
      setEndYear(startYear);
    }
  }, [startMonth, startYear, endMonth, endYear]);

  const processBookingData = useCallback(
    (bookingInputFromFirestore, bookingMapToUpdate) => {
      try {
        const {
          id,
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
          arrivalDate, // Expected as "YYYY-MM-DD" string from Firestore
          departureDate, // Expected as "YYYY-MM-DD" string from Firestore
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
          extras,
          priceDetails,
          couponApplied,
          createdAt,
          updatedAt,
          lastSyncedAt,
          spaDateTime,
          spaEndDateTime,
          spaBookingPreference,
          spaInfo,
          spaSlots,
          processedFreeDrinks,
          freeDrinkInfo,
        } = bookingInputFromFirestore;

        const arrivalDateObj = arrivalDate ? parseISO(arrivalDate) : null;
        const departureDateObj = departureDate ? parseISO(departureDate) : null;
        const tempSpaDateTimeObj = parseBookingDateTime(spaDateTime);
        const tempSpaEndDateTimeObj = parseBookingDateTime(spaEndDateTime);
        const createdDateObj = parseBookingDateTime(createdAt);
        const updatedDateObj = parseBookingDateTime(updatedAt || lastSyncedAt);

        let spaInfoProcessed = null;
        if (spaInfo) {
          spaInfoProcessed = {
            ...spaInfo,
            scheduledDateTimeObj: parseBookingDateTime(
              spaInfo.scheduledDateTime
            ),
            endDateTimeObj: parseBookingDateTime(spaInfo.endDateTime),
          };
        }

        // Extract coupon information from priceElements if available
        let extractedCoupon = couponApplied || null;
        if (!extractedCoupon && priceDetails?.priceElements?.length > 0) {
          const couponElement = priceDetails.priceElements.find(
            (el) =>
              el &&
              el.name &&
              el.amount &&
              (el.type === "coupon" ||
                el.name.toLowerCase().includes("coupon") ||
                el.name.toLowerCase().includes("code promo") ||
                el.name.toLowerCase().includes("réduction") ||
                el.name.toLowerCase().includes("promo"))
          );

          if (couponElement) {
            let couponCode = "";
            if (
              couponElement.name.includes("Gift.") ||
              couponElement.name.includes("GIFT.")
            ) {
              const match = couponElement.name.match(
                /Gift\.(\d+)|GIFT\.(\d+)/i
              );
              if (match) {
                couponCode = `GIFT.${match[1] || match[2]}`;
              }
            } else if (couponElement.name.includes("Coupon - ")) {
              couponCode = couponElement.name.replace("Coupon - ", "");
            } else if (couponElement.name.includes("Code promo: ")) {
              const match = couponElement.name.match(/Code promo: ([^(]+)/);
              if (match) {
                couponCode = match[1].trim();
              }
            }

            extractedCoupon = {
              code: couponCode,
              discount: Math.abs(parseFloat(couponElement.amount)),
              type: "fixed",
              fromPriceElements: true,
            };
          }
        }

        const formattedBooking = {
          id: String(smoobuId || smoobuReservationId || id),
          firestoreId: id,
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
          checkIn: arrivalDate,
          arrivalTime: checkInTime || "",
          checkOut: departureDate,
          departureTime: checkOutTime || "",
          nights: Number(nights) || 0,
          property: property || "",
          apartmentId: String(apartmentId || ""),
          portal: portalName || channelName || "",
          channelId: channelId,
          price: Number(price) || 0,
          basePrice: Number(basePrice) || 0,
          linenFee: Number(linenFee) || 0,
          commission: Number(commission) || 0,
          extras: extras || [],
          priceDetails: priceDetails || {},
          coupon: extractedCoupon,
          created: createdAt,
          updated: updatedAt || lastSyncedAt,
          arrivalDateObj:
            arrivalDateObj && isValid(arrivalDateObj) ? arrivalDateObj : null,
          departureDateObj:
            departureDateObj && isValid(departureDateObj)
              ? departureDateObj
              : null,
          spaDateTimeObj: tempSpaDateTimeObj,
          spaEndDateTimeObj: tempSpaEndDateTimeObj,
          createdDateObj:
            createdDateObj && isValid(createdDateObj) ? createdDateObj : null,
          updatedDateObj:
            updatedDateObj && isValid(updatedDateObj) ? updatedDateObj : null,
          spaDateTime: spaDateTime,
          spaEndDateTime: spaEndDateTime,
          spaBookingPreference: spaBookingPreference,
          spaInfo: spaInfoProcessed,
          spaSlots: spaSlots,
          hasSpaBooking: !!(
            tempSpaDateTimeObj ||
            spaBookingPreference ||
            spaInfoProcessed?.hasSpaTreatment
          ),
          processedFreeDrinks: processedFreeDrinks || [],
          freeDrinkInfo: freeDrinkInfo || null,
        };
        bookingMapToUpdate.set(formattedBooking.id, formattedBooking);
      } catch (error) {
        console.error(
          `Error processing booking data for Firestore ID ${
            bookingInputFromFirestore?.id || "N/A"
          }:`,
          error,
          bookingInputFromFirestore
        );
      }
    },
    []
  );

  const calculateCompletenessScore = useCallback((booking) => {
    let score = 0;
    if (booking.extras && booking.extras.length > 0) score += 10;
    if (booking.priceDetails?.priceElements?.length > 0) score += 5;
    if (booking.priceDetails?.extrasTotal !== undefined) score += 3;
    if (booking.commission !== undefined) score += 2;
    if (booking.linenFee !== undefined) score += 2;
    if (booking.email) score += 1;
    if (booking.phone) score += 1;
    if (booking.address) score += 1;
    if (booking.spaDateTimeObj || booking.spaDateTime) score += 5;
    if (booking.spaBookingPreference) score += 3;
    if (booking.spaInfo?.hasSpaTreatment || booking.spaInfo) score += 5;
    if (booking.spaSlots && booking.spaSlots.length) score += 3;
    if (booking.processedFreeDrinks && booking.processedFreeDrinks.length > 0)
      score += 4;
    if (booking.freeDrinkInfo?.needsNonAlcoholicChoice) score -= 2;
    if (booking.updated) {
      const updateDate = parseBookingDateTime(booking.updated);
      if (updateDate && isValid(updateDate)) {
        const daysAgo =
          (Date.now() - updateDate.getTime()) / (1000 * 60 * 60 * 24);
        score += Math.max(0, 10 - daysAgo / 3);
      }
    }
    return score;
  }, []);

  // Main useEffect for setting up and cleaning up the Firestore listener
  useEffect(() => {
    // console.log("useEffect for listener setup (STRING DATE QUERY): Triggered. Date range:",
    //   startYear, startMonth, "to", endYear, endMonth);

    setLoading(true);
    setError(null);
    // setReportData([]); // Optionally clear data on new query, listener will populate

    const jsStartDate = new Date(startYear, startMonth - 1, 1);
    const jsEndDate = new Date(endYear, endMonth, 0); // Last day of the endMonth

    // Convert JS Dates to "YYYY-MM-DD" strings for the query
    const queryStringStartDate = jsStartDate.toISOString().split("T")[0];
    const queryStringEndDate = jsEndDate.toISOString().split("T")[0];

    // console.log("Querying with STRING dates for arrivalDate:", queryStringStartDate, "to", queryStringEndDate);

    const bookingsRef = collection(db, "bookings");
    const q = query(
      bookingsRef,
      where("arrivalDate", ">=", queryStringStartDate), // String comparison
      where("arrivalDate", "<=", queryStringEndDate), // String comparison
      orderBy("arrivalDate", "desc") // Ordering strings lexicographically
    );

    const unsubscribe = onSnapshot(
      q,
      (querySnapshot) => {
        // console.log(`Firestore Listener (String Query): Snapshot received. Doc count: ${querySnapshot.docs.length}`);
        if (querySnapshot.empty) {
          // console.log("Listener (String Query): Query returned an empty set.");
          setReportData([]);
          setLoading(false);
          setError(null);
          return;
        }

        const bookingsBySmoobuId = {};
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          // data.arrivalDate and data.departureDate are already strings from Firestore
          const rawDataForProcessing = { ...data };

          // No conversion needed here for arrivalDate/departureDate if they are already strings
          // as processBookingData expects them as "YYYY-MM-DD" for parseISO.

          const smoobuIdKey = String(
            rawDataForProcessing.smoobuId ||
              rawDataForProcessing.smoobuReservationId ||
              doc.id
          );
          if (
            !smoobuIdKey ||
            smoobuIdKey === "undefined" ||
            smoobuIdKey === "null" ||
            smoobuIdKey.trim() === ""
          ) {
            return;
          }

          if (!bookingsBySmoobuId[smoobuIdKey]) {
            bookingsBySmoobuId[smoobuIdKey] = [];
          }
          bookingsBySmoobuId[smoobuIdKey].push({
            id: doc.id,
            ...rawDataForProcessing,
          });
        });

        const bookingMap = new Map();
        Object.entries(bookingsBySmoobuId).forEach(
          ([smoobuId, bookingsList]) => {
            if (bookingsList.length === 1) {
              processBookingData(bookingsList[0], bookingMap);
            } else {
              bookingsList.sort(
                (a, b) =>
                  calculateCompletenessScore(b) - calculateCompletenessScore(a)
              );
              processBookingData(bookingsList[0], bookingMap);
            }
          }
        );

        const finalBookingsArray = Array.from(bookingMap.values());
        setReportData(finalBookingsArray);
        setLoading(false);
        setError(null);
      },
      (snapshotError) => {
        console.error(
          "Error in Firestore onSnapshot listener (String Query):",
          snapshotError
        );
        setError(
          "Failed to get real-time booking updates: " + snapshotError.message
        );
        setReportData([]);
        setLoading(false);
      }
    );

    return () => {
      // console.log("Cleaning up Firestore listener (String Query).");
      if (unsubscribe && typeof unsubscribe === "function") {
        unsubscribe();
      }
    };
  }, [
    startMonth,
    startYear,
    endMonth,
    endYear,
    processBookingData,
    calculateCompletenessScore,
  ]);

  const handleFetchAndSync = async () => {
    try {
      setLoading(true);
      setError(null);
      const backendUrl =
        import.meta.env.VITE_API_URL || "http://localhost:3000";
      const syncStartDate = new Date(startYear, startMonth - 1, 1)
        .toISOString()
        .split("T")[0];
      const syncEndDate = new Date(endYear, endMonth, 0)
        .toISOString()
        .split("T")[0];

      const response = await axios.get(`${backendUrl}/api/fetch-and-sync`, {
        params: { startDate: syncStartDate, endDate: syncEndDate },
      });

      if (response.data.success) {
        alert(
          `Fetch and sync completed!\nFetched Active: ${response.data.stats.fetchedActive}\nFetched Modified: ${response.data.stats.fetchedModified}\nAdded: ${response.data.stats.added}\nUpdated: ${response.data.stats.updated}\nDeleted: ${response.data.stats.deletedFromFirebase}`
        );
      } else {
        const errorMessage =
          response.data.error || "Fetch and sync from backend failed.";
        setError(errorMessage);
        alert(`Fetch and sync failed: ${errorMessage}`);
      }
    } catch (err) {
      console.error("Error in handleFetchAndSync:", err);
      const errorMessage =
        err.message || "Failed to connect or unexpected error during sync.";
      setError(`Failed to fetch and sync: ${errorMessage}`);
      alert(`Failed to fetch and sync: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDeduplicate = async () => {
    try {
      setDeduplicating(true);
      setError(null);
      const backendUrl =
        import.meta.env.VITE_API_URL || "http://localhost:3000";
      const response = await axios.get(
        `${backendUrl}/api/deduplicate-bookings`
      );
      if (response.data.success) {
        alert(
          `Deduplication completed!\nFound ${response.data.stats.duplicateGroups} groups\nDeleted ${response.data.stats.deletedBookings} entries`
        );
      } else {
        setError(response.data.error || "Deduplication failed");
        alert(
          `Deduplication failed: ${response.data.error || "Unknown error"}`
        );
      }
    } catch (err) {
      console.error("Error in deduplication:", err);
      setError(`Failed to deduplicate: ${err.message}`);
      alert(`Failed to deduplicate: ${err.message}`);
    } finally {
      setDeduplicating(false);
    }
  };

  const handleExport = () => {
    if (!reportData || reportData.length === 0) {
      alert("Aucune donnée à exporter.");
      return;
    }
    const wsData = [
      [
        "ID",
        "Client",
        "Date Création Booking",
        "Portail",
        "Logement",
        "Email",
        "Téléphone",
        "Adresse",
        "Adulte(s)",
        "Enfant(s)",
        "Date Arrivée",
        "Heure Check-in",
        "Date Départ",
        "Nuits",
        "Prix Base (€)",
        "Nom Coupon Appliqué",
        "Valeur Coupon (€)",
        "Frais Linge (€)",
        "Promo Long Séjour (€)",
        "Commission (€)",
        "SPA",
        "Boissons Incluses",
        "Extras Payants Liste",
        "Extras Payants Total (€)",
        "Prix Total Payé (€)",
        "Prix Total Sans Coupon (€)",
      ],
      ...reportData.map((booking) => {
        const portalName =
          booking.portalName || booking.channelName || booking.portal;
        const isBookingCom = portalName === "Booking.com";
        let displayPaidExtras = [];
        if (booking.priceDetails?.priceElements?.length > 0) {
          displayPaidExtras = getCleanExtrasFromPriceElements(
            booking.priceDetails.priceElements,
            portalName
          );
          if (isBookingCom)
            displayPaidExtras = displayPaidExtras.filter(
              (extra) =>
                !extra.name.includes("TVA") &&
                !extra.name.toLowerCase().includes("taxe de séjour")
            );
        } else if (booking.extras?.length > 0) {
          displayPaidExtras = booking.extras;
          if (isBookingCom)
            displayPaidExtras = displayPaidExtras.filter(
              (extra) =>
                !extra.name.includes("TVA") &&
                !extra.name.toLowerCase().includes("taxe de séjour")
            );
        }
        const mergedAndSortedPaidExtras = mergeAndSortExtras(displayPaidExtras);
        const paidExtrasTotal = mergedAndSortedPaidExtras.reduce(
          (sum, extra) => sum + parseFloat(extra.amount || 0),
          0
        );
        const paidExtrasList = mergedAndSortedPaidExtras
          .map(
            (extra) =>
              `${extra.name}${
                parseInt(extra.quantity || 1, 10) > 1
                  ? ` (x${extra.quantity})`
                  : ""
              }`
          )
          .join("; ");

        let exportCouponName = "";
        let exportCouponValue = 0;
        const mainCouponObject =
          booking.coupon ||
          booking.appliedCoupon ||
          booking.couponApplied ||
          booking.priceDetails?.promoCode;
        if (
          mainCouponObject?.code &&
          String(mainCouponObject.code).trim() &&
          String(mainCouponObject.code).toLowerCase() !== "code"
        ) {
          exportCouponName = String(mainCouponObject.code).trim();
        } else if (
          mainCouponObject?.name &&
          String(mainCouponObject.name).trim() &&
          String(mainCouponObject.name).toLowerCase() !== "code"
        ) {
          exportCouponName = String(mainCouponObject.name).trim();
        }
        if (
          exportCouponName === "" &&
          (booking.priceDetails?.couponDiscount ||
            (mainCouponObject?.amount &&
              mainCouponObject?.type !== "percentage"))
        ) {
          exportCouponName = "PROMO APPLIQUÉ";
        }

        if (typeof booking.priceDetails?.couponDiscount === "number") {
          exportCouponValue = parseFloat(booking.priceDetails.couponDiscount);
        } else if (
          typeof booking.priceDetails?.promoCode?.amount === "number"
        ) {
          exportCouponValue = parseFloat(booking.priceDetails.promoCode.amount);
        } else if (
          mainCouponObject?.discount &&
          mainCouponObject?.type !== "percentage"
        ) {
          exportCouponValue = parseFloat(mainCouponObject.discount);
        }

        // --- Check priceElements for coupon/discount entries (CRITICAL FOR EXPORT) ---
        if (
          exportCouponValue === 0 &&
          booking.priceDetails?.priceElements?.length > 0
        ) {
          const priceElements = booking.priceDetails.priceElements;
          const couponElement = priceElements.find(
            (el) =>
              el &&
              el.name &&
              el.amount &&
              (el.type === "coupon" ||
                el.name.toLowerCase().includes("coupon") ||
                el.name.toLowerCase().includes("code promo") ||
                el.name.toLowerCase().includes("réduction") ||
                el.name.toLowerCase().includes("promo"))
          );

          if (couponElement) {
            exportCouponValue = Math.abs(parseFloat(couponElement.amount));

            // Extract coupon code from the name if not already set
            if (!exportCouponName) {
              if (
                couponElement.name.includes("Gift.") ||
                couponElement.name.includes("GIFT.")
              ) {
                const match = couponElement.name.match(
                  /Gift\.(\d+)|GIFT\.(\d+)/i
                );
                if (match) {
                  exportCouponName = `GIFT.${match[1] || match[2]}`;
                }
              } else if (couponElement.name.includes("Coupon - ")) {
                exportCouponName = couponElement.name.replace("Coupon - ", "");
              } else if (couponElement.name.includes("Code promo: ")) {
                const match = couponElement.name.match(/Code promo: ([^(]+)/);
                if (match) {
                  exportCouponName = match[1].trim();
                }
              } else {
                exportCouponName = "PROMO APPLIQUÉ";
              }
            }
          }
        }

        if (exportCouponValue > 0 && exportCouponName !== "")
          exportCouponValue = -exportCouponValue;

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
        } else if (booking.spaBookingPreference === "later")
          spaInfoExport = "À programmer";
        else if (booking.spaBookingPreference === "scheduled")
          spaInfoExport = "Date Programmée Invalide";

        const arrivalExport =
          booking.arrivalDateObj && isValid(booking.arrivalDateObj)
            ? booking.arrivalDateObj.toLocaleDateString("fr-FR")
            : booking.checkIn || "N/A";
        const departureExport =
          booking.departureDateObj && isValid(booking.departureDateObj)
            ? booking.departureDateObj.toLocaleDateString("fr-FR")
            : booking.checkOut || "N/A";
        const createdDateObjToFormat = parseBookingDateTime(booking.created);

        let exportBasePrice = parseFloat(
          booking.priceDetails?.basePrice || booking.basePrice || 0
        );

        // If basePrice is 0, try to calculate it from the total price minus extras
        if (
          exportBasePrice === 0 &&
          booking.priceDetails?.priceElements?.length > 0
        ) {
          // Look for base price in priceElements first
          const basePriceElement = booking.priceDetails.priceElements.find(
            (element) =>
              element.name === "Prix de base" ||
              element.type === "base" ||
              element.type === "basePrice"
          );

          if (basePriceElement) {
            exportBasePrice = parseFloat(basePriceElement.amount) || 0;
          } else if (booking.price) {
            // Fallback to original logic if no base price element found
            const totalPrice = parseFloat(booking.price);
            const priceElementsTotal =
              booking.priceDetails.priceElements.reduce((sum, element) => {
                return sum + (parseFloat(element.amount) || 0);
              }, 0);

            // If total price seems too low compared to extras, assume the stored price is just the base price
            if (totalPrice < priceElementsTotal) {
              exportBasePrice = totalPrice;
            } else {
              exportBasePrice = Math.max(0, totalPrice - priceElementsTotal);
            }
          }
        }
        const exportLongStayDiscount = parseFloat(
          booking.priceDetails?.longStayDiscount ||
            booking.priceBreakdown?.appliedLongStayDiscount ||
            0
        );

        let freeDrinksExportText = "-";
        if (
          booking.processedFreeDrinks &&
          booking.processedFreeDrinks.length > 0
        ) {
          freeDrinksExportText = booking.processedFreeDrinks
            .map((drink) => `${drink.name} (Quantité: ${drink.quantity})`)
            .join("; ");
        }
        if (booking.freeDrinkInfo?.needsNonAlcoholicChoice) {
          const pendingChoiceText = ` (Choix non-alcoolisé en attente pour: ${booking.freeDrinkInfo.nonAlcoholicChoiceGrantors.join(
            ", "
          )})`;
          freeDrinksExportText =
            (freeDrinksExportText === "-" ? "" : freeDrinksExportText) +
            pendingChoiceText;
          if (freeDrinksExportText.startsWith(" ("))
            freeDrinksExportText = freeDrinksExportText
              .substring(1)
              .trimStart();
        }
        if (freeDrinksExportText.trim() === "") freeDrinksExportText = "-";

        // Use the same calculation logic as the UI for consistency
        const totalPricePaid = calculateBookingTotal(booking);

        return [
          booking.id,
          booking.guest,
          createdDateObjToFormat && isValid(createdDateObjToFormat)
            ? createdDateObjToFormat.toLocaleDateString("fr-FR")
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
          exportBasePrice,
          exportCouponName || "-",
          exportCouponValue,
          parseFloat(booking.priceDetails?.linenFee || booking.linenFee || 0),
          exportLongStayDiscount > 0 ? -exportLongStayDiscount : 0,
          parseFloat(booking.commission || 0),
          spaInfoExport,
          freeDrinksExportText,
          paidExtrasList || "-",
          paidExtrasTotal || 0,
          totalPricePaid,
          totalPricePaid + Math.abs(exportCouponValue),
        ];
      }),
    ];
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(wsData);
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
      { wch: 7 },
      { wch: 12 },
      { wch: 10 },
      { wch: 12 },
      { wch: 7 },
      { wch: 10 },
      { wch: 20 },
      { wch: 10 },
      { wch: 10 },
      { wch: 10 },
      { wch: 10 },
      { wch: 20 },
      { wch: 40 },
      { wch: 40 },
      { wch: 10 },
      { wch: 10 },
      { wch: 15 },
    ];
    ws["!cols"] = colWidths;
    const priceColumns = [14, 16, 17, 18, 19, 23, 24, 25];
    priceColumns.forEach((colIndex) => {
      const range = XLSX.utils.decode_range(ws["!ref"]);
      for (let R = range.s.r + 1; R <= range.e.r; ++R) {
        const cellRef = XLSX.utils.encode_cell({ r: R, c: colIndex });
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
      `rapport-reservations_${startDateStr}_a_${endDateStr}.xlsx`
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
    handleFetchAndSync,
    handleDeduplicate,
    handleExport,
    deduplicating,
  };
};
