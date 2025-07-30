// File: src/components/BookingsReport/BookingDetails.js
import React from "react";
import { formatPrice } from "../../utils/formatters";
import ClientInfoSection from "./sections/ClientInfoSection.jsx";
import BookingInfoSection from "./sections/BookingInfoSection.jsx";
import PriceDetailsSection from "./sections/PriceDetailsSection.jsx";
import ExtrasDetailsSection from "./sections/ExtrasDetailsSection.jsx";
import SpaDetailsSection from "./sections/SpaDetailsSection.jsx";
import FreeDrinksDetailsSection from "./sections/FreeDrinksDetailsSection.jsx";
import {
  mergeAndSortExtras,
  getCleanExtrasFromPriceElements,
} from "./utils/extrasUtils.js";

/**
 * Calculates the total price for a booking using the most accurate method
 * @param {Object} booking - The booking object
 * @returns {number} - The calculated total price
 */

export function calculateBookingTotal(booking) {
  // General debug to see if function is called
  // console.log("calculateBookingTotal called - booking keys:", Object.keys(booking));
  // console.log("calculateBookingTotal booking:", {
  //   guestName: booking.guestName,
  //   guest: booking.guest,
  //   smoobuId: booking.smoobuId,
  //   id: booking.id,
  //   price: booking.price
  // });

  // For debugging, you can uncomment this to see the exact data being processed
  // console.log("Calculating total for booking:", booking.guestName, {
  //   basePrice: booking.priceDetails?.basePrice || booking.basePrice,
  //   price: booking.price,
  //   priceElements: booking.priceDetails?.priceElements,
  //   couponApplied: booking.couponApplied,
  //   couponDiscount: booking.priceDetails?.couponDiscount
  // });

  const portalName =
    booking.portalName || booking.channelName || booking.portal;
  const isAirbnb = portalName === "Airbnb";
  const isBookingCom = portalName === "Booking.com";

  const priceElements = booking.priceDetails?.priceElements || [];

  let basePrice = parseFloat(
    booking.priceDetails?.basePrice || booking.basePrice || 0
  );

  // If basePrice is 0, try to calculate it from priceElements
  if (basePrice === 0 && priceElements.length > 0) {
    // Look for base price in priceElements first
    const basePriceElement = priceElements.find(
      (element) =>
        element.name === "Prix de base" ||
        element.type === "base" ||
        element.type === "basePrice"
    );

    if (basePriceElement) {
      basePrice = parseFloat(basePriceElement.amount) || 0;
    } else if (booking.price) {
      // Fallback: calculate from total price minus extras, accounting for discounts
      const totalPrice = parseFloat(booking.price);
      const extrasTotal = priceElements
        .filter(
          (element) =>
            element.amount > 0 && // Only positive amounts (exclude discounts)
            element.name !== "Prix de base" && // Exclude base price
            !element.name.toLowerCase().includes("coupon") &&
            !element.name.toLowerCase().includes("promo") &&
            !element.name.toLowerCase().includes("réduction")
        )
        .reduce((sum, element) => sum + (parseFloat(element.amount) || 0), 0);

      // Get coupon discount amount to add back to base price calculation
      const couponDiscountAmount = priceElements
        .filter(
          (element) =>
            element.amount < 0 && // Only negative amounts (discounts)
            (element.name.toLowerCase().includes("coupon") ||
              element.name.toLowerCase().includes("promo") ||
              element.name.toLowerCase().includes("réduction"))
        )
        .reduce(
          (sum, element) => sum + Math.abs(parseFloat(element.amount) || 0),
          0
        );

      // If total price seems too low compared to extras, assume the stored price is just the base price
      if (totalPrice < extrasTotal) {
        basePrice = totalPrice;
      } else {
        // Calculate base price: total - extras + discounts (to get original base price before discounts)
        basePrice = Math.max(
          0,
          totalPrice - extrasTotal + couponDiscountAmount
        );
      }
    }
  }
  let linenFee = parseFloat(
    booking.priceDetails?.linenFee || booking.linenFee || 0
  );
  let longStayDiscount = parseFloat(
    booking.priceBreakdown?.appliedLongStayDiscount ||
      booking.priceDetailsSnapshot?.discount ||
      booking.priceDetails?.longStayDiscount ||
      0
  );

  // =================================================================
  // === THIS IS THE CRITICAL FIX ===
  // The old code did not check `booking.couponApplied.discount`.
  // This new code checks the correct location first.
  // =================================================================
  let couponDiscount = parseFloat(
    // Only use coupon discount if there's actually a coupon applied (not null)
    (booking.couponApplied
      ? booking.coupon?.discount || booking.couponApplied?.discount
      : 0) ||
      booking.priceDetails?.couponDiscount || // Fallback for older data structures.
      booking.priceDetails?.promoCode?.amount || // Another fallback.
      0 // Default to 0 if nothing is found.
  );

  // --- Check priceElements for coupon/discount entries ---
  // This is critical for bookings where coupon info is stored in priceElements
  const priceElementsToCheck =
    priceElements.length > 0
      ? priceElements
      : booking.priceBreakdown?.priceElementsForSmoobu || [];

  if (couponDiscount === 0 && priceElementsToCheck.length > 0) {
    const couponElement = priceElementsToCheck.find(
      (el) =>
        el &&
        el.name &&
        el.amount &&
        (el.type === "coupon" ||
          el.name.toLowerCase().includes("coupon") ||
          el.name.toLowerCase().includes("code promo") ||
          el.name.toLowerCase().includes("chèque cadeau") ||
          el.name.toLowerCase().includes("gift") ||
          (el.name.toLowerCase().includes("réduction") &&
            !el.name.toLowerCase().includes("long séjour") &&
            !el.name.toLowerCase().includes("longstay")) ||
          el.name.toLowerCase().includes("promo"))
    );

    if (couponElement) {
      couponDiscount = Math.abs(parseFloat(couponElement.amount));
    }
  }

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

  // Check for longStayDiscount in priceElements if not found elsewhere
  if (longStayDiscount === 0 && priceElementsToCheck.length > 0) {
    const longStayElement = priceElementsToCheck.find(
      (el) =>
        el &&
        el.name &&
        (el.name.toLowerCase().includes("long stay discount") ||
          el.name.toLowerCase().includes("réduction long séjour") ||
          el.name.toLowerCase().includes("longstay") ||
          el.type === "longStayDiscount" ||
          (el.type === "discount" &&
            !el.name.toLowerCase().includes("coupon") &&
            !el.name.toLowerCase().includes("code promo") &&
            !el.name.toLowerCase().includes("promo")))
    );
    if (longStayElement) {
      longStayDiscount = Math.abs(parseFloat(longStayElement.amount) || 0);
    }
  }

  // Calculate room subtotal (Base + Fees - Discounts)
  let roomTotal = basePrice + linenFee - longStayDiscount - couponDiscount;

  if (isBookingCom) {
    roomTotal += taxeDeSejour;
  }

  // --- Extras Calculation ---
  let displayExtras = [];
  if (priceElementsToCheck.length > 0) {
    displayExtras = getCleanExtrasFromPriceElements(
      priceElementsToCheck,
      portalName
    );
    // If priceElements didn't yield any extras, fallback to booking.extras
    if (displayExtras.length === 0 && booking.extras?.length > 0) {
      displayExtras = booking.extras;
    }
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
  const calculatedTotal = roomTotal + extrasTotal;
  const storedPrice = parseFloat(booking.price || 0);

  // Debug logging for specific bookings
  if (booking.id === "104351664" || booking.smoobuId === "104351664") {
    console.log("=== DEBUGGING TOTAL CALCULATION FOR BOOKING 104351664 ===");
    console.log("basePrice:", basePrice);
    console.log("linenFee:", linenFee);
    console.log("longStayDiscount:", longStayDiscount);
    console.log("couponDiscount:", couponDiscount);
    console.log("roomTotal (base + linen - longStay - coupon):", roomTotal);
    console.log("extrasTotal:", extrasTotal);
    console.log("calculatedTotal (room + extras):", calculatedTotal);
    console.log("storedPrice (from booking.price):", storedPrice);
  }

  // Debug logging removed - issue resolved for booking 96356178

  // Debug logs removed - issue resolved

  // For newer bookings, if stored price is reasonable and includes extras, use it
  // But only if it's very close to our calculated total (within 5% or €5)
  // However, for Airbnb bookings, always use calculated total since stored price often excludes extras

  // If we have detailed priceElements/priceBreakdown data, prefer calculated total
  // as it's more accurate than stored price which might be outdated
  const hasDetailedPriceData =
    priceElementsToCheck.length > 0 && extrasTotal > 0;

  if (
    !isAirbnb &&
    storedPrice > 0 &&
    storedPrice > roomTotal &&
    extrasTotal > 0
  ) {
    const priceDifference = Math.abs(storedPrice - calculatedTotal);
    const allowedDifference = Math.max(5, calculatedTotal * 0.05);

    // If we have detailed price breakdown data, prefer calculated total even if stored price is close
    // This ensures we use the most accurate calculation when we have complete data
    if (hasDetailedPriceData) {
      // Only use stored price if it's EXACTLY the same as calculated (no tolerance)
      if (priceDifference === 0) {
        if (booking.id === "104351664" || booking.smoobuId === "104351664") {
          console.log("RETURNING storedPrice (exact match):", storedPrice);
        }
        return storedPrice;
      }
      // Otherwise use calculated total when we have detailed data
    } else if (priceDifference <= allowedDifference) {
      // Only use tolerance logic when we don't have detailed price breakdown
      if (booking.id === "104351664" || booking.smoobuId === "104351664") {
        console.log(
          "RETURNING storedPrice (within tolerance, no detailed data):",
          storedPrice
        );
      }
      return storedPrice;
    }
  }

  // Otherwise, use our calculated total
  // console.log("Using calculated total:", calculatedTotal);
  if (booking.id === "104351664" || booking.smoobuId === "104351664") {
    console.log("RETURNING calculatedTotal:", calculatedTotal);
  }
  // Debug logging removed - issue resolved for booking 96356178
  return calculatedTotal;
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
