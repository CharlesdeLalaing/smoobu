import cron from "node-cron";
import { SmoobuClient } from "./fetch-and-sync/smoobu-client.js";
import { BookingRepository } from "./fetch-and-sync/booking-repository.js";
import { BookingProcessor } from "./fetch-and-sync/booking-processor.js";
import { db } from "../../../../firebase-config.js";
import { normalizeBookingId } from "../../../../helpers/normalize-booking-id.js";

export async function fetchAndSync(req, res) {
  const { startDate, endDate } = req.query;
  const lookbackHours = 25;
  const modifiedSince = new Date();
  modifiedSince.setHours(modifiedSince.getHours() - lookbackHours);
  const modifiedSinceDate = modifiedSince.toISOString().split("T")[0];
  const modifiedUntil = new Date();
  modifiedUntil.setDate(modifiedUntil.getDate() + 1);
  const modifiedUntilDate = modifiedUntil.toISOString().split("T")[0];

  if (startDate && endDate) {
    console.log(`[Sync] Phase 1 active sync range (Arrival: ${startDate} to ${endDate}).`);
  } else {
    console.log(`[Sync] Phase 1 active sync by arrival date skipped.`);
  }

  try {
    const smoobuClient = new SmoobuClient();
    if (!smoobuClient.apiKey) {
      const errorMessage = "[Sync] Smoobu API key is missing. Cannot proceed with sync.";
      console.error(errorMessage);
      return res.status(500).json({ success: false, error: errorMessage });
    }

    const repository = new BookingRepository();
    const processor = new BookingProcessor(smoobuClient, repository);

    let stats = {
      fetchedActive: 0, added: 0, updated: 0, skippedActive: 0,
      errorsProcessingActive: 0, fetchedModified: 0, processedAsCancellation: 0,
      processedAsRoomChange: 0, deletedFromFirebase: 0, errorsProcessingModified: 0,
      errorsInBatchCommit: 0,
    };

    let existingBookingMap;
    console.log("[Sync] Fetching all existing bookings from Firebase...");
    try {
      existingBookingMap = await repository.fetchExistingBookings();
      console.log(`[Sync] Fetched map with ${existingBookingMap.size} unique Smoobu IDs from Firebase.`);
    } catch (firebaseFetchError) {
      console.error("🟥 [Sync] Error fetching existing bookings from Firebase:", firebaseFetchError);
      return res.status(500).json({ success: false, error: "Failed to fetch existing bookings from Firebase." });
    }

    if (startDate && endDate) {
      console.log(`[Sync] Phase 1: Starting Active Bookings Sync...`);
      const activeBookings = await smoobuClient.fetchBookings(startDate, endDate);
      stats.fetchedActive = activeBookings.length;
      for (const booking of activeBookings) {
        try {
          stats = await processor.processBooking(booking, existingBookingMap, stats);
        } catch (procError) {
          console.error(`🟥 [Sync] Error processing active booking ${booking.id}:`, procError);
          stats.errorsProcessingActive++;
        }
      }
    }

    console.log(`[Sync] Phase 2: Starting Reconciliation of Recently Modified Bookings...`);
    const recentlyModifiedBookings = await smoobuClient.fetchRecentlyModifiedBookings(modifiedSinceDate, modifiedUntilDate);
    stats.fetchedModified = recentlyModifiedBookings.length;

    if (recentlyModifiedBookings.length > 0) {
      const batch = db.batch();
      let firebaseDocsAddedToDeleteBatch = 0;

      for (const modifiedBooking of recentlyModifiedBookings) {
        try {
          const normalizedId = normalizeBookingId(modifiedBooking.id);
          const isCancelled = modifiedBooking.type?.toLowerCase() === "cancellation";

          if (isCancelled) {
            stats.processedAsCancellation++;
            console.log(`[Sync] Smoobu booking ${modifiedBooking.id} is a CANCELLATION.`);
            const existingBooking = existingBookingMap.get(normalizedId);
            if (existingBooking && existingBooking.firebaseDocId) {
              console.log(`[Sync] Found Firebase doc ${existingBooking.firebaseDocId} to delete for cancelled Smoobu ID ${normalizedId}.`);
              const docRef = db.collection("bookings").doc(existingBooking.firebaseDocId);
              batch.delete(docRef);
              firebaseDocsAddedToDeleteBatch++;
            } else {
              console.log(`[Sync] No Firebase booking found for cancelled Smoobu ID ${normalizedId}.`);
            }
          } else {
            const oldBookingState = existingBookingMap.get(normalizedId);
            const newApartmentId = modifiedBooking.apartment?.id;

            // --- THIS IS THE FINAL, CRITICAL FIX ---
            // We ensure both values are STRINGS before comparing them.
            if (
              oldBookingState &&
              newApartmentId &&
              String(oldBookingState.apartmentId) !== String(newApartmentId)
            ) {
              // --- THIS IS THE TRUE ROOM CHANGE LOGIC ---
              stats.processedAsRoomChange++;
              console.log(`[Sync] TRUE ROOM CHANGE DETECTED for Smoobu ID ${normalizedId}.`);
              console.log(`       Old Room: ${oldBookingState.apartmentId} -> New Room: ${newApartmentId}`);

              if (oldBookingState.firebaseDocId) {
                console.log(`       Deleting old Firebase doc (${oldBookingState.firebaseDocId}) to free up old room.`);
                const oldDocRef = db.collection("bookings").doc(oldBookingState.firebaseDocId);
                batch.delete(oldDocRef);
                firebaseDocsAddedToDeleteBatch++;
                existingBookingMap.delete(normalizedId);
              }

              console.log(`       Processing booking as a new entry for the new room.`);
              await processor.processBooking(modifiedBooking, existingBookingMap, stats);
            } else {
              // --- This is a simple modification (no room change) ---
              console.log(`[Sync] Smoobu booking ${modifiedBooking.id} is a SIMPLE MODIFICATION. Re-processing to update...`);
              await processor.processBooking(modifiedBooking, existingBookingMap, stats);
            }
          }
        } catch (modError) {
          console.error(`🟥 [Sync] Error processing modified booking ID ${modifiedBooking.id}:`, modError);
          stats.errorsProcessingModified++;
        }
      }

      if (firebaseDocsAddedToDeleteBatch > 0) {
        console.log(`[Sync] Committing batch deletion of ${firebaseDocsAddedToDeleteBatch} bookings.`);
        try {
          await batch.commit();
          stats.deletedFromFirebase = firebaseDocsAddedToDeleteBatch;
          console.log(`[Sync] Batch delete successful.`);
        } catch (batchError) {
          console.error("🟥 [Sync] Error committing Firebase deletion batch:", batchError);
          stats.errorsInBatchCommit++;
        }
      }
    }

    console.log("[Sync] Sync Process Finished. Final Stats:", stats);
    const overallSuccess = stats.errorsProcessingActive === 0 && stats.errorsProcessingModified === 0 && stats.errorsInBatchCommit === 0;
    return res.json({ success: overallSuccess, stats: stats });
  } catch (error) {
    console.error("🟥 [Sync] Critical error in main fetch-and-sync endpoint:", error);
    return res.status(500).json({ success: false, error: "Critical sync error has occurred." });
  }
}