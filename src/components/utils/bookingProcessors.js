// File: src/utils/bookingProcessors.js
import { getPortalName, roomNames } from "./formatters";

// Deep clone extras array ensuring all necessary properties
export const deepCloneExtras = (extras) => {
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

// Process a booking to extract and structure data consistently
export const processBookingData = (data, bookingMap) => {
  const smoobuId = data.smoobuId || data.smoobuReservationId;

  // Skip if already processed or missing ID
  if (!smoobuId || bookingMap.has(smoobuId)) return;

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

  // Process extras from all possible sources
  let extractedExtras = [];

  // 1. First try to use the extras array if it exists with proper extra person data
  if (data.extras && Array.isArray(data.extras) && data.extras.length > 0) {
    // Make a deep copy to preserve all extra person data
    extractedExtras = deepCloneExtras(data.extras);
  }
  // 2. Otherwise, extract extras from the collected allPriceElements
  else if (allPriceElements.length > 0) {
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

    extractedExtras = extraElements.map((element) => ({
      name: element.name || "Extra",
      amount: Math.abs(parseFloat(element.amount) || 0),
      quantity: parseInt(element.quantity) || 1,
      type: element.type || "addon",
      id: element.id,
      currencyCode: element.currencyCode || "EUR",
      // Preserve existing extra person data when available
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
};
