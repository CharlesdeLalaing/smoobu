// File: src/components/BookingsReport/BookingDetails.js
import React from "react";
import { formatDate, formatPrice, getPortalName } from "../../utils/formatters";

/**
 * Calculates the total price for a booking using the most accurate method
 * @param {Object} booking - The booking object
 * @returns {number} - The calculated total price
 */

export function calculateBookingTotal(booking) {
  // Check if this is an Airbnb or Booking.com booking
  const portalName =
    booking.portalName || booking.channelName || booking.portal;
  const isAirbnb = portalName === "Airbnb";
  const isBookingCom = portalName === "Booking.com";

  // Get price elements if available
  const priceElements = booking.priceDetails?.priceElements || [];

  // Calculate room price components
  let basePrice = parseFloat(
    booking.priceDetails?.basePrice || booking.basePrice || 0
  );
  let linenFee = parseFloat(
    booking.priceDetails?.linenFee || booking.linenFee || 0
  );
  let longStayDiscount = parseFloat(
    booking.priceDetails?.longStayDiscount || 0
  );
  let couponDiscount = parseFloat(
    booking.priceDetails?.promoCode?.amount ||
      booking.priceDetails?.couponDiscount ||
      0
  );
  let taxeDeSejour = 0;

  // For Airbnb, handle different price calculation
  if (isAirbnb && priceElements.length > 0) {
    // Try to find the base price element
    const basePriceElement = priceElements.find(
      (el) =>
        el && el.name && (el.name === "Base Price" || el.name === "base_price")
    );

    if (basePriceElement) {
      basePrice = parseFloat(basePriceElement.amount) || 0;
    }

    // For Airbnb, reset other components that might not apply
    longStayDiscount = 0;
    couponDiscount = 0;
  } 
  // For Booking.com, handle taxe de séjour specially
  else if (isBookingCom) {
    // Look for taxe de séjour in priceElements
    const taxeElement = priceElements.find(
      (el) => el && el.name && el.name.toLowerCase().includes("taxe de séjour")
    );
    
    if (taxeElement) {
      taxeDeSejour = parseFloat(taxeElement.amount) || 0;
    }
  }

  // Calculate room subtotal
  let roomTotal = basePrice + linenFee - longStayDiscount - couponDiscount;
  
  // For Booking.com, include taxe de séjour in the room total
  if (isBookingCom) {
    roomTotal += taxeDeSejour;
  }

  // Get clean extras
  let displayExtras = [];

  // If we have price elements, use those for a consistent display
  if (priceElements.length > 0) {
    displayExtras = getCleanExtrasFromPriceElements(priceElements, portalName);
  }
  // Otherwise fall back to the extras array
  else if (booking.extras?.length > 0) {
    displayExtras = booking.extras;
  }

  // For Booking.com, remove TVA and taxe de séjour from extras since they're in the room price
  if (isBookingCom) {
    displayExtras = displayExtras.filter(
      (extra) => 
        !extra.name.includes("TVA") && 
        !extra.name.toLowerCase().includes("taxe de séjour")
    );
  }

  // Merge duplicate extras
  const mergedExtras = mergeAndSortExtras(displayExtras);

  // Calculate extras total
  const extrasTotal = mergedExtras.reduce(
    (sum, extra) => sum + parseFloat(extra.amount || 0),
    0
  );

  // Calculate total price
  return roomTotal + extrasTotal;
}

/**
 * Gets a clean list of extras from price elements
 * @param {Array} priceElements - Array of price elements from booking data
 * @param {string} portalName - Portal name for special handling
 * @returns {Array} - Clean list of extras for display
 */
function getCleanExtrasFromPriceElements(priceElements, portalName) {
  if (!priceElements || !Array.isArray(priceElements)) return [];

  // Define unwanted extras patterns
  const unwantedPatterns = [
    "cancellation",
    "Cancellation",
    "pass_through",
    "PASS_THROUGH",
    "service fee",
    "Service Fee",
    "host fee",
    "Host Fee",
    "guest fee",
    "Guest Fee",
    "cleaning fee",
    "Cleaning Fee",
    "LINEN_FEE",
    "linen_fee",
    "Base Price",
    "base_price",
    "Commission",
    "commission",
    "Tax",
    "tax",
    "VAT",
    "vat",
  ];

  // Is this an Airbnb booking?
  const isAirbnb = portalName === "Airbnb";

  // Only include relevant price elements
  const relevantElements = priceElements.filter((el) => {
    if (!el || !el.amount || !el.name) return false;

    // For Airbnb, be very selective
    if (isAirbnb) {
      // Only allow formules and specific extras
      return (
        el.name.toLowerCase().includes("formule") ||
        el.name.toLowerCase().includes("anniversaire") ||
        el.name.toLowerCase().includes("détente") ||
        el.name.toLowerCase().includes("gourmet") ||
        el.name.toLowerCase().includes("essentiel") ||
        el.name.toLowerCase().includes("romantique")
      );
    } else {
      // For non-Airbnb, filter out unwanted patterns
      return (
        el.amount > 0 &&
        !el.name.includes("Prix de base") &&
        !el.name.includes("Base price") &&
        !el.name.includes("Code promo") &&
        !el.name.includes("Réduction") &&
        !unwantedPatterns.some((pattern) => el.name.includes(pattern))
      );
    }
  });

  // Use a Map for deduplication
  const uniqueExtras = new Map();

  // Process all extras
  relevantElements.forEach((el) => {
    // Create a clean key for the map
    const cleanName = el.name.trim();

    // If we already have this extra in our map
    if (uniqueExtras.has(cleanName)) {
      // For "Personne supplémentaire" extras, merge quantities and amounts
      if (cleanName.includes("Personne supplémentaire")) {
        const existingExtra = uniqueExtras.get(cleanName);

        // Calculate total quantity and amount
        const existingQuantity = parseInt(existingExtra.quantity) || 1;
        const currentQuantity = parseInt(el.quantity) || 1;
        const totalQuantity = existingQuantity + currentQuantity;

        const existingAmount = parseFloat(existingExtra.amount) || 0;
        const currentAmount = parseFloat(el.amount) || 0;
        const totalAmount = existingAmount + currentAmount;

        // Update the existing extra
        existingExtra.quantity = totalQuantity;
        existingExtra.amount = totalAmount;

        // Update the map
        uniqueExtras.set(cleanName, existingExtra);
      }
      // For other extras, only replace if this one has more data
      else if (
        parseFloat(el.amount) > parseFloat(uniqueExtras.get(cleanName).amount)
      ) {
        uniqueExtras.set(cleanName, {
          name: cleanName,
          amount: parseFloat(el.amount) || 0,
          quantity: parseInt(el.quantity) || 1,
          id: el.id,
        });
      }
    }
    // If this is a new extra, add it to the map
    else {
      uniqueExtras.set(cleanName, {
        name: cleanName,
        amount: parseFloat(el.amount) || 0,
        quantity: parseInt(el.quantity) || 1,
        id: el.id,
      });
    }
  });

  // Convert Map values to array
  const result = Array.from(uniqueExtras.values());

  // Special handling for duplicate "Frais supplémentaires"
  const fraisElements = result.filter((e) =>
    e.name.includes("Frais supplémentaires")
  );
  if (fraisElements.length > 1) {
    // Keep only the first one
    const toKeep = fraisElements[0];
    return result.filter(
      (e) => !e.name.includes("Frais supplémentaires") || e === toKeep
    );
  }

  return result;
}

const BookingDetails = ({ booking }) => {
  // Guard clause to handle undefined booking
  if (!booking) {
    return (
      <div className="p-4 bg-gray-50">
        <div className="text-center text-gray-500">
          Détails de réservation non disponibles
        </div>
      </div>
    );
  }

  // Calculate the total price
  const totalPrice = calculateBookingTotal(booking);

  return (
    <div className="p-4 bg-gray-50">
      <div className="w-[95%] mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Column 1: Information Client */}
        <ClientInfoSection booking={booking} />

        {/* Column 2: Booking Information */}
        <BookingInfoSection booking={booking} />

        {/* Column 3: Price Details */}
        <PriceDetailsSection booking={booking} />

        {/* Column 4: Extras Details */}
        <ExtrasDetailsSection booking={booking} />
      </div>

      {/* Add total price display at the bottom */}
      <div className="pr-6 mt-6 text-right">
        <span className="text-lg font-bold">
          Total: {formatPrice(totalPrice)}
        </span>
      </div>
    </div>
  );
};

const ClientInfoSection = ({ booking }) => (
  <div className="space-y-3">
    <h3 className="text-sm font-semibold text-gray-900">Information Client</h3>
    <div className="space-y-2">
      <div className="text-sm">
        <span className="block font-medium">Nom:</span>
        <span className="break-words">{booking.guest}</span>
      </div>
      <div className="text-sm">
        <span className="block font-medium">Mail:</span>
        <span className="break-words">{booking.email}</span>
      </div>
      <div className="text-sm">
        <span className="block font-medium">Téléphone:</span>
        <span className="break-words">{booking.phone}</span>
      </div>
      <div className="text-sm">
        <span className="block font-medium">Adresse:</span>
        <span className="break-words">{booking.address}</span>
      </div>
    </div>
  </div>
);

const BookingInfoSection = ({ booking }) => (
  <div className="space-y-3">
    <h3 className="text-sm font-semibold text-gray-900">
      Information Réservation
    </h3>
    <div className="space-y-2">
      <div className="text-sm">
        <span className="block font-medium">Logement:</span>
        <span className="break-words">{booking.property}</span>
      </div>
      <div className="text-sm">
        <span className="block font-medium">Adultes:</span>
        {booking.adults}
      </div>
      <div className="text-sm">
        <span className="block font-medium">Enfants:</span>
        {booking.children}
      </div>
      <div className="text-sm">
        <span className="block font-medium">Création:</span>
        {formatDate(booking.created)}
      </div>
      <div className="text-sm">
        <span className="block font-medium">Portail:</span>
        {getPortalName(booking.portal)}
      </div>
    </div>
  </div>
);

const PriceDetailsSection = ({ booking }) => {
  // Get portal name
  const portalName =
    booking.portalName || booking.channelName || booking.portal;
  const isAirbnb = portalName === "Airbnb";
  const isBookingCom = portalName === "Booking.com";

  // For Airbnb, we may need special handling
  let basePrice = 0;
  let linenFee = 0;
  let longStayDiscount = 0;
  let couponDiscount = 0;
  let taxeDeSejour = 0;

  if (isAirbnb) {
    // For Airbnb, extract base price from price elements
    const priceElements = booking.priceDetails?.priceElements || [];

    // Find base price element
    const basePriceElement = priceElements.find(
      (el) =>
        el && el.name && (el.name === "Base Price" || el.name === "base_price")
    );

    if (basePriceElement) {
      basePrice = parseFloat(basePriceElement.amount) || 0;
    }

    // Find linen fee
    const linenFeeElement = priceElements.find(
      (el) =>
        el &&
        el.name &&
        (el.name.includes("LINEN_FEE") ||
          el.name.includes("linen_fee") ||
          el.name.includes("Linen Fee"))
    );

    if (linenFeeElement) {
      linenFee = parseFloat(linenFeeElement.amount) || 0;
    }

    // Find commission (for display only)
    const commissionElement = priceElements.find(
      (el) =>
        el &&
        el.name &&
        (el.name.includes("Cancellation Host Fee") ||
          el.name.includes("Host Fee"))
    );

    if (commissionElement) {
      booking.commission = parseFloat(commissionElement.amount) || 0;
    }
  } else if (isBookingCom) {
    // For Booking.com bookings
    basePrice = parseFloat(
      booking.priceDetails?.basePrice || booking.basePrice || 0
    );

    // Look for taxe de séjour in priceElements
    const priceElements = booking.priceDetails?.priceElements || [];
    const taxeElement = priceElements.find(
      (el) => el && el.name && el.name.toLowerCase().includes("taxe de séjour")
    );

    if (taxeElement) {
      taxeDeSejour = parseFloat(taxeElement.amount) || 0;
    }
  } else {
    // For non-Airbnb/non-Booking.com bookings, use the normal fields
    basePrice = parseFloat(
      booking.priceDetails?.basePrice || booking.basePrice || 0
    );
    linenFee = parseFloat(
      booking.priceDetails?.linenFee || booking.linenFee || 0
    );
    longStayDiscount = parseFloat(booking.priceDetails?.longStayDiscount || 0);
    couponDiscount = parseFloat(
      booking.priceDetails?.promoCode?.amount ||
        booking.priceDetails?.couponDiscount ||
        0
    );
  }

  // Calculate total room price
  const totalRoomPrice =
    basePrice + linenFee - longStayDiscount - couponDiscount;

  // Get commission for display (if any)
  const commission = parseFloat(booking.commission || 0);

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-gray-900">Détails de Prix</h3>
      <div className="space-y-2">
        {/* Base Price */}
        <p className="text-sm">
          <span className="block font-medium">Prix de base:</span>
          {formatPrice(basePrice)}
        </p>

        {/* Linen Fee (if applicable) */}
        {linenFee > 0 && (
          <p className="text-sm">
            <span className="block font-medium">Frais de linge:</span>
            {formatPrice(linenFee)}
          </p>
        )}

        {/* Taxe de Séjour for Booking.com (if applicable) */}
        {isBookingCom && taxeDeSejour > 0 && (
          <p className="text-sm">
            <span className="block font-medium">Taxe de séjour:</span>
            {formatPrice(taxeDeSejour)}
          </p>
        )}

        {/* Long Stay Discount (if applicable) */}
        {longStayDiscount > 0 && (
          <p className="text-sm text-red-600">
            <span className="block font-medium">Réduction long séjour:</span>
            {formatPrice(-longStayDiscount)}
          </p>
        )}

        {/* Coupon Discount (if applicable) */}
        {couponDiscount > 0 && booking.priceDetails?.promoCode && (
          <p className="text-sm text-green-600">
            <span className="block font-medium">
              {`Code promo: ${booking.priceDetails.promoCode.code || "PROMO"}:`}
            </span>
            {formatPrice(-couponDiscount)}
          </p>
        )}

        {/* Total Room Price */}
        <div className="pt-2 mt-4 border-t border-gray-200">
          <span className="block text-sm font-medium">Total chambre:</span>
          <span className="text-sm">
            {isBookingCom
              ? formatPrice(basePrice + taxeDeSejour)
              : formatPrice(totalRoomPrice)}
          </span>
        </div>

        {/* Commission (Displayed but NOT added to total) */}
        {commission > 0 && (
          <p className="text-sm text-gray-600">
            <span className="block font-medium">Commission:</span>
            {formatPrice(commission)}
          </p>
        )}
      </div>
    </div>
  );
};

const ExtrasDetailsSection = ({ booking }) => {
  // Get portal name
  const portalName =
    booking.portalName || booking.channelName || booking.portal;
  const isBookingCom = portalName === "Booking.com";

  // Process and organize extras
  let displayExtras = [];

  // If we have price elements, use those for a consistent display
  if (booking.priceDetails?.priceElements?.length > 0) {
    const priceElements = booking.priceDetails.priceElements;
    displayExtras = getCleanExtrasFromPriceElements(priceElements, portalName);

    // For Booking.com, remove TVA and taxe de séjour from extras
    if (isBookingCom) {
      displayExtras = displayExtras.filter(
        (extra) =>
          !extra.name.includes("TVA") &&
          !extra.name.toLowerCase().includes("taxe de séjour")
      );
    }
  }
  // Otherwise fall back to the extras array
  else if (booking.extras?.length > 0) {
    displayExtras = booking.extras;

    // For Booking.com, filter out TVA from extras
    if (isBookingCom) {
      displayExtras = displayExtras.filter(
        (extra) =>
          !extra.name.includes("TVA") &&
          !extra.name.toLowerCase().includes("taxe de séjour")
      );
    }
  }

  // Merge duplicate extras and sort them
  const mergedAndSortedExtras = mergeAndSortExtras(displayExtras);

  // Calculate total
  const extrasTotal = mergedAndSortedExtras.reduce(
    (sum, extra) => sum + parseFloat(extra.amount || 0),
    0
  );

  // Check if we have any extras to display
  const hasExtras = mergedAndSortedExtras.length > 0;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-gray-900">Détails Extras</h3>
      <div className="space-y-2">
        {hasExtras ? (
          <div className="text-sm">
            <span className="block mb-2 font-medium">Extras sélectionnés:</span>
            <ul className="space-y-2">
              {mergedAndSortedExtras.map((extra, index) => {
                // Check if this is a person extra
                const isPersonExtra = extra.name.includes(
                  "Personne supplémentaire"
                );

                return (
                  <li
                    key={`extra-item-${index}`}
                    className={
                      isPersonExtra
                        ? "ml-4 text-indigo-700 break-words"
                        : "break-words"
                    }
                  >
                    • {extra.name}{" "}
                    {extra.quantity > 1 && `(${extra.quantity}x)`}:{" "}
                    {formatPrice(extra.amount)}
                  </li>
                );
              })}
            </ul>

            <div className="pt-2 mt-4 border-t border-gray-200">
              <span className="font-medium">Total Extras:</span>
              <span className="block">{formatPrice(extrasTotal)}</span>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-500">Aucun extra sélectionné</p>
        )}
      </div>
    </div>
  );
};

/**
 * Merges duplicate extras before displaying them
 * @param {Array} extras - Array of extras
 * @returns {Array} - Array with duplicates merged
 */
function mergeAndSortExtras(extras) {
  if (!extras || !Array.isArray(extras)) return [];

  // Create a map to track extras by name for deduplication
  const mergedExtrasMap = new Map();

  // First pass: merge duplicates by combining their amounts and quantities
  extras.forEach((extra) => {
    if (!extra.name) return;

    // Clean up the name to handle slight variations
    const cleanName = extra.name.trim();

    if (mergedExtrasMap.has(cleanName)) {
      // We found a duplicate - merge it with the existing one
      const existingExtra = mergedExtrasMap.get(cleanName);

      // Add the amounts
      existingExtra.amount =
        parseFloat(existingExtra.amount || 0) + parseFloat(extra.amount || 0);

      // Add the quantities
      existingExtra.quantity =
        parseInt(existingExtra.quantity || 1) + parseInt(extra.quantity || 1);

      // Update the map
      mergedExtrasMap.set(cleanName, existingExtra);
    } else {
      // New extra - add it to the map
      mergedExtrasMap.set(cleanName, { ...extra });
    }
  });

  // Get the merged extras
  let mergedExtras = Array.from(mergedExtrasMap.values());

  // Now sort them using the same logic as before
  return sortExtras(mergedExtras);
}

/**
 * Sorts extras to keep related items together
 * @param {Array} extras - Array of extras
 * @returns {Array} - Sorted array of extras
 */
function sortExtras(extras) {
  if (!extras || !Array.isArray(extras)) return [];

  // Create a map to group related extras
  const extrasGroups = new Map();
  const mainExtras = [];
  const personExtras = [];

  // First pass: separate main extras and person extras
  extras.forEach((extra) => {
    if (!extra.name) return;

    const isPersonExtra = extra.name.includes("Personne supplémentaire");

    if (isPersonExtra) {
      personExtras.push(extra);
    } else {
      mainExtras.push(extra);

      // Initialize the group for this main extra
      const baseName = extra.name.split(" - ")[0].trim();
      if (!extrasGroups.has(baseName)) {
        extrasGroups.set(baseName, []);
      }
    }
  });

  // Second pass: assign person extras to their parent groups
  personExtras.forEach((personExtra) => {
    // Extract the parent name from the person extra name
    let parentName = "";

    if (personExtra.name.includes(" - ")) {
      // If the name has a format like "Parent Name - Personne supplémentaire"
      parentName = personExtra.name.split(" - ")[0].trim();
    }

    // If we found a parent and it exists in our groups, add this person extra to that group
    if (parentName && extrasGroups.has(parentName)) {
      extrasGroups.get(parentName).push(personExtra);
    } else {
      // If we can't determine the parent, handle it as an orphan
      // Create a fallback group
      if (!extrasGroups.has("Autres")) {
        extrasGroups.set("Autres", []);
      }
      extrasGroups.get("Autres").push(personExtra);
    }
  });

  // Sort main extras by name for consistency
  mainExtras.sort((a, b) => {
    // Special case: always put "Frais supplémentaires" at the top
    if (a.name.includes("Frais supplémentaires")) return -1;
    if (b.name.includes("Frais supplémentaires")) return 1;

    return a.name.localeCompare(b.name);
  });

  // Build the final sorted array
  const result = [];

  // Add each main extra followed by its related person extras
  mainExtras.forEach((mainExtra) => {
    result.push(mainExtra);

    const baseName = mainExtra.name.split(" - ")[0].trim();
    const relatedPersonExtras = extrasGroups.get(baseName) || [];

    // Sort related person extras by name if there are multiple
    relatedPersonExtras.sort((a, b) => a.name.localeCompare(b.name));

    // Add all related person extras
    relatedPersonExtras.forEach((personExtra) => {
      result.push(personExtra);
    });
  });

  // Add any orphaned extras from the "Autres" group
  const orphans = extrasGroups.get("Autres") || [];
  orphans.forEach((orphan) => {
    result.push(orphan);
  });

  return result;
}

export default BookingDetails;
