import axios from "axios";

/**
 * Client for interacting with Smoobu API
 */
export class SmoobuClient {
  constructor(apiKey = null) {
    this.apiKey =
      apiKey ||
      process.env.SMOOBU_API_KEY ||
      "UZFV5QRY0ExHUfJi3c1DIG8Bpwet1X4knWa8rMkj6o";
  }

  /**
   * Fetches bookings from Smoobu API
   * @param {string} startDate - Start date in YYYY-MM-DD format
   * @param {string} endDate - End date in YYYY-MM-DD format
   * @returns {Promise<Array>} - Array of booking objects
   */
  async fetchBookings(startDate, endDate) {
    console.log(`🔍 Fetching Smoobu bookings from ${startDate} to ${endDate}`);

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
          showCancellation: false,
          excludeBlocked: true,
          pageSize: 100,
        },
      }
    );

    const bookings = response.data.bookings || [];
    console.log(`🟦 Fetched ${bookings.length} bookings from Smoobu`);

    return bookings;
  }

  /**
   * Fetches price elements for a booking
   * @param {string} bookingId - Booking ID
   * @returns {Promise<Array>} - Array of price elements
   */
  async fetchPriceElements(bookingId) {
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
      return [];
    }
  }
}
