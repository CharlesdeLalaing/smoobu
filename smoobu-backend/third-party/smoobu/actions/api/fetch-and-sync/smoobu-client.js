import axios from "axios";
import * as dotenv from "dotenv"; // Make sure dotenv is configured here or in server.js

// If dotenv is not configured globally, uncomment this:
// dotenv.config();

export class SmoobuClient {
  constructor(apiKey = null) {
    // Prioritize provided key, then environment variable
    this.apiKey = apiKey || process.env.SMOOBU_API_KEY;
    if (!this.apiKey) {
      console.error("[SmoobuClient] FATAL Error: SMOOBU_API_KEY is not set.");
      // You might want to throw an error here or handle it upstream
    }
  }

  /**
   * Fetches active bookings within an arrival date range.
   * @param {string} startDate - Arrival start date in YYYY-MM-DD format
   * @param {string} endDate - Arrival end date in YYYY-MM-DD format
   * @returns {Promise<Array>} - Array of active booking objects
   */
  async fetchBookings(startDate, endDate) {
    if (!this.apiKey) {
      console.error(
        "[SmoobuClient] Cannot fetch active bookings: API key missing."
      );
      return [];
    }
    console.log(
      `[SmoobuClient] Fetching ACTIVE bookings (Arrival: ${startDate} to ${endDate})...`
    );
    try {
      const response = await axios.get(
        "https://login.smoobu.com/api/reservations",
        {
          headers: {
            "Api-Key": this.apiKey,
            "Cache-Control": "no-cache",
          },
          params: {
            arrivalFrom: startDate,
            arrivalTo: endDate,
            showCancellation: false, // Explicitly exclude cancelled for this list
            excludeBlocked: true,
            pageSize: 100, // Max page size
          },
        }
      );
      const bookings = response.data.bookings || [];
      console.log(
        `[SmoobuClient] Fetched ${bookings.length} active bookings by arrival date.`
      );
      return bookings;
    } catch (error) {
      console.error(
        `[SmoobuClient] Error fetching active bookings: ${error.message}`
      );
      return []; // Return empty array on error
    }
  }

  /**
   * Fetches price elements for a booking. (Keep as is)
   * @param {string} bookingId - Booking ID
   * @returns {Promise<Array>} - Array of price elements
   */
  async fetchPriceElements(bookingId) {
    if (!this.apiKey) {
      console.error(
        "[SmoobuClient] Cannot fetch price elements: API key missing."
      );
      return [];
    }
    try {
      const response = await axios.get(
        `https://login.smoobu.com/api/reservations/${bookingId}/price-elements`,
        {
          headers: {
            "Api-Key": this.apiKey,
            "Cache-Control": "no-cache",
          },
        }
      );
      return response.data.priceElements || [];
    } catch (error) {
      console.error(
        `🟨 Error fetching price elements for booking ${bookingId}:`,
        error.message
      );
      return []; // Return empty array on error
    }
  }

  /**
   * Fetches bookings modified within a given date range, including cancellations.
   * Uses 'modifiedFrom' and 'modifiedTo' parameters.
   * @param {string} modifiedSinceDate - Date string (YYYY-MM-DD) for 'modifiedFrom'.
   * @param {string} modifiedUntilDate - Date string (YYYY-MM-DD) for 'modifiedTo'.
   * @returns {Promise<Array>} - Array of booking objects from Smoobu.
   */
  async fetchRecentlyModifiedBookings(modifiedSinceDate, modifiedUntilDate) {
    if (!this.apiKey) {
      console.error(
        "[SmoobuClient] Cannot fetch modified bookings: API key missing."
      );
      return [];
    }
    console.log(
      `[SmoobuClient] Fetching bookings MODIFIED (from ${modifiedSinceDate} to ${modifiedUntilDate}, including cancellations)...`
    );
    try {
      const response = await axios.get(
        "https://login.smoobu.com/api/reservations",
        {
          headers: {
            "Api-Key": this.apiKey,
            "Cache-Control": "no-cache",
          },
          params: {
            modifiedFrom: modifiedSinceDate,
            modifiedTo: modifiedUntilDate,
            showCancellation: true, // INCLUDE cancelled bookings
            // excludeBlocked: false, // Decide if you need to check blocked bookings
            pageSize: 100, // Max page size
          },
        }
      );
      const bookings = response.data.bookings || [];
      console.log(
        `[SmoobuClient] Fetched ${bookings.length} bookings modified from ${modifiedSinceDate} to ${modifiedUntilDate}.`
      );
      return bookings;
    } catch (error) {
      console.error(
        `[SmoobuClient] Error fetching modified bookings: ${error.message}`
      );
      return []; // Return empty array on error
    }
  }
}
