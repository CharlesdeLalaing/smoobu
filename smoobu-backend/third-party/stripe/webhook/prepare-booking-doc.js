import { extrasFrenchNames } from "../../../config/config.js";

export const prepareBookingDocument = (
  bookingData,
  paymentIntent,
  reservationId
) => {
  return {
    ...bookingData,
    smoobuReservationId: reservationId,
    paymentIntentId: paymentIntent.id,
    stripePaymentStatus: paymentIntent.status,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    price: Number(bookingData.totalPriceWithExtras),
    basePrice: Number(bookingData.basePrice),
    priceDetails: {
      basePrice: Number(bookingData.basePrice),
      finalPrice: Number(bookingData.totalPriceWithExtras),
      linenFee: 0,
      commission: 0,
      extrasTotal:
        bookingData.extras?.reduce((sum, extra) => {
          const extraAmount = Number(extra.amount);
          const extraPersonAmount =
            extra.extraPersonQuantity > 0
              ? Number(extra.extraPersonPrice) *
                Number(extra.extraPersonQuantity)
              : 0;
          return sum + extraAmount + extraPersonAmount;
        }, 0) || 0,
      discount: Number(bookingData.priceDetails?.discount || 0),
      longStayDiscount: Number(bookingData.priceDetails?.discount || 0),
      couponDiscount: bookingData.couponApplied
        ? Number(bookingData.couponApplied.discount)
        : 0,
      promoCode: bookingData.couponApplied
        ? {
            name: bookingData.couponApplied.code,
            code: bookingData.couponApplied.code,
            amount: Number(bookingData.couponApplied.discount) || 0,
            type: bookingData.couponApplied.type,
            percentageValue:
              bookingData.couponApplied.type === "percentage"
                ? Number(bookingData.couponApplied.percentageValue)
                : null,
          }
        : null,
      calculatedDiscounts: {
        longStay: Number(bookingData.priceDetails?.discount || 0),
        coupon: bookingData.couponApplied
          ? Number(bookingData.couponApplied.discount)
          : 0,
      },
      settings: bookingData.priceDetails?.settings || {},
    },
    linenFee: 0,
    commission: 0,
    extras: bookingData.extras
      ? bookingData.extras.map((extra) => {
          const translatedExtra = {
            ...extra,
            amount: Number(extra.amount),
            quantity: Number(extra.quantity),
            extraPersonAmount:
              extra.extraPersonQuantity > 0
                ? Number(extra.extraPersonPrice) *
                  Number(extra.extraPersonQuantity)
                : 0,
            extraPersonQuantity: Number(extra.extraPersonQuantity || 0),
            extraPersonPrice: Number(extra.extraPersonPrice || 0),
            name: extra.name.startsWith("extras.")
              ? extrasFrenchNames[extra.name] || extra.name
              : extra.name,
          };

          if (extra.extraPersonQuantity > 0) {
            translatedExtra.extraPersonName =
              extrasFrenchNames["extras.additionalPerson"];
          }

          return translatedExtra;
        })
      : [],
    appliedCoupon: bookingData.couponApplied
      ? {
          code: bookingData.couponApplied.code,
          type: bookingData.couponApplied.type,
          discount: Number(bookingData.couponApplied.discount) || 0,
          percentageValue:
            bookingData.couponApplied.type === "percentage"
              ? Number(bookingData.couponApplied.percentageValue) || null
              : null,
        }
      : null,
  };
};
