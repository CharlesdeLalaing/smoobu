import { db } from "../../../../../firebase-config.js";
import { normalizeBookingId } from "../../../../../helpers/normalize-booking-id.js";

/**
 * Repository for booking data in Firebase
 */
export class BookingRepository {
  /**
   * Fetches all existing bookings from Firebase
   * @returns {Promise<Map>} - Map of booking IDs to booking data
   */
  async fetchExistingBookings() {
    const existingBookingsSnapshot = await db.collection("bookings").get();
    const existingBookingMap = new Map();

    existingBookingsSnapshot.forEach((doc) => {
      const data = doc.data();

      // Use normalized ID to ensure consistent matching
      if (data.smoobuId) {
        const normalizedId = normalizeBookingId(data.smoobuId);
        if (!existingBookingMap.has(normalizedId)) {
          existingBookingMap.set(normalizedId, []);
        }
        existingBookingMap.get(normalizedId).push({
          id: doc.id,
          ...data,
        });
      }

      // Also add by smoobuReservationId if it exists and is different
      if (
        data.smoobuReservationId &&
        data.smoobuReservationId !== data.smoobuId
      ) {
        const normalizedResId = normalizeBookingId(data.smoobuReservationId);
        if (!existingBookingMap.has(normalizedResId)) {
          existingBookingMap.set(normalizedResId, []);
        }
        existingBookingMap.get(normalizedResId).push({
          id: doc.id,
          ...data,
        });
      }
    });

    console.log(
      `🟦 Found ${existingBookingMap.size} existing Smoobu bookings in database`
    );

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
}
