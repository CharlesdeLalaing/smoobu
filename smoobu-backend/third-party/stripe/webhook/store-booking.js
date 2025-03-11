import { db } from "../../../firebase-config.js";
import { prepareBookingDocument } from "./prepare-booking-doc.js";
import { sendBookingConfirmation } from "../../../third-party/smoobu/sendBookingConfirmation.js";

export const storeBookingInFirebase = async (
  bookingData,
  paymentIntent,
  reservationId
) => {
  try {
    // Pre-process extras to ensure they have the right format and include additional person data
    const processedExtras = bookingData.extras.map((extra) => {
      // Make sure each extra has properly formatted additional person data
      return {
        ...extra,
        hasExtraPerson: extra.extraPersonQuantity > 0,
        extraPersonAmount:
          (extra.extraPersonPrice || 0) * (extra.extraPersonQuantity || 0),
        extraPersonName: extra.extraPersonName || "Personne supplémentaire",
      };
    });

    // Update booking data with processed extras
    const updatedBookingData = {
      ...bookingData,
      extras: processedExtras,
      // Calculate the total price including all extras and additional persons
      totalPriceWithExtras: calculateTotalPriceWithExtras(
        bookingData,
        processedExtras
      ),
    };

    // Prepare the final booking document
    const bookingDoc = prepareBookingDocument(
      updatedBookingData,
      paymentIntent,
      reservationId
    );



    const docRef = await db.collection("bookings").add(bookingDoc);


    // Send confirmation email
    await sendBookingConfirmation(bookingDoc);

    return { success: true, docId: docRef.id };
  } catch (error) {
    console.error("🟥 Error storing in Firebase:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Calculate the total price including all extras and additional persons
 * @param {Object} bookingData - Original booking data
 * @param {Array} processedExtras - Processed extras with additional person info
 * @returns {number} - Total price
 */
function calculateTotalPriceWithExtras(bookingData, processedExtras) {
  // Start with base price
  let total = parseFloat(bookingData.basePrice) || 0;

  // Add guest fees
  if (bookingData.guestFees) {
    total += parseFloat(bookingData.guestFees) || 0;
  }

  // Add all extras and their additional person amounts
  processedExtras.forEach((extra) => {
    // Add main extra amount
    total += parseFloat(extra.amount) || 0;

    // Add additional person amount if applicable
    if (extra.extraPersonQuantity > 0) {
      total += parseFloat(extra.extraPersonAmount) || 0;
    }
  });

  // Subtract any discounts
  if (bookingData.couponApplied) {
    total -= parseFloat(bookingData.couponApplied.discount) || 0;
  }

  if (bookingData.priceDetails?.longStayDiscount) {
    total -= parseFloat(bookingData.priceDetails.longStayDiscount) || 0;
  }

  return total;
}
