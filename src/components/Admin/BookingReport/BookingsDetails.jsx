// File: src/components/BookingsReport/BookingDetails.js
import React from "react";
import { formatPrice} from "../../utils/formatters";
import ClientInfoSection from "./sections/ClientInfoSection.jsx";
import BookingInfoSection from "./sections/BookingInfoSection.jsx";
import PriceDetailsSection from "./sections/PriceDetailsSection.jsx";
import ExtrasDetailsSection from "./sections/ExtrasDetailsSection.jsx";
import SpaDetailsSection from "./sections/SpaDetailsSection.jsx";
import FreeDrinksDetailsSection from "./sections/FreeDrinksDetailsSection.jsx";
import { mergeAndSortExtras, getCleanExtrasFromPriceElements } from "./utils/extrasUtils.js";

/**
 * Calculates the total price for a booking using the most accurate method
 * @param {Object} booking - The booking object
 * @returns {number} - The calculated total price
 */

export function calculateBookingTotal(booking) {
  // For debugging, you can uncomment this to see the exact data being processed
  // console.log("Calculating total for booking:", booking);

  const portalName =
    booking.portalName || booking.channelName || booking.portal;
  const isAirbnb = portalName === "Airbnb";
  const isBookingCom = portalName === "Booking.com";

  const priceElements = booking.priceDetails?.priceElements || [];

  let basePrice = parseFloat(
    booking.priceDetails?.basePrice || booking.basePrice || booking.price || 0
  );
  let linenFee = parseFloat(
    booking.priceDetails?.linenFee || booking.linenFee || 0
  );
  let longStayDiscount = parseFloat(
    booking.priceDetails?.longStayDiscount || 0
  );

  // =================================================================
  // === THIS IS THE CRITICAL FIX ===
  // The old code did not check `booking.couponApplied.discount`.
  // This new code checks the correct location first.
  // =================================================================
  let couponDiscount = parseFloat(
    booking.couponApplied?.discount || // CHECK HERE FIRST: This is where modern bookings save it.
      booking.priceDetails?.couponDiscount || // Fallback for older data structures.
      booking.priceDetails?.promoCode?.amount || // Another fallback.
      0 // Default to 0 if nothing is found.
  );

  let taxeDeSejour = 0;

  // This special block for Airbnb might accidentally reset the coupon.
  // Let's ensure it ONLY runs for Airbnb.
  if (isAirbnb && priceElements.length > 0) {
    const basePriceElement = priceElements.find(
      (el) =>
        el && el.name && (el.name === "Base Price" || el.name === "base_price")
    );
    if (basePriceElement) {
      basePrice = parseFloat(basePriceElement.amount) || 0;
    }
    // These resets are ONLY for Airbnb bookings.
    longStayDiscount = 0;
    couponDiscount = 0;
  } else if (isBookingCom) {
    const taxeElement = priceElements.find(
      (el) => el && el.name && el.name.toLowerCase().includes("taxe de séjour")
    );
    if (taxeElement) {
      taxeDeSejour = parseFloat(taxeElement.amount) || 0;
    }
  }

  // Calculate room subtotal (Base + Fees - Discounts)
  let roomTotal = basePrice + linenFee - longStayDiscount - couponDiscount;

  if (isBookingCom) {
    roomTotal += taxeDeSejour;
  }

  // --- Extras Calculation ---
  let displayExtras = [];
  if (priceElements.length > 0) {
    displayExtras = getCleanExtrasFromPriceElements(priceElements, portalName);
  } else if (booking.extras?.length > 0) {
    displayExtras = booking.extras;
  }

  if (isBookingCom) {
    displayExtras = displayExtras.filter(
      (extra) =>
        !extra.name.includes("TVA") &&
        !extra.name.toLowerCase().includes("taxe de séjour")
    );
  }

  const mergedExtras = mergeAndSortExtras(displayExtras);
  const extrasTotal = mergedExtras.reduce(
    (sum, extra) => sum + parseFloat(extra.amount || 0),
    0
  );

  // --- FINAL CALCULATION ---
  // The final total is the calculated room total PLUS the extras total.
  return roomTotal + extrasTotal;
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

        {booking.spaDateTime ||
        booking.spaBookingPreference ||
        booking.spaInfo ? (
          <div className="md:col-span-2 lg:col-span-4">
            <SpaDetailsSection booking={booking} />
          </div>
        ) : (
          <div className="md:col-span-2 lg:col-span-4">
            <div className="p-4 bg-white border rounded-md shadow-sm">
              <h2 className="mb-3 text-sm font-bold text-gray-700">
                Informations SPA
              </h2>
              <p className="text-sm text-gray-500">
                Aucune réservation SPA pour ce séjour
              </p>
            </div>
          </div>
        )}

        {(booking.processedFreeDrinks?.length > 0 ||
          booking.freeDrinkInfo?.needsNonAlcoholicChoice) && (
          <div className="md:col-span-2 lg:col-span-4">
            {" "}
            {/* Takes full width on medium and large */}
            <FreeDrinksDetailsSection booking={booking} />
          </div>
        )}
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




export default BookingDetails;
