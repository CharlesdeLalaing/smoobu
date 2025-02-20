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
  "Homepage": "Website",
  "Direct booking": "Direct booking",
  "Homepage direct": "Website",
  "Direct": "Direct booking",
  "Airbnb": "Airbnb",
  "airbnb": "Airbnb",
  "Booking.com": "Booking.com",
  "booking.com": "Booking.com",
  "Expedia": "Expedia",
  "blocked": "Blocked",
  "Blocked": "Blocked",
  "Partenariat": "Partenariat",
  "partenariat": "Partenariat",
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

 const diagnoseBookingData = (booking) => {
   console.group(`Diagnosing booking ${booking.id} (${booking.portal})`);

   // Check data structure
   console.log("Basic booking info:", {
     id: booking.id,
     portal: booking.portal,
     guest: booking.guest,
     price: booking.price,
   });

   // Check extras array
   console.log("Extras array:", {
     exists: !!booking.extras,
     isArray: Array.isArray(booking.extras),
     length: booking.extras?.length || 0,
     content: booking.extras,
   });

   // Check priceDetails structure
   console.log("PriceDetails structure:", {
     exists: !!booking.priceDetails,
     hasBasePrice: !!booking.priceDetails?.basePrice,
     hasLinenFee: !!booking.priceDetails?.linenFee,
     hasCommission: !!booking.priceDetails?.commission,
     hasExtrasTotal: !!booking.priceDetails?.extrasTotal,
     hasPriceElements: !!booking.priceDetails?.priceElements,
     priceElementsLength: booking.priceDetails?.priceElements?.length || 0,
   });

   // Check priceElements content if it exists
   if (booking.priceDetails?.priceElements?.length > 0) {
     console.log(
       "PriceElements content:",
       booking.priceDetails.priceElements.map((el) => ({
         type: el.type,
         name: el.name,
         amount: el.amount,
         quantity: el.quantity,
       }))
     );

     // Check if there are any potential extras in priceElements
     const potentialExtras = booking.priceDetails.priceElements.filter(
       (el) =>
         el.type === "addon" &&
         !el.name?.toLowerCase().includes("commission") &&
         !el.name?.toLowerCase().includes("linen") &&
         !el.name?.toLowerCase().includes("nettoyage")
     );

     console.log("Potential extras in priceElements:", {
       count: potentialExtras.length,
       items: potentialExtras,
     });
   }

   // Check root-level priceElements if they exist
   if (booking.priceElements?.length > 0) {
     console.log(
       "Root-level priceElements content:",
       booking.priceElements.map((el) => ({
         type: el.type,
         name: el.name,
         amount: el.amount,
         quantity: el.quantity,
       }))
     );
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
         ((bookingsWithExtras.length / bookings.length) * 100).toFixed(1) + "%",
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
 const processBookingData = (data, bookingMap) => {
   const smoobuId = data.smoobuId || data.smoobuReservationId;

   // Skip if already processed or missing ID
   if (!smoobuId || bookingMap.has(smoobuId)) return;

   // DEBUGGING - log the structure of this booking's price-related data
   if (data.portalName === "Airbnb" || data.channelName === "Airbnb") {
     console.log(`Processing Airbnb booking ${smoobuId} - Data structure:`, {
       hasExtras: !!data.extras,
       extrasLength: data.extras?.length || 0,
       hasPriceDetails: !!data.priceDetails,
       hasPriceDetailsElements: !!data.priceDetails?.priceElements,
       priceDetailsElementsLength:
         data.priceDetails?.priceElements?.length || 0,
       hasRootPriceElements: !!data.priceElements,
       rootPriceElementsLength: data.priceElements?.length || 0,
     });
   }

   // Extract fees - check all possible paths
   const linenFee =
     parseFloat(data.priceDetails?.cleaningFee) ||
     parseFloat(data.priceDetails?.linenFee) ||
     parseFloat(data.linenFee) ||
     0;

   const commission =
     parseFloat(data.priceDetails?.commission) ||
     parseFloat(data.commission) ||
     0;

   // Get total price
   const totalPrice = parseFloat(data.price) || 0;

   // Calculate base price by SUBTRACTING fees from total
   const basePrice = totalPrice - linenFee;

   // Extract long stay discount
   const longStayDiscount =
     parseFloat(data.priceDetails?.calculatedDiscounts?.longStay) ||
     parseFloat(data.priceDetails?.discount) ||
     parseFloat(data.priceDetails?.longStayDiscount) ||
     0;

   // Map promo code info consistently
   const promoCode = data.appliedCoupon
     ? {
         name: data.appliedCoupon.code || "",
         amount: parseFloat(data.appliedCoupon.discount || 0),
       }
     : data.priceDetails?.promoCode
     ? {
         name:
           data.priceDetails.promoCode.code ||
           data.priceDetails.promoCode.name ||
           "",
         amount: parseFloat(
           data.priceDetails.promoCode.discount ||
             data.priceDetails.promoCode.amount ||
             0
         ),
       }
     : null;

   // IMPROVED: Extract extras from various sources with more robust checks
   let extractedExtras = [];
   let sourceOfExtras = "none";

   // 1. First try to use the extras array if it exists and has items
   if (data.extras && Array.isArray(data.extras) && data.extras.length > 0) {
     extractedExtras = [...data.extras];
     sourceOfExtras = "extras";

     if (data.portalName === "Airbnb" || data.channelName === "Airbnb") {
       console.log(
         `Airbnb booking ${smoobuId}: Using extras array with ${data.extras.length} items`
       );
     }
   }
   // 2. Try to extract from priceDetails.priceElements
   else if (
     data.priceDetails?.priceElements &&
     Array.isArray(data.priceDetails.priceElements) &&
     data.priceDetails.priceElements.length > 0
   ) {
     if (data.portalName === "Airbnb" || data.channelName === "Airbnb") {
       console.log(
         `Airbnb booking ${smoobuId}: Using priceDetails.priceElements with ${data.priceDetails.priceElements.length} items`
       );
     }

     // Filter price elements to find extras
 const filteredExtras = data.priceDetails.priceElements.filter((element) => {
   const name = (element.name || "").toLowerCase();
   const type = (element.type || "").toLowerCase();

   // Log each element being considered for Airbnb bookings
   if (data.portalName === "Airbnb" || data.channelName === "Airbnb") {
     console.log(`Element ${element.name} (${element.type})`);
   }

   // IMPROVED: Handle elements with null/missing type fields
   // 1. If it's specifically an "addon" type, include it (unless it's a fee)
   // 2. If it has no type but appears to be an extra (not a fee), include it
   // 3. Check for common extra names even if type is missing
   const isAddon = type === "addon";
   const isFee =
     name.includes("commission") ||
     name.includes("cleaning fee") ||
     name.includes("frais de nettoyage") ||
     name.includes("linen fee") ||
     name.includes("frais de linge") ||
     name.includes("cancellation");

   // Special detection for Airbnb extras which often have null types
   const isProbablyExtra =
     // Check for formule, which appears in many extras
     name.includes("formule") ||
     // Check for common meal types
     name.includes("petit-déjeuner") ||
     name.includes("raclette") ||
     name.includes("barbecue") ||
     name.includes("anniversaire") ||
     // Check for spa packages
     name.includes("spa") ||
     name.includes("2 pers") ||
     // For non-French extras
     name.includes("breakfast") ||
     name.includes("meal") ||
     name.includes("package") ||
     // Check for known product categories
     name.includes("(pour 2)");

   const include = (isAddon && !isFee) || (!type && isProbablyExtra);

   if (
     (data.portalName === "Airbnb" || data.channelName === "Airbnb") &&
     include
   ) {
     console.log(
       `✓ Including element as extra: ${element.name} (${element.amount})`
     );
   }

   return include;
 });

     if (data.portalName === "Airbnb" || data.channelName === "Airbnb") {
       console.log(
         `Found ${filteredExtras.length} extras in priceDetails.priceElements`
       );
     }

     extractedExtras = filteredExtras.map((element) => ({
       name: element.name || "Extra",
       amount: parseFloat(element.amount) || 0,
       quantity: parseInt(element.quantity) || 1,
     }));
     sourceOfExtras = "priceDetails.priceElements";
   }
   // 3. Try to extract from root-level priceElements (alternative structure)
   else if (
     data.priceElements &&
     Array.isArray(data.priceElements) &&
     data.priceElements.length > 0
   ) {
     if (data.portalName === "Airbnb" || data.channelName === "Airbnb") {
       console.log(
         `Airbnb booking ${smoobuId}: Using root priceElements with ${data.priceElements.length} items`
       );
     }

     // Filter price elements to find extras
     const filteredExtras = data.priceElements.filter((element) => {
       const name = (element.name || "").toLowerCase();
       const type = (element.type || "").toLowerCase();

       return (
         type === "addon" &&
         !name.includes("commission") &&
         !name.includes("cleaning fee") &&
         !name.includes("frais de nettoyage") &&
         !name.includes("linen fee") &&
         !name.includes("frais de linge")
       );
     });

     if (data.portalName === "Airbnb" || data.channelName === "Airbnb") {
       console.log(
         `Found ${filteredExtras.length} extras in root priceElements`
       );
     }

     extractedExtras = filteredExtras.map((element) => ({
       name: element.name || "Extra",
       amount: parseFloat(element.amount) || 0,
       quantity: parseInt(element.quantity) || 1,
     }));
     sourceOfExtras = "root.priceElements";
   }

   // Process all extras to ensure consistent format
   const processedExtras = extractedExtras.map((extra) => ({
     name: extra.name || "Extra sans nom",
     amount: parseFloat(extra.amount) || 0,
     quantity: parseInt(extra.quantity) || 1,
     extraPersonQuantity: parseInt(extra.extraPersonQuantity) || 0,
     extraPersonPrice: parseFloat(extra.extraPersonPrice) || 0,
     extraPersonAmount:
       extra.extraPersonQuantity > 0
         ? parseFloat(extra.extraPersonPrice) *
           parseInt(extra.extraPersonQuantity)
         : 0,
   }));

   // Calculate extras total
   const extrasTotal = processedExtras.reduce(
     (sum, extra) => sum + parseFloat(extra.amount || 0),
     0
   );

   if (data.portalName === "Airbnb" || data.channelName === "Airbnb") {
     if (processedExtras.length > 0) {
       console.log(
         `Airbnb booking ${smoobuId}: Processed ${processedExtras.length} extras from ${sourceOfExtras}:`,
         processedExtras.map((e) => e.name).join(", ")
       );
     } else {
       console.log(`Airbnb booking ${smoobuId}: No extras found in any source`);
     }
   }

   // Get all price elements from all possible locations
   const allPriceElements = [
     ...(data.priceDetails?.priceElements || []),
     ...(data.priceElements || []),
   ];

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
     priceDetails: {
       basePrice: basePrice,
       linenFee: linenFee,
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
       extrasSource: sourceOfExtras,
       hasExtrasArray: data.extras && data.extras.length > 0,
       hasPriceDetailsElements:
         data.priceDetails?.priceElements &&
         data.priceDetails.priceElements.length > 0,
       hasRootElements: data.priceElements && data.priceElements.length > 0,
     },
   });
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
                        {formatPrice(booking.price)}
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

                              {/* Column 3: Détails de Prix with improved display logic */}
                              <div className="space-y-3">
                                <h3 className="text-sm font-semibold text-gray-900">
                                  Détails de Prix
                                </h3>
                                <div className="space-y-2">
                                  <p className="text-sm">
                                    <span className="block font-medium">
                                      Prix de base:
                                    </span>
                                    {formatPrice(
                                      booking.priceDetails.basePrice
                                    )}
                                  </p>

                                  {booking.priceDetails.linenFee > 0 && (
                                    <p className="text-sm">
                                      <span className="block font-medium">
                                        Frais de linge:
                                      </span>
                                      {formatPrice(
                                        booking.priceDetails.linenFee
                                      )}
                                    </p>
                                  )}

                                  {booking.priceDetails.longStayDiscount <
                                    0 && (
                                    <p className="text-sm text-red-600">
                                      <span className="block font-medium">
                                        Réduction long séjour:
                                      </span>
                                      {formatPrice(
                                        booking.priceDetails.longStayDiscount
                                      )}
                                    </p>
                                  )}

                                  {booking.priceDetails.promoCode &&
                                    booking.priceDetails.promoCode.amount >
                                      0 && (
                                      <p className="text-sm text-green-600">
                                        <span className="block font-medium">
                                          {booking.priceDetails.promoCode
                                            .name || "Code promo"}
                                          :
                                        </span>
                                        {formatPrice(
                                          -booking.priceDetails.promoCode.amount
                                        )}
                                      </p>
                                    )}

                                  {booking.commission > 0 && (
                                    <p className="text-sm">
                                      <span className="block font-medium">
                                        Commission:
                                      </span>
                                      {formatPrice(booking.commission)}
                                    </p>
                                  )}

                                  <div className="pt-2 mt-4 border-t border-gray-200">
                                    <span className="block text-sm font-medium">
                                      Total chambre:
                                    </span>
                                    <span className="text-sm">
                                      {/* ADD fees for the total - this matches the way you want to display it */}
                                      {formatPrice(
                                        booking.priceDetails.basePrice +
                                          booking.priceDetails.linenFee
                                      )}
                                    </span>
                                  </div>
                                </div>
                              </div>
                              {/* Column 4: Détails Extras */}
                              <div className="space-y-3">
                                <h3 className="text-sm font-semibold text-gray-900">
                                  Détails Extras
                                </h3>
                                <div className="space-y-2">
                                  {(() => {
                                    // Log our decision process
                                    console.group(
                                      `Extras display decision for booking ${booking.id}`
                                    );

                                    // First check: processed extras array
                                    if (
                                      booking.extras &&
                                      booking.extras.length > 0
                                    ) {
                                      console.log(
                                        "Using processed extras array with",
                                        booking.extras.length,
                                        "items"
                                      );
                                      console.groupEnd();
                                      return (
                                        <div className="text-sm">
                                          <span className="block mb-2 font-medium">
                                            Extras sélectionnés:
                                          </span>
                                          <ul className="space-y-2">
                                            {booking.extras.map(
                                              (extra, index) => (
                                                <li
                                                  key={`${booking.id}-extra-${index}`}
                                                  className="break-words"
                                                >
                                                  • {extra.name}{" "}
                                                  {extra.quantity > 1 &&
                                                    `(${extra.quantity}x)`}
                                                  <span className="block ml-3 text-gray-600">
                                                    {formatPrice(extra.amount)}
                                                    {extra.quantity > 1 &&
                                                      ` (${formatPrice(
                                                        extra.amount /
                                                          extra.quantity
                                                      )} / unité)`}
                                                  </span>
                                                </li>
                                              )
                                            )}
                                          </ul>

                                          <div className="pt-2 mt-4 border-t border-gray-200">
                                            <span className="font-medium">
                                              Total Extras:
                                            </span>
                                            <span className="block">
                                              {formatPrice(
                                                booking.extras.reduce(
                                                  (sum, extra) =>
                                                    sum +
                                                    (parseFloat(extra.amount) ||
                                                      0),
                                                  0
                                                )
                                              )}
                                            </span>
                                          </div>
                                        </div>
                                      );
                                    }

                                    // Second check: improved filtering for priceElements
                                    else if (
                                      booking.priceDetails?.priceElements
                                        ?.length > 0
                                    ) {
                                      // IMPROVED: Better filtering for Airbnb price elements
                                      const filteredElements =
                                        booking.priceDetails.priceElements.filter(
                                          (el) => {
                                            const name = (
                                              el.name || ""
                                            ).toLowerCase();
                                            const type = (
                                              el.type || ""
                                            ).toLowerCase();

                                            // Handle elements with null/missing type fields
                                            const isAddon = type === "addon";
                                            const isFee =
                                              name.includes("commission") ||
                                              name.includes("cleaning fee") ||
                                              name.includes(
                                                "frais de nettoyage"
                                              ) ||
                                              name.includes("linen fee") ||
                                              name.includes("frais de linge") ||
                                              name.includes("cancellation");

                                            // Special detection for Airbnb extras
                                            const isProbablyExtra =
                                              name.includes("formule") ||
                                              name.includes("petit-déjeuner") ||
                                              name.includes("raclette") ||
                                              name.includes("barbecue") ||
                                              name.includes("anniversaire") ||
                                              name.includes("spa") ||
                                              name.includes("breakfast") ||
                                              name.includes("meal") ||
                                              name.includes("package") ||
                                              name.includes("(pour 2)");

                                            return (
                                              (isAddon && !isFee) ||
                                              (!type && isProbablyExtra)
                                            );
                                          }
                                        );

                                      if (filteredElements.length > 0) {
                                        console.log(
                                          "Using filtered priceElements with",
                                          filteredElements.length,
                                          "items:",
                                          filteredElements.map((e) => e.name)
                                        );
                                        console.groupEnd();

                                        return (
                                          <div className="text-sm">
                                            <span className="block mb-2 font-medium">
                                              Extras sélectionnés:
                                            </span>
                                            <ul className="space-y-2">
                                              {filteredElements.map(
                                                (element, index) => (
                                                  <li
                                                    key={`${booking.id}-element-${index}`}
                                                    className="break-words"
                                                  >
                                                    • {element.name}{" "}
                                                    {element.quantity > 1 &&
                                                      `(${element.quantity}x)`}
                                                    <span className="block ml-3 text-gray-600">
                                                      {formatPrice(
                                                        element.amount
                                                      )}
                                                      {element.quantity > 1 &&
                                                        ` (${formatPrice(
                                                          element.amount /
                                                            element.quantity
                                                        )} / unité)`}
                                                    </span>
                                                  </li>
                                                )
                                              )}
                                            </ul>

                                            <div className="pt-2 mt-4 border-t border-gray-200">
                                              <span className="font-medium">
                                                Total Extras:
                                              </span>
                                              <span className="block">
                                                {formatPrice(
                                                  filteredElements.reduce(
                                                    (sum, el) =>
                                                      sum +
                                                      (parseFloat(el.amount) ||
                                                        0),
                                                    0
                                                  )
                                                )}
                                              </span>
                                            </div>
                                          </div>
                                        );
                                      }
                                    }

                                    // Log that no extras were found
                                    console.log(
                                      "No extras found in any location for this booking"
                                    );
                                    console.groupEnd();

                                    // No extras found
                                    return (
                                      <p className="text-sm text-gray-500">
                                        Aucun extra sélectionné
                                      </p>
                                    );
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
