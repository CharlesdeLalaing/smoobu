import React, { useState, useEffect, useCallback } from "react";
import {
  Calendar,
  Search,
  Download,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { db } from "../../firebase";
import * as XLSX from "xlsx";
import axios from "axios";

const portalNames = {
  Homepage: "Website",
  "Direct booking": "Direct booking",
  "Homepage direct": "Website",
  Direct: "Direct booking",
  Airbnb: "Airbnb",
  airbnb: "Airbnb",
  "Booking.com": "Booking.com",
  "booking.com": "Booking.com",
  Expedia: "Expedia",
  blocked: "Blocked",
  Blocked: "Blocked",
  Partenariat: "Partenariat",
  partenariat: "Partenariat",
};

const getPortalName = (portal) => {
  // Handle null/undefined
  if (!portal) return "Website";

  // Check if it's already a mapped portal
  if (portalNames[portal]) return portalNames[portal];

  // Check channel IDs
  if (portal === "2323525" || portal === 2323525) return "Website";
  if (portal === "2323543" || portal === 2323543) return "Airbnb";

  // Special case for unknown channels from Smoobu that should be Website
  if (
    portal.includes("Homepage") ||
    portal === "Direct" ||
    portal === "Direct booking"
  ) {
    return "Website";
  }

  // Return the original or default to Website
  return portal || "Website";
};
const roomNames = {
  1946282: "Le dôme de libellules",
  2565753: "La Cabane du Chêne",
  1644643: "La Bulle du Ruisseau",
  1946279: "Le Moulin",
  1946276: "La Chambre de Blé",
  1946270: "Le Logis",
};

  const deepCloneExtras = (extras) => {
    if (!extras || !Array.isArray(extras)) return [];

    return extras.map((extra) => {
      // Create a fresh object with all properties
      return {
        ...extra,
        // Ensure these specific properties are included and properly typed
        name: extra.name || "Extra sans nom",
        amount: parseFloat(extra.amount || 0),
        quantity: parseInt(extra.quantity || 1),
        extraPersonQuantity: parseInt(extra.extraPersonQuantity || 0),
        extraPersonPrice: parseFloat(extra.extraPersonPrice || 0),
        extraPersonAmount: parseFloat(extra.extraPersonAmount || 0),
        extraPersonName: extra.extraPersonName || "Personne supplémentaire",
        hasExtraPerson:
          extra.extraPersonQuantity > 0 ||
          extra.extraPersonPrice > 0 ||
          extra.extraPersonAmount > 0,
        type: extra.type || "addon",
        currencyCode: extra.currencyCode || "EUR",
      };
    });
  };


const BookingsReport = () => {
  const [startMonth, setStartMonth] = useState(new Date().getMonth() + 1);
  const [startYear, setStartYear] = useState(new Date().getFullYear());
  const [endMonth, setEndMonth] = useState(new Date().getMonth() + 1);
  const [endYear, setEndYear] = useState(new Date().getFullYear());
  const [reportData, setReportData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState("checkIn");
  const [sortDirection, setSortDirection] = useState("desc");
  const [expandedBooking, setExpandedBooking] = useState(null);
  const [deduplicating, setDeduplicating] = useState(false);


  const years = Array.from(
    { length: 3 },
    (_, i) => new Date().getFullYear() - i
  );
  const months = Array.from({ length: 12 }, (_, i) => ({
    value: i + 1,
    label: new Date(2024, i).toLocaleString("fr", { month: "long" }),
  }));

  useEffect(() => {
    if (
      endYear < startYear ||
      (endYear === startYear && endMonth < startMonth)
    ) {
      setEndYear(startYear);
      setEndMonth(startMonth);
    }
  }, [startYear, startMonth, endYear, endMonth]);

  // Inside your BookingsReport component:

  // Enhanced version of the diagnoseBookingData function with more verbose logging
  // Enhanced version of the diagnoseBookingData function with more verbose logging
  // Enhanced version of the diagnoseBookingData function with more verbose logging
  const diagnoseBookingData = (booking) => {
    console.group(`🔍 Diagnosing booking ${booking.id} (${booking.portal})`);

    // First - let's check the raw extras data to see what's in it
    console.log("Raw extras data:", JSON.stringify(booking.extras));

    // Log all price elements for inspection
    console.log(
      "All price elements:",
      booking.priceDetails?.priceElements?.map((el) => ({
        name: el.name,
        type: el.type,
        amount: el.amount,
      })) || "No price elements"
    );

    // Check data structure - focus on price fields
    console.log("Price structure:", {
      price: booking.price,
      basePrice: booking.basePrice,
      priceDetailsBasePrice: booking?.priceDetails?.basePrice,
      linenFee: booking.linenFee,
      priceDetailsLinenFee: booking?.priceDetails?.linenFee,
    });

    // Check coupon/discount structure
    console.log("Discount structure:", {
      appliedCoupon: booking.appliedCoupon,
      priceDetailsPromoCode: booking?.priceDetails?.promoCode,
      priceDetailsCouponDiscount: booking?.priceDetails?.couponDiscount,
      priceDetailsLongStayDiscount: booking?.priceDetails?.longStayDiscount,
      priceDetailsDiscount: booking?.priceDetails?.discount,
    });

    // Check extras - especially for extra person handling
    if (booking.extras && booking.extras.length > 0) {
      console.log("Extras structure:");
      booking.extras.forEach((extra, i) => {
        console.log(`Extra ${i + 1}:`, {
          name: extra.name,
          amount: extra.amount,
          quantity: extra.quantity,
          hasExtraPerson:
            !!extra.extraPersonQuantity ||
            !!extra.extraPersonPrice ||
            !!extra.extraPersonAmount,
          extraPersonQuantity: extra.extraPersonQuantity,
          extraPersonPrice: extra.extraPersonPrice,
          extraPersonAmount: extra.extraPersonAmount,
          extraPersonName: extra.extraPersonName,
          // Raw extra for inspection
          rawExtra: JSON.stringify(extra),
        });
      });
    } else {
      console.log(
        "No extras found - this could be a problem if extras should exist!"
      );
      console.log("Debug sources:", booking._debug || "No debug info");
    }

    console.groupEnd();
  };

  // Complete fetchFromFirebase function with diagnostic logging
  const fetchFromFirebase = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Create date range for query
      const startDate = new Date(startYear, startMonth - 1, 1);
      const endDate = new Date(endYear, endMonth, 0, 23, 59, 59);

      // Create Firebase query
      const bookingsRef = collection(db, "bookings");
      const q = query(
        bookingsRef,
        where("arrivalDate", ">=", startDate.toISOString().split("T")[0]),
        where("arrivalDate", "<=", endDate.toISOString().split("T")[0]),
        orderBy("arrivalDate", "desc")
      );

      const querySnapshot = await getDocs(q);
      console.log(
        `Retrieved ${querySnapshot.docs.length} documents from Firebase`
      );

      // Log a sample of the raw data structure from Firebase
      if (querySnapshot.docs.length > 0) {
        const sampleDoc = querySnapshot.docs.find((doc) => {
          const data = doc.data();
          return data.portalName === "Airbnb" || data.channelName === "Airbnb";
        });

        if (sampleDoc) {
          console.group("Sample Airbnb booking raw data structure");
          console.log("Document ID:", sampleDoc.id);
          console.log("Data:", sampleDoc.data());
          console.groupEnd();
        }
      }

      // Create a map for deduplicated bookings
      const bookingMap = new Map();

      // First, go through all documents and group by smoobuId
      const bookingsBySmoobuId = {};
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        if (
          (!data.extras || data.extras.length === 0) &&
          data.priceDetails?.priceElements
        ) {
          // For debugging
          console.log(
            `Processing extras for booking ${data.id || data.smoobuId}`
          );
          console.log(
            "All price elements:",
            data.priceDetails.priceElements.map((el) => el.name)
          );

          // 1. Extract extras from priceElements - Use a simple, robust approach
          data.extras = data.priceDetails.priceElements
            .filter((element) => {
              const name = (element.name || "").toLowerCase();
              const type = (element.type || "").toLowerCase();

              // Specifically exclude these items as non-extras
              if (
                type === "base" ||
                type === "discount" ||
                name === "prix de base" ||
                name.includes("réduction long séjour") ||
                name.includes("code promo")
              ) {
                return false;
              }

              // Include all addons (this is the key part - rely on the type)
              if (type === "addon") {
                return true;
              }

              // For elements without a type, use name-based inclusion
              return (
                name.includes("formule") ||
                name.includes("essentiel") || // Note: lowercase matches "l'essentiel"
                name.includes("détente") ||
                name.includes("petit-déjeuner") ||
                name.includes("raclette") ||
                name.includes("barbecue") ||
                name.includes("spa") ||
                name.includes("bouteille") ||
                name.includes("2 pers") ||
                name.includes("personne") ||
                name.includes("frais supplémentaires")
              );
            })
            .map((element) => ({
              name: element.name,
              amount: Math.abs(parseFloat(element.amount) || 0),
              quantity: parseInt(element.quantity) || 1,
              type: element.type || "addon",
              id: element.id,
              currencyCode: element.currencyCode || "EUR",
              extraPersonQuantity: 0,
              extraPersonPrice: 0,
              extraPersonAmount: 0,
              hasExtraPerson: false,
            }));

          console.log(
            "Extracted extras:",
            data.extras.map((el) => el.name)
          );

          // 2. Separately handle other important price elements

          // Find base price element
          const basePriceElement = data.priceDetails.priceElements.find(
            (el) =>
              el.type === "base" ||
              (el.name || "").toLowerCase() === "prix de base"
          );

          if (basePriceElement) {
            data.priceDetails.basePrice =
              parseFloat(basePriceElement.amount) || 0;
            data.basePrice = parseFloat(basePriceElement.amount) || 0;
            console.log("Found base price:", data.basePrice);
          }

          // Find long stay discount
          const longStayElement = data.priceDetails.priceElements.find((el) =>
            (el.name || "").toLowerCase().includes("réduction long séjour")
          );

          if (longStayElement) {
            data.priceDetails.longStayDiscount = Math.abs(
              parseFloat(longStayElement.amount) || 0
            );
            console.log(
              "Found long stay discount:",
              data.priceDetails.longStayDiscount
            );
          }

          // Find coupon discount from priceElements
          const couponElement = data.priceDetails.priceElements.find((el) =>
            (el.name || "").toLowerCase().includes("code promo")
          );

          if (couponElement) {
            if (!data.priceDetails.promoCode) {
              data.priceDetails.promoCode = {
                name: couponElement.name,
                amount: Math.abs(parseFloat(couponElement.amount) || 0),
              };
            }
            console.log("Found coupon:", data.priceDetails.promoCode);
          }
        }
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

      // Log duplicates found for debugging
      const duplicateGroups = Object.entries(bookingsBySmoobuId).filter(
        ([, group]) => group.length > 1
      );

      if (duplicateGroups.length > 0) {
        console.log(
          `Found ${duplicateGroups.length} bookings with duplicates in the client-side data`
        );
      }

      // For each smoobuId, pick the most complete entry
      Object.entries(bookingsBySmoobuId).forEach(([smoobuId, bookings]) => {
        if (bookings.length === 1) {
          // If only one entry, use it
          const booking = bookings[0];
          processBookingData(booking, bookingMap);
        } else {
          // If multiple entries, choose the one with the most data
          // Prioritize entries with extras, price elements, etc.
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
      console.log(`Returning ${bookings.length} deduplicated bookings`);

      // Log some stats about extras
      const bookingsWithExtras = bookings.filter(
        (b) => b.extras && b.extras.length > 0
      );
      const airbnbBookings = bookings.filter((b) => b.portal === "Airbnb");
      const airbnbWithExtras = airbnbBookings.filter(
        (b) => b.extras && b.extras.length > 0
      );

      console.log("Extras statistics:", {
        totalBookings: bookings.length,
        bookingsWithExtras: bookingsWithExtras.length,
        airbnbTotal: airbnbBookings.length,
        airbnbWithExtras: airbnbWithExtras.length,
        percentWithExtras:
          ((bookingsWithExtras.length / bookings.length) * 100).toFixed(1) +
          "%",
        percentAirbnbWithExtras: airbnbBookings.length
          ? ((airbnbWithExtras.length / airbnbBookings.length) * 100).toFixed(
              1
            ) + "%"
          : "N/A",
      });

      setReportData(bookings);
    } catch (err) {
      console.error("Error fetching bookings from Firebase:", err);
      setError("Failed to fetch bookings: " + err.message);
    } finally {
      setLoading(false);
    }
  }, [startMonth, startYear, endMonth, endYear]);

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

  // Helper function to process booking data with improved robustness
  // Replace the entire processBookingData function with this improved version

const processBookingData = (data, bookingMap) => {
  const smoobuId = data.smoobuId || data.smoobuReservationId;
  console.log(
    `📌 Booking ${data.id}: Raw extras before any processing:`,
    data.extras
  );

  // Skip if already processed or missing ID
  if (!smoobuId || bookingMap.has(smoobuId)) return;

  // DEBUGGING - log the structure of this booking's price-related data
  if (data.portalName === "Airbnb" || data.channelName === "Airbnb") {
    console.log(`Processing Airbnb booking ${smoobuId} - Data structure:`, {
      hasExtras: !!data.extras,
      extrasLength: data.extras?.length || 0,
      hasPriceDetails: !!data.priceDetails,
      hasPriceDetailsElements: !!data.priceDetails?.priceElements,
      priceDetailsElementsLength: data.priceDetails?.priceElements?.length || 0,
      hasRootPriceElements: !!data.priceElements,
      rootPriceElementsLength: data.priceElements?.length || 0,
    });
  }

  // Extract prices directly rather than calculating
  const basePrice =
    parseFloat(data.priceDetails?.basePrice) || parseFloat(data.basePrice) || 0;

  const guestFees =
    parseFloat(data.guestFees) || parseFloat(data.priceDetails?.guestFees) || 0;

  const totalPrice = parseFloat(data.price) || 0;

  // Get fees directly
  const linenFee =
    parseFloat(data.priceDetails?.linenFee) ||
    parseFloat(data.priceDetails?.cleaningFee) ||
    parseFloat(data.linenFee) ||
    0;

  const commission =
    parseFloat(data.priceDetails?.commission) ||
    parseFloat(data.commission) ||
    0;

  // Extract discount info from all possible paths
  const longStayDiscount =
    parseFloat(data.priceDetails?.longStayDiscount) ||
    parseFloat(data.priceDetails?.discount) ||
    0;

  // Extract coupon info with priority to descriptive names in priceElements
  let promoCode = null;

  // First, try to find the coupon element in priceElements for the full descriptive name
  const couponElement = data.priceDetails?.priceElements?.find((el) =>
    (el.name || "").toLowerCase().includes("code promo")
  );

  if (couponElement) {
    promoCode = {
      name: couponElement.name, // Use the descriptive name from priceElements
      amount: Math.abs(parseFloat(couponElement.amount || 0)),
    };
  } else if (data.priceDetails?.promoCode) {
    // Fall back to the promoCode object if no priceElement was found
    promoCode = {
      name:
        data.priceDetails.promoCode.code ||
        data.priceDetails.promoCode.name ||
        "",
      amount: parseFloat(data.priceDetails.promoCode.amount || 0),
    };
  } else if (data.appliedCoupon) {
    // Last resort: use the appliedCoupon object
    promoCode = {
      name: data.appliedCoupon.code || "",
      amount: parseFloat(data.appliedCoupon.discount || 0),
    };
  }

  // Prepare to collect price elements from all sources
  let allPriceElements = [];

  // 1. If there are priceDetails.priceElements, add them
  if (
    data.priceDetails?.priceElements &&
    Array.isArray(data.priceDetails.priceElements)
  ) {
    allPriceElements = [...data.priceDetails.priceElements];
  }

  // 2. If there are root priceElements, add them if not duplicates
  if (data.priceElements && Array.isArray(data.priceElements)) {
    data.priceElements.forEach((element) => {
      // Check if this element already exists in allPriceElements by ID
      const existingElement = allPriceElements.find((e) => e.id === element.id);
      if (!existingElement) {
        allPriceElements.push(element);
      }
    });
  }

  // IMPROVED: Process extras from all possible sources
  let extractedExtras = [];

  // 1. First try to use the extras array if it exists with proper extra person data
  if (data.extras && Array.isArray(data.extras) && data.extras.length > 0) {
    // Make a deep copy to preserve all extra person data
    extractedExtras = data.extras.map((extra) => ({
      ...extra,
      name: extra.name || "Extra sans nom",
      amount: parseFloat(extra.amount || 0),
      quantity: parseInt(extra.quantity || 1),
      extraPersonQuantity: parseInt(extra.extraPersonQuantity || 0),
      extraPersonPrice: parseFloat(extra.extraPersonPrice || 0),
      extraPersonAmount: parseFloat(extra.extraPersonAmount || 0),
      extraPersonName: extra.extraPersonName || "Personne supplémentaire",
      hasExtraPerson:
        parseInt(extra.extraPersonQuantity || 0) > 0 ||
        parseFloat(extra.extraPersonPrice || 0) > 0 ||
        parseFloat(extra.extraPersonAmount || 0) > 0,
      type: extra.type || "addon",
      currencyCode: extra.currencyCode || "EUR",
    }));

    if (data.portalName === "Airbnb" || data.channelName === "Airbnb") {
      console.log(
        `Airbnb booking ${smoobuId}: Using extras array with ${data.extras.length} items`
      );

      // Debug logging - check if any extras have extra person data
      const extrasWithPersonData = extractedExtras.filter(
        (e) =>
          e.extraPersonQuantity > 0 ||
          e.extraPersonPrice > 0 ||
          e.extraPersonAmount > 0
      );
      if (extrasWithPersonData.length > 0) {
        console.log(
          `Found ${extrasWithPersonData.length} extras with person data:`,
          extrasWithPersonData.map((e) => ({
            name: e.name,
            extraPersonQuantity: e.extraPersonQuantity,
            extraPersonPrice: e.extraPersonPrice,
            extraPersonAmount: e.extraPersonAmount,
          }))
        );
      }
    }
  }
  // 2. Otherwise, extract extras from the collected allPriceElements
  else if (allPriceElements.length > 0) {
    if (data.portalName === "Airbnb" || data.channelName === "Airbnb") {
      console.log(
        `Airbnb booking ${smoobuId}: Extracting extras from priceElements with ${allPriceElements.length} items`
      );
    }

    // Filter price elements to find extras
    const extraElements = allPriceElements.filter((element) => {
      const name = (element.name || "").toLowerCase();
      const type = (element.type || "").toLowerCase();

      // Include only elements that are addons or have specific names indicating they are extras
      const isAddon = type === "addon";
      const isSpecialExtra =
        name.includes("formule") ||
        name.includes("petit-déjeuner") ||
        name.includes("raclette") ||
        name.includes("barbecue") ||
        name.includes("spa") ||
        name.includes("bouteille") ||
        name.includes("2 pers") ||
        name.includes("personne") ||
        name.includes("frais supplémentaires");

      const isBaseOrDiscount =
        name.includes("prix de base") ||
        name.includes("base price") ||
        name.includes("code promo") ||
        name.includes("réduction") ||
        name.includes("commission") ||
        type === "base" ||
        type === "discount";

      // Return true if it's an addon or special extra, and NOT a base price or discount
      return (isAddon || isSpecialExtra) && !isBaseOrDiscount;
    });

    if (data.portalName === "Airbnb" || data.channelName === "Airbnb") {
      console.log(`Found ${extraElements.length} extras in priceElements`);
    }

    console.log(
      `📌 Booking ${data.id}: Raw extras before processing:`,
      data.extras
    );
    console.log(
      `📌 Booking ${data.id}: Extracted priceElements:`,
      data.priceDetails?.priceElements
    );

    console.log(
      `📌 Booking ${data.id}: Source of extras -`,
      data.extras?.length > 0
        ? "✅ Using extras array"
        : "⚠️ Extracting from priceElements"
    );

    // Inside processBookingData in BookingReport.jsx
    extractedExtras = extraElements.map((element) => ({
      name: element.name || "Extra",
      amount: Math.abs(parseFloat(element.amount) || 0),
      quantity: parseInt(element.quantity) || 1,
      type: element.type || "addon",
      id: element.id,
      currencyCode: element.currencyCode || "EUR",
      // IMPORTANT FIX: Preserve existing extra person data when available
      extraPersonQuantity: element.extraPersonQuantity
        ? parseInt(element.extraPersonQuantity)
        : 0,
      extraPersonPrice: element.extraPersonPrice
        ? parseFloat(element.extraPersonPrice)
        : 0,
      extraPersonAmount: element.extraPersonAmount
        ? parseFloat(element.extraPersonAmount)
        : 0,
      extraPersonName: element.extraPersonName || "Personne supplémentaire",
      hasExtraPerson:
        (element.extraPersonQuantity && element.extraPersonQuantity > 0) ||
        (element.extraPersonPrice && element.extraPersonPrice > 0) ||
        (element.extraPersonAmount && element.extraPersonAmount > 0) ||
        !!element.hasExtraPerson,
    }));
  }

  // Process all extras to ensure consistent format
  const processedExtras = extractedExtras.map((extra) => {
    // Preserve all existing extra person data or use default values
    const extraPersonQuantity = parseInt(extra.extraPersonQuantity || 0);
    const extraPersonPrice = parseFloat(extra.extraPersonPrice || 0);
    let extraPersonAmount = parseFloat(extra.extraPersonAmount || 0);
    const extraPersonName = extra.extraPersonName || "Personne supplémentaire";

    // Set hasExtraPerson based on existing data
    const hasExtraPerson =
      extraPersonQuantity > 0 ||
      extraPersonPrice > 0 ||
      extraPersonAmount > 0 ||
      !!extra.hasExtraPerson;

    // If we have quantity and price but no amount, calculate the amount
    if (
      extraPersonQuantity > 0 &&
      extraPersonPrice > 0 &&
      extraPersonAmount === 0
    ) {
      extraPersonAmount = extraPersonPrice * extraPersonQuantity;
    }

    return {
      name: extra.name || "Extra sans nom",
      amount: parseFloat(extra.amount || 0),
      quantity: parseInt(extra.quantity || 1),
      type: extra.type || "addon",
      id: extra.id,
      currencyCode: extra.currencyCode || "EUR",
      extraPersonQuantity,
      extraPersonPrice,
      extraPersonAmount,
      extraPersonName,
      hasExtraPerson,
    };
  });

  // Calculate extras total including extra person amounts
  const extrasTotal = processedExtras.reduce((sum, extra) => {
    // Include both the extra amount and any extra person amount
    return (
      sum +
      parseFloat(extra.amount || 0) +
      parseFloat(extra.extraPersonAmount || 0)
    );
  }, 0);

  if (data.portalName === "Airbnb" || data.channelName === "Airbnb") {
    if (processedExtras.length > 0) {
      console.log(
        `Airbnb booking ${smoobuId}: Processed ${processedExtras.length} extras:`,
        processedExtras.map((e) => e.name).join(", ")
      );
    } else {
      console.log(`Airbnb booking ${smoobuId}: No extras found in any source`);
    }
  }

  console.log("Processed extras before saving:", processedExtras);

  console.log(
    `✅ Booking ${data.id}: Processed extras before saving:`,
    extractedExtras
  );

  // Construct processed booking object
  bookingMap.set(smoobuId, {
    id: smoobuId,
    firestoreId: data.firestoreId, // Store the Firestore ID for reference
    guest:
      `${data.firstName} ${data.lastName}`.trim() ||
      data.guestName ||
      "Unknown",
    property: roomNames[data.apartmentId] || data.property || data.apartmentId,
    portal:
      getPortalName(data.portalName) ||
      getPortalName(data.channelName) ||
      getPortalName(String(data.channelId)) ||
      "Website",
    created: data.createdAt,
    email: data.email,
    phone: data.phone,
    address: data.street
      ? `${data.street}, ${data.postalCode} ${data.location}, ${data.country}`
      : data.address || "",
    adults: data.adults,
    children: data.children,
    checkIn: data.arrivalDate,
    checkOut: data.departureDate,
    arrivalTime: data.arrivalTime || data.checkInTime,
    departureTime: data.departureTime || data.checkOutTime,
    notes: data.notice,
    price: totalPrice,
    basePrice: basePrice, // Root level basePrice for ease of access
    guestFees: guestFees,
    priceDetails: {
      basePrice: basePrice,
      linenFee: linenFee,
      commission: commission,
      longStayDiscount: longStayDiscount,
      promoCode: promoCode,
      extrasTotal: extrasTotal,
      // Store all price elements from all sources
      priceElements: allPriceElements,
    },
    commission: commission,
    linenFee: linenFee,
    nights:
      data.priceDetails?.numberOfNights ||
      Math.ceil(
        (new Date(data.departureDate) - new Date(data.arrivalDate)) /
          (1000 * 60 * 60 * 24)
      ),
    extras: processedExtras,
    // Store original data sources for debugging
    _debug: {
      extrasSource:
        processedExtras.length > 0
          ? data.extras?.length > 0
            ? "extras"
            : data.priceDetails?.priceElements?.length > 0
            ? "priceDetails.priceElements"
            : "rootPriceElements"
          : "none",
      hasExtrasArray: data.extras && data.extras.length > 0,
      guestFees: guestFees,
      hasPriceDetailsElements:
        data.priceDetails?.priceElements &&
        data.priceDetails.priceElements.length > 0,
      hasRootElements: data.priceElements && data.priceElements.length > 0,
      originalPortalName: data.portalName || data.channelName,
      appliedCoupon: data.appliedCoupon,
      priceDetailsPromoCode: data.priceDetails?.promoCode,
    },
  });

  // Additional debug logging for bookings with extras
  if (
    data.extras &&
    data.extras.some(
      (e) =>
        e.extraPersonQuantity > 0 ||
        e.extraPersonPrice > 0 ||
        e.extraPersonAmount > 0
    )
  ) {
    console.log(
      `🔍 Booking ${smoobuId} has extras with person data in the original data`
    );
    console.log("Original extras:", data.extras);
    console.log("Processed extras:", processedExtras);
    console.log("✅ Saved booking in bookingMap:", bookingMap.get(smoobuId));
  }
};

  // Frontend function - call your backend proxy instead of Smoobu directly
  const handleFetchAndSync = async () => {
    try {
      setLoading(true);
      console.log("Starting fetch and sync...");

      // FIXED: Call your backend proxy endpoint instead of Smoobu directly
      const response = await axios.get(
        "http://localhost:3000/api/fetch-and-sync", // Your backend proxy endpoint
        {
          params: {
            startDate: new Date(startYear - 1, startMonth - 1, 1)
              .toISOString()
              .split("T")[0],
            endDate: new Date(endYear, endMonth, 0).toISOString().split("T")[0],
          },
        }
      );

      console.log("Fetch and sync response:", response.data);

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

  // Separate function to fetch from Firebase

  // Use fetchFromFirebase in the initial load
  useEffect(() => {
    fetchFromFirebase();
  }, [startMonth, startYear, endMonth, endYear]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const handleDeduplicate = async () => {
    try {
      setDeduplicating(true);
      console.log("Starting deduplication process...");

      const response = await axios.get(
        "http://localhost:3000/api/deduplicate-bookings"
      );

      console.log("Deduplication response:", response.data);

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

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("fr-FR");
  };

  const formatPrice = (price) => {
    return `€${Number(price).toFixed(2)}`;
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
      ...filteredAndSortedData.map((booking) => [
        booking.id,
        booking.guest,
        formatDate(booking.created),
        booking.portal,
        booking.email || "",
        booking.phone || "",
        booking.address || "",
        booking.adults,
        booking.children,
        formatDate(booking.checkIn),
        booking.arrivalTime || "",
        formatDate(booking.checkOut),
        booking.nights,
        booking.priceDetails.basePrice,
        booking.priceDetails.promoCode?.name || "",
        booking.priceDetails.promoCode?.amount || "",
        booking.priceDetails.linenFee || "",
        booking.priceDetails.longStayDiscount || "",
        booking.commission || "",
        booking.extras.map((e) => `${e.name} (${e.quantity}x)`).join(", "),
        booking.extras.reduce(
          (sum, extra) => sum + parseFloat(extra.amount || 0),
          0
        ),
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

  const filteredAndSortedData = reportData
    .filter((booking) =>
      Object.values(booking).some(
        (value) =>
          value &&
          value.toString().toLowerCase().includes(searchTerm.toLowerCase())
      )
    )
    .sort((a, b) => {
      const multiplier = sortDirection === "asc" ? 1 : -1;
      if (["checkIn", "checkOut", "created"].includes(sortField)) {
        return multiplier * (new Date(a[sortField]) - new Date(b[sortField]));
      }
      return (
        multiplier * String(a[sortField]).localeCompare(String(b[sortField]))
      );
    });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        Chargement...
      </div>
    );
  }

  return (
    <div className="w-full p-3 mx-auto max-w-7xl md:p-6">
      <div className="flex flex-col gap-4 mb-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="w-6 h-6 text-[#678D73]" />
          <h1 className="text-xl font-bold md:text-2xl">
            Rapport des Réservations Smoobu
          </h1>
        </div>

        <button
          onClick={handleExport}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-[#678D73] text-white rounded-lg hover:bg-[#4a6553] transition-colors w-full sm:w-auto"
          disabled={filteredAndSortedData.length === 0}
        >
          <Download size={20} />
          Exporter
        </button>
        <button
          onClick={handleFetchAndSync}
          className="flex items-center justify-center w-full gap-2 px-4 py-2 text-white transition-colors bg-blue-500 rounded-lg hover:bg-blue-600 sm:w-auto"
        >
          <RefreshCw size={20} />
          Sync Réservations
        </button>
        <button
          onClick={handleDeduplicate}
          className="flex items-center justify-center w-full gap-2 px-4 py-2 text-white transition-colors bg-purple-500 rounded-lg hover:bg-purple-600 sm:w-auto"
          disabled={deduplicating}
        >
          <Trash2 size={20} className={deduplicating ? "animate-pulse" : ""} />
          Supprimer Doublons
        </button>
      </div>

      <div className="p-4 mb-6 bg-white rounded-lg shadow">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="relative lg:col-span-1">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <Search size={20} className="text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Rechercher..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-[#678D73] focus:border-[#678D73]"
            />
          </div>

          <div className="sm:col-span-1">
            <select
              className="w-full px-3 py-2 border rounded-lg focus:ring-[#678D73] focus:border-[#678D73]"
              value={startMonth}
              onChange={(e) => setStartMonth(parseInt(e.target.value))}
            >
              {months.map((month) => (
                <option key={month.value} value={month.value}>
                  {month.label}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-1">
            <select
              className="w-full px-3 py-2 border rounded-lg focus:ring-[#678D73] focus:border-[#678D73]"
              value={startYear}
              onChange={(e) => setStartYear(parseInt(e.target.value))}
            >
              {years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-1">
            <select
              className="w-full px-3 py-2 border rounded-lg focus:ring-[#678D73] focus:border-[#678D73]"
              value={endMonth}
              onChange={(e) => setEndMonth(parseInt(e.target.value))}
            >
              {months.map((month) => (
                <option key={month.value} value={month.value}>
                  {month.label}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-1">
            <select
              className="w-full px-3 py-2 border rounded-lg focus:ring-[#678D73] focus:border-[#678D73]"
              value={endYear}
              onChange={(e) => setEndYear(parseInt(e.target.value))}
            >
              {years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {error && (
        <div className="px-4 py-3 mb-6 text-red-700 border border-red-200 rounded bg-red-50">
          {error}
        </div>
      )}

      <div className="bg-white rounded-lg shadow">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="w-8 px-4 py-3"></th>
                {/* Table headers - keeping the existing ones */}
                <th
                  className="px-4 py-3 text-xs font-semibold text-left text-gray-600 cursor-pointer md:px-6 md:text-sm"
                  onClick={() => handleSort("id")}
                >
                  ID de réservation{" "}
                  {sortField === "id" && (sortDirection === "asc" ? "↑" : "↓")}
                </th>
                <th
                  className="px-4 py-3 text-xs font-semibold text-left text-gray-600 cursor-pointer"
                  onClick={() => handleSort("guest")}
                >
                  Nom du client{" "}
                  {sortField === "guest" &&
                    (sortDirection === "asc" ? "↑" : "↓")}
                </th>
                <th
                  className="px-4 py-3 text-xs font-semibold text-left text-gray-600 cursor-pointer"
                  onClick={() => handleSort("checkIn")}
                >
                  Date d&apos;arrivée{" "}
                  {sortField === "checkIn" &&
                    (sortDirection === "asc" ? "↑" : "↓")}
                </th>
                <th
                  className="px-4 py-3 text-xs font-semibold text-left text-gray-600 cursor-pointer"
                  onClick={() => handleSort("arrivalTime")}
                >
                  Heure de check-in{" "}
                  {sortField === "arrivalTime" &&
                    (sortDirection === "asc" ? "↑" : "↓")}
                </th>
                <th
                  className="px-4 py-3 text-xs font-semibold text-left text-gray-600 cursor-pointer"
                  onClick={() => handleSort("checkOut")}
                >
                  Date de départ{" "}
                  {sortField === "checkOut" &&
                    (sortDirection === "asc" ? "↓" : "↑")}
                </th>
                <th
                  className="px-4 py-3 text-xs font-semibold text-left text-gray-600 cursor-pointer"
                  onClick={() => handleSort("property")}
                >
                  Nom du logement{" "}
                  {sortField === "property" &&
                    (sortDirection === "asc" ? "↑" : "↓")}
                </th>
                <th
                  className="px-4 py-3 text-xs font-semibold text-left text-gray-600 cursor-pointer"
                  onClick={() => handleSort("nights")}
                >
                  Nombre de nuits{" "}
                  {sortField === "nights" &&
                    (sortDirection === "asc" ? "↑" : "↓")}
                </th>
                <th
                  className="px-4 py-3 text-xs font-semibold text-left text-gray-600 cursor-pointer"
                  onClick={() => handleSort("portal")}
                >
                  Portail de réservation{" "}
                  {sortField === "portal" &&
                    (sortDirection === "asc" ? "↑" : "↓")}
                </th>
                <th
                  className="px-4 py-3 text-xs font-semibold text-left text-gray-600 cursor-pointer"
                  onClick={() => handleSort("price")}
                >
                  Prix total{" "}
                  {sortField === "price" &&
                    (sortDirection === "asc" ? "↑" : "↓")}
                </th>
              </tr>
            </thead>
            {/* Table Body */}
            <tbody className="divide-y divide-gray-200">
              {filteredAndSortedData.length > 0 ? (
                filteredAndSortedData.map((booking, index) => (
                  <React.Fragment key={`booking-${booking.id}-${index}`}>
                    <tr key={`row-${booking.id}`} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <button
                          onClick={() =>
                            setExpandedBooking(
                              expandedBooking === booking.id ? null : booking.id
                            )
                          }
                          className="p-1 rounded hover:bg-gray-100"
                        >
                          {expandedBooking === booking.id ? (
                            <ChevronUp key={`up-${booking.id}`} size={16} />
                          ) : (
                            <ChevronDown key={`down-${booking.id}`} size={16} />
                          )}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-xs font-medium text-gray-900">
                        {booking.id}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {booking.guest}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {formatDate(booking.checkIn)}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {booking.arrivalTime || "-"}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {formatDate(booking.checkOut)}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {booking.property}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {booking.nights}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {getPortalName(booking.portal)}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {(() => {
                          // Calculate total room price
                          const roomPrice =
                            parseFloat(booking.basePrice) +
                            parseFloat(booking.linenFee || 0) -
                            parseFloat(
                              booking.priceDetails?.longStayDiscount || 0
                            ) -
                            parseFloat(
                              booking.priceDetails?.promoCode?.amount || 0
                            );

                          // Calculate extras total
                          const extrasTotal =
                            booking.extras?.reduce((sum, extra) => {
                              const baseAmount = parseFloat(extra.amount || 0);
                              const extraPersonAmount =
                                extra.extraPersonQuantity > 0
                                  ? parseFloat(extra.extraPersonAmount) ||
                                    parseFloat(extra.extraPersonPrice) *
                                      parseInt(extra.extraPersonQuantity)
                                  : 0;
                              return sum + baseAmount + extraPersonAmount;
                            }, 0) || 0;

                          // Add guest fees
                          const guestFees = parseFloat(booking.guestFees || 0);

                          // Calculate final price
                          const finalPrice =
                            roomPrice + extrasTotal + guestFees;

                          return formatPrice(finalPrice);
                        })()}
                      </td>
                    </tr>
                    {expandedBooking === booking.id && (
                      <tr key={`expanded-${booking.id}`}>
                        <td colSpan="10" className="p-0">
                          {(() => {
                            diagnoseBookingData(booking);
                            return null;
                          })()}
                          <div className="p-4 bg-gray-50">
                            <div className="w-[95%] mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                              {/* Column 1: Information Client */}
                              <div className="space-y-3">
                                <h3 className="text-sm font-semibold text-gray-900">
                                  Information Client
                                </h3>
                                <div className="space-y-2">
                                  <div className="text-sm">
                                    <span className="block font-medium">
                                      Nom:
                                    </span>
                                    <span className="break-words">
                                      {booking.guest}
                                    </span>
                                  </div>
                                  <div className="text-sm">
                                    <span className="block font-medium">
                                      Mail:
                                    </span>
                                    <span className="break-words">
                                      {booking.email}
                                    </span>
                                  </div>
                                  <div className="text-sm">
                                    <span className="block font-medium">
                                      Téléphone:
                                    </span>
                                    <span className="break-words">
                                      {booking.phone}
                                    </span>
                                  </div>
                                  <div className="text-sm">
                                    <span className="block font-medium">
                                      Adresse:
                                    </span>
                                    <span className="break-words">
                                      {booking.address}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* Column 2: Information Reservation */}
                              <div className="space-y-3">
                                <h3 className="text-sm font-semibold text-gray-900">
                                  Information Réservation
                                </h3>
                                <div className="space-y-2">
                                  <div className="text-sm">
                                    <span className="block font-medium">
                                      Logement:
                                    </span>
                                    <span className="break-words">
                                      {booking.property}
                                    </span>
                                  </div>
                                  <div className="text-sm">
                                    <span className="block font-medium">
                                      Adultes:
                                    </span>
                                    {booking.adults}
                                  </div>
                                  <div className="text-sm">
                                    <span className="block font-medium">
                                      Enfants:
                                    </span>
                                    {booking.children}
                                  </div>
                                  <div className="text-sm">
                                    <span className="block font-medium">
                                      Création:
                                    </span>
                                    {formatDate(booking.created)}
                                  </div>
                                  <div className="text-sm">
                                    <span className="block font-medium">
                                      Portail:
                                    </span>
                                    {getPortalName(booking.portal)}
                                  </div>
                                </div>
                              </div>

                              <div className="space-y-3">
                                <h3 className="text-sm font-semibold text-gray-900">
                                  Détails de Prix
                                </h3>
                                <div className="space-y-2">
                                  {(() => {
                                    // Get base price directly from booking data
                                    const basePrice =
                                      booking.priceDetails?.basePrice || 0;

                                    // Get linen fee
                                    const linenFee =
                                      booking.priceDetails?.linenFee || 0;

                                    // Get long stay discount
                                    const longStayDiscount =
                                      booking.priceDetails?.longStayDiscount ||
                                      0;

                                    // Get coupon discount
                                    const couponDiscount =
                                      booking.priceDetails?.promoCode?.amount ||
                                      0;

                                    // Get commission
                                    const commission =
                                      booking.priceDetails?.commission || 0;

                                    // Calculate total room price correctly
                                    const totalRoomPrice =
                                      basePrice +
                                      linenFee -
                                      longStayDiscount -
                                      couponDiscount;

                                    return (
                                      <>
                                        {/* Base Price */}
                                        <p className="text-sm">
                                          <span className="block font-medium">
                                            Prix de base:
                                          </span>
                                          {formatPrice(basePrice)}
                                        </p>

                                        {/* Linen Fee (if applicable) */}
                                        {linenFee > 0 && (
                                          <p className="text-sm">
                                            <span className="block font-medium">
                                              Frais de linge:
                                            </span>
                                            {formatPrice(linenFee)}
                                          </p>
                                        )}

                                        {/* Long Stay Discount (if applicable) */}
                                        {longStayDiscount > 0 && (
                                          <p className="text-sm text-red-600">
                                            <span className="block font-medium">
                                              Réduction long séjour:
                                            </span>
                                            {formatPrice(-longStayDiscount)}
                                          </p>
                                        )}

                                        {/* Coupon Discount (if applicable) */}
                                        {booking.priceDetails?.promoCode &&
                                          couponDiscount > 0 && (
                                            <p className="text-sm text-green-600">
                                              <span className="block font-medium">
                                                {" "}
                                                {
                                                  booking.priceDetails.promoCode
                                                    .name
                                                }
                                                :
                                              </span>
                                              {formatPrice(-couponDiscount)}
                                            </p>
                                          )}

                                        {/* Total Room Price */}
                                        <div className="pt-2 mt-4 border-t border-gray-200">
                                          <span className="block text-sm font-medium">
                                            Total chambre:
                                          </span>
                                          <span className="text-sm">
                                            {formatPrice(totalRoomPrice)}
                                          </span>
                                        </div>

                                        {/* Commission (Displayed but NOT added to total) */}
                                        {commission > 0 && (
                                          <p className="text-sm text-gray-600">
                                            <span className="block font-medium">
                                              Commission:
                                            </span>
                                            {formatPrice(commission)}
                                          </p>
                                        )}
                                      </>
                                    );
                                  })()}
                                </div>
                              </div>
                              {/* Column 4: Détails Extras */}
                              <div className="space-y-3">
                                <h3 className="text-sm font-semibold text-gray-900">
                                  Détails Extras
                                </h3>
                                <div className="space-y-2">
                                  {(() => {
                                    // Get guest fees (extra guests charge)
                                    const extraGuestFees =
                                      booking.guestFees ||
                                      booking._debug?.guestFees ||
                                      0;

                                    // Calculate extra guests count for display
                                    const extraGuestsCount = Math.max(
                                      0,
                                      parseInt(booking.adults) +
                                        parseInt(booking.children) -
                                        (booking.priceDetails?.settings
                                          ?.startingAtGuest || 2)
                                    );

                                    // Check if we have any extras to display
                                    const hasExtras =
                                      (booking.extras &&
                                        booking.extras.length > 0) ||
                                      extraGuestFees > 0;

                                    if (hasExtras) {
                                      return (
                                        <div className="text-sm">
                                          <span className="block mb-2 font-medium">
                                            Extras sélectionnés:
                                          </span>
                                          <ul className="space-y-2">
                                            {/* Show extra guest fees as the first item if applicable */}
                                            {extraGuestFees > 0 && (
                                              <li className="break-words">
                                                • Frais supplémentaires (
                                                {extraGuestsCount} personne
                                                {extraGuestsCount > 1
                                                  ? "s"
                                                  : ""}
                                                ): {formatPrice(extraGuestFees)}
                                              </li>
                                            )}

                                            {/* Then show regular extras */}
                                            {booking.extras?.map(
                                              (extra, index) => {
                                                // Access hasExtraPerson directly from the extra object
                                                const hasExtraPerson =
                                                  extra.hasExtraPerson ||
                                                  extra.extraPersonQuantity >
                                                    0 ||
                                                  extra.extraPersonPrice > 0 ||
                                                  extra.extraPersonAmount > 0;

                                                return (
                                                  <li
                                                    key={`${booking.id}-extra-${index}`}
                                                    className="break-words"
                                                  >
                                                    • {extra.name}{" "}
                                                    {extra.quantity > 1 &&
                                                      `(${extra.quantity}x)`}
                                                    :{" "}
                                                    {formatPrice(extra.amount)}
                                                    {/* Always try to show extra person details if they might exist */}
                                                    {hasExtraPerson && (
                                                      <span className="ml-1 text-indigo-700">
                                                        <br />
                                                        <span className="ml-4">
                                                          (
                                                          {extra.extraPersonName ||
                                                            "Personne supplémentaire"}
                                                          {parseInt(
                                                            extra.extraPersonQuantity
                                                          ) > 1
                                                            ? ` (x${extra.extraPersonQuantity})`
                                                            : ""}{" "}
                                                          :{" "}
                                                          {formatPrice(
                                                            extra.extraPersonAmount ||
                                                              extra.extraPersonPrice *
                                                                extra.extraPersonQuantity
                                                          )}
                                                          )
                                                        </span>
                                                      </span>
                                                    )}
                                                  </li>
                                                );
                                              }
                                            )}
                                          </ul>

                                          <div className="pt-2 mt-4 border-t border-gray-200">
                                            <span className="font-medium">
                                              Total Extras:
                                            </span>
                                            <span className="block">
                                              {(() => {
                                                // Calculate extras total including extra person amounts
                                                const extrasTotal =
                                                  booking.extras?.reduce(
                                                    (sum, extra) => {
                                                      const baseAmount =
                                                        parseFloat(
                                                          extra.amount || 0
                                                        );
                                                      const extraPersonAmount =
                                                        extra.extraPersonQuantity >
                                                        0
                                                          ? parseFloat(
                                                              extra.extraPersonAmount
                                                            ) ||
                                                            parseFloat(
                                                              extra.extraPersonPrice
                                                            ) *
                                                              parseInt(
                                                                extra.extraPersonQuantity
                                                              )
                                                          : 0;
                                                      return (
                                                        sum +
                                                        baseAmount +
                                                        extraPersonAmount
                                                      );
                                                    },
                                                    0
                                                  ) || 0;

                                                // Add guest fees
                                                const totalWithFees =
                                                  extrasTotal +
                                                  (booking.guestFees ||
                                                    booking._debug?.guestFees ||
                                                    0);

                                                return formatPrice(
                                                  totalWithFees
                                                );
                                              })()}
                                            </span>
                                          </div>
                                        </div>
                                      );
                                    } else {
                                      return (
                                        <p className="text-sm text-gray-500">
                                          Aucun extra sélectionné
                                        </p>
                                      );
                                    }
                                  })()}
                                </div>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))
              ) : (
                <tr>
                  <td
                    colSpan="10"
                    className="px-4 py-3 text-sm text-center text-gray-500"
                  >
                    Aucune réservation trouvée pour cette période
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default BookingsReport;
