// File: src/components/BookingsReport/BookingDetails.js
import React from "react";
import { formatPrice} from "../../utils/formatters";
import ClientInfoSection from "./sections/ClientInfoSection.jsx";
import BookingInfoSection from "./sections/BookingInfoSection.jsx";
import PriceDetailsSection from "./sections/PriceDetailsSection.jsx";
import ExtrasDetailsSection from "./sections/ExtrasDetailsSection.jsx";
import SpaDetailsSection from "./sections/SpaDetailsSection.jsx";
import { mergeAndSortExtras, getCleanExtrasFromPriceElements } from "./utils/extrasUtils.js";

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
