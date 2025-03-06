// File: src/components/BookingsReport/BookingDetails.js
import React from "react";
import { formatDate, formatPrice, getPortalName } from "../../utils/formatters";

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
  const portalName = booking.portalName || booking.channelName || "";
  const isAirbnb = portalName === "Airbnb";

  // Price elements
  const priceElements = booking.priceDetails?.priceElements || [];

  let basePrice = 0;
  let linenFee = 0;
  let longStayDiscount = 0;
  let couponDiscount = 0;

  if (isAirbnb) {
    // For Airbnb, use our specialized base price extractor
    basePrice = extractAirbnbBasePrice(priceElements, booking);

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
  } else {
    // For non-Airbnb bookings, use the normal fields
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
          <span className="text-sm">{formatPrice(totalRoomPrice)}</span>
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

/**
 * Special function to find the base price for Airbnb bookings
 * @param {Array} priceElements - The price elements from the booking
 * @param {Object} booking - The booking object
 * @returns {number} - The extracted base price
 */
function extractAirbnbBasePrice(priceElements, booking) {
  // Initialize base price
  let basePrice = 0;

  // First approach: Try to find the "Base Price" element
  const basePriceElement = priceElements.find(
    (el) =>
      el &&
      el.name &&
      (el.name === "Base Price" ||
        el.name === "base_price" ||
        el.name === "BasePrice")
  );

  if (basePriceElement && basePriceElement.amount) {
    basePrice = Math.abs(parseFloat(basePriceElement.amount));
    return basePrice;
  }

  // Second approach: Try to find the "Cancellation Payout" element
  // This often contains the actual room amount in Airbnb
  const payoutElement = priceElements.find(
    (el) => el && el.name && el.name.includes("Cancellation Payout")
  );

  if (payoutElement && payoutElement.amount) {
    basePrice = Math.abs(parseFloat(payoutElement.amount));
    return basePrice;
  }

  // Third approach: Try to use the booking price
  if (booking.price) {
    // Subtract known extras from total price
    let extrasTotal = 0;
    const relevantExtras = priceElements.filter(
      (el) =>
        el &&
        el.name &&
        el.amount &&
        (el.name.includes("formule") ||
          el.name.includes("anniversaire") ||
          el.name.includes("détente") ||
          el.name.includes("gourmet") ||
          el.name.includes("essentiel") ||
          el.name.includes("romantique"))
    );

    extrasTotal = relevantExtras.reduce(
      (sum, el) => sum + parseFloat(el.amount || 0),
      0
    );

    // Subtract extras from total price
    basePrice = parseFloat(booking.price) - extrasTotal;

    // Subtract linen fee if present
    const linenFeeElement = priceElements.find(
      (el) =>
        el &&
        el.name &&
        (el.name.includes("LINEN_FEE") ||
          el.name.includes("linen_fee") ||
          el.name.includes("Linen Fee"))
    );

    if (linenFeeElement && linenFeeElement.amount) {
      basePrice -= parseFloat(linenFeeElement.amount);
    }

    return Math.max(0, basePrice);
  }

  // Fourth approach: Try to use the nights and a constant value
  if (booking.nights) {
    // Assume a standard nightly rate
    const nights = parseInt(booking.nights) || 1;
    basePrice = nights * 150; // Assuming 150€ per night as default
    return basePrice;
  }

  // If all else fails, return a fallback value
  return 180; // Reasonable fallback
}

const ExtrasDetailsSection = ({ booking }) => {
  // Get extras from price elements for guaranteed deduplication
  const priceElements = booking.priceDetails?.priceElements || [];
  const portalName = booking.portalName || booking.channelName;
  const displayExtras = getExtrasFromPriceElements(priceElements, portalName);

  // Calculate total
  const extrasTotal = displayExtras.reduce(
    (sum, extra) => sum + parseFloat(extra.amount || 0),
    0
  );

  // Check if we have any extras to display
  const hasExtras = displayExtras.length > 0;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-gray-900">Détails Extras</h3>
      <div className="space-y-2">
        {hasExtras ? (
          <div className="text-sm">
            <span className="block mb-2 font-medium">Extras sélectionnés:</span>
            <ul className="space-y-2">
              {displayExtras.map((extra, index) => (
                <li
                  key={`extra-item-${index}`}
                  className={
                    extra.isPersonExtra
                      ? "ml-4 text-indigo-700 break-words"
                      : "break-words"
                  }
                >
                  • {extra.name} {extra.quantity > 1 && `(${extra.quantity}x)`}:{" "}
                  {formatPrice(extra.amount)}
                </li>
              ))}
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
 * Gets a clean list of extras from price elements
 * @param {Array} priceElements - Array of price elements from booking data
 * @param {string} portalName - Portal name for special handling
 * @returns {Array} - Clean list of extras for display
 */
function getExtrasFromPriceElements(priceElements, portalName) {
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
    if (!el.amount || !el.name) return false;

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
    // Skip if we already have this exact name
    if (uniqueExtras.has(el.name)) return;

    // Determine if this is a person extra
    const isPersonExtra = el.name.includes("Personne supplémentaire");

    // Add this extra
    uniqueExtras.set(el.name, {
      name: el.name,
      amount: el.amount,
      quantity: el.quantity || 1,
      isPersonExtra: isPersonExtra,
    });
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

export default BookingDetails;
