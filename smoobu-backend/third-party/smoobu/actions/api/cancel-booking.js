import { db } from "../../../../firebase-config.js"; // Adjust path

export async function handleCancelSpaBooking(req, res) {
  // We expect the document ID of the slot to be cancelled.
  // For a 2-hour block, you would call this API twice, once for each slot ID.
  const { bookingId } = req.body;

  if (!bookingId) {
    return res
      .status(400)
      .json({ success: false, message: "Booking ID is required." });
  }

  try {
    const bookingRef = db.collection("spaBookings").doc(bookingId);
    const docSnap = await bookingRef.get();

    const docExists =
      typeof docSnap.exists === "function" ? docSnap.exists() : docSnap.exists;
    if (!docExists) {
      return res
        .status(404)
        .json({ success: false, message: "Booking not found." });
    }

    // Delete the document
    await bookingRef.delete();

    console.log(
      `[API] Successfully cancelled spaBooking with ID: ${bookingId}`
    );

    return res
      .status(200)
      .json({ success: true, message: "Booking cancelled successfully." });
  } catch (error) {
    console.error(`[API] Error cancelling spaBooking ${bookingId}:`, error);
    return res
      .status(500)
      .json({ success: false, message: "An internal server error occurred." });
  }
}
