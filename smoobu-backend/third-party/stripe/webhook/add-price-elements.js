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

// Update this in your addExtrasToReservation function

export const addExtrasToReservation = async (reservationId, extras, apiKey) => {
  if (!extras || extras.length === 0) return { success: true };

  try {
    for (const extra of extras) {
      let retryCount = 0;
      const maxRetries = 3;

      while (retryCount < maxRetries) {
        try {
          // Get the proper name for the extra
          let extraName = extra.name;
          
          // Check if this is a key that needs translation
          if (extra.name.startsWith("extras.")) {
            extraName = extrasFrenchNames[extra.name] || extra.name;
          }
          
          // Skip if it's "personne supplémentaire"
          if (
            extraName &&
            !extraName.toLowerCase().includes("personne supplémentaire")
          ) {
            await axios.post(
              `https://login.smoobu.com/api/reservations/${reservationId}/price-elements`,
              {
                type: "addon",
                name: extraName,
                amount: extra.amount,
                quantity: extra.quantity,
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

          // Add the additional person as a separate price element
          if (extra.extraPersonQuantity > 0 && extra.extraPersonPrice) {
            const extraPersonName = extrasFrenchNames["extras.additionalPerson"] || "Personne supplémentaire";
            
            await axios.post(
              `https://login.smoobu.com/api/reservations/${reservationId}/price-elements`,
              {
                type: "addon",
                name: `${extraName} - ${extraPersonName}`,
                amount: extra.extraPersonPrice * extra.extraPersonQuantity,
                quantity: extra.extraPersonQuantity,
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

          break;
        } catch (extraError) {
          retryCount++;
          if (retryCount === maxRetries) {
            console.error("🟥 Failed to add extra:", extraError);
            throw extraError; // Re-throw to be caught by the outer try/catch
          } else {
            await wait(2000 * retryCount);
            continue;
          }
        }
      }
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
      console.error("🟥 Failed to add long stay discountt:", discountError);
      results.longStay = false;
    }
  }

  return {
    success: results.coupon && results.longStay,
    couponSuccess: results.coupon,
    longStaySuccess: results.longStay,
  };
};
