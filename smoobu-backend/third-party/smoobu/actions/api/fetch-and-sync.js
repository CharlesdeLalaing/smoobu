import { SmoobuClient } from "./fetch-and-sync/smoobu-client.js";
import { BookingRepository } from "./fetch-and-sync/booking-repository.js";
import { BookingProcessor } from "./fetch-and-sync/booking-processor.js";
import {db} from "../../../../firebase-config.js";
import { normalizeBookingId } from "../../../../helpers/normalize-booking-id.js";


export async function fetchAndSync(req, res) {
  // Date range for fetching ACTIVE bookings by arrival date (Optional via query params, useful for manual sync)
  // Frontend hook sends startDate/endDate params based on the report date range.
  const { startDate, endDate } = req.query;

  // Date range for fetching RECENTLY MODIFIED bookings (Crucial for cancellations/updates, uses a lookback window)
  // Determine the start date for checking modifications/cancellations.
  // For a 12-hourly cron, fetch modifications from the last ~24-25 hours to be safe.
  // For a manual sync button, this lookback ensures recent changes are caught even if
  // the arrival date is outside the report's startDate/endDate.
  const lookbackHours = 25; // Define the lookback window in hours
  const modifiedSince = new Date();
  modifiedSince.setHours(modifiedSince.getHours() - lookbackHours);
  // Format to YYYY-MM-DD for Smoobu API 'modifiedFrom'
  const modifiedSinceDate = modifiedSince.toISOString().split("T")[0];

  // Calculate 'modifiedTo' date as tomorrow's date (YYYY-MM-DD) to include the entire current day
  const modifiedUntil = new Date();
  modifiedUntil.setDate(modifiedUntil.getDate() + 1); // Get tomorrow's date
  const modifiedUntilDate = modifiedUntil.toISOString().split("T")[0]; // Format as YYYY-MM-DD


  if (startDate && endDate) {
    console.log(
      `[Sync] Phase 1 active sync range (Arrival: ${startDate} to ${endDate}).`
    );
  } else {
    console.log(`[Sync] Phase 1 active sync by arrival date skipped.`);
  }

  try {
    // --- Initialize Dependencies ---
    const smoobuClient = new SmoobuClient();
    // Check if API key is missing before proceeding
    if (!smoobuClient.apiKey) {
      const errorMessage =
        "[Sync] Smoobu API key is missing. Cannot proceed with sync.";
      console.error(errorMessage);
      return res.status(500).json({
        success: false,
        error: errorMessage,
        message: "Server configuration error: Smoobu API key is not set.",
      });
    }

    const repository = new BookingRepository(); // Your repository for Firebase interaction
    const processor = new BookingProcessor(smoobuClient, repository);

    // --- Initialize Stats ---
    let stats = {
      fetchedActive: 0, // Bookings fetched in Phase 1
      added: 0, // New bookings added to Firebase
      updated: 0, // Existing bookings updated in Firebase
      skippedActive: 0, // Bookings skipped in Phase 1
      errorsProcessingActive: 0, // Errors processing individual bookings in Phase 1
      fetchedModified: 0, // Bookings fetched in Phase 2
      processedAsCancellation: 0, // Bookings identified as cancellations in Phase 2
      deletedFromFirebase: 0, // Bookings deleted from Firebase due to cancellation
      errorsProcessingModified: 0, // Errors processing individual bookings in Phase 2
      errorsInBatchCommit: 0, // Errors during the final batch commit
    };

    // --- Fetch Existing Bookings Once ---
    // Declare the variable using 'let' in the outer scope so it's accessible after the if/else.
    let existingBookingMap;
    // Fetch ALL (or a very wide range of) existing bookings to populate the map used by the processor.
    // This is done once to make lookups efficient for updates/additions in both phases.
    // Assumes repository.fetchExistingBookings fetches broadly (e.g., all or a very large date range).
    console.log("[Sync] Fetching all existing bookings from Firebase...");
    try {
      existingBookingMap = await repository.fetchExistingBookings(); // Assign here
      console.log(
        `[Sync] Fetched map with ${existingBookingMap.size} unique Smoobu IDs from Firebase.`
      );
    } catch (firebaseFetchError) {
      console.error(
        "🟥 [Sync] Error fetching existing bookings from Firebase:",
        firebaseFetchError
      );
      return res.status(500).json({
        success: false,
        error:
          firebaseFetchError.message ||
          "Failed to fetch existing bookings from Firebase.",
        message: "Failed to initialize sync process due to Firebase error.",
      });
    }

    // --- Phase 1: Sync Active Bookings by Arrival Date (Optional via query params) ---
    // This syncs bookings arriving in the specified range. It's good for initial population
    // or re-syncing a specific period, but Phase 2 is more critical for recent changes.
    if (startDate && endDate) {
      console.log(
        `[Sync] Phase 1: Starting Active Bookings Sync (Arrival: ${startDate} to ${endDate})...`
      );
      const activeBookings = await smoobuClient.fetchBookings(
        startDate,
        endDate
      );
      stats.fetchedActive = activeBookings.length;

      for (const booking of activeBookings) {
        // Should be redundant due to showCancellation: false in fetchBookings, but a check is safe
        if (booking.type && booking.type.toLowerCase() === "cancellation") {
          stats.skippedActive++;
          console.log(
            `[Sync] Skipped active booking ${booking.id} as it is a cancellation (should not appear in Phase 1 fetch).`
          );
          continue; // Skip cancellations in Phase 1
        }
        try {
          // processor.processBooking will find/update/add in Firebase using the existingBookingMap
          // existingBookingMap is accessible here
          stats = await processor.processBooking(
            booking,
            existingBookingMap,
            stats
          );
        } catch (procError) {
          console.error(
            `🟥 [Sync] Error processing active booking ${booking.id} during Phase 1:`,
            procError.message
          );
          stats.errorsProcessingActive++;
        }
      }
      console.log(
        "[Sync] Phase 1 (Active Bookings) Complete. Stats after Phase 1:",
        stats
      );
    } else {
      console.log(
        "[Sync] Phase 1 (Active Bookings by Arrival) skipped - no startDate/endDate query params provided."
      );
      // existingBookingMap was already fetched above
    }

    // --- Phase 2: Reconcile Recently Modified Bookings (Including Cancellations) ---
    // This phase catches:
    // 1. Cancellations (by type="cancellation") -> delete from Firebase
    // 2. Modifications to active bookings -> update in Firebase (handled by processor)
    // 3. Potentially new bookings created recently that weren't caught in Phase 1 (e.g., created/modified within the lookback window)
    console.log(
      `[Sync] Phase 2: Starting Reconciliation of Recently Modified Bookings (Modified: ${modifiedSinceDate} to ${modifiedUntilDate})...`
    );

    const recentlyModifiedBookings =
      await smoobuClient.fetchRecentlyModifiedBookings(
        modifiedSinceDate,
        modifiedUntilDate
      );
    stats.fetchedModified = recentlyModifiedBookings.length;

    if (recentlyModifiedBookings.length > 0) {
      const batch = db.batch(); // Start a Firestore batch for deletions
      let firebaseDocsAddedToDeleteBatch = 0; // Counter for docs added to deletion batch

      for (const modifiedBooking of recentlyModifiedBookings) {
        try {
          const normalizedId = normalizeBookingId(modifiedBooking.id);
          // Based on Smoobu docs, 'type: "cancellation"' is the key indicator
          const isCancelled =
            modifiedBooking.type &&
            modifiedBooking.type.toLowerCase() === "cancellation";

          if (isCancelled) {
            stats.processedAsCancellation++; // Increment cancellation stat
            console.log(
              `[Sync] Smoobu booking ${modifiedBooking.id} is a CANCELLATION (Type: ${modifiedBooking.type}). Attempting to delete from Firebase.`
            );

            // Find corresponding bookings in Firebase by smoobuId (string) and smoobuReservationId (number)
            // Need to query using the ADMIN SDK (db)
            const bookingsQueryBySmoobuId = db
              .collection("bookings")
              .where("smoobuId", "==", normalizedId);
            const bookingsQueryByReservationId = db
              .collection("bookings")
              .where("smoobuReservationId", "==", parseInt(normalizedId, 10));

            // Execute both queries concurrently
            const [snapshotBySmoobuId, snapshotByReservationId] =
              await Promise.all([
                bookingsQueryBySmoobuId.get(),
                bookingsQueryByReservationId.get(),
              ]);

            // Collect unique document references found in Firebase
            const docsFound = new Map(); // Map: doc.id -> doc.ref
            snapshotBySmoobuId.forEach((doc) => docsFound.set(doc.id, doc.ref));
            snapshotByReservationId.forEach((doc) => {
              // Only add if not already found by smoobuId (shouldn't happen with correct data, but safe)
              if (!docsFound.has(doc.id)) {
                docsFound.set(doc.id, doc.ref);
              }
            });

            // Add found documents to the Firestore batch for deletion
            if (docsFound.size > 0) {
              console.log(
                `[Sync] Found ${docsFound.size} Firebase document(s) to delete for cancelled Smoobu ID ${normalizedId}. Adding to delete batch.`
              );
              docsFound.forEach((docRef) => {
                batch.delete(docRef); // Add the delete operation to the batch
                firebaseDocsAddedToDeleteBatch++; // Increment the counter
              });
            } else {
              console.log(
                `[Sync] No Firebase booking found for cancelled Smoobu ID ${normalizedId}. It may have already been deleted or never synced.`
              );
            }
          } else {
            // This booking was modified but is NOT a cancellation.
            // Re-process it using the BookingProcessor to update its details in Firebase.
            // processor.processBooking will find the existing record (from existingBookingMap or by querying Firebase itself if the map doesn't have it)
            // and update it if needed, or add it if it's a new booking modified recently.
            console.log(
              `[Sync] Smoobu booking ${modifiedBooking.id} is MODIFIED (Type: ${modifiedBooking.type}). Re-processing to update...`
            );
            // existingBookingMap is accessible here
            // processor.processBooking updates stats.added/updated/errorsProcessingActive (ideally these stats should be split for Phase 2)
            // For now, we track errorsProcessingModified separately
            try {
              // Call processor without affecting Phase 1 stats directly
              const tempStats = { added: 0, updated: 0, skipped: 0, errors: 0 }; // Use temporary stats object
              const updatedTempStats = await processor.processBooking(
                modifiedBooking,
                existingBookingMap,
                tempStats
              );

              // Aggregate stats manually if needed, or rely on the main counters
              stats.added += updatedTempStats.added;
              stats.updated += updatedTempStats.updated;
              // Note: processor.processBooking errors are logged internally, but the outer catch also catches errors here.
            } catch (procError) {
              console.error(
                `🟥 [Sync] Error re-processing modified (non-cancellation) booking ${modifiedBooking.id} during Phase 2:`,
                procError.message
              );
              stats.errorsProcessingModified++;
            }
          }
        } catch (modError) {
          // This outer catch catches errors thrown during processing a single modified booking,
          // including issues with the cancellation deletion logic or the inner processor call.
          console.error(
            `🟥 [Sync] Error processing modified/cancelled Smoobu booking ID ${modifiedBooking.id} during Phase 2:`,
            modError.message
          );
          stats.errorsProcessingModified++; // Increment error stat for Phase 2
        }
      }

      // Commit the batch deletion outside the loop
      if (firebaseDocsAddedToDeleteBatch > 0) {
        console.log(
          `[Sync] Committing batch deletion of ${firebaseDocsAddedToDeleteBatch} bookings.`
        );
        try {
          await batch.commit(); // Execute all batched delete operations
          stats.deletedFromFirebase = firebaseDocsAddedToDeleteBatch; // Update final deleted count stat
          console.log(`[Sync] Batch delete successful.`);
        } catch (batchError) {
          console.error(
            "🟥 [Sync] Error committing Firebase deletion batch:",
            batchError
          );
          stats.errorsInBatchCommit++;
          // The sync process will report success:true, but stats will show batch commit error count.
          // Consider changing the final res.json status if batch commit fails.
        }
      } else {
        console.log(
          "[Sync] No Firebase bookings added to deletion batch. Batch commit skipped."
        );
      }
    } else {
      console.log(
        "[Sync] No recently modified bookings found in Smoobu to process for cancellations/updates in Phase 2."
      );
    }

    console.log("[Sync] Sync Process Finished. Final Stats:", stats);

    // Send response back to the client (your frontend button)
    // Decide if success: true is appropriate even if batch commit had errors (stats will show it)
    // or if you should return an error status. For now, keeping success: true if no critical error before batch.
    const overallSuccess =
      stats.errorsProcessingActive === 0 &&
      stats.errorsProcessingModified === 0 &&
      stats.errorsInBatchCommit === 0;

    return res.json({
      success: overallSuccess, // Indicate overall success based on errors
      stats: stats,
      message: overallSuccess
        ? "Fetch and sync completed successfully."
        : "Fetch and sync completed with errors. Check logs.",
      error: overallSuccess
        ? null
        : "See stats for error counts and backend logs for details.",
    });
  } catch (error) {
    // This catch block handles errors originating from setting up the sync, fetching from Smoobu (client instantiation, initial fetch),
    // or fetching existing bookings from Firebase (repository call).
    console.error(
      "🟥 [Sync] Critical error in main fetch-and-sync endpoint:",
      error
    );

    // Attempt to return an error response
    let errorMessage =
      error.message ||
      "An unknown error occurred during the sync process startup.";
    // Check if it's a specific error from our code (like missing API key)
    if (error.message && error.message.includes("API key is missing")) {
      errorMessage = "Server configuration error: Smoobu API key is not set.";
    }

    return res.status(500).json({
      success: false,
      error: errorMessage,
      message: "Failed to complete the sync process due to a critical error.",
      details: error.message, // Include error message in details
    });
  }
}