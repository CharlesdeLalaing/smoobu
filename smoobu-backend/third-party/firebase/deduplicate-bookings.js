import { db } from "../../firebase-config.js"

export async function deduplicateBookings(req, res) {
  try {
    console.log("🟦 Starting deduplication process...");

    // Get all bookings from Firebase
    const bookingsSnapshot = await db.collection("bookings").get();
    const bookings = [];
    bookingsSnapshot.forEach((doc) => {
      bookings.push({
        id: doc.id,
        ...doc.data(),
      });
    });


    // Group by smoobuId
    const bookingsBySmoobuId = {};
    bookings.forEach((booking) => {
      const smoobuId = booking.smoobuId;
      if (!smoobuId) return; // Skip entries without smoobuId

      if (!bookingsBySmoobuId[smoobuId]) {
        bookingsBySmoobuId[smoobuId] = [];
      }
      bookingsBySmoobuId[smoobuId].push(booking);
    });

    // Find duplicates
    const duplicates = Object.entries(bookingsBySmoobuId)
      .filter(([_, group]) => group.length > 1)
      .map(([smoobuId, group]) => ({
        smoobuId,
        count: group.length,
        bookings: group,
      }));


    // Delete duplicates - keep only the most recently updated one for each smoobuId
    let deletedCount = 0;
    for (const duplicate of duplicates) {
      // Sort by updatedAt (newest first)
      duplicate.bookings.sort((a, b) => {
        const dateA = new Date(a.updatedAt || a.createdAt || 0);
        const dateB = new Date(b.updatedAt || b.createdAt || 0);
        return dateB - dateA;
      });

      // Keep the first one (newest), delete the rest
      const [keep, ...toDelete] = duplicate.bookings;
      console.log(
        `🟨 Keeping booking ${keep.id} for smoobuId ${duplicate.smoobuId}`
      );

      for (const booking of toDelete) {
        console.log(
          `🟥 Deleting duplicate booking ${booking.id} for smoobuId ${duplicate.smoobuId}`
        );
        await db.collection("bookings").doc(booking.id).delete();
        deletedCount++;
      }
    }


    res.json({
      success: true,
      stats: {
        totalBookings: bookings.length,
        duplicateGroups: duplicates.length,
        deletedBookings: deletedCount,
      },
    });
  } catch (error) {
    console.error("🟥 Error during deduplication:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}
