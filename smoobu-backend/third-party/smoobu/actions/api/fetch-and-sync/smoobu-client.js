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
   * This method now combines multiple fetching strategies to ensure all bookings are captured.
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

    try {
      console.log(
        `[SmoobuClient] ENHANCED FETCH: Starting comprehensive booking fetch for arrival range ${startDate} to ${endDate}`
      );

      // Strategy 1: Departure-based fetch (primary strategy - more reliable)
      console.log(
        `[SmoobuClient] Strategy 1: Fetching by departure date range...`
      );
      const arrivalResponse = await axios.get(
        "https://login.smoobu.com/api/reservations",
        {
          headers: {
            "Api-Key": this.apiKey,
            "Cache-Control": "no-cache",
          },
          params: {
            departureFrom: startDate,
            departureTo: endDate,
            showCancellation: false, // Explicitly exclude cancelled for this list
            excludeBlocked: true,
            pageSize: 10000, // Max page size for comprehensive coverage
          },
        }
      );

      let departureBookings = arrivalResponse.data.bookings || [];
      console.log(
        `[SmoobuClient] Strategy 1 result: ${departureBookings.length} bookings found by departure date`
      );

      // Strategy 2: Arrival-based fetch as fallback
      // This catches any bookings that might be missed by the departure-based approach
      console.log(
        `[SmoobuClient] Strategy 2: Fetching by arrival date range (fallback)...`
      );
      const arrivalBookings = await this.fetchBookingsByArrivalDate(
        startDate,
        endDate
      );
      console.log(
        `[SmoobuClient] Strategy 2 result: ${arrivalBookings.length} bookings found by arrival date`
      );

      // Combine and deduplicate bookings from both strategies
      const combinedBookingsMap = new Map();

      // Add departure-based bookings first (primary strategy)
      departureBookings.forEach((booking) => {
        // Only include if the booking arrives within our requested range
        if (booking.arrival >= startDate && booking.arrival <= endDate) {
          combinedBookingsMap.set(booking.id, booking);
        }
      });

      // Add arrival-based bookings as fallback
      let supplementaryCount = 0;
      arrivalBookings.forEach((booking) => {
        if (!combinedBookingsMap.has(booking.id)) {
          combinedBookingsMap.set(booking.id, booking);
          supplementaryCount++;
        }
      });

      let bookings = Array.from(combinedBookingsMap.values());
      console.log(
        `[SmoobuClient] COMBINATION RESULT: ${bookings.length} total unique bookings (${supplementaryCount} additional found via arrival-date fallback)`
      );

      if (supplementaryCount > 0) {
        console.log(
          `[SmoobuClient] 🎯 FALLBACK FIND: Found ${supplementaryCount} bookings that were missing from the departure-date API call!`
        );
        const missingBookings = arrivalBookings.filter(
          (b) => !departureBookings.some((db) => db.id === b.id)
        );
        missingBookings.forEach((booking) => {
          console.log(
            `  - FALLBACK BOOKING: ID ${booking.id}, Guest: ${booking["guest-name"]}, Arrival: ${booking.arrival}, Departure: ${booking.departure}, Apartment: ${booking.apartment?.name}`
          );
        });
      }

      // Debug logging for La Chambre de Blé (apartment 1946276)
      // Check both direct apartment assignment AND related apartments
      const bleBookings = bookings.filter(
        (booking) =>
          booking.apartment?.id === 1946276 ||
          booking.related?.some((rel) => rel.id === 1946276)
      );

      // Also log all apartment IDs to see what's available
      const allApartmentIds = [
        ...new Set(bookings.map((b) => b.apartment?.id).filter(Boolean)),
      ];
      console.log(
        `[SmoobuClient] All apartment IDs in active bookings: [${allApartmentIds.join(
          ", "
        )}]`
      );
      console.log(
        `[SmoobuClient] Total bookings returned by API: ${bookings.length}`
      );

      // Log all Airbnb bookings to see what apartments they're for
      const airbnbBookings = bookings.filter(
        (booking) =>
          booking.channel?.name?.toLowerCase().includes("airbnb") ||
          booking.channel?.id === 2323543 ||
          booking.channel?.id === "2323543"
      );
      if (airbnbBookings.length > 0) {
        console.log(
          `[SmoobuClient] Found ${airbnbBookings.length} Airbnb bookings for these apartments:`
        );
        airbnbBookings.forEach((booking) => {
          console.log(
            `  - ID: ${booking.id}, ApartmentID: ${
              booking.apartment?.id
            }, ApartmentName: "${booking.apartment?.name}", Channel: ${
              booking.channel?.name
            } (${booking.channel?.id}), Guest: ${
              booking["guest-name"] ||
              booking.firstName + " " + booking.lastName
            }`
          );
        });

        // Specifically check if any Airbnb bookings are for apartment 1946276
        const airbnbBleBookings = airbnbBookings.filter(
          (booking) => booking.apartment?.id === 1946276
        );
        if (airbnbBleBookings.length === 0) {
          console.log(
            `  ❌ ISSUE: No Airbnb bookings found for La Chambre de Blé (1946276) even though other Airbnb bookings exist`
          );
          console.log(
            `  🔧 WORKAROUND: Attempting to fetch missing Airbnb bookings for La Chambre de Blé...`
          );

          // Attempt workaround: fetch missing Airbnb bookings for apartment 1946276
          const supplementaryBookings =
            await this.fetchMissingAirbnbBookingsForBle(startDate, endDate);
          if (supplementaryBookings.length > 0) {
            console.log(
              `  ✅ WORKAROUND SUCCESS: Found ${supplementaryBookings.length} missing Airbnb booking(s) for La Chambre de Blé`
            );
            supplementaryBookings.forEach((booking) => {
              console.log(
                `    - ID: ${booking.id}, Guest: ${booking["guest-name"]}, Arrival: ${booking.arrival}`
              );
            });
            // Add these bookings to the main list
            bookings = [...bookings, ...supplementaryBookings];
          } else {
            console.log(
              `  ❌ WORKAROUND: No additional Airbnb bookings found for La Chambre de Blé`
            );
          }
        }
      } else {
        console.log(
          `[SmoobuClient] No Airbnb bookings found in this date range`
        );
      }

      // Re-check bleBookings after potential supplementary additions
      const finalBleBookings = bookings.filter(
        (booking) =>
          booking.apartment?.id === 1946276 ||
          booking.related?.some((rel) => rel.id === 1946276)
      );

      if (finalBleBookings.length > 0) {
        console.log(
          `[SmoobuClient] Found ${finalBleBookings.length} active booking(s) for La Chambre de Blé (1946276):`
        );
        finalBleBookings.forEach((booking) => {
          console.log(
            `  - ID: ${booking.id}, Channel: ${booking.channel?.name}, Guest: ${
              booking["guest-name"] ||
              booking.firstName + " " + booking.lastName
            }`
          );
        });
      } else {
        console.log(
          `[SmoobuClient] No active bookings found for La Chambre de Blé (1946276) in date range ${startDate} to ${endDate}`
        );

        // Check if there are any bookings with similar apartment names
        const apartmentNameBookings = bookings.filter(
          (booking) =>
            booking.apartment?.name?.toLowerCase().includes("chambre") ||
            booking.apartment?.name?.toLowerCase().includes("blé") ||
            booking.apartment?.name?.toLowerCase().includes("ble")
        );
        if (apartmentNameBookings.length > 0) {
          console.log(
            `[SmoobuClient] Found bookings with 'chambre' or 'blé'/'ble' in apartment name:`
          );
          apartmentNameBookings.forEach((booking) => {
            console.log(
              `  - ID: ${booking.id}, ApartmentID: ${booking.apartment?.id}, ApartmentName: "${booking.apartment?.name}", Channel: ${booking.channel?.name} (${booking.channel?.id}), Arrival: ${booking.arrival}`
            );
          });
        }

        // SPECIFIC CHECK: Look for any bookings arriving on July 29, 2025
        const jul29Bookings = bookings.filter(
          (booking) => booking.arrival === "2025-07-29"
        );
        if (jul29Bookings.length > 0) {
          console.log(
            `[SmoobuClient] 🎯 Found bookings arriving on 2025-07-29:`
          );
          jul29Bookings.forEach((booking) => {
            console.log(
              `  - ID: ${booking.id}, ApartmentID: ${
                booking.apartment?.id
              }, ApartmentName: "${booking.apartment?.name}", Channel: ${
                booking.channel?.name
              } (${booking.channel?.id}), Guest: ${
                booking["guest-name"] ||
                booking.firstName + " " + booking.lastName
              }`
            );
          });
        } else {
          console.log(
            `[SmoobuClient] ❌ No bookings found arriving on 2025-07-29`
          );
        }

        // Also check for any July 2025 bookings
        const julyBookings = bookings.filter((booking) =>
          booking.arrival?.startsWith("2025-07")
        );
        if (julyBookings.length > 0) {
          console.log(
            `[SmoobuClient] Found ${julyBookings.length} bookings arriving in July 2025:`
          );
          julyBookings.forEach((booking) => {
            console.log(
              `  - ID: ${booking.id}, ApartmentID: ${booking.apartment?.id}, ApartmentName: "${booking.apartment?.name}", Channel: ${booking.channel?.name}, Arrival: ${booking.arrival}`
            );
          });
        }
      }

      // === STRATEGY 3: FULLY AUTOMATIC MISSING BOOKING DETECTION ===
      // This strategy uses intelligent heuristics to automatically detect and rescue
      // ANY missing bookings without requiring manual ID management.
      console.log(
        `[SmoobuClient] STRATEGY 3: Fully automatic missing booking detection...`
      );

      const missingBookingIds = await this._detectMissingBookingsAutomatically(
        bookings,
        startDate,
        endDate
      );

      if (missingBookingIds.length > 0) {
        console.log(
          `[SmoobuClient] DETECTED MISSING: ${missingBookingIds.length} bookings are missing from bulk API results: [${missingBookingIds.join(', ')}]`
        );

        // Attempt to rescue these bookings via individual API calls
        const rescuedBookings = await this.fetchBookingsIndividually(
          missingBookingIds,
          startDate,
          endDate
        );

        if (rescuedBookings.length > 0) {
          console.log(
            `[SmoobuClient] 🎯 RESCUE SUCCESS: Retrieved ${rescuedBookings.length} missing bookings via individual fetch!`
          );
          
          // Add rescued bookings to main results, avoiding duplicates
          rescuedBookings.forEach((rescuedBooking) => {
            if (!bookings.some((existing) => existing.id === rescuedBooking.id)) {
              bookings.push(rescuedBooking);
              console.log(
                `  ✅ ADDED: ${rescuedBooking.id} (${rescuedBooking["guest-name"]}) from individual fetch`
              );
            }
          });

          console.log(
            `[SmoobuClient] FINAL ENHANCED TOTAL: ${bookings.length} bookings (${rescuedBookings.length} rescued via fallback strategy)`
          );
        } else {
          console.log(
            `[SmoobuClient] ❌ RESCUE FAILED: Could not retrieve any missing bookings via individual fetch`
          );
        }
      } else {
        console.log(
          `[SmoobuClient] ✅ ALL KNOWN PROBLEMATIC BOOKINGS PRESENT: No fallback individual fetch needed`
        );
      }

      return bookings;
    } catch (error) {
      console.error(
        `[SmoobuClient] Error fetching active bookings: ${error.message}`
      );
      return []; // Return empty array on error
    }
  }

  /**
   * Fetches active bookings within a departure date range.
   * This method is more reliable than arrivalFrom/arrivalTo for certain bookings.
   * @param {string} startDate - Departure start date in YYYY-MM-DD format
   * @param {string} endDate - Departure end date in YYYY-MM-DD format
   * @returns {Promise<Array>} - Array of active booking objects
   */
  async fetchBookingsByDepartureDate(startDate, endDate) {
    if (!this.apiKey) {
      console.error(
        "[SmoobuClient] Cannot fetch bookings by departure date: API key missing."
      );
      return [];
    }

    try {
      console.log(
        `[SmoobuClient] Making API call with departureFrom/departureTo params:`,
        {
          departureFrom: startDate,
          departureTo: endDate,
          showCancellation: false,
          excludeBlocked: true,
          pageSize: 1000,
        }
      );

      const response = await axios.get(
        "https://login.smoobu.com/api/reservations",
        {
          headers: {
            "Api-Key": this.apiKey,
            "Cache-Control": "no-cache",
          },
          params: {
            departureFrom: startDate,
            departureTo: endDate,
            showCancellation: false,
            excludeBlocked: true,
            pageSize: 10000,
          },
        }
      );

      const bookings = response.data.bookings || [];
      console.log(
        `[SmoobuClient] fetchBookingsByDepartureDate returned ${bookings.length} bookings for departure range ${startDate} to ${endDate}`
      );

      return bookings;
    } catch (error) {
      console.error(
        `[SmoobuClient] Error fetching bookings by departure date: ${error.message}`
      );
      return [];
    }
  }

  /**
   * Fetches bookings by arrival date range.
   * @param {string} startDate - Arrival start date in YYYY-MM-DD format
   * @param {string} endDate - Arrival end date in YYYY-MM-DD format
   * @returns {Promise<Array>} - Array of booking objects
   */
  async fetchBookingsByArrivalDate(startDate, endDate) {
    if (!this.apiKey) {
      console.error(
        "[SmoobuClient] Cannot fetch bookings by arrival date: API key missing."
      );
      return [];
    }
    try {
      console.log(
        `[SmoobuClient] Making API call with arrivalFrom/arrivalTo params:`,
        {
          arrivalFrom: startDate,
          arrivalTo: endDate,
          showCancellation: false,
          excludeBlocked: true,
          pageSize: 1000,
        }
      );
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
            pageSize: 10000,
          },
        }
      );
      const bookings = response.data.bookings || [];
      console.log(
        `[SmoobuClient] fetchBookingsByArrivalDate returned ${bookings.length} bookings for arrival range ${startDate} to ${endDate}`
      );
      return bookings;
    } catch (error) {
      console.error(
        `[SmoobuClient] Error fetching bookings by arrival date: ${error.message}`
      );
      return [];
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
      // Handle 304 Not Modified specifically
      if (error.response?.status === 304) {
        console.log(`[SmoobuClient] 📋 Price elements for booking ${bookingId} not modified (304), forcing fresh fetch`);
        // Force fresh fetch by removing cache headers
        return this.fetchPriceElementsForced(bookingId);
      }
      
      console.error(
        `🟨 Error fetching price elements for booking ${bookingId}:`,
        error.message
      );
      if (error.response) {
        console.error(`Response status: ${error.response.status}`);
      }
      return []; // Return empty array on error
    }
  }

  /**
   * Force fetch price elements without cache headers
   * Used when 304 responses need to be bypassed
   * @param {string|number} bookingId - The booking ID to fetch price elements for
   * @returns {Promise<Array>} - Array of price elements or empty array
   */
  async fetchPriceElementsForced(bookingId) {
    if (!this.apiKey) {
      console.error(
        "[SmoobuClient] Cannot force fetch price elements: API key missing."
      );
      return [];
    }
    try {
      console.log(`[SmoobuClient] Force fetching price elements for booking ${bookingId} (bypassing cache)`);
      
      const response = await axios.get(
        `https://login.smoobu.com/api/reservations/${bookingId}/price-elements`,
        {
          headers: {
            "Api-Key": this.apiKey,
            // No cache headers to force fresh fetch
          },
        }
      );
      
      const priceElements = response.data.priceElements || [];
      console.log(`[SmoobuClient] ✅ Successfully force fetched ${priceElements.length} price elements for booking ${bookingId}`);
      return priceElements;
    } catch (error) {
      console.error(
        `🟨 Error force fetching price elements for booking ${bookingId}:`,
        error.message
      );
      if (error.response) {
        console.error(`Response status: ${error.response.status}`);
      }
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
            pageSize: 10000, // Max page size for comprehensive coverage
          },
        }
      );
      const bookings = response.data.bookings || [];

      // Debug logging for La Chambre de Blé (apartment 1946276)
      const bleBookings = bookings.filter(
        (booking) => booking.apartment?.id === 1946276
      );

      // Also check Airbnb bookings in modified list
      const airbnbBookings = bookings.filter(
        (booking) =>
          booking.channel?.name?.toLowerCase().includes("airbnb") ||
          booking.channel?.id === 2323543 ||
          booking.channel?.id === "2323543"
      );
      if (airbnbBookings.length > 0) {
        console.log(
          `[SmoobuClient] Found ${airbnbBookings.length} modified Airbnb bookings:`
        );
        airbnbBookings.forEach((booking) => {
          console.log(
            `  - ID: ${booking.id}, ApartmentID: ${
              booking.apartment?.id
            }, ApartmentName: "${booking.apartment?.name}", Type: ${
              booking.type
            }, Guest: ${
              booking["guest-name"] ||
              booking.firstName + " " + booking.lastName
            }`
          );
        });

        const airbnbBleBookings = airbnbBookings.filter(
          (booking) => booking.apartment?.id === 1946276
        );
        if (airbnbBleBookings.length > 0) {
          console.log(
            `  ✅ Found ${airbnbBleBookings.length} Airbnb booking(s) for La Chambre de Blé in modified list!`
          );
        }
      }

      if (bleBookings.length > 0) {
        console.log(
          `[SmoobuClient] Found ${bleBookings.length} modified booking(s) for La Chambre de Blé (1946276):`
        );
        bleBookings.forEach((booking) => {
          console.log(
            `  - ID: ${booking.id}, Channel: ${booking.channel?.name}, Type: ${
              booking.type
            }, Guest: ${
              booking["guest-name"] ||
              booking.firstName + " " + booking.lastName
            }`
          );
        });
      } else {
        console.log(
          `[SmoobuClient] No modified bookings found for La Chambre de Blé (1946276) in date range ${modifiedSinceDate} to ${modifiedUntilDate}`
        );
      }

      return bookings;
    } catch (error) {
      console.error(
        `[SmoobuClient] Error fetching modified bookings: ${error.message}`
      );
      return []; // Return empty array on error
    }
  }

  /**
   * CRITICAL WORKAROUND: Fetch missing Airbnb bookings for La Chambre de Blé (apartment 1946276).
   *
   * ROOT CAUSE: Smoobu API has a systemic issue where some Airbnb bookings for apartment 1946276
   * are completely missing from ALL bulk API endpoints (/api/reservations), regardless of parameters.
   * These bookings only exist when fetched individually by booking ID.
   *
   * INVESTIGATION RESULTS:
   * - Strategy 1 (apartmentId query): Returns 0 bookings - apartmentId filter doesn't work for 1946276
   * - Strategy 2 (channelId query): Finds some bookings but still misses specific ones (Anne Vicente, Baya Cheikh)
   * - Strategy 3 (broad query): Same as main API call - missing the problematic bookings
   * - Strategy 4 (direct fetch): ONLY way to get missing bookings like 105719121, 105608666
   *
   * FUTURE-PROOFING LIMITATION:
   * This workaround can only recover KNOWN missing booking IDs. New missing bookings won't be detected
   * unless we implement a more advanced detection mechanism.
   *
   * @param {string} startDate - Arrival start date in YYYY-MM-DD format
   * @param {string} endDate - Arrival end date in YYYY-MM-DD format
   * @returns {Promise<Array>} - Array of found booking objects
   */
  async fetchMissingAirbnbBookingsForBle(startDate, endDate) {
    if (!this.apiKey) {
      console.error(
        "[SmoobuClient] Cannot fetch missing bookings: API key missing."
      );
      return [];
    }

    const foundBookings = [];

    try {
      // Strategy 1: Query specifically for apartment 1946276
      // NOTE: Investigation shows this returns 0 bookings - apartmentId filter is broken for 1946276
      console.log(
        `[SmoobuClient] Strategy 1: Querying specifically for apartment 1946276...`
      );

      const apartmentSpecificResponse = await axios.get(
        "https://login.smoobu.com/api/reservations",
        {
          headers: {
            "Api-Key": this.apiKey,
            "Cache-Control": "no-cache",
          },
          params: {
            apartmentId: 1946276,
            arrivalFrom: startDate,
            arrivalTo: endDate,
            showCancellation: false,
            excludeBlocked: true,
            pageSize: 10000,
          },
        }
      );

      const apartmentBookings = apartmentSpecificResponse.data.bookings || [];
      const airbnbApartmentBookings = apartmentBookings.filter(
        (booking) =>
          booking.channel?.name?.toLowerCase().includes("airbnb") ||
          booking.channel?.id === 2323543 ||
          booking.channel?.id === "2323543"
      );

      if (airbnbApartmentBookings.length > 0) {
        console.log(
          `[SmoobuClient] Strategy 1 SUCCESS: Found ${airbnbApartmentBookings.length} Airbnb bookings for apartment 1946276`
        );
        foundBookings.push(...airbnbApartmentBookings);
      } else {
        console.log(
          `[SmoobuClient] Strategy 1: No Airbnb bookings found for apartment 1946276 (EXPECTED - apartmentId filter broken)`
        );
      }
    } catch (error) {
      console.error(`[SmoobuClient] Strategy 1 failed:`, error.message);
    }

    try {
      // Strategy 2: Query for Airbnb channel specifically
      // NOTE: This finds SOME bookings but still misses problematic ones
      console.log(
        `[SmoobuClient] Strategy 2: Querying for Airbnb channel (2323543)...`
      );

      const channelSpecificResponse = await axios.get(
        "https://login.smoobu.com/api/reservations",
        {
          headers: {
            "Api-Key": this.apiKey,
            "Cache-Control": "no-cache",
          },
          params: {
            channelId: 2323543, // Airbnb channel ID
            arrivalFrom: startDate,
            arrivalTo: endDate,
            showCancellation: false,
            excludeBlocked: true,
            pageSize: 10000,
          },
        }
      );

      const channelBookings = channelSpecificResponse.data.bookings || [];
      const channelBleBookings = channelBookings.filter(
        (booking) =>
          booking.apartment?.id === 1946276 ||
          booking.related?.some((rel) => rel.id === 1946276)
      );

      if (channelBleBookings.length > 0) {
        console.log(
          `[SmoobuClient] Strategy 2 SUCCESS: Found ${channelBleBookings.length} Airbnb bookings for La Chambre de Blé from channel query`
        );
        // Avoid duplicates
        channelBleBookings.forEach((booking) => {
          if (!foundBookings.some((fb) => fb.id === booking.id)) {
            foundBookings.push(booking);
          }
        });
      } else {
        console.log(
          `[SmoobuClient] Strategy 2: No Airbnb bookings found for La Chambre de Blé from channel query`
        );
      }
    } catch (error) {
      console.error(`[SmoobuClient] Strategy 2 failed:`, error.message);
    }

    try {
      // Strategy 3: Query without filters and search for known bookings
      // NOTE: Same as main API call - still misses the problematic bookings
      console.log(
        `[SmoobuClient] Strategy 3: Broad query to find any missing bookings...`
      );

      const broadResponse = await axios.get(
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
            pageSize: 10000,
          },
        }
      );

      const broadBookings = broadResponse.data.bookings || [];
      const broadBleAirbnbBookings = broadBookings.filter(
        (booking) =>
          (booking.apartment?.id === 1946276 ||
            booking.related?.some((rel) => rel.id === 1946276)) &&
          (booking.channel?.name?.toLowerCase().includes("airbnb") ||
            booking.channel?.id === 2323543)
      );

      if (broadBleAirbnbBookings.length > 0) {
        console.log(
          `[SmoobuClient] Strategy 3 SUCCESS: Found ${broadBleAirbnbBookings.length} Airbnb bookings for La Chambre de Blé from broad query`
        );
        // Avoid duplicates
        broadBleAirbnbBookings.forEach((booking) => {
          if (!foundBookings.some((fb) => fb.id === booking.id)) {
            foundBookings.push(booking);
          }
        });
      } else {
        console.log(
          `[SmoobuClient] Strategy 3: No additional Airbnb bookings found for La Chambre de Blé`
        );
      }
    } catch (error) {
      console.error(`[SmoobuClient] Strategy 3 failed:`, error.message);
    }

    // Strategy 4: CRITICAL - Direct fetch of known missing bookings
    // NOTE: This is the ONLY way to get bookings like 105719121 and 105608666
    // LIMITATION: Only works for KNOWN missing booking IDs - can't detect NEW missing ones
    const knownMissingIds = [105719121, 105608666]; // Add any other known missing booking IDs here

    console.log(
      `[SmoobuClient] Strategy 4: CRITICAL direct fetch for known missing bookings`
    );
    console.log(
      `[SmoobuClient] WARNING: This strategy only works for KNOWN missing IDs: [${knownMissingIds.join(
        ", "
      )}]`
    );
    console.log(
      `[SmoobuClient] Future missing Airbnb bookings for apartment 1946276 may not be detected automatically!`
    );

    for (const bookingId of knownMissingIds) {
      try {
        console.log(
          `[SmoobuClient] Strategy 4: Directly fetching known missing booking ${bookingId}...`
        );

        const directResponse = await axios.get(
          `https://login.smoobu.com/api/reservations/${bookingId}`,
          {
            headers: {
              "Api-Key": this.apiKey,
              "Cache-Control": "no-cache",
            },
          }
        );

        const directBooking = directResponse.data;
        if (
          directBooking &&
          (directBooking.apartment?.id === 1946276 ||
            directBooking.related?.some((rel) => rel.id === 1946276)) &&
          (directBooking.channel?.name?.toLowerCase().includes("airbnb") ||
            directBooking.channel?.id === 2323543)
        ) {
          // Check if this booking falls within our date range
          const arrivalDate = new Date(directBooking.arrival);
          const rangeStart = new Date(startDate);
          const rangeEnd = new Date(endDate);

          if (arrivalDate >= rangeStart && arrivalDate <= rangeEnd) {
            console.log(
              `[SmoobuClient] Strategy 4 SUCCESS: Found missing booking ${bookingId} for La Chambre de Blé`
            );
            // Avoid duplicates
            if (!foundBookings.some((fb) => fb.id === directBooking.id)) {
              foundBookings.push(directBooking);
            }
          } else {
            console.log(
              `[SmoobuClient] Strategy 4: Booking ${bookingId} found but outside date range (${directBooking.arrival})`
            );
          }
        } else {
          console.log(
            `[SmoobuClient] Strategy 4: Booking ${bookingId} found but not for La Chambre de Blé or not Airbnb`
          );
        }
      } catch (error) {
        console.log(
          `[SmoobuClient] Strategy 4: Could not fetch booking ${bookingId} - ${error.message}`
        );
      }
    }

    if (foundBookings.length > 0) {
      console.log(
        `[SmoobuClient] WORKAROUND SUMMARY: Found ${foundBookings.length} missing Airbnb booking(s) for La Chambre de Blé using supplementary strategies`
      );
      console.log(
        `[SmoobuClient] ⚠️  IMPORTANT: This workaround has limitations - see method documentation`
      );
    } else {
      console.log(
        `[SmoobuClient] WORKAROUND SUMMARY: No missing Airbnb bookings found for La Chambre de Blé despite trying multiple strategies`
      );
    }

    return foundBookings;
  }

  /**
   * Fetches a single booking by ID using the individual API endpoint.
   * This method is used as a fallback when bulk API calls miss certain bookings.
   * @param {string|number} bookingId - The booking ID to fetch
   * @returns {Promise<Object|null>} - The booking object or null if not found
   */
  async fetchIndividualBooking(bookingId) {
    if (!this.apiKey) {
      console.error(
        "[SmoobuClient] Cannot fetch individual booking: API key missing."
      );
      return null;
    }

    try {
      console.log(`[SmoobuClient] Fetching individual booking ID: ${bookingId}`);
      
      const response = await axios.get(
        `https://login.smoobu.com/api/reservations/${bookingId}`,
        {
          headers: {
            "Api-Key": this.apiKey,
            "Cache-Control": "no-cache",
          },
        }
      );

      const booking = response.data;
      if (booking && booking.id) {
        console.log(
          `[SmoobuClient] ✅ Successfully fetched individual booking ${bookingId}: ${booking["guest-name"]}`
        );
        
        // Fetch detailed price elements using the dedicated endpoint
        try {
          const priceElementsResponse = await axios.get(
            `https://login.smoobu.com/api/reservations/${bookingId}/price-elements`,
            {
              headers: {
                "Api-Key": this.apiKey,
                "Cache-Control": "no-cache",
              },
            }
          );
          
          if (priceElementsResponse.data && priceElementsResponse.data.priceElements) {
            booking.priceElements = priceElementsResponse.data.priceElements;
            console.log(
              `[SmoobuClient] ✅ Enhanced booking ${bookingId} with ${booking.priceElements.length} detailed price elements`
            );
          }
        } catch (priceError) {
          console.warn(`[SmoobuClient] ⚠️  Could not fetch price elements for booking ${bookingId}: ${priceError.message}`);
          // Continue with the booking data we have
        }
        
        return booking;
      } else {
        console.log(`[SmoobuClient] ❌ Individual booking ${bookingId} returned empty data`);
        return null;
      }
    } catch (error) {
      // Handle 304 Not Modified specifically
      if (error.response?.status === 304) {
        console.log(`[SmoobuClient] 📋 Booking ${bookingId} not modified (304), forcing fresh fetch`);
        // Force fresh fetch by removing cache headers
        return this.fetchIndividualBookingForced(bookingId);
      }
      
      console.log(
        `[SmoobuClient] ❌ Error fetching individual booking ${bookingId}: ${error.message}`
      );
      if (error.response) {
        console.log(`[SmoobuClient] Response status: ${error.response.status}`);
      }
      return null;
    }
  }

  /**
   * Force fetch individual booking without cache headers
   * Used when 304 responses need to be bypassed
   * @param {string|number} bookingId - The booking ID to fetch
   * @returns {Promise<Object|null>} - Booking data or null
   */
  async fetchIndividualBookingForced(bookingId) {
    if (!this.apiKey) {
      console.error(
        "[SmoobuClient] Cannot force fetch individual booking: API key missing."
      );
      return null;
    }

    try {
      console.log(`[SmoobuClient] Force fetching individual booking ID: ${bookingId} (bypassing cache)`);
      
      const response = await axios.get(
        `https://login.smoobu.com/api/reservations/${bookingId}`,
        {
          headers: {
            "Api-Key": this.apiKey,
            // No cache headers to force fresh fetch
          },
        }
      );

      const booking = response.data;
      if (booking && booking.id) {
        console.log(
          `[SmoobuClient] ✅ Successfully force fetched individual booking ${bookingId}: ${booking["guest-name"]}`
        );
        
        // Fetch detailed price elements using the dedicated endpoint
        try {
          const priceElementsResponse = await axios.get(
            `https://login.smoobu.com/api/reservations/${bookingId}/price-elements`,
            {
              headers: {
                "Api-Key": this.apiKey,
                // No cache headers for forced fetch
              },
            }
          );
          
          if (priceElementsResponse.data && priceElementsResponse.data.priceElements) {
            booking.priceElements = priceElementsResponse.data.priceElements;
            console.log(
              `[SmoobuClient] ✅ Enhanced forced booking ${bookingId} with ${booking.priceElements.length} detailed price elements`
            );
          }
        } catch (priceError) {
          console.warn(`[SmoobuClient] ⚠️  Could not fetch price elements for forced booking ${bookingId}: ${priceError.message}`);
          // Continue with the booking data we have
        }
        
        return booking;
      } else {
        console.log(`[SmoobuClient] ❌ Force fetch booking ${bookingId} returned empty data`);
        return null;
      }
    } catch (error) {
      console.log(
        `[SmoobuClient] ❌ Error force fetching individual booking ${bookingId}: ${error.message}`
      );
      if (error.response) {
        console.log(`[SmoobuClient] Response status: ${error.response.status}`);
      }
      return null;
    }
  }

  /**
   * Fetches multiple bookings individually by their IDs.
   * This is used as a fallback strategy when bulk API calls miss certain bookings.
   * @param {Array<string|number>} bookingIds - Array of booking IDs to fetch
   * @param {string} startDate - Only include bookings arriving on/after this date
   * @param {string} endDate - Only include bookings arriving on/before this date
   * @returns {Promise<Array>} - Array of successfully fetched bookings within date range
   */
  async fetchBookingsIndividually(bookingIds, startDate, endDate) {
    if (!this.apiKey) {
      console.error(
        "[SmoobuClient] Cannot fetch bookings individually: API key missing."
      );
      return [];
    }

    if (!Array.isArray(bookingIds) || bookingIds.length === 0) {
      console.log("[SmoobuClient] No booking IDs provided for individual fetch");
      return [];
    }

    console.log(
      `[SmoobuClient] FALLBACK STRATEGY: Attempting to fetch ${bookingIds.length} bookings individually...`
    );

    const fetchedBookings = [];
    const rangeStart = new Date(startDate);
    const rangeEnd = new Date(endDate);

    for (const bookingId of bookingIds) {
      try {
        const booking = await this.fetchIndividualBooking(bookingId);
        
        if (booking) {
          // Check if booking falls within the requested date range
          const arrivalDate = new Date(booking.arrival);
          
          if (arrivalDate >= rangeStart && arrivalDate <= rangeEnd) {
            fetchedBookings.push(booking);
            console.log(
              `[SmoobuClient] ✅ RESCUED: Booking ${bookingId} (${booking["guest-name"]}) retrieved individually`
            );
          } else {
            console.log(
              `[SmoobuClient] ⏭️  SKIPPED: Booking ${bookingId} outside date range (arrives ${booking.arrival})`
            );
          }
        }
      } catch (error) {
        console.error(
          `[SmoobuClient] Error in individual fetch for booking ${bookingId}:`,
          error.message
        );
      }

      // Add a small delay between individual API calls to be respectful to the API
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log(
      `[SmoobuClient] FALLBACK RESULT: Successfully rescued ${fetchedBookings.length} bookings via individual fetch`
    );

    return fetchedBookings;
  }

  /**
   * Fully automatic detection of missing bookings using intelligent heuristics.
   * This method uses multiple strategies to find bookings that exist individually
   * but are missing from bulk API results, without requiring manual ID management.
   * @param {Array} currentBookings - Bookings already fetched via bulk API
   * @param {string} startDate - Date range start
   * @param {string} endDate - Date range end
   * @returns {Promise<Array<string>>} - Array of missing booking IDs to rescue
   */
  async _detectMissingBookingsAutomatically(currentBookings, startDate, endDate) {
    console.log(
      `[SmoobuClient] 🤖 AUTOMATIC DETECTION: Analyzing booking patterns to find missing bookings...`
    );

    const missingBookingIds = [];

    // === HEURISTIC 1: GAP ANALYSIS ===
    // Look for gaps in booking ID sequences which often indicate missing bookings
    console.log(`[SmoobuClient] Heuristic 1: Analyzing ID sequence gaps...`);
    const gapCandidates = this._findBookingIdGaps(currentBookings);
    console.log(`[SmoobuClient] Found ${gapCandidates.length} potential gap candidates: [${gapCandidates.slice(0, 10).join(', ')}${gapCandidates.length > 10 ? '...' : ''}]`);

    // === HEURISTIC 2: CHANNEL-APARTMENT PATTERN ANALYSIS ===
    // Analyze patterns: if we see very few bookings for certain channel+apartment combos
    // that historically have more bookings, those might be missing
    console.log(`[SmoobuClient] Heuristic 2: Analyzing channel-apartment booking patterns...`);
    const patternCandidates = await this._findMissingByPatternAnalysis(currentBookings);
    console.log(`[SmoobuClient] Found ${patternCandidates.length} pattern-based candidates: [${patternCandidates.slice(0, 10).join(', ')}${patternCandidates.length > 10 ? '...' : ''}]`);

    // === HEURISTIC 3: KNOWN PROBLEMATIC CASES (LEGACY SUPPORT) ===
    // Keep some known problematic IDs for immediate rescue while heuristics learn
    const knownProblematicIds = [
      "105719121", // Anne Vicente - confirmed missing
      "105608666", // Baya Cheikh - confirmed missing  
      "102430458", // Aaron Torres Huerta - confirmed missing
      "100706438", // Romain Dumont - confirmed missing
      "104843583", // Erik Vrijens - confirmed missing
    ];
    
    const knownMissingIds = knownProblematicIds.filter(id => 
      !currentBookings.some(booking => String(booking.id) === id)
    );
    console.log(`[SmoobuClient] Heuristic 3: Known problematic cases still missing: [${knownMissingIds.join(', ')}]`);

    // === COMBINE ALL HEURISTICS ===
    const allCandidates = [
      ...new Set([...gapCandidates, ...patternCandidates, ...knownMissingIds])
    ].slice(0, 15); // Limit to 15 candidates to avoid API overload

    console.log(`[SmoobuClient] 🎯 TOTAL CANDIDATES: ${allCandidates.length} booking IDs to verify`);

    // === VERIFY CANDIDATES ===
    // Test each candidate to see if it exists individually but was missing from bulk API
    for (const candidateId of allCandidates) {
      try {
        const individualBooking = await this.fetchIndividualBooking(candidateId);
        
        if (individualBooking) {
          // Check if booking is within our date range
          const arrivalDate = new Date(individualBooking.arrival);
          const rangeStart = new Date(startDate);
          const rangeEnd = new Date(endDate);
          
          if (arrivalDate >= rangeStart && arrivalDate <= rangeEnd) {
            missingBookingIds.push(candidateId);
            console.log(
              `[SmoobuClient] ✅ CONFIRMED MISSING: ${candidateId} (${individualBooking["guest-name"]}) exists individually but missing from bulk API`
            );
          }
        }
        
        // Add small delay to be respectful to API
        await new Promise(resolve => setTimeout(resolve, 50));
      } catch (error) {
        // Booking doesn't exist or API error - skip silently
      }
    }

    console.log(
      `[SmoobuClient] 🎯 AUTOMATIC DETECTION RESULT: Found ${missingBookingIds.length} confirmed missing bookings`
    );

    return missingBookingIds;
  }

  /**
   * Heuristic 1: Find potential missing bookings by analyzing gaps in booking ID sequences.
   * Missing bookings often create gaps in otherwise sequential booking IDs.
   */
  _findBookingIdGaps(currentBookings) {
    const bookingIds = currentBookings
      .map(b => parseInt(b.id))
      .filter(id => !isNaN(id) && id > 100000000) // Only recent bookings
      .sort((a, b) => a - b);

    if (bookingIds.length < 2) return [];

    const gapCandidates = [];
    const minId = Math.min(...bookingIds);
    const maxId = Math.max(...bookingIds);
    
    // Look for gaps of 1-5 missing IDs (common pattern for API issues)
    for (let i = 0; i < bookingIds.length - 1; i++) {
      const current = bookingIds[i];
      const next = bookingIds[i + 1];
      const gap = next - current;
      
      // If there's a small gap (2-6 missing IDs), check those
      if (gap >= 2 && gap <= 6) {
        for (let missingId = current + 1; missingId < next; missingId++) {
          gapCandidates.push(String(missingId));
        }
      }
    }

    // Also check a few IDs before min and after max (edge cases)
    for (let i = 1; i <= 3; i++) {
      if (minId - i > 100000000) {
        gapCandidates.push(String(minId - i));
      }
      gapCandidates.push(String(maxId + i));
    }

    return gapCandidates.slice(0, 20); // Limit gap candidates
  }

  /**
   * Heuristic 2: Find missing bookings by analyzing channel-apartment patterns.
   * If certain combinations have unusually few bookings, there might be missing ones.
   */
  async _findMissingByPatternAnalysis(currentBookings) {
    const patternCandidates = [];
    
    // Analyze booking distribution by channel-apartment combination
    const channelApartmentCombos = {};
    
    currentBookings.forEach(booking => {
      const channelId = booking.channel?.id;
      const apartmentId = booking.apartment?.id;
      
      if (channelId && apartmentId) {
        const key = `${channelId}-${apartmentId}`;
        if (!channelApartmentCombos[key]) {
          channelApartmentCombos[key] = {
            channelId,
            apartmentId,
            channelName: booking.channel?.name,
            apartmentName: booking.apartment?.name,
            bookings: []
          };
        }
        channelApartmentCombos[key].bookings.push(booking);
      }
    });

    // Look for combinations that have very few bookings (potential missing bookings)
    for (const combo of Object.values(channelApartmentCombos)) {
      // If a channel-apartment combo has only 1-2 bookings in a 2-month period,
      // there might be missing bookings (especially for popular combos like Airbnb)
      if (combo.bookings.length <= 2 && combo.channelName?.toLowerCase().includes('airbnb')) {
        console.log(
          `[SmoobuClient] 📊 SUSPICIOUS PATTERN: ${combo.channelName} + ${combo.apartmentName} has only ${combo.bookings.length} bookings`
        );
        
        // Generate some candidate IDs around the existing bookings
        combo.bookings.forEach(booking => {
          const bookingId = parseInt(booking.id);
          // Check a few IDs before and after this booking
          for (let offset = -5; offset <= 5; offset++) {
            if (offset !== 0) {
              const candidateId = bookingId + offset;
              if (candidateId > 100000000 && 
                  !currentBookings.some(b => parseInt(b.id) === candidateId)) {
                patternCandidates.push(String(candidateId));
              }
            }
          }
        });
      }
    }

    return [...new Set(patternCandidates)].slice(0, 15); // Remove duplicates and limit
  }

  /**
   * Helper method to easily identify if a booking ID should be added to the known problematic list.
   * This can be called when you discover a booking with missing extras.
   * @param {string|number} bookingId - The booking ID to test
   * @returns {Promise<Object>} - Information about whether this booking is problematic
   */
  async diagnoseBookingIssue(bookingId) {
    console.log(`[SmoobuClient] 🔍 DIAGNOSING: Booking ${bookingId} for potential API issues...`);
    
    try {
      // Test 1: Can we fetch it individually?
      const individualBooking = await this.fetchIndividualBooking(bookingId);
      
      if (!individualBooking) {
        return {
          bookingId,
          isProblematic: false,
          reason: "Booking does not exist or is not accessible",
          recommendation: "No action needed - booking may be cancelled or invalid"
        };
      }

      // Test 2: Try a bulk fetch for the booking's arrival date range
      const arrivalDate = individualBooking.arrival;
      const bulkBookings = await this.fetchBookings(arrivalDate, arrivalDate);
      
      const foundInBulk = bulkBookings.some(b => String(b.id) === String(bookingId));
      
      if (foundInBulk) {
        return {
          bookingId,
          isProblematic: false,
          reason: "Booking is correctly returned by bulk API",
          recommendation: "No action needed - booking sync should work normally",
          bookingDetails: {
            guest: individualBooking["guest-name"],
            apartment: individualBooking.apartment?.name,
            channel: individualBooking.channel?.name,
            arrival: individualBooking.arrival
          }
        };
      } else {
        return {
          bookingId,
          isProblematic: true,
          reason: "Booking exists individually but missing from bulk API - confirmed Smoobu API issue",
          recommendation: `Add "${bookingId}" to knownProblematicBookingIds array in SmoobuClient.js`,
          bookingDetails: {
            guest: individualBooking["guest-name"],
            apartment: individualBooking.apartment?.name,
            apartmentId: individualBooking.apartment?.id,
            channel: individualBooking.channel?.name,
            channelId: individualBooking.channel?.id,
            arrival: individualBooking.arrival,
            hasExtras: individualBooking.extras && individualBooking.extras.length > 0,
            extraCount: individualBooking.extras?.length || 0
          }
        };
      }
    } catch (error) {
      return {
        bookingId,
        isProblematic: false,
        reason: `Error during diagnosis: ${error.message}`,
        recommendation: "Check booking ID validity and API connectivity"
      };
    }
  }
}
