import { db } from "../../../firebase-config.js";
import { prepareBookingDocument } from "./prepare-booking-doc.js";
import { sendBookingConfirmation } from "../../../third-party/smoobu/sendBookingConfirmation.js";

export const storeBookingInFirebase = async (
  bookingData,
  paymentIntent,
  reservationId
) => {
  try {
    const bookingDoc = prepareBookingDocument(
      bookingData,
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
