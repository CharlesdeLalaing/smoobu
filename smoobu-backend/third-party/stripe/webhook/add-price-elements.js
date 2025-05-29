// src/api/webhook/add-price-elements.js
import axios from "axios";
import { wait } from "../../../helpers/wait.js"; // Ensure this helper exists and works
// extrasFrenchNames is imported but might not be heavily used if bookingDoc provides final names.
// It's good to have it available for any static keys if needed.
import { extrasFrenchNames } from "../../../config/config.js";

// --- Add Base Price ---
export const addBasePriceToReservation = async (
  reservationId,
  basePrice, // From bookingDoc.basePrice or bookingDoc.priceBreakdown.roomBasePrice
  apiKey
) => {
  if (basePrice === undefined || basePrice === null || basePrice <= 0) {

    return { success: true, message: "No positive base price to add." };
  }
  try {
    await axios.post(
      `https://login.smoobu.com/api/reservations/${reservationId}/price-elements`,
      {
        type: "base",
        name: "Prix de base", // Static French name
        amount: parseFloat(basePrice.toFixed(2)),
        quantity: 1,
        currencyCode: "EUR",
      },
      {
        headers: {
          "Api-Key": apiKey,
          "Content-Type": "application/json",
          "Cache-Control": "no-cache",
        },
      }
    );

    return { success: true };
  } catch (error) {
    const errorMessage =
      error.response?.data?.message || error.response?.data || error.message;
    console.error(
      `🟥 Smoobu: Failed to add base price for reservation ${reservationId}. Error: ${errorMessage}`,
      error.config?.data
    );
    return { success: false, error: errorMessage };
  }
};

// --- Add Guest Fees ---
export const addGuestFeesToReservation = async (
  reservationId,
  bookingDoc, // Full bookingDoc
  apiKey
) => {
  const guestFees = parseFloat(
    bookingDoc.guestFees || bookingDoc.priceBreakdown?.calculatedGuestFees || 0
  );
  if (guestFees <= 0) {

    return { success: true, message: "No guest fees to add." };
  }

  try {
    const totalGuests =
      (Number(bookingDoc.adults) || 0) + (Number(bookingDoc.children) || 0);
    // Prefer settings from priceDetailsSnapshot if available, then priceBreakdown, then default
    const startingAtGuestConfig =
      bookingDoc.priceDetailsSnapshot?.settings?.startingAtGuest ||
      bookingDoc.priceBreakdown?.settings?.startingAtGuest;
    const startingAtGuest =
      startingAtGuestConfig !== undefined ? Number(startingAtGuestConfig) : 2;
    const extraGuests = Math.max(0, totalGuests - startingAtGuest);

    // Constructing the name directly in French
    const guestFeeName =
      extraGuests > 0
        ? `Frais voyageurs suppl. (${extraGuests} personne${
            extraGuests > 1 ? "s" : ""
          })`
        : "Frais voyageurs"; // Fallback if fee exists but extraGuests is 0 (e.g. per child fee)

    await axios.post(
      `https://login.smoobu.com/api/reservations/${reservationId}/price-elements`,
      {
        type: "addon",
        name: guestFeeName,
        amount: parseFloat(guestFees.toFixed(2)),
        quantity: 1,
        currencyCode: "EUR",
      },
      {
        headers: {
          "Api-Key": apiKey,
          "Content-Type": "application/json",
          "Cache-Control": "no-cache",
        },
      }
    );

    return { success: true };
  } catch (error) {
    const errorMessage =
      error.response?.data?.message || error.response?.data || error.message;
    console.error(
      `🟥 Smoobu: Failed to add guest fees for reservation ${reservationId}. Error: ${errorMessage}`,
      error.config?.data
    );
    return { success: false, error: errorMessage };
  }
};

// --- Add PAID Extras ---
// Assumes `paidExtras` (from `bookingDoc.extras`) contains items where `extra.name`
// and `extra.extraPersonName` are already the final French display strings.
export const addExtrasToReservation = async (
  reservationId,
  paidExtras, // This is bookingDoc.extras
  apiKey
) => {
  if (!paidExtras || paidExtras.length === 0) {

    return { success: true };
  }

  let allSucceeded = true;


  for (const extra of paidExtras) {
    // `extra.name` is assumed to be the final French display name from prepareBookingDocument.
    // `extra.extraPersonName` is also assumed to be the final French display name.
    let mainExtraAddedSuccessfully = true;

    // Add the main extra item only if it has a positive amount or it's explicitly a zero-cost item being tracked
    if (extra.amount > 0 || (extra.amount === 0 && extra.quantity > 0)) {
      try {
        await axios.post(
          `https://login.smoobu.com/api/reservations/${reservationId}/price-elements`,
          {
            type: "addon",
            name: (extra.name || "Extra payant").substring(0, 250), // Use pre-set French name
            amount: parseFloat(extra.amount.toFixed(2)),
            quantity: Number(extra.quantity || 1),
            currencyCode: "EUR",
          },
          {
            headers: {
              "Api-Key": apiKey,
              "Content-Type": "application/json",
              "Cache-Control": "no-cache",
            },
          }
        );

        await wait(1000);
      } catch (error) {
        const errorMessage =
          error.response?.data?.message ||
          error.response?.data ||
          error.message;
        console.error(
          `  🟥 Smoobu: Failed to add paid extra "${extra.name}" for ${reservationId}. Error: ${errorMessage}`,
          error.config?.data
        );
        allSucceeded = false;
        mainExtraAddedSuccessfully = false;
      }
    } else if (extra.amount < 0) {
      console.warn(
        `  ⚠️ Smoobu: Paid extra "${extra.name}" has a negative amount ${extra.amount} and was not added as a regular extra. Discounts should be handled separately.`
      );
      mainExtraAddedSuccessfully = false; // Don't add associated extra person cost if main item is a discount
    }

    // Add the additional person amount for THIS extra, if applicable, positive, and main extra was added.
    if (
      extra.hasExtraPerson &&
      extra.extraPersonAmount > 0 &&
      mainExtraAddedSuccessfully
    ) {
      try {
        // `extra.extraPersonName` is assumed to be "Personne supplémentaire" (French) from prepareBookingDocument
        const extraPersonDisplayName = `${extra.name} - ${extra.extraPersonName}`;
        await axios.post(
          `https://login.smoobu.com/api/reservations/${reservationId}/price-elements`,
          {
            type: "addon",
            name: extraPersonDisplayName.substring(0, 250),
            amount: parseFloat(extra.extraPersonAmount.toFixed(2)),
            // Quantity for extra person cost line item:
            // If extra.extraPersonAmount is a total FOR ALL extra persons of THAT extra, quantity should be 1.
            // If extra.extraPersonAmount is PER extra person, then quantity should be extra.extraPersonQuantity.
            // Your `prepareBookingDocument` calculates `extraPersonAmount` as `extraPersonQty * extraPersonPr`.
            // So, `extra.extraPersonAmount` is already a total. Thus, quantity here should be 1.
            quantity: 1,
            currencyCode: "EUR",
          },
          {
            headers: {
              "Api-Key": apiKey,
              "Content-Type": "application/json",
              "Cache-Control": "no-cache",
            },
          }
        );

        await wait(1000);
      } catch (error) {
        const errorMessage =
          error.response?.data?.message ||
          error.response?.data ||
          error.message;
        console.error(
          `  🟥 Smoobu: Failed to add extra person cost for "${extra.name}" for ${reservationId}. Error: ${errorMessage}`,
          error.config?.data
        );
        allSucceeded = false;
      }
    }
  }
  return { success: allSucceeded };
};


// --- Add Discounts (Coupon & Long Stay) ---
// Uses bookingDoc to get couponInfo and longStayDiscountAmount
export const addDiscountsToReservation = async (
  reservationId,
  bookingDoc,
  apiKey
) => {
  let couponSuccess = true;
  let longStaySuccess = true;

  const couponInfo = bookingDoc.couponApplied; // From bookingDoc
  const longStayDiscountAmount = parseFloat(
    bookingDoc.priceBreakdown?.appliedLongStayDiscount || 0
  ); // From bookingDoc

  // Add coupon discount
  if (couponInfo && couponInfo.discount > 0) {
    try {
      // Constructing name directly in French
      let couponName = `${
        extrasFrenchNames["priceDetails.promoCode.generic"] || "Code Promo"
      }: ${couponInfo.code}`;
      if (couponInfo.type === "percentage" && couponInfo.percentageValue) {
        couponName += ` (-${couponInfo.percentageValue}%)`;
      } else {
        couponName += ` (-${couponInfo.discount.toFixed(2)}€)`;
      }
      if (couponInfo.isGiftVoucher) {
        couponName = `${
          extrasFrenchNames["priceDetails.giftVoucher"] || "Chèque Cadeau"
        }: ${couponInfo.code} (-${couponInfo.discount.toFixed(2)}€)`;
      }

      await axios.post(
        `https://login.smoobu.com/api/reservations/${reservationId}/price-elements`,
        {
          type: "discount",
          name: couponName.substring(0, 250),
          amount: -parseFloat(couponInfo.discount.toFixed(2)),
          quantity: 1,
          currencyCode: "EUR",
        },
        {
          headers: {
            "Api-Key": apiKey,
            "Content-Type": "application/json",
            "Cache-Control": "no-cache",
          },
        }
      );

      await wait(1000);
    } catch (error) {
      const errorMessage =
        error.response?.data?.message || error.response?.data || error.message;
      console.error(
        `🟥 Smoobu: Failed to add coupon discount (${couponInfo.code}) for ${reservationId}. Error: ${errorMessage}`,
        error.config?.data
      );
      couponSuccess = false;
    }
  } else {
    console.log(
      `ℹ️ Smoobu: No coupon discount to add for reservation ${reservationId}.`
    );
  }

  // Add long stay discount
  if (longStayDiscountAmount > 0) {
    try {
      // Constructing name directly in French
      let longStayName =
        extrasFrenchNames["priceDetails.longStayDiscount"] ||
        "Réduction long séjour";
      const discountSettings =
        bookingDoc.priceDetailsSnapshot?.settings?.lengthOfStayDiscount ||
        bookingDoc.priceBreakdown?.settings?.lengthOfStayDiscount; // Check both places
      if (discountSettings?.discountPercentage) {
        longStayName += ` (${discountSettings.discountPercentage}%)`;
      }

      await axios.post(
        `https://login.smoobu.com/api/reservations/${reservationId}/price-elements`,
        {
          type: "discount",
          name: longStayName.substring(0, 250),
          amount: -parseFloat(longStayDiscountAmount.toFixed(2)),
          quantity: 1,
          currencyCode: "EUR",
        },
        {
          headers: {
            "Api-Key": apiKey,
            "Content-Type": "application/json",
            "Cache-Control": "no-cache",
          },
        }
      );

      await wait(1000);
    } catch (error) {
      const errorMessage =
        error.response?.data?.message || error.response?.data || error.message;
      console.error(
        `🟥 Smoobu: Failed to add long stay discount for ${reservationId}. Error: ${errorMessage}`,
        error.config?.data
      );
      longStaySuccess = false;
    }
  } else {
    console.log(
      `ℹ️ Smoobu: No long stay discount to add for reservation ${reservationId}.`
    );
  }

  return {
    success: couponSuccess && longStaySuccess,
    couponSuccess: couponSuccess,
    longStaySuccess: longStaySuccess,
  };
};
