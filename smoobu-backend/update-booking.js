// Save this as update-booking.js
import { db } from "./firebase-config.js";

async function updateBookingExtras() {
  const bookingId = "88649503";

  try {
    console.log(
      `Looking for booking ${bookingId} to update extras calculation...`
    );

    // Find the booking
    const bookingsSnapshot = await db
      .collection("bookings")
      .where("smoobuId", "==", bookingId)
      .get();

    if (bookingsSnapshot.empty) {
      console.log(`No booking found with ID ${bookingId}`);
      return;
    }

    const bookingDoc = bookingsSnapshot.docs[0];
    const bookingData = bookingDoc.data();
    console.log(`Found booking: ${bookingDoc.id}`);

    // Fix extras calculation - make sure extra person amounts are not double-counted
    const extras = bookingData.extras || [];

    // Calculate the correct extras total
    const extrasTotal = extras.reduce((sum, extra) => {
      // Just use the main amount, not extra person amount
      return sum + parseFloat(extra.amount || 0);
    }, 0);

    console.log(
      `Original extras total: ${bookingData.priceDetails?.extrasTotal}`
    );
    console.log(`Corrected extras total: ${extrasTotal}`);

    // Update the booking with the correct extras total
    await db.collection("bookings").doc(bookingDoc.id).update({
      "priceDetails.extrasTotal": extrasTotal,
    });

    console.log(
      `✅ Successfully updated extras calculation for booking ${bookingId}`
    );

    return "Booking updated successfully";
  } catch (error) {
    console.error("Error updating booking:", error);
    return `Update failed: ${error.message}`;
  }
}

// Run the update
updateBookingExtras()
  .then((result) => {
    console.log("\nResult:", result);
  })
  .catch((error) => {
    console.error("\nFatal error:", error);
  });
