import axios from "axios";

export class SmoobuClient {
  constructor(apiKey = null) {
    this.apiKey = apiKey || process.env.SMOOBU_API_KEY;
    if (!this.apiKey) {
      console.error("[SmoobuClient] FATAL Error: SMOOBU_API_KEY is not set.");
    }
  }

  /**
   * Fetches active bookings within an arrival date range
   * @param {string} startDate - Arrival start date in YYYY-MM-DD format
   * @param {string} endDate - Arrival end date in YYYY-MM-DD format
   * @returns {Promise<Array>} - Array of active booking objects
   */
  async fetchBookings(startDate, endDate) {
    if (!this.apiKey) {
      console.error("[SmoobuClient] Cannot fetch bookings: API key missing.");
      return [];
    }

    try {
      console.log(`[SmoobuClient] Fetching bookings from ${startDate} to ${endDate}`);
      
      const response = await axios.get("https://login.smoobu.com/api/reservations", {
        headers: {
          "Api-Key": this.apiKey,
          "Cache-Control": "no-cache",
        },
        params: {
          from: startDate,
          until: endDate,
          showCancellation: false,
          excludeBlocked: true,
          pageSize: 10000,
        },
      });

      const bookings = response.data.bookings || [];
      console.log(`[SmoobuClient] Found ${bookings.length} bookings`);
      return bookings;
      
    } catch (error) {
      console.error("[SmoobuClient] Error fetching bookings:", error.message);
      return [];
    }
  }

  /**
   * Fetches a single booking by ID with detailed price elements
   * @param {string|number} bookingId - The Smoobu booking ID
   * @returns {Promise<Object|null>} - Detailed booking object or null if not found
   */
  async fetchIndividualBooking(bookingId) {
    if (!this.apiKey) {
      console.error("[SmoobuClient] Cannot fetch individual booking: API key missing.");
      return null;
    }

    try {
      console.log(`[SmoobuClient] Fetching individual booking ID: ${bookingId}`);
      
      const response = await axios.get(`https://login.smoobu.com/api/reservations/${bookingId}`, {
        headers: {
          "Api-Key": this.apiKey,
          "Cache-Control": "no-cache",
        },
      });

      const booking = response.data;
      if (booking) {
        console.log(`[SmoobuClient] ✅ Successfully fetched individual booking ${bookingId}: ${booking['guest-name']}`);
        console.log(`[SmoobuClient] ✅ Enhanced booking ${bookingId} with ${booking.priceElements?.length || 0} detailed price elements`);
      }
      return booking;
      
    } catch (error) {
      console.error(`[SmoobuClient] ❌ Error fetching individual booking ${bookingId}:`, error.message);
      if (error.response) {
        console.error(`[SmoobuClient] Response status: ${error.response.status}`);
      }
      return null;
    }
  }

  /**
   * Fetches price elements for a specific booking
   * @param {string|number} bookingId - The Smoobu booking ID
   * @returns {Promise<Array>} - Array of price elements
   */
  async fetchPriceElements(bookingId) {
    if (!this.apiKey) {
      console.error("[SmoobuClient] Cannot fetch price elements: API key missing.");
      return [];
    }

    try {
      console.log(`[SmoobuClient] Fetching price elements for booking ID: ${bookingId}`);
      
      const response = await axios.get(`https://login.smoobu.com/api/reservations/${bookingId}/price-elements`, {
        headers: {
          "Api-Key": this.apiKey,
          "Cache-Control": "no-cache",
        },
      });

      const priceElements = response.data.priceElements || [];
      console.log(`[SmoobuClient] ✅ Successfully fetched ${priceElements.length} price elements for booking ${bookingId}`);
      return priceElements;
      
    } catch (error) {
      console.error(`[SmoobuClient] ❌ Error fetching price elements for booking ${bookingId}:`, error.message);
      if (error.response) {
        console.error(`[SmoobuClient] Response status: ${error.response.status}`);
      }
      return [];
    }
  }
}