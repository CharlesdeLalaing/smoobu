import axios from "axios";
import { db } from "../../firebase-config.js"; 
import { roomNames } from "../../config/config.js";
import { extractPricingInfo } from "../../helpers/pricing/extract-pricing-info.js";
import { processExtrasWithPersons } from "../smoobu/process-extras-with-persons.js";
import { normalizeBookingId } from "../../helpers/normalize-booking-id.js";
import { portalNames } from "../../config/config.js";

/**
 * Synchronizes reservations from Smoobu to Firebase
 * @returns {Object} - Sync result statistics
 */

const getPortalName = (portal) => {
  // Handle null/undefined
  if (!portal) return "Website";

  // Check if it's already a mapped portal
  if (portalNames[portal]) return portalNames[portal];

  // Handle channel IDs that should map to Website
  if (portal === "2323525" || portal === 2323525) return "Website";

  // Handle channel IDs that should map to Airbnb
  if (portal === "2323543" || portal === 2323543) return "Airbnb";

  // Special case for unknown channels from Smoobu that should be Website
  if (
    portal.includes("Homepage") ||
    portal === "Direct" ||
    portal === "Direct booking"
  ) {
    return "Website";
  }

  // Return the original portal name or default to Website
  return portal || "Website";
};

export async function syncReservations() {
  try {
    console.log("🟦 Starting reservation sync...", new Date().toISOString());

    const channelMapping = {
      // Channel IDs
      2323525: "Website",
      2323516: "Blocked",
      2323543: "Airbnb",

      // Channel Names
      Homepage: "Website",
      "Direct booking": "Website",
      "Homepage direct": "Website",
      Direct: "Website",
      Airbnb: "Airbnb",
      airbnb: "Airbnb",
      "booking.com": "Booking.com",
      "Booking.com": "Booking.com",
      "Blocked channel": "Blocked",
      Blocked: "Blocked",
    };

    const endDate = new Date().toISOString().split("T")[0];
    const startDate = new Date(Date.now() - 730 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];

    const response = await axios.get(
      "https://login.smoobu.com/api/reservations",
      {
        headers: {
          "Api-Key":
            process.env.SMOOBU_API_KEY ||
            "UZFV5QRY0ExHUfJi3c1DIG8Bpwet1X4knWa8rMkj6o",
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

    console.log(
      "Full booking details:",
      response.data.bookings?.map((booking) => ({
        id: normalizeBookingId(booking.id),
        channel: booking.channel,
        channelId: booking.channel?.id,
        channelName: booking.channel?.name,
        arrival: booking.arrival,
        guest: booking["guest-name"],
      }))
    );

    const reservations = response.data.bookings || [];
    console.log(`🟦 Found ${reservations.length} reservations to process`);

    let successCount = 0;
    let errorCount = 0;

    for (const reservation of reservations) {
      try {
        const normalizedId = normalizeBookingId(reservation.id);
        if (!normalizedId) {
          console.error("🟥 Invalid reservation ID, skipping...");
          errorCount++;
          continue;
        }

        console.log(`🟦 Processing reservation ${normalizedId} from channel:`, {
          rawChannelName: reservation.channel?.name,
          mappedChannelName:
            channelMapping[reservation.channel?.name] || "Website",
        });

        // Check for existing booking with normalized ID
        const existingBookingRef = await db
          .collection("bookings")
          .where("smoobuId", "==", String(normalizedId))
          .get();

        const existingDoc = existingBookingRef.empty
          ? null
          : existingBookingRef.docs[0];

        // Get price elements
        const priceElementsResponse = await axios.get(
          `https://login.smoobu.com/api/reservations/${normalizedId}/price-elements`,
          {
            headers: {
              "Api-Key":
                process.env.SMOOBU_API_KEY ||
                "UZFV5QRY0ExHUfJi3c1DIG8Bpwet1X4knWa8rMkj6o",
              "Cache-Control": "no-cache",
            },
          }
        );

        const priceElements = priceElementsResponse.data.priceElements || [];

        // Add debug logging for all price elements
        console.log(
          `Raw price elements for booking ${normalizedId}:`,
          priceElements
        );

        // Process extras data
        const extrasData = processExtrasWithPersons(priceElements);

        // Extract pricing information
        const pricingInfo = extractPricingInfo(priceElements);

        // Extract linen fee
        const linenFee =
          priceElements.find(
            (el) =>
              el.name?.toLowerCase().includes("linen") ||
              el.name?.toLowerCase().includes("linge") ||
              el.name?.toLowerCase().includes("cleaning")
          )?.amount || 0;

        // Extract commission
        const commission =
          priceElements.find((el) =>
            el.name?.toLowerCase().includes("commission")
          )?.amount || 0;

        // Calculate nights
        const checkIn = new Date(reservation.arrival);
        const checkOut = new Date(reservation.departure);
        const nights = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));

        // Format guest name
        const guestName =
          reservation["guest-name"] ||
          `${reservation.firstName || ""} ${
            reservation.lastName || ""
          }`.trim() ||
          "Unknown Guest";

        // Special handling for Airbnb bookings
        const portalName = getPortalName(reservation.channel?.name);
        if (reservation.channel?.name === "Airbnb" || portalName === "Airbnb") {
          console.log(`🔄 Special handling for Airbnb booking ${normalizedId}`);

          // Only keep anniversary-related extras for Airbnb bookings
          const filteredExtras = extrasData.extras.filter(
            (extra) => extra.name && extra.name.includes("anniversaire")
          );

          // Replace the extras in extrasData
          extrasData.extras = filteredExtras;
          extrasData.extrasTotal = filteredExtras.reduce(
            (sum, extra) => sum + Math.abs(parseFloat(extra.amount) || 0),
            0
          );

          console.log(
            "Restricted Airbnb extras to:",
            filteredExtras.map((e) => e.name)
          );
        }

        // Create booking document
        const bookingDoc = {
          smoobuId: normalizedId,
          smoobuReservationId: Number(normalizedId), // Store both formats for better matching
          createdAt: reservation["created-at"] || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          firstName: reservation.firstName || guestName.split(" ")[0] || "",
          lastName:
            reservation.lastName ||
            (guestName.split(" ").length > 1
              ? guestName.split(" ").slice(1).join(" ")
              : ""),
          guestName: guestName,
          email: reservation.email || "",
          phone: reservation.phone || "",
          address: reservation.address || "",
          adults: parseInt(reservation.adults) || 0,
          children: parseInt(reservation.children) || 0,
          arrivalDate: reservation.arrival,
          departureDate: reservation.departure,
          checkInTime: reservation["check-in"] || "",
          checkOutTime: reservation["check-out"] || "",
          apartmentId: reservation.apartment?.id,
          property:
            roomNames[reservation.apartment?.id] ||
            reservation.apartment?.name ||
            "",
          channelId: reservation.channel?.id,
          channelName: reservation.channel?.name || "",
          portalName: portalName,
          price: parseFloat(reservation.price) || 0,
          basePrice: pricingInfo.basePrice,
          linenFee: parseFloat(linenFee),
          commission: parseFloat(commission),
          extras: extrasData.extras,
          nights: nights,
          priceDetails: {
            basePrice: pricingInfo.basePrice,
            linenFee: parseFloat(linenFee),
            commission: parseFloat(commission),
            longStayDiscount: pricingInfo.longStayDiscount,
            couponDiscount: pricingInfo.couponDiscount,
            discount: pricingInfo.longStayDiscount,
            extrasTotal: extrasData.extras.reduce(
              (sum, extra) => sum + Math.abs(parseFloat(extra.amount) || 0),
              0 // Only use base amount
            ),
            priceElements: priceElements,
            promoCode: pricingInfo.promoCode, // This is now always either an object or null
            calculatedDiscounts: {
              longStay: pricingInfo.longStayDiscount,
              coupon: pricingInfo.couponDiscount,
            },
            settings: {
              extraChildPerNight: 20,
              extraGuestsPerNight: 20,
              lengthOfStayDiscount: {
                discountPercentage: pricingInfo.longStayDiscount > 0 ? 40 : 0,
                minNights: 2,
              },
              maxGuests: 4,
              startingAtGuest: 2,
            },
          },
          lastSyncedAt: new Date().toISOString(),
        };

        // Clean up undefined values
        const cleanBookingDoc = {};
        Object.entries(bookingDoc).forEach(([key, value]) => {
          if (value !== undefined) {
            cleanBookingDoc[key] = value;
          }
        });

        const cleanPriceDetails = {};
        Object.entries(bookingDoc.priceDetails || {}).forEach(
          ([key, value]) => {
            if (value !== undefined) {
              cleanPriceDetails[key] = value;
            }
          }
        );

        cleanBookingDoc.priceDetails = cleanPriceDetails;

        // Save to Firebase
        if (existingDoc) {
          await db
            .collection("bookings")
            .doc(existingDoc.id)
            .update({
              ...cleanBookingDoc,
              createdAt: existingDoc.data().createdAt,
            });

          console.log(`🟦 Updated existing booking ${normalizedId}`);
        } else {
          await db
            .collection("bookings")
            .doc(normalizedId)
            .set(cleanBookingDoc);
          console.log(`🟩 Added new booking ${normalizedId}`);
        }

        successCount++;
        await new Promise((resolve) => setTimeout(resolve, 500)); // Add delay between requests
      } catch (error) {
        console.error(
          `🟥 Error processing reservation ${reservation.id}:`,
          error
        );
        errorCount++;
        continue;
      }
    }

    console.log("🟦 Sync Summary:", {
      totalReservations: reservations.length,
      successfullyProcessed: successCount,
      errors: errorCount,
      completedAt: new Date().toISOString(),
    });

    return {
      success: true,
      message: "Sync completed successfully",
      stats: {
        total: reservations.length,
        successful: successCount,
        failed: errorCount,
      },
    };
  } catch (error) {
    console.error("🟥 Error in syncReservations:", error);
    throw error;
  }
}
