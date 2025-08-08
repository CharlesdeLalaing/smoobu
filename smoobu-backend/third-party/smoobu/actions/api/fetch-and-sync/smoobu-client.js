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

      // Strategy 1: Original arrival-based fetch (arrivalFrom/arrivalTo)
      console.log(
        `[SmoobuClient] Strategy 1: Fetching by arrival date range...`
      );
      const arrivalResponse = await axios.get(
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

      let arrivalBookings = arrivalResponse.data.bookings || [];
      console.log(
        `[SmoobuClient] Strategy 1 result: ${arrivalBookings.length} bookings found by arrival date`
      );

      // Strategy 2: Enhanced departure-based fetch
      // Calculate departure date range - bookings arriving in our range will likely depart within a reasonable window
      // Add some buffer to catch bookings that arrive at the end of our range but depart after
      const bufferDays = 30; // 30-day buffer for longer stays
      const departureStartDate = new Date(startDate);
      const departureEndDate = new Date(endDate);
      departureEndDate.setDate(departureEndDate.getDate() + bufferDays);

      const departureStartStr = departureStartDate.toISOString().split("T")[0];
      const departureEndStr = departureEndDate.toISOString().split("T")[0];

      console.log(
        `[SmoobuClient] Strategy 2: Fetching by departure date range (${departureStartStr} to ${departureEndStr})...`
      );
      const departureBookings = await this.fetchBookingsByDepartureDate(
        departureStartStr,
        departureEndStr
      );
      console.log(
        `[SmoobuClient] Strategy 2 result: ${departureBookings.length} bookings found by departure date`
      );

      // Combine and deduplicate bookings from both strategies
      const combinedBookingsMap = new Map();

      // Add arrival-based bookings
      arrivalBookings.forEach((booking) => {
        combinedBookingsMap.set(booking.id, booking);
      });

      // Add departure-based bookings (only if they overlap with our arrival range)
      let supplementaryCount = 0;
      departureBookings.forEach((booking) => {
        // Only include if the booking arrives within our requested range
        if (booking.arrival >= startDate && booking.arrival <= endDate) {
          if (!combinedBookingsMap.has(booking.id)) {
            combinedBookingsMap.set(booking.id, booking);
            supplementaryCount++;
          }
        }
      });

      let bookings = Array.from(combinedBookingsMap.values());
      console.log(
        `[SmoobuClient] COMBINATION RESULT: ${bookings.length} total unique bookings (${supplementaryCount} additional found via departure-date strategy)`
      );

      if (supplementaryCount > 0) {
        console.log(
          `[SmoobuClient] 🎯 CRITICAL FIND: Found ${supplementaryCount} bookings that were missing from the arrival-date API call!`
        );
        const missingBookings = departureBookings.filter(
          (b) =>
            b.arrival >= startDate &&
            b.arrival <= endDate &&
            !arrivalBookings.some((ab) => ab.id === b.id)
        );
        missingBookings.forEach((booking) => {
          console.log(
            `  - RESCUED BOOKING: ID ${booking.id}, Guest: ${booking["guest-name"]}, Arrival: ${booking.arrival}, Departure: ${booking.departure}, Apartment: ${booking.apartment?.name}`
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
          pageSize: 100,
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
            pageSize: 100,
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
            pageSize: 100,
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
            pageSize: 100,
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
            pageSize: 100,
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
}
