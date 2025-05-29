// src/api/webhook/store-booking.js
import { db } from "../../../firebase-config.js"; // Ensure correct path to your Firebase admin init
import { prepareBookingDocument } from "./prepare-booking-doc.js"; // Ensure correct path
import { sendBookingConfirmation } from "../../../third-party/smoobu/sendBookingConfirmation.js"; // Ensure this path is correct
import { extrasFrenchNames } from "../../../config/config.js"; // For "Personne supplémentaire"

/**
 * Stores the prepared booking document in Firebase and sends a confirmation email.
 * This version pre-processes `bookingData.extras` before calling `prepareBookingDocument`.
 *
 * @param {object} bookingData - The booking data retrieved from pendingBookings.
 *                               This should contain fields like `selectedFreeDrinks`,
 *                               `extras` (paid, possibly needing enhancement), `basePrice`,
 *                               `guestFees`, `couponApplied`, `priceBreakdown` (with final price),
 *                               `totalPriceWithExtras` (final charged amount from create-payment-intent),
 *                               `spaDateTime`, `spaBookingPreference`, etc.
 * @param {object} paymentIntent - The Stripe paymentIntent object.
 * @param {string|number} reservationId - The Smoobu reservation ID.
 * @returns {Promise<{success: boolean, docId?: string, bookingDoc?: object, error?: string}>}
 */
export const storeBookingInFirebase = async (
  bookingData,
  paymentIntent,
  reservationId
) => {
  try {
    // --- START: Pre-processing bookingData.extras (Option B) ---
    // Ensure each paid extra object has its extra person details fully calculated.
    const processedPaidExtras = (bookingData.extras || []).map((extra) => {
      const extraPersonQty = Number(extra.extraPersonQuantity || 0);
      const extraPersonPr = Number(extra.extraPersonPrice || 0);
      const calculatedExtraPersonAmount = extraPersonQty * extraPersonPr;

      return {
        ...extra, // Spread original extra properties
        id: extra.id || Date.now() + Math.floor(Math.random() * 10000), // Ensure an ID
        amount: Number(extra.amount || 0), // Ensure amount is a number
        quantity: Number(extra.quantity || 1), // Ensure quantity is a number
        extraPersonPrice: extraPersonPr,
        extraPersonQuantity: extraPersonQty,
        extraPersonAmount: calculatedExtraPersonAmount, // Explicitly calculated amount for extra persons
        hasExtraPerson: extraPersonQty > 0,
        // Use a default name if not provided, possibly from a config
        extraPersonName:
          extra.extraPersonName ||
          extrasFrenchNames["extras.additionalPerson"] ||
          "Personne supplémentaire",
      };
    });

    // Create an updated version of bookingData to pass to prepareBookingDocument.
    // This updatedBookingData will have the `extras` array enhanced.
    // Crucially, we use the final price information (e.g., totalPriceWithExtras or priceBreakdown.finalPayableAmount)
    // that was determined when the payment intent was created, NOT recalculated here from `processedPaidExtras`.
    const updatedBookingDataWithEnhancedExtras = {
      ...bookingData,
      extras: processedPaidExtras, // Replace original extras with the processed ones
      // `totalPriceWithExtras` or `priceBreakdown.finalPayableAmount` from the original `bookingData`
      // is assumed to be the correct final charged amount.
      // No need to recalculate the grand total here. `prepareBookingDocument` will use these values.
    };
    // --- END: Pre-processing bookingData.extras ---

    // Now, call `prepareBookingDocument` with the `updatedBookingDataWithEnhancedExtras`.
    // `prepareBookingDocument` will expect `bookingData.extras` to be in this enhanced format
    // and will also process `bookingData.selectedFreeDrinks`.
    const bookingDoc = prepareBookingDocument(
      updatedBookingDataWithEnhancedExtras,
      paymentIntent,
      reservationId
    );

    // Add the fully prepared document to the 'bookings' collection in Firebase.
    const docRef = await db.collection("bookings").add(bookingDoc);


    // Send confirmation email using the comprehensive bookingDoc.
    try {
      await sendBookingConfirmation(bookingDoc); // Pass the full bookingDoc
      console.log(
        `🟩 Email: Booking confirmation email sent for ${bookingDoc.email}.`
      );
    } catch (emailError) {
      console.error(
        `🟥 Email: Failed to send booking confirmation email for ${bookingDoc.email}:`,
        emailError
      );
      // Log the error but don't necessarily fail the entire booking storage if the email fails.
    }

    // Return success, Firebase doc ID, and the `bookingDoc` itself for subsequent webhook steps.
    return { success: true, docId: docRef.id, bookingDoc: bookingDoc };
  } catch (error) {
    console.error(
      "🟥 Firebase Store: Error during booking storage or document preparation:",
      error
    );
    return { success: false, error: error.message, bookingDoc: null };
  }
};
