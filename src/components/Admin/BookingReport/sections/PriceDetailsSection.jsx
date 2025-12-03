// File: src/components/Admin/BookingReport/PriceDetailsSection.jsx
import React from "react";
import { formatPrice } from "../../../utils/formatters"; // Adjust path if necessary

const PriceDetailsSection = ({ booking }) => {
  if (!booking) {
    return (
      <div className="text-sm text-gray-500">
        Données de réservation manquantes.
      </div>
    );
  }

  const portalName =
    booking.portalName || booking.channelName || booking.portal;
  const isAirbnb = portalName === "Airbnb";
  const isBookingCom = portalName === "Booking.com";

  let basePrice = 0;
  let linenFee = 0;
  let longStayDiscount = 0;
  let couponDiscountAmount = 0;
  let actualCouponCode = "";
  let taxeDeSejour = 0;
  let guestFees = 0;

  // --- Determine the actual coupon code used ---
  // Priority: booking.coupon (from useBookingsData processing), then fallbacks.
  if (
    booking.coupon &&
    typeof booking.coupon.code === "string" &&
    booking.coupon.code.trim() !== ""
  ) {
    actualCouponCode = booking.coupon.code;
  } else if (
    booking.appliedCoupon &&
    typeof booking.appliedCoupon.code === "string" &&
    booking.appliedCoupon.code.trim() !== ""
  ) {
    actualCouponCode = booking.appliedCoupon.code;
  } else if (
    booking.couponApplied &&
    typeof booking.couponApplied.code === "string" &&
    booking.couponApplied.code.trim() !== ""
  ) {
    actualCouponCode = booking.couponApplied.code;
  } else if (
    booking.priceDetails?.promoCode?.code &&
    typeof booking.priceDetails.promoCode.code === "string" &&
    booking.priceDetails.promoCode.code.trim() !== "" &&
    booking.priceDetails.promoCode.code.toLowerCase() !== "code"
  ) {
    actualCouponCode = booking.priceDetails.promoCode.code;
  } else if (
    booking.priceDetails?.promoCode?.name &&
    typeof booking.priceDetails.promoCode.name === "string" &&
    booking.priceDetails.promoCode.name.trim() !== "" &&
    booking.priceDetails.promoCode.name.toLowerCase() !== "code" &&
    actualCouponCode === ""
  ) {
    // Only use name if code wasn't found or was generic
    actualCouponCode = booking.priceDetails.promoCode.name;
  }

  // --- Get coupon discount amount consistently ---
  // This should represent the final monetary value of the discount.
  if (typeof booking.priceDetails?.couponDiscount === "number") {
    couponDiscountAmount = parseFloat(booking.priceDetails.couponDiscount);
  } else if (typeof booking.priceDetails?.promoCode?.amount === "number") {
    couponDiscountAmount = parseFloat(booking.priceDetails.promoCode.amount);
  } else if (booking.coupon?.discount) {
    // Use booking.coupon.discount if other more specific monetary values are not present
    // Check type if available to avoid misinterpreting a percentage as a fixed amount.
    if (!booking.coupon.type || booking.coupon.type !== "percentage") {
      couponDiscountAmount = parseFloat(booking.coupon.discount);
    } else if (!couponDiscountAmount) {
      // If it's a percentage and no monetary amount found yet
      console.warn(
        "PriceDetailsSection: booking.coupon.type is 'percentage', 'discount' field might be the percentage value. Monetary discount amount might be missing or derived from priceDetails.couponDiscount which was not found."
      );
    }
  }

  // --- Determine which priceElements to use ---
  // Check both priceDetails.priceElements and priceBreakdown.priceElementsForSmoobu
  const priceElementsToCheck =
    booking.priceDetails?.priceElements?.length > 0
      ? booking.priceDetails.priceElements
      : booking.priceBreakdown?.priceElementsForSmoobu || [];

  // --- Check priceElements for coupon/discount entries ---
  // This is critical for bookings where coupon info is stored in priceElements
  if (couponDiscountAmount === 0 && priceElementsToCheck.length > 0) {
    const priceElements = priceElementsToCheck;

    // Look for coupon entries in priceElements (exclude long stay discounts)
    const couponElement = priceElements.find(
      (el) =>
        el &&
        el.name &&
        el.amount &&
        // Exclude long stay discounts first
        !el.name.toLowerCase().includes("long séjour") &&
        !el.name.toLowerCase().includes("longstay") &&
        !(
          typeof el.id === "string" && el.id.toLowerCase().includes("longstay")
        ) &&
        (el.type === "coupon" ||
          (el.type === "discount" &&
            !el.name.toLowerCase().includes("réduction long séjour")) ||
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
      couponDiscountAmount = Math.abs(parseFloat(couponElement.amount));

      // Extract coupon code from the name if not already set
      if (!actualCouponCode) {
        if (couponElement.name.includes("Chèque Cadeau: ")) {
          const match = couponElement.name.match(/Chèque Cadeau: ([^(]+)/);
          if (match) {
            actualCouponCode = match[1].trim();
          }
        } else if (
          couponElement.name.includes("Gift.") ||
          couponElement.name.includes("GIFT.")
        ) {
          const match = couponElement.name.match(/Gift\.(\d+)|GIFT\.(\d+)/i);
          if (match) {
            actualCouponCode = `GIFT.${match[1] || match[2]}`;
          }
        } else if (couponElement.name.includes("Coupon - ")) {
          actualCouponCode = couponElement.name.replace("Coupon - ", "");
        } else if (couponElement.name.includes("Code promo: ")) {
          const match = couponElement.name.match(/Code promo: ([^(]+)/);
          if (match) {
            actualCouponCode = match[1].trim();
          }
        } else {
          // If no specific pattern matches, use generic text
          actualCouponCode = "PROMO APPLIQUÉ";
        }
      }
    }
  }

  // Additional check: If no actual coupon was applied, reset coupon values
  if (
    !booking.couponApplied &&
    !booking.appliedCoupon &&
    (!booking.priceBreakdown?.appliedCouponDiscount ||
      booking.priceBreakdown.appliedCouponDiscount === 0) &&
    !booking.priceDetails?.couponDiscount &&
    !booking.priceDetails?.promoCode
  ) {
    couponDiscountAmount = 0;
    actualCouponCode = "";
  }
  // Ensure the discount is stored as a positive value for calculations; it will be displayed as negative.
  couponDiscountAmount = Math.abs(couponDiscountAmount);

  // --- Extract Guest Fees ---
  // Try multiple sources for guest fees
  if (booking.guestFees) {
    guestFees = parseFloat(booking.guestFees) || 0;
  } else if (booking.priceBreakdown?.calculatedGuestFees) {
    guestFees = parseFloat(booking.priceBreakdown.calculatedGuestFees) || 0;
  } else if (booking.priceDetailsSnapshot?.guestFees) {
    guestFees = parseFloat(booking.priceDetailsSnapshot.guestFees) || 0;
  } else if (priceElementsToCheck.length > 0) {
    // Look for guest fees in price elements
    // CRITICAL: Exclude ALL extra-package-related "Personne supplémentaire" items
    const guestFeeElement = priceElementsToCheck.find((el) => {
      if (!el || !el.name || !el.amount) return false;

      const name = el.name.toLowerCase();

      // Explicit guest fee types
      if (el.type === "guests") return true;
      if (name.includes("frais voyageurs")) return true;
      if (name.includes("frais de personnes supplémentaires")) return true;
      if (name.includes("extra guest") || name.includes("additional guest"))
        return true;

      // "guest" keyword (but not if part of an extra)
      if (name.includes("guest") && !name.includes("formule")) return true;

      // CRITICAL FIX: For "personne supplémentaire", check if it's part of an extra package
      if (name.includes("personne supplémentaire")) {
        // If the name includes " - personne supplémentaire", it's likely "[Extra Name] - Personne supplémentaire"
        // This means it's part of an extra package, NOT a standalone guest fee
        if (name.includes(" - personne supplémentaire")) {
          return false; // Exclude - this is part of an extra package
        }
        // If it's standalone "Personne supplémentaire" without a parent, it's a guest fee
        return true;
      }

      return false;
    });

    if (guestFeeElement) {
      guestFees = parseFloat(guestFeeElement.amount) || 0;
    }
  }

  // --- Determine Base Price and other fees based on portal ---
  if (isAirbnb) {
    const priceElements = booking.priceDetails?.priceElements || [];
    const basePriceElement = priceElements.find(
      (el) =>
        el && el.name && (el.name === "Base Price" || el.name === "base_price")
    );
    if (basePriceElement) basePrice = parseFloat(basePriceElement.amount) || 0;

    const linenFeeElement = priceElements.find(
      (el) =>
        el &&
        el.name &&
        (el.name.includes("LINEN_FEE") ||
          el.name.includes("linen_fee") ||
          el.name.includes("Linen Fee"))
    );
    if (linenFeeElement) linenFee = parseFloat(linenFeeElement.amount) || 0;

    // Check for long stay discount in priceElements
    const longStayElement = priceElements.find(
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
    if (longStayElement)
      longStayDiscount = Math.abs(parseFloat(longStayElement.amount) || 0);

    // For commission display (not calculation of total)
    // const commissionElement = priceElements.find(el => el && el.name && (el.name.includes("Cancellation Host Fee") || el.name.includes("Host Fee")));
    // if (commissionElement) { /* localCommission = parseFloat(commissionElement.amount) || 0; */ }
  } else if (isBookingCom) {
    basePrice = parseFloat(
      booking.priceDetails?.basePrice || booking.basePrice || 0
    );

    // If basePrice is 0, try to calculate it from the total price minus extras
    if (basePrice === 0 && booking.priceDetails?.priceElements?.length > 0) {
      // Look for base price in priceElements first
      const basePriceElement = booking.priceDetails.priceElements.find(
        (element) =>
          element.name === "Prix de base" ||
          element.type === "base" ||
          element.type === "basePrice"
      );

      if (basePriceElement) {
        basePrice = parseFloat(basePriceElement.amount) || 0;
      } else if (booking.price) {
        // Fallback to original logic if no base price element found
        const totalPrice = parseFloat(booking.price);
        const priceElementsTotal = booking.priceDetails.priceElements.reduce(
          (sum, element) => {
            return sum + (parseFloat(element.amount) || 0);
          },
          0
        );

        // If total price seems too low compared to extras, assume the stored price is just the base price
        if (totalPrice < priceElementsTotal) {
          basePrice = totalPrice;
        } else {
          basePrice = Math.max(0, totalPrice - priceElementsTotal);
        }
      }
    }

    const priceElements = booking.priceDetails?.priceElements || [];
    const taxeElement = priceElements.find(
      (el) => el && el.name && el.name.toLowerCase().includes("taxe de séjour")
    );
    if (taxeElement) taxeDeSejour = parseFloat(taxeElement.amount) || 0;

    // Check for long stay discount in priceElements
    const longStayElement = priceElements.find(
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
    if (longStayElement)
      longStayDiscount = Math.abs(parseFloat(longStayElement.amount) || 0);
  } else {
    // For non-Airbnb/non-Booking.com (e.g., Direct/Website)
    basePrice = parseFloat(
      booking.priceDetails?.basePrice || booking.basePrice || 0
    );

    // If basePrice is 0, try to calculate it from the total price minus extras
    if (basePrice === 0 && booking.priceDetails?.priceElements?.length > 0) {
      // Look for base price in priceElements first
      const basePriceElement = booking.priceDetails.priceElements.find(
        (element) =>
          element.name === "Prix de base" ||
          element.type === "base" ||
          element.type === "basePrice"
      );

      if (basePriceElement) {
        basePrice = parseFloat(basePriceElement.amount) || 0;
      } else if (booking.price) {
        // Fallback to original logic if no base price element found
        const totalPrice = parseFloat(booking.price);
        const priceElementsTotal = booking.priceDetails.priceElements.reduce(
          (sum, element) => {
            return sum + (parseFloat(element.amount) || 0);
          },
          0
        );

        // If total price seems too low compared to extras, assume the stored price is just the base price
        if (totalPrice < priceElementsTotal) {
          basePrice = totalPrice;
        } else {
          basePrice = Math.max(0, totalPrice - priceElementsTotal);
        }
      }
    }

    linenFee = parseFloat(
      booking.priceDetails?.linenFee || booking.linenFee || 0
    );
    longStayDiscount = parseFloat(
      booking.priceBreakdown?.appliedLongStayDiscount ||
        booking.priceDetailsSnapshot?.discount ||
        booking.priceDetails?.longStayDiscount ||
        booking.longStayDiscount ||
        0
    );

    // If no discount found, check priceElements as fallback
    if (longStayDiscount === 0 && priceElementsToCheck.length > 0) {
      const priceElements = priceElementsToCheck;
      const longStayElement = priceElements.find(
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
  }

  // Calculate total room price logic
  const totalRoomPriceBeforeDiscountsAndTaxes =
    basePrice + linenFee + guestFees + (isBookingCom ? taxeDeSejour : 0);
  const totalDiscountsApplicable = longStayDiscount + couponDiscountAmount; // Both are positive values representing reduction
  const finalTotalRoomPrice =
    totalRoomPriceBeforeDiscountsAndTaxes - totalDiscountsApplicable;

  const commission = parseFloat(booking.commission || 0); // For display only

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-gray-900">Détails de Prix</h3>
      <div className="space-y-2">
        <p className="text-sm">
          <span className="block font-medium">Prix de base:</span>
          {formatPrice(basePrice)}
        </p>

        {linenFee > 0 && (
          <p className="text-sm">
            <span className="block font-medium">Frais de linge:</span>
            {formatPrice(linenFee)}
          </p>
        )}

        {guestFees > 0 && (
          <p className="text-sm">
            <span className="block font-medium">
              Frais voyageurs supplémentaires:
            </span>
            {formatPrice(guestFees)}
          </p>
        )}

        {isBookingCom && taxeDeSejour > 0 && (
          <p className="text-sm">
            <span className="block font-medium">Taxe de séjour:</span>
            {formatPrice(taxeDeSejour)}
          </p>
        )}

        {longStayDiscount > 0 && (
          <p className="text-sm text-red-600">
            <span className="block font-medium">Réduction long séjour:</span>
            {formatPrice(-longStayDiscount)}{" "}
            {/* Display discount as negative */}
          </p>
        )}

        {couponDiscountAmount > 0.001 && ( // Use a small epsilon for float comparison
          <p className="text-sm text-green-600">
            <span className="block font-medium">
              {booking.couponApplied?.isGiftVoucher ||
              actualCouponCode?.startsWith("GIFT")
                ? `Chèque Cadeau: ${actualCouponCode || "CADEAU APPLIQUÉ"}:`
                : `Code promo: ${actualCouponCode || "PROMO APPLIQUÉ"}:`}
            </span>
            {formatPrice(-couponDiscountAmount)}{" "}
            {/* Display discount as negative */}
          </p>
        )}

        <div className="pt-2 mt-4 border-t border-gray-200">
          <span className="block text-sm font-medium">Total chambre:</span>
          <span className="text-sm">{formatPrice(finalTotalRoomPrice)}</span>
        </div>

        {commission > 0 && (
          <p className="text-sm text-gray-600">
            <span className="block font-medium">Commission (informative):</span>
            {formatPrice(commission)}
          </p>
        )}
      </div>
    </div>
  );
};

export default PriceDetailsSection;
