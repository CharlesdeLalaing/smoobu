import { db } from "../../../../../firebase-config.js";
import { normalizeBookingId } from "../../../../../helpers/normalize-booking-id.js";

/**
 * Repository for booking data in Firebase
 */
export class BookingRepository {
  /**
   * Fetches all existing bookings from Firebase and creates a map.
   * Each Smoobu ID maps to an ARRAY of booking objects (to handle potential duplicates).
   * @returns {Promise<Map<string, Array>>} - Map of Smoobu IDs to arrays of booking data objects.
   */
  async fetchExistingBookings() {
    const existingBookingsSnapshot = await db.collection("bookings").get();
    const existingBookingMap = new Map();

    existingBookingsSnapshot.forEach((doc) => {
      const data = doc.data();
      const bookingWithId = {
        firebaseDocId: doc.id, // <-- IMPORTANT: Explicitly add the Firebase document ID.
        ...data,
      };

      // Use normalized ID to ensure consistent matching.
      // Store bookings as arrays to handle potential duplicates (expected by BookingProcessor)
      if (data.smoobuId) {
        const normalizedId = normalizeBookingId(data.smoobuId);
        if (!existingBookingMap.has(normalizedId)) {
          existingBookingMap.set(normalizedId, []);
        }
        existingBookingMap.get(normalizedId).push(bookingWithId);
      }

      // Also add by smoobuReservationId if it exists
      if (data.smoobuReservationId) {
        const normalizedResId = normalizeBookingId(data.smoobuReservationId);
        if (!existingBookingMap.has(normalizedResId)) {
          existingBookingMap.set(normalizedResId, []);
        }
        existingBookingMap.get(normalizedResId).push(bookingWithId);
      }
    });

    return existingBookingMap;
  }

  /**
   * Creates a new booking in Firebase
   * @param {Object} bookingData - Booking data to store
   * @returns {Promise<string>} - ID of created document
   */
  async createBooking(bookingData) {
    const docRef = await db.collection("bookings").add(bookingData);
    return docRef.id;
  }

  /**
   * Updates an existing booking in Firebase
   * @param {string} docId - Document ID
   * @param {Object} bookingData - Updated booking data
   * @returns {Promise<void>}
   */
  async updateBooking(docId, bookingData) {
    await db.collection("bookings").doc(docId).update(bookingData);
  }

  /**
   * Deletes booking(s) by smoobuId from Firebase
   * Backs up the booking to bookings_backup collection before deletion
   * @param {string|number} smoobuId - Smoobu booking ID
   * @returns {Promise<number>} - Number of documents deleted
   */
  async deleteBookingBySmoobuId(smoobuId) {
    const normalizedId = normalizeBookingId(smoobuId);
    const snapshot = await db.collection("bookings")
      .where('smoobuId', '==', normalizedId)
      .get();

    if (snapshot.empty) {
      console.log(`[BookingRepository] No booking found with smoobuId ${smoobuId} to delete`);
      return 0;
    }

    const batch = db.batch();

    // Backup each document before deletion
    for (const doc of snapshot.docs) {
      const backupData = {
        ...doc.data(),
        _backup: {
          originalDocId: doc.id,
          deletedAt: new Date().toISOString(),
          reason: 'cancellation'
        }
      };
      const backupRef = db.collection("bookings_backup").doc();
      batch.set(backupRef, backupData);
      console.log(`[BookingRepository] Backing up booking ${smoobuId} to bookings_backup`);
    }

    // Delete original documents
    snapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });

    await batch.commit();

    console.log(`[BookingRepository] Backed up and deleted ${snapshot.docs.length} booking(s) with smoobuId ${smoobuId}`);
    return snapshot.docs.length;
  }
}