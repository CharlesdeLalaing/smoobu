import React from "react";
import { formatPrice } from "../../../utils/formatters";


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

export default PriceDetailsSection;