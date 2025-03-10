import { SmoobuClient } from "./fetch-and-sync/smoobu-client.js";
import { BookingRepository } from "./fetch-and-sync/booking-repository.js";
import { BookingProcessor } from "./fetch-and-sync/booking-processor.js";

/**
 * Handles the fetch and sync process from Smoobu to Firebase
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function fetchAndSync(req, res) {
  try {
    const { startDate, endDate } = req.query;

    // Validate required parameters
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: "Missing date parameters",
      });
    }

    console.log("🟦 Starting fetch and sync process...", {
      startDate,
      endDate,
    });

    // Initialize dependencies
    const smoobuClient = new SmoobuClient();
    const repository = new BookingRepository();
    const processor = new BookingProcessor(smoobuClient, repository);

    // 1. Fetch bookings from Smoobu API
    const bookings = await smoobuClient.fetchBookings(startDate, endDate);

    // Track statistics
    let stats = {
      fetched: bookings.length,
      added: 0,
      updated: 0,
      skipped: 0,
      errors: 0,
    };

    // 2. Fetch existing bookings from Firebase
    const existingBookingMap = await repository.fetchExistingBookings();

    // 3. Process each booking
    for (const booking of bookings) {
      stats = await processor.processBooking(
        booking,
        existingBookingMap,
        stats
      );
    }

    console.log("🟩 Sync process completed:", stats);
    return res.json({
      success: true,
      stats: stats,
      message: "Fetch and sync completed successfully",
    });
  } catch (error) {
    console.error("🟥 Error in fetch-and-sync endpoint:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "An unknown error occurred",
      message: "Failed to fetch and sync bookings",
    });
  }
}
