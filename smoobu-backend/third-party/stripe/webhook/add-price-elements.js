import axios from "axios";
import { wait } from "../../../helpers/wait.js";
import { extrasFrenchNames } from "../../../config/config.js";

export const addBasePriceToReservation = async (
  reservationId,
  basePrice,
  apiKey
) => {
  try {
    await axios.post(
      `https://login.smoobu.com/api/reservations/${reservationId}/price-elements`,
      {
        type: "base",
        name: "Prix de base",
        amount: basePrice,
        quantity: 1,
        currencyCode: "EUR",
      },
      {
        headers: {
          "Api-Key": apiKey || process.env.SMOOBU_API_KEY,
          "Content-Type": "application/json",
        },
      }
    );
    return { success: true };
  } catch (error) {
    console.error("🟥 Failed to add base price:", error);
    return { success: false, error: error.message };
  }
};

export const addGuestFeesToReservation = async (
  reservationId,
  bookingData,
  apiKey
) => {
  if (bookingData.guestFees <= 0) return { success: true };

  try {
    const extraGuests = Math.max(
      0,
      parseInt(bookingData.adults) +
        parseInt(bookingData.children) -
        (bookingData.priceDetails?.settings?.startingAtGuest || 2)
    );

    await axios.post(
      `https://login.smoobu.com/api/reservations/${reservationId}/price-elements`,
      {
        type: "addon",
        name: `Frais supplémentaires (${extraGuests} personne${
          extraGuests > 1 ? "s" : ""
        })`,
        amount: bookingData.guestFees,
        quantity: 1,
        currencyCode: "EUR",
      },
      {
        headers: {
          "Api-Key": apiKey || process.env.SMOOBU_API_KEY,
          "Content-Type": "application/json",
        },
      }
    );
    return { success: true };
  } catch (error) {
    console.error("🟥 Failed to add guest fees:", error);
    return { success: false, error: error.message };
  }
};

export const addExtrasToReservation = async (reservationId, extras, apiKey) => {
  if (!extras || extras.length === 0) return { success: true };

  try {
    for (const extra of extras) {
      const totalExtraAmount =
        Number(extra.amount) +
        Number(extra.extraPersonPrice) * Number(extra.extraPersonQuantity);

      await axios.post(
        `https://login.smoobu.com/api/reservations/${reservationId}/price-elements`,
        {
          type: "addon",
          name: extra.name.startsWith("extras.")
            ? extrasFrenchNames[extra.name]
            : extra.name,
          amount: totalExtraAmount,
          quantity: extra.quantity || 1,
          currencyCode: "EUR",
        },
        {
          headers: {
            "Api-Key": apiKey || process.env.SMOOBU_API_KEY,
            "Content-Type": "application/json",
          },
        }
      );
      await wait(1000);
    }
    return { success: true };
  } catch (error) {
    console.error("🟥 Failed to add extras:", error);
    return { success: false, error: error.message };
  }
};

export const addDiscountsToReservation = async (
  reservationId,
  bookingData,
  apiKey
) => {
  const results = { coupon: true, longStay: true };

  // Add coupon discount if present
  if (bookingData.couponApplied) {
    try {
      const couponName =
        bookingData.couponApplied.type === "percentage"
          ? `Code promo: ${bookingData.couponApplied.code} (-${bookingData.couponApplied.percentageValue}%)`
          : `Code promo: ${bookingData.couponApplied.code} (-${bookingData.couponApplied.discount}€)`;

      await axios.post(
        `https://login.smoobu.com/api/reservations/${reservationId}/price-elements`,
        {
          type: "discount",
          name: couponName,
          amount: -bookingData.couponApplied.discount,
          quantity: 1,
          currencyCode: "EUR",
        },
        {
          headers: {
            "Api-Key": apiKey || process.env.SMOOBU_API_KEY,
            "Content-Type": "application/json",
          },
        }
      );
      await wait(1000);
    } catch (couponError) {
      console.error("🟥 Failed to add coupon discount:", couponError);
      results.coupon = false;
    }
  }

  // Add long stay discount if present
  if (bookingData.priceDetails?.discount > 0) {
    try {
      await axios.post(
        `https://login.smoobu.com/api/reservations/${reservationId}/price-elements`,
        {
          type: "discount",
          name: `Réduction long séjour (${bookingData.priceDetails.settings.lengthOfStayDiscount.discountPercentage}%)`,
          amount: -bookingData.priceDetails.discount,
          quantity: 1,
          currencyCode: "EUR",
        },
        {
          headers: {
            "Api-Key": apiKey || process.env.SMOOBU_API_KEY,
            "Content-Type": "application/json",
          },
        }
      );
      await wait(1000);
    } catch (discountError) {
      console.error("🟥 Failed to add long stay discount:", discountError);
      results.longStay = false;
    }
  }

  return {
    success: results.coupon && results.longStay,
    couponSuccess: results.coupon,
    longStaySuccess: results.longStay,
  };
};
