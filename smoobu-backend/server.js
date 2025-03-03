import express from "express";
import cors from "cors";
import axios from "axios";
import Stripe from "stripe";
import * as dotenv from "dotenv";
import cron from "node-cron";
import { roomNames, portalNames, discountSettings, extrasFrenchNames } from "./config/config.js"
import { syncReservations } from "./third-party/smoobu/syncReservationsNodeCron.js"
import { verifyWordPressAuth } from "./third-party/wordpress/verify-wordpress-auth.js"
import { transporter } from "./config/nodemailer.js"
import { calculatePriceWithSettings } from "./helpers/pricing/calculate-price-with-settings.js"
import { handleWebhook, pendingBookings } from "./third-party/stripe/webhook/index.js";

import {
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";


import { db } from "./firebase-config.js";

// AlexisVS: init.js
dotenv.config();
const app = express();

// AlexisVS: je sais pas c'est quoi
app.options("/webhook", cors());

// AlexisVS: third-party/stripe/stripe.js
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// AlexisVS: third-party/smobou/actions/webhook.js
app.post("/webhook", express.raw({ type: "application/json" }), handleWebhook);

// AlexisVS: init.js et faire une separation si les trucs qui avait au dessus en on pas besoins
// Use JSON parsing and CORS for all other routes
app.use(express.json());
app.use(
  cors({
    origin: [
      "https://reservation.fermedebasseilles.be",
      "https://smoobu-test.vercel.app",
      "http://localhost:5173",
      "http://localhost:3000",
    ],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "Accept",
      "Origin",
    ],
  })
);

// AlexisVS: third-party/smobou/actions/sync-reservations.js
app.get("/sync-reservations", async (req, res) => {
  try {
    console.log("Starting reservation sync...");
    const result = await syncReservations();
    console.log("Sync completed:", result);
    res.json(result);
  } catch (error) {
    console.error("Error in sync endpoint:", error);
    res.status(500).json({
      error: "Failed to sync reservations",
      details: error.message,
    });
  }
});

// AlexisVS: third-party/smobou/helpers/get-portal-name.js
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

// AlexisVS: third-party/smobou/actions/api/deduplicate-bookings.js
app.get("/api/deduplicate-bookings", async (req, res) => {
  try {
    console.log("🟦 Starting deduplication process...");

    // Get all bookings from Firebase
    const bookingsSnapshot = await db.collection("bookings").get();
    const bookings = [];
    bookingsSnapshot.forEach((doc) => {
      bookings.push({
        id: doc.id,
        ...doc.data(),
      });
    });

    console.log(`🟦 Found ${bookings.length} total bookings in database`);

    // Group by smoobuId
    const bookingsBySmoobuId = {};
    bookings.forEach((booking) => {
      const smoobuId = booking.smoobuId;
      if (!smoobuId) return; // Skip entries without smoobuId

      if (!bookingsBySmoobuId[smoobuId]) {
        bookingsBySmoobuId[smoobuId] = [];
      }
      bookingsBySmoobuId[smoobuId].push(booking);
    });

    // Find duplicates
    const duplicates = Object.entries(bookingsBySmoobuId)
      .filter(([_, group]) => group.length > 1)
      .map(([smoobuId, group]) => ({
        smoobuId,
        count: group.length,
        bookings: group,
      }));

    console.log(`🟦 Found ${duplicates.length} bookings with duplicates`);

    // Delete duplicates - keep only the most recently updated one for each smoobuId
    let deletedCount = 0;
    for (const duplicate of duplicates) {
      // Sort by updatedAt (newest first)
      duplicate.bookings.sort((a, b) => {
        const dateA = new Date(a.updatedAt || a.createdAt || 0);
        const dateB = new Date(b.updatedAt || b.createdAt || 0);
        return dateB - dateA;
      });

      // Keep the first one (newest), delete the rest
      const [keep, ...toDelete] = duplicate.bookings;
      console.log(
        `🟨 Keeping booking ${keep.id} for smoobuId ${duplicate.smoobuId}`
      );

      for (const booking of toDelete) {
        console.log(
          `🟥 Deleting duplicate booking ${booking.id} for smoobuId ${duplicate.smoobuId}`
        );
        await db.collection("bookings").doc(booking.id).delete();
        deletedCount++;
      }
    }

    console.log(
      `🟩 Deduplication complete. Deleted ${deletedCount} duplicate bookings`
    );

    res.json({
      success: true,
      stats: {
        totalBookings: bookings.length,
        duplicateGroups: duplicates.length,
        deletedBookings: deletedCount,
      },
    });
  } catch (error) {
    console.error("🟥 Error during deduplication:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// In your server.js
// Add or update this endpoint in your server.js
// AlexisVS: third-party/smobou/actions/api/fetch-and-sync.js
app.get("/api/fetch-and-sync", async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: "Missing date parameters",
      });
    }

    console.log("🟦 Starting fetch and sync process...", {
      startDate,
      endDate,
    });

    // 1. Fetch bookings from Smoobu API
    const response = await axios.get(
      "https://login.smoobu.com/api/reservations",
      {
        headers: {
          "Api-Key": "UZFV5QRY0ExHUfJi3c1DIG8Bpwet1X4knWa8rMkj6o",
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

    // Track statistics
    let stats = {
      fetched: bookings.length,
      added: 0,
      updated: 0,
      skipped: 0,
      errors: 0,
    };

    // IMPROVED: First check for existing bookings to avoid duplicates
    // Get all existing booking IDs in one batch query
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
      // Also add by smoobuReservationId if it exists
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

    // 2. Process each booking
    for (const booking of bookings) {
      try {
        // Use normalized ID for consistent matching
        const smoobuId = normalizeBookingId(booking.id);

        console.log(`🔄 Processing booking ${smoobuId}`);

        // Check for existing booking using our map
        const existingBookings = existingBookingMap.get(smoobuId) || [];

        // Get channel/portal name
        const channelName = booking.channel?.name || "Website";
        const portalName = getPortalName(channelName) || "Website";

        // Fetch price elements
        let priceElements = [];
        try {
          const priceElementsResponse = await axios.get(
            `https://login.smoobu.com/api/reservations/${smoobuId}/price-elements`,
            {
              headers: {
                "Api-Key": "UZFV5QRY0ExHUfJi3c1DIG8Bpwet1X4knWa8rMkj6o",
                "Cache-Control": "no-cache",
              },
            }
          );
          priceElements = priceElementsResponse.data.priceElements || [];
          console.log(
            `🟦 Fetched ${priceElements.length} price elements for booking ${smoobuId}`
          );
        } catch (priceError) {
          console.error(
            `🟨 Error fetching price elements for booking ${smoobuId}:`,
            priceError.message
          );
        }

        // Use helper functions for price extraction
        const pricingInfo = extractPricingInfo(priceElements);
        const extrasData = processExtrasWithPersons(priceElements);

        // Still extract these directly
        const linenFee =
          priceElements.find(
            (el) =>
              el.name?.toLowerCase().includes("linen") ||
              el.name?.toLowerCase().includes("linge") ||
              el.name?.toLowerCase().includes("cleaning")
          )?.amount || 0;

        const commission =
          priceElements.find((el) =>
            el.name?.toLowerCase().includes("commission")
          )?.amount || 0;

        // Calculate nights
        const checkIn = new Date(booking.arrival);
        const checkOut = new Date(booking.departure);
        const nights = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));

        // Format guest name
        const guestName =
          booking["guest-name"] ||
          `${booking.firstName || ""} ${booking.lastName || ""}`.trim() ||
          "Unknown Guest";

        // When handling a booking, add this check right after fetching the booking data
        if (booking.channel?.name === "Airbnb" || portalName === "Airbnb") {
          console.log(`🔄 Special handling for Airbnb booking ${smoobuId}`);

          // Only keep one specific extra if it exists
          const filteredExtras = extrasData.extras.filter(
            (extra) => extra.name && extra.name.includes("anniversaire")
          );

          // Force replace the extras
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

                  function isUnwantedExtra(extraName) {
                    if (!extraName) return true;

                    const name = extraName.toLowerCase();
                    return (
                      name.includes("cancellation") ||
                      name.includes("commission") ||
                      name.includes("pass_through") ||
                      name.includes("host fee") ||
                      name.includes("service fee") ||
                      name.includes("cleaning fee") ||
                      name.includes("vat") ||
                      name.includes("tax") ||
                      name.includes("linen_fee") ||
                      (name.includes("fee") && !name.includes("coffee"))
                    );
                  }


        // Create booking document with improved price and discount handling
        const bookingDoc = {
          smoobuId: smoobuId,
          smoobuReservationId: Number(smoobuId), // Store both formats for better matching
          createdAt: booking["created-at"] || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          firstName: booking.firstName || guestName.split(" ")[0] || "",
          lastName:
            booking.lastName ||
            (guestName.split(" ").length > 1
              ? guestName.split(" ").slice(1).join(" ")
              : ""),
          guestName: guestName,
          email: booking.email || "",
          phone: booking.phone || "",
          address: booking.address || "",
          adults: parseInt(booking.adults) || 0,
          children: parseInt(booking.children) || 0,
          arrivalDate: booking.arrival,
          departureDate: booking.departure,
          checkInTime: booking["check-in"] || "",
          checkOutTime: booking["check-out"] || "",
          apartmentId: booking.apartment?.id,
          property:
            roomNames[booking.apartment?.id] || booking.apartment?.name || "",
          channelId: booking.channel?.id,
          channelName: booking.channel?.name || "",
          portalName: portalName,
          price: parseFloat(booking.price) || 0,
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

        // Log detailed information for the specific problematic booking
        if (smoobuId === "88649503") {
          console.log("🔍 Found target booking 88649503!");
          console.log("Base price:", pricingInfo.basePrice);
          console.log("Long stay discount:", pricingInfo.longStayDiscount);
          console.log("Coupon discount:", pricingInfo.couponDiscount);
          console.log(
            "Extras:",
            extrasData.extras.map((e) => `${e.name} (${e.amount}€)`)
          );
        }

        // Create clean versions of data objects without undefined values
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

        console.log

        // Add or update in Firebase
        if (existingBookings.length === 0) {
          // Add new booking
          await db.collection("bookings").add(cleanBookingDoc);
          console.log(
            `🟩 Added new booking ${smoobuId} (${portalName}): ${guestName}`
          );
          stats.added++;
        } else if (existingBookings.length === 1) {
          // Update single existing booking with proper data preservation
          const docId = existingBookings[0].id;
          const existingData = existingBookings[0];
          // IMPROVED: Preserve existing extra person data for all matching extras
          let mergedExtras = [];

          // Process each new extra
          extrasData.extras.forEach((newExtra) => {
            // Skip unwanted extras
            if (isUnwantedExtra(newExtra.name)) {
              console.log(
                `⛔ Skipping unwanted extra from API: ${newExtra.name}`
              );
              return;
            }

            // Check if this extra exists in the existing data
            const existingExtra = existingData.extras?.find(
              (e) => e.name === newExtra.name
            );

            if (
              existingExtra &&
              (existingExtra.hasExtraPerson ||
                existingExtra.extraPersonQuantity > 0 ||
                existingExtra.extraPersonPrice > 0 ||
                existingExtra.extraPersonAmount > 0)
            ) {
              // Use the existing extra person data
              console.log(
                `Preserving extra person data for ${existingExtra.name}`
              );
              mergedExtras.push({
                ...newExtra,
                extraPersonQuantity: existingExtra.extraPersonQuantity,
                extraPersonPrice: existingExtra.extraPersonPrice,
                extraPersonAmount: existingExtra.extraPersonAmount,
                extraPersonName:
                  existingExtra.extraPersonName || "Personne supplémentaire",
                hasExtraPerson: true,
              });
            } else {
              // Use the new extra as is
              mergedExtras.push(newExtra);
            }
          });

          // Then add any existing extras that are not unwanted and not already included
          if (existingData.extras && Array.isArray(existingData.extras)) {
            const newExtraNames = new Set(mergedExtras.map((e) => e.name));

            existingData.extras.forEach((existingExtra) => {
              // Skip if it's already in our list or if it's an unwanted extra
              if (
                newExtraNames.has(existingExtra.name) ||
                isUnwantedExtra(existingExtra.name)
              ) {
                if (isUnwantedExtra(existingExtra.name)) {
                  console.log(
                    `⛔ Skipping unwanted extra from existing data: ${existingExtra.name}`
                  );
                }
                return;
              }

              // Only include extras that are definitely wanted (formulas, services, etc.)
              const name = (existingExtra.name || "").toLowerCase();
              const isWantedExtra =
                name.includes("formule") ||
                name.includes("essentiel") ||
                name.includes("détente") ||
                name.includes("gourmet") ||
                name.includes("romantique") ||
                name.includes("barbecue") ||
                name.includes("anniversaire") ||
                name.includes("petit-déjeuner") ||
                name.includes("raclette") ||
                name.includes("bouteille") ||
                name.includes("champagne") ||
                name.includes("spa") ||
                name.includes("massage") ||
                (name.includes("frais supplémentaires") &&
                  name.includes("personnes"));

              if (isWantedExtra) {
                console.log(
                  `✅ Adding wanted extra from existing data: ${existingExtra.name}`
                );
                mergedExtras.push(existingExtra);
              } else {
                console.log(
                  `⛔ Skipping extra from existing data (not in whitelist): ${existingExtra.name}`
                );
              }
            });
          }

          // Add this just before calculating mergedExtrasTotal
          if (booking.channel?.name === "Airbnb" || portalName === "Airbnb") {
            // Remove all unwanted extras from the merged list
            const filteredMergedExtras = mergedExtras.filter((extra) => {
              const name = (extra.name || "").toLowerCase();

              if (
                name.includes("cancellation") ||
                name.includes("commission") ||
                name.includes("pass_through") ||
                name.includes("linen_fee")
              ) {
                console.log(`🔴 Removing unwanted Airbnb extra: ${extra.name}`);
                return false;
              }
              return true;
            });

            console.log(
              "Filtered mergedExtras from:",
              mergedExtras.length,
              "to:",
              filteredMergedExtras.length
            );
            mergedExtras = filteredMergedExtras;
          }

          // Calculate extras total using only the base amount
          const mergedExtrasTotal = mergedExtras.reduce(
            (sum, extra) => sum + Math.abs(parseFloat(extra.amount) || 0),
            0
          );

          console.log(
            "Final extras after merging and filtering:",
            mergedExtras.map((e) => e.name)
          );

          // Create updated booking doc with merged extras
          const updatedBookingDoc = {
            ...existingData, // Start with ALL existing data
            ...cleanBookingDoc, // Add/overwrite with new data

            // Use our carefully merged extras
            extras: mergedExtras,

            // Make sure these critical fields don't get overwritten
            createdAt: existingData.createdAt || bookingDoc.createdAt,
            paymentIntentId: existingData.paymentIntentId || null,
            stripePaymentStatus: existingData.stripePaymentStatus || null,
            updatedAt: new Date().toISOString(),

            // Special handling for price details to ensure we don't lose information
            priceDetails: {
              ...cleanPriceDetails, // Use our clean price details

              // Update extras total with the correct calculation
              extrasTotal: mergedExtrasTotal,
            },
          };

          // Create clean version of this updated doc
          const cleanUpdatedDoc = {};
          Object.entries(updatedBookingDoc).forEach(([key, value]) => {
            if (value !== undefined) {
              cleanUpdatedDoc[key] = value;
            }
          });

          // Make sure priceDetails is clean too
          if (cleanUpdatedDoc.priceDetails) {
            const cleanUpdatedPriceDetails = {};
            Object.entries(cleanUpdatedDoc.priceDetails).forEach(
              ([key, value]) => {
                if (value !== undefined) {
                  cleanUpdatedPriceDetails[key] = value;
                }
              }
            );
            cleanUpdatedDoc.priceDetails = cleanUpdatedPriceDetails;
          }

          // Update with cleaned document
          await db.collection("bookings").doc(docId).update(cleanUpdatedDoc);

          console.log(
            `🟦 Updated booking ${smoobuId} (${portalName}): ${guestName} with ${
              mergedExtras.length
            } extras: ${mergedExtras.map((e) => e.name).join(", ")}`
          );
          stats.updated++;
        } else {
          // Handle duplicate existing bookings - update the most recent one but DON'T delete others
          console.log(
            `⚠️ Found ${existingBookings.length} potential duplicates for booking ${smoobuId}. Will update without deleting.`
          );

          // Sort the bookings by update date to find the most recently updated one
          existingBookings.sort((a, b) => {
            const dateA = new Date(a.updatedAt || a.createdAt || 0);
            const dateB = new Date(b.updatedAt || b.createdAt || 0);
            return dateB - dateA;
          });

          const mostRecent = existingBookings[0];
          const existingData = mostRecent;

          // IMPROVED: Preserve existing extra person data for all matching extras
let mergedExtras = [];

// Process each new extra
extrasData.extras.forEach((newExtra) => {
  // Skip unwanted extras
  if (isUnwantedExtra(newExtra.name)) {
    console.log(`⛔ Skipping unwanted extra from API: ${newExtra.name}`);
    return;
  }

  // Check if this extra exists in the existing data
  const existingExtra = existingData.extras?.find(
    (e) => e.name === newExtra.name
  );

  if (
    existingExtra &&
    (existingExtra.hasExtraPerson ||
      existingExtra.extraPersonQuantity > 0 ||
      existingExtra.extraPersonPrice > 0 ||
      existingExtra.extraPersonAmount > 0)
  ) {
    // Use the existing extra person data
    console.log(`Preserving extra person data for ${existingExtra.name}`);
    mergedExtras.push({
      ...newExtra,
      extraPersonQuantity: existingExtra.extraPersonQuantity,
      extraPersonPrice: existingExtra.extraPersonPrice,
      extraPersonAmount: existingExtra.extraPersonAmount,
      extraPersonName:
        existingExtra.extraPersonName || "Personne supplémentaire",
      hasExtraPerson: true,
    });
  } else {
    // Use the new extra as is
    mergedExtras.push(newExtra);
  }
});

// Then add any existing extras that are not unwanted and not already included
if (existingData.extras && Array.isArray(existingData.extras)) {
  const newExtraNames = new Set(mergedExtras.map((e) => e.name));

  existingData.extras.forEach((existingExtra) => {
    // Skip if it's already in our list or if it's an unwanted extra
    if (
      newExtraNames.has(existingExtra.name) ||
      isUnwantedExtra(existingExtra.name)
    ) {
      if (isUnwantedExtra(existingExtra.name)) {
        console.log(
          `⛔ Skipping unwanted extra from existing data: ${existingExtra.name}`
        );
      }
      return;
    }

    // Only include extras that are definitely wanted (formulas, services, etc.)
    const name = (existingExtra.name || "").toLowerCase();
    const isWantedExtra =
      name.includes("formule") ||
      name.includes("essentiel") ||
      name.includes("détente") ||
      name.includes("gourmet") ||
      name.includes("romantique") ||
      name.includes("barbecue") ||
      name.includes("anniversaire") ||
      name.includes("petit-déjeuner") ||
      name.includes("raclette") ||
      name.includes("bouteille") ||
      name.includes("champagne") ||
      name.includes("spa") ||
      name.includes("massage") ||
      (name.includes("frais supplémentaires") &&
        name.includes("personnes"));

    if (isWantedExtra) {
      console.log(
        `✅ Adding wanted extra from existing data: ${existingExtra.name}`
      );
      mergedExtras.push(existingExtra);
    } else {
      console.log(
        `⛔ Skipping extra from existing data (not in whitelist): ${existingExtra.name}`
      );
    }
  });
}

          // FIXED: Calculate extras total using only the base amount
          const mergedExtrasTotal = mergedExtras.reduce(
            (sum, extra) => sum + Math.abs(parseFloat(extra.amount) || 0),
            0
          );

          // Create clean version of the updated document
          const updatedBookingDoc = {
            ...existingData, // Start with ALL existing data
            ...cleanBookingDoc, // Add/overwrite with new data

            // Use our carefully merged extras
            extras: mergedExtras,

            // Make sure these critical fields don't get overwritten
            createdAt: existingData.createdAt || bookingDoc.createdAt,
            paymentIntentId: existingData.paymentIntentId || null,
            stripePaymentStatus: existingData.stripePaymentStatus || null,
            updatedAt: new Date().toISOString(),

            // Special handling for price details
            priceDetails: {
              ...cleanPriceDetails,
              extrasTotal: mergedExtrasTotal,
            },
          };

          // Clean the updated doc
          const cleanUpdatedDoc = {};
          Object.entries(updatedBookingDoc).forEach(([key, value]) => {
            if (value !== undefined) {
              cleanUpdatedDoc[key] = value;
            }
          });

          // Make sure priceDetails is clean too
          if (cleanUpdatedDoc.priceDetails) {
            const cleanUpdatedPriceDetails = {};
            Object.entries(cleanUpdatedDoc.priceDetails).forEach(
              ([key, value]) => {
                if (value !== undefined) {
                  cleanUpdatedPriceDetails[key] = value;
                }
              }
            );
            cleanUpdatedDoc.priceDetails = cleanUpdatedPriceDetails;
          }

          // Update the booking without deleting any others
          try {
            await db
              .collection("bookings")
              .doc(mostRecent.id)
              .update(cleanUpdatedDoc);
            console.log(
              `🟦 Updated booking ${smoobuId} - DISABLED duplicate deletion`
            );
            stats.updated++;
          } catch (updateError) {
            console.error(`Error updating booking ${smoobuId}:`, updateError);
            stats.errors++;
          }
        }
      } catch (bookingError) {
        console.error(
          `🟥 Error processing booking ${booking.id}:`,
          bookingError.message
        );
        stats.errors++;
      }
    }

    console.log("🟩 Sync process completed:", stats);
    return res.json({
      success: true,
      stats: stats,
      message: "Fetch and sync completed successfully",
    });
  } catch (error) {
    console.error("🟥 Error in fetch-and-sync endpoint:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "An unknown error occurred",
      message: "Failed to fetch and sync bookings",
    });
  }
});

// AlexisVS: helpers/normalize-booking-id.js
// Helper function for normalizing booking IDs
function normalizeBookingId(id) {
  if (!id) return null;
  return String(id).trim();
}

// AlexisVS: helpers/price/extract-pricing-info.js
// Helper function for extracting pricing information
function extractPricingInfo(priceElements) {
  // Base price elements - look for either "base" type or "Prix de base" name
  const basePriceElement = priceElements.find(
    (el) =>
      el.type === "base" ||
      (el.name || "").toLowerCase().includes("prix de base") ||
      (el.name || "").toLowerCase().includes("base price")
  );

  const basePrice = basePriceElement
    ? parseFloat(basePriceElement.amount) || 0
    : 0;

  // Find discounts
  const longStayElement = priceElements.find(
    (el) => el.name && el.name.toLowerCase().includes("réduction long séjour")
  );
  const longStayDiscount = longStayElement
    ? Math.abs(parseFloat(longStayElement.amount) || 0)
    : 0;

  const couponElement = priceElements.find(
    (el) => el.name && el.name.toLowerCase().includes("code promo")
  );
  const couponDiscount = couponElement
    ? Math.abs(parseFloat(couponElement.amount) || 0)
    : 0;

  // Create promoCode object if coupon exists
  let promoCode = null;
  if (couponElement && couponElement.name) {
    const couponMatch = couponElement.name.match(/POTES|[A-Z0-9]+/i);
    const couponName = couponMatch ? couponMatch[0] : "CODE";

    promoCode = {
      code: couponName,
      name: couponName,
      amount: couponDiscount,
      type: "fixed",
      percentageValue: null,
    };
  }

  return {
    basePrice,
    longStayDiscount,
    couponDiscount,
    promoCode,
    discountElements: {
      longStay: longStayElement,
      coupon: couponElement,
    },
  };
}

// AlexisVS: third-party/smobou/helpers/process-extras-with-persons.js
// Helper function for processing extras
function processExtrasWithPersons(priceElements) {
  // First, filter to ONLY include items that are definitely extras we want to display
  // This is a "whitelist" approach instead of a "blacklist" approach

  const isWantedExtra = (element) => {
    const name = (element.name || "").toLowerCase();
    const type = (element.type || "").toLowerCase();

    // Check if it's a clearly wanted extra (positive check)
    const isDefinitelyExtra =
      // Formules and packages
      name.includes("formule") ||
      name.includes("essentiel") ||
      name.includes("détente") ||
      name.includes("gourmet") ||
      name.includes("romantique") ||
      name.includes("barbecue") ||
      name.includes("anniversaire") ||
      // Food and beverages
      name.includes("petit-déjeuner") ||
      name.includes("raclette") ||
      name.includes("bouteille") ||
      name.includes("champagne") ||
      // Specific services
      name.includes("spa") ||
      name.includes("massage") ||
      // Only include "frais supplémentaires" if it refers to extra guests
      (name.includes("frais supplémentaires") && name.includes("personnes"));

    // Even if it matches above, exclude it if it also contains these terms
    const containsUnwantedTerms =
      name.includes("cancellation") ||
      name.includes("commission") ||
      name.includes("pass_through") ||
      name.includes("host fee") ||
      name.includes("service fee") ||
      name.includes("cleaning fee") ||
      (name.includes("fee") && !name.includes("coffee"));

    return isDefinitelyExtra && !containsUnwantedTerms;
  };

  // First filter the price elements to only include the extras we definitely want
  const wantedExtras = priceElements.filter(isWantedExtra);

  console.log(
    "Filtered to only wanted extras:",
    wantedExtras.map((e) => e.name)
  );

  // Now continue with processing as before, but starting from our filtered list

  // 1. Deduplicate by name
  const extraNamesMap = new Map();
  wantedExtras.forEach((element) => {
    if (extraNamesMap.has(element.name)) {
      const existing = extraNamesMap.get(element.name);
      // Only replace if this one has more data or higher amount
      if (
        element.type === "addon" ||
        parseFloat(element.amount) > parseFloat(existing.amount)
      ) {
        extraNamesMap.set(element.name, element);
      }
    } else {
      extraNamesMap.set(element.name, element);
    }
  });

  const potentialExtras = Array.from(extraNamesMap.values());
  console.log(
    "Deduplicated extras:",
    potentialExtras.map((e) => e.name)
  );

  // 2. Identify "personne supplémentaire" items
  const personneItems = priceElements.filter((element) => {
    const name = (element.name || "").toLowerCase();
    return name.includes("personne supplémentaire");
  });

  console.log(
    "Personne supplémentaire items:",
    personneItems.map((e) => e.name)
  );

  // 3. Process each extra and try to match with personne supplémentaire items
  const processedExtras = potentialExtras.map((extra) => {
    const extraName = (extra.name || "").toLowerCase();

    // Try to find a matching personne supplémentaire item for this extra
    const matchingPersonItem = personneItems.find((person) => {
      const personName = (person.name || "").toLowerCase();

      // Check if the person item references this extra
      // First strip out qualifiers from the extra name
      const baseExtraName = extraName
        .replace(" (pour 2)", "")
        .replace(" (2 pers)", "")
        .replace(" (pour 2 personnes)", "");

      // More aggressive matching - look for significant words in both names
      const extraWords = baseExtraName.split(" ");
      const significantExtraWords = extraWords.filter(
        (word) =>
          word.length > 3 &&
          !["pour", "avec", "sans", "dans", "les"].includes(word)
      );

      // Check if personne item contains these significant words
      const hasMatch = significantExtraWords.some((word) =>
        personName.includes(word)
      );

      return hasMatch;
    });

    let extraPersonAmount = 0;
    let extraPersonPrice = 0;
    let extraPersonQuantity = 0;
    let hasExtraPerson = false;

    if (matchingPersonItem) {
      // Use data from matched item
      extraPersonAmount = Math.abs(parseFloat(matchingPersonItem.amount) || 0);
      extraPersonQuantity = parseInt(matchingPersonItem.quantity) || 1;
      extraPersonPrice = extraPersonAmount / extraPersonQuantity;
      hasExtraPerson = true;

      console.log(
        `Found match for "${extra.name}": "${matchingPersonItem.name}" (${extraPersonAmount}€)`
      );
    }

    return {
      name: extra.name || "Extra",
      amount: Math.abs(parseFloat(extra.amount) || 0),
      quantity: parseInt(extra.quantity) || 1,
      type: extra.type || "addon",
      id: extra.id,
      currencyCode: extra.currencyCode || "EUR",
      extraPersonQuantity,
      extraPersonPrice,
      extraPersonAmount,
      extraPersonName: matchingPersonItem
        ? matchingPersonItem.name
        : "Personne supplémentaire",
      hasExtraPerson,
    };
  });

  // Filter out "Frais supplémentaires" if it appears as a regular extra AND we already have it with "personne supplémentaire"
  const fraisPresentAsPersonne = personneItems.some((p) =>
    p.name.toLowerCase().includes("frais supplémentaires")
  );

  const finalExtras = fraisPresentAsPersonne
    ? processedExtras.filter(
        (e) => !e.name.toLowerCase().includes("frais supplémentaires")
      )
    : processedExtras;

  // If we filtered out "Frais supplémentaires", add it back as a separate item
  if (fraisPresentAsPersonne) {
    const fraisItem = personneItems.find((p) =>
      p.name.toLowerCase().includes("frais supplémentaires")
    );

    if (fraisItem) {
      finalExtras.push({
        name: fraisItem.name,
        amount: Math.abs(parseFloat(fraisItem.amount) || 0),
        quantity: parseInt(fraisItem.quantity) || 1,
        type: "addon",
        id: fraisItem.id,
        currencyCode: fraisItem.currencyCode || "EUR",
        extraPersonQuantity: 0,
        extraPersonPrice: 0,
        extraPersonAmount: 0,
        extraPersonName: "Personne supplémentaire",
        hasExtraPerson: false,
      });

      console.log(
        `Added "Frais supplémentaires" as a separate item (${fraisItem.amount}€)`
      );
    }
  }

  // Calculate extras total using only the base amount
  const extrasTotal = finalExtras.reduce((sum, extra) => {
    return sum + parseFloat(extra.amount || 0); // Only use base amount, not extraPersonAmount
  }, 0);

  return {
    extras: finalExtras,
    extrasTotal,
  };
}

// AlexisVS: schedule.js
// Schedule automatic sync every 4 hours
cron.schedule("0 */12 * * *", async () => {
  try {
    console.log("🟦 Starting scheduled sync...");
    await syncReservations();
    console.log("🟩 Scheduled sync completed");
  } catch (error) {
    console.error("🟥 Scheduled sync failed:", error);
  }
});

// AlexisVS: third-party/smobou/actions/api/create-gift-voucher
app.post("/api/create-gift-voucher", verifyWordPressAuth, async (req, res) => {
  try {
    const {
      orderId,
      amount,
      customerEmail,
      customerName,
      customerPhone,
      language,
    } = req.body;

    // Generate unique voucher code
    const voucherCode = `GIFT-${Math.random()
      .toString(36)
      .substring(2, 12)
      .toUpperCase()}`;

    // Create voucher document in Firebase
    const voucherData = {
      code: voucherCode,
      amount: Number(amount),
      type: "fixed",
      isGiftVoucher: true,
      status: "active",
      orderId,
      customerEmail,
      customerName,
      customerPhone,
      language,
      dateCreated: new Date().toISOString(),
      expiryDate: new Date(
        Date.now() + 365 * 24 * 60 * 60 * 1000
      ).toISOString(),
      usedCount: 0,
      usageHistory: [],
    };

    await db.collection("coupons").add(voucherData);

    // Just return the success response, no email sending
    res.json({
      success: true,
      voucherCode,
      amount,
    });
  } catch (error) {
    console.error("Error creating gift voucher:", error);
    res.status(500).json({
      error: "Failed to create gift voucher",
      details: error.message,
    });
  }
});

// AlexisVS: third-party/smobou/actions/api/validate-voucher.js
// Endpoint to validate gift voucher during booking
app.post("/api/validate-voucher", async (req, res) => {
  try {
    const { code, amount } = req.body;
    console.log("Validating voucher with code:", code, "for amount:", amount);

    // Get voucher from Firebase
    const voucherQuery = await getDocs(
      query(collection(db, "coupons"), where("code", "==", code.toUpperCase()))
    );

    if (voucherQuery.empty) {
      console.log("No voucher found with code:", code);
      return res.status(404).json({
        valid: false,
        message: "Code invalide",
      });
    }

    const voucherDoc = voucherQuery.docs[0];
    const voucherData = voucherDoc.data();
    console.log("Found voucher:", voucherData);

    // If it's a gift voucher, perform specific validations
    if (voucherData.isGiftVoucher) {
      // Check if already used
      if (voucherData.usedCount > 0) {
        console.log("Gift voucher already used");
        return res.status(400).json({
          valid: false,
          message: "Ce bon cadeau a déjà été utilisé",
        });
      }

      // Check expiration - handle both Timestamp and regular date
      const expiryDate =
        voucherData.expiryDate?.toDate?.() || new Date(voucherData.expiryDate);
      if (expiryDate < new Date()) {
        console.log("Gift voucher expired");
        return res.status(400).json({
          valid: false,
          message: "Ce bon cadeau a expiré",
        });
      }

      // Check if booking amount is sufficient
      if (amount < voucherData.amount) {
        console.log("Booking amount insufficient");
        return res.status(400).json({
          valid: false,
          message: `Le montant de la réservation doit être supérieur au montant du bon cadeau (${voucherData.amount}€)`,
        });
      }
    }
    // Regular coupon validation
    else {
      // Check status
      if (voucherData.status !== "active" && code !== "POTES") {
        console.log("Coupon not active");
        return res.status(400).json({
          valid: false,
          message: "Ce code promo n'est plus valide",
        });
      }

      // Check expiration if exists
      if (voucherData.expiryDate) {
        const expiryDate =
          voucherData.expiryDate?.toDate?.() ||
          new Date(voucherData.expiryDate);
        if (expiryDate < new Date()) {
          console.log("Coupon expired");
          return res.status(400).json({
            valid: false,
            message: "Ce code promo a expiré",
          });
        }
      }
    }

    // Calculate discount based on type
    let discount = 0;
    if (voucherData.type === "percentage") {
      discount = (amount * voucherData.discount) / 100;
    } else {
      discount = voucherData.discount;
    }

    console.log("Voucher validated successfully");
    res.json({
      valid: true,
      code: voucherData.code,
      type: voucherData.type,
      isGiftVoucher: voucherData.isGiftVoucher || false,
      discount: discount,
      amount: voucherData.amount,
      percentageValue:
        voucherData.type === "percentage" ? voucherData.discount : null,
    });
  } catch (error) {
    console.error("Error validating voucher:", error);
    res.status(500).json({
      valid: false,
      message: "Erreur lors de la validation du bon cadeau",
    });
  }
});

// AlexisVS: third-party/smobou/actions/api/direct-bookings.js
app.get("/api/direct-bookings", async (req, res) => {
  try {
    const { startDate, endDate, showCancellation, excludeBlocked } = req.query;

    // Call Smoobu API directly
    const response = await axios.get(
      "https://login.smoobu.com/api/reservations",
      {
        headers: {
          "Api-Key": "UZFV5QRY0ExHUfJi3c1DIG8Bpwet1X4knWa8rMkj6o",
          "Cache-Control": "no-cache",
        },
        params: {
          arrivalFrom: startDate,
          arrivalTo: endDate,
          showCancellation: showCancellation === "true",
          excludeBlocked: excludeBlocked === "true",
          pageSize: 100,
        },
      }
    );

    // Log all channel information for debugging
    console.log(
      "All channels:",
      response.data.bookings?.map((b) => ({
        id: b.id,
        channelId: b.channel?.id,
        channelName: b.channel?.name,
        arrival: b.arrival,
      }))
    );

    res.json(response.data);
  } catch (error) {
    console.error("Error fetching direct bookings:", error);
    res.status(500).json({
      error: "Failed to fetch bookings",
      message: error.message,
    });
  }
});

// Helper function to generate email content
// AlexisVS: third-party/smobou/actions/api/extra-report.js
app.get("/api/extras-report", async (req, res) => {
  try {
    const { startMonth, startYear, endMonth, endYear } = req.query;

    const normalizeExtraName = (name) => {
      const frenchName = Object.entries(extrasFrenchNames).find(
        ([key, value]) =>
          value.toLowerCase() === name.toLowerCase() ||
          key.toLowerCase() === name.toLowerCase()
      );
      return frenchName ? frenchName[1] : name;
    };

    const startDate = `${startYear}-${String(startMonth).padStart(2, "0")}-01`;
    const lastDay = new Date(endYear, parseInt(endMonth), 0).getDate();
    const endDate = `${endYear}-${String(endMonth).padStart(
      2,
      "0"
    )}-${lastDay}`;

    console.log("=== START OF REQUEST ===");
    console.log("Request params:", {
      startMonth,
      startYear,
      endMonth,
      endYear,
    });
    console.log("Calculated dates:", { startDate, endDate });

    const bookingsResponse = await axios.get(
      "https://login.smoobu.com/api/reservations",
      {
        headers: {
          "Api-Key": "UZFV5QRY0ExHUfJi3c1DIG8Bpwet1X4knWa8rMkj6o",
          "Cache-Control": "no-cache",
        },
        params: {
          arrivalFrom: startDate,
          arrivalTo: endDate,
          excludeBlocked: true,
          showCancellation: false,
        },
      }
    );

    console.log("Smoobu API Response:", bookingsResponse.data);
    console.log(
      "Number of bookings:",
      bookingsResponse.data.bookings?.length || 0
    );

    const bookings = bookingsResponse.data.bookings || [];
    console.log(
      `Found ${bookings.length} bookings for period ${startMonth}/${startYear} - ${endMonth}/${endYear}`
    );

    const extrasCount = {};
    let processedCount = 0;
    let bookingsWithExtras = 0;

    for (const booking of bookings) {
      try {
        processedCount++;
        console.log(
          `Processing booking ${booking.id} (${booking.arrival} - ${booking.departure})`
        );

        const priceElementsResponse = await axios.get(
          `https://login.smoobu.com/api/reservations/${booking.id}/price-elements`,
          {
            headers: {
              "Api-Key": "UZFV5QRY0ExHUfJi3c1DIG8Bpwet1X4knWa8rMkj6o",
              "Cache-Control": "no-cache",
            },
          }
        );

        const extraNames = [
          "L'essentiel (pour 2) - Personne supplémentaire",
          "Le détente gourmet (pour 2) - Personne supplémentaire",
          "La raclette en détente (pour 2) - Personne supplémentaire",
          "Le romantique gourmet (pour 2) - Personne supplémentaire",
          "La raclette romantique (pour 2) - Personne supplémentaire",
          "Le barbecue détente (pour 2) - Personne supplémentaire",
          "Le romantique barbecue (pour 2) - Personne supplémentaire",
          "Formule petit-déjeuner (2 pers) - Personne supplémentaire",
          "Formule gourmet (2 pers) - Personne supplémentaire",
          "Formule raclette (2 pers) - Personne supplémentaire",
          "Formule barbecue (2 pers) - Personne supplémentaire",
          "Formule SPA (2 pers) - Personne supplémentaire",
          "Formule anniversaire (pour 2) - Personne supplémentaire",
          "L'essentiel (pour 2)",
          "Le détente gourmet (pour 2)",
          "La raclette en détente (pour 2)",
          "Le romantique gourmet (pour 2)",
          "La raclette romantique (pour 2)",
          "Le barbecue détente (pour 2)",
          "Le romantique barbecue (pour 2)",
          "Formule planche apéro (2 pers)",
          "Formule passion (pour 2)",
          "Formule anniversaire (pour 2)",
          "Formule petit-déjeuner (2 pers)",
          "Formule gourmet (2 pers)",
          "Formule raclette (2 pers)",
          "Formule barbecue (2 pers)",
          "Formule SPA (2 pers)",
          "Formule SPA + bouteille (2 pers)",
          "Boulettes de viande sauce liégeoise",
          "Boulette de viande sauce tomate",
          "Waterzooi de volaille",
          "Chili végétarien",
          "Velouté de carotte et cumin",
          "Brut de Bioul",
          "Cortil Barco",
          "Terre Charlot",
          "Houblonde Triple",
          "Houblonde Blonde",
          "Houblonde White IPA",
          "Brune du Condroz",
          "Ambrée du Condroz",
          "Blanche du Condroz",
          "Jus de pomme « Pom d'Happy »",
          "Ritchie Citron/Framboise",
          "Ritchie Orange/Vanille",
          "Ritchie Cola",
          "Ritchie Cola Zéro",
        ];

        const addons = (priceElementsResponse.data.priceElements || []).filter(
          (element) =>
            element.type === "addon" || extraNames.includes(element.name)
        );

        if (addons.length > 0) {
          bookingsWithExtras++;
          console.log(
            `Found ${addons.length} extras in booking ${booking.id}:`,
            addons.map((a) => ({
              name: a.name,
              amount: a.amount,
              quantity: a.quantity || 1,
            }))
          );
        }

        addons.forEach((addon) => {
          const normalizedName = normalizeExtraName(addon.name);
          if (!extrasCount[normalizedName]) {
            extrasCount[normalizedName] = {
              count: 0,
              totalAmount: 0,
              details: {
                calculationType: addon.calculationType || 0,
                optional: true,
                type: addon.type,
              },
            };
          }
          extrasCount[normalizedName].count += addon.quantity || 1;
          extrasCount[normalizedName].totalAmount += addon.amount;
        });
      } catch (error) {
        console.error(`Error processing booking ${booking.id}:`, error.message);
      }
    }

    const reportData = Object.entries(extrasCount)
      .map(([name, data]) => ({
        name,
        count: data.count,
        totalAmount: data.totalAmount,
        details: data.details,
      }))
      .sort((a, b) => b.count - a.count);

    console.log("=== PROCESSING SUMMARY ===");
    console.log({
      period: `${startMonth}/${startYear} - ${endMonth}/${endYear}`,
      totalBookingsInPeriod: bookings.length,
      processedBookings: processedCount,
      bookingsWithExtras,
      uniqueExtrasFound: reportData.length,
      extrasList: reportData.map((d) => `${d.name}: ${d.count}`),
    });

    res.json({
      startMonth,
      startYear,
      endMonth,
      endYear,
      data: reportData,
      totalBookings: bookings.length,
    });
  } catch (error) {
    console.error("=== ERROR IN REQUEST ===");
    console.error(error);
    res.status(500).json({
      error: "Failed to generate report",
      details: error.message,
    });
  }
});

// AlexisVS: third-party/smobou/actions/api/booking-report.js
app.get("/api/bookings-report", async (req, res) => {
  try {
    const { startMonth, startYear, endMonth, endYear } = req.query;

    // Validate and fix date range
    let finalStartMonth = String(startMonth).padStart(2, "0");
    let finalStartYear = startYear;
    let finalEndMonth = String(endMonth).padStart(2, "0");
    let finalEndYear = endYear;

    const startDate = `${finalStartYear}-${finalStartMonth}-01`;
    const lastDay = new Date(
      finalEndYear,
      parseInt(finalEndMonth),
      0
    ).getDate();
    const endDate = `${finalEndYear}-${finalEndMonth}-${lastDay}`;

    console.log("=== START OF BOOKINGS REPORT REQUEST ===");
    console.log("Request params:", {
      startMonth: finalStartMonth,
      startYear: finalStartYear,
      endMonth: finalEndMonth,
      endYear: finalEndYear,
    });

    // Fetch bookings for the period
    const bookingsResponse = await axios.get(
      "https://login.smoobu.com/api/reservations",
      {
        headers: {
          "Api-Key": "UZFV5QRY0ExHUfJi3c1DIG8Bpwet1X4knWa8rMkj6o",
          "Cache-Control": "no-cache",
        },
        params: {
          arrivalFrom: startDate,
          arrivalTo: endDate,
          excludeBlocked: true,
          showCancellation: true,
        },
      }
    );

    const bookings = bookingsResponse.data.bookings || [];
    console.log(
      `Found ${bookings.length} bookings for period ${finalStartMonth}/${finalStartYear} - ${finalEndMonth}/${finalEndYear}`
    );

    // Process each booking to get price elements and extras
    const processedBookings = [];
    for (const booking of bookings) {
      try {
        console.log(`Processing booking ${booking.id}`);

        // Skip if it's a blocked booking or cancelled booking
        if (
          booking.channelId === "Blocked" ||
          booking.type === "cancellation"
        ) {
          console.log(
            `Skipping ${
              booking.channelId === "Blocked" ? "blocked" : "cancelled"
            } booking ${booking.id}`
          );
          continue;
        }

        // Fetch price elements for each booking
        const priceElementsResponse = await axios.get(
          `https://login.smoobu.com/api/reservations/${booking.id}/price-elements`,
          {
            headers: {
              "Api-Key": "UZFV5QRY0ExHUfJi3c1DIG8Bpwet1X4knWa8rMkj6o",
              "Cache-Control": "no-cache",
            },
          }
        );

        const priceElements = priceElementsResponse.data.priceElements || [];
        console.log(
          "Price elements for booking",
          booking.id,
          ":",
          priceElements
        );

        // Calculate nights
        const checkIn = new Date(booking.arrival);
        const checkOut = new Date(booking.departure);
        const nights = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));

        // Find long stay discount first
        const longStayDiscount =
          priceElements.find(
            (el) =>
              el.name?.toLowerCase().includes("long stay") ||
              el.name?.toLowerCase().includes("long-stay")
          )?.amount || 0;

        // Process extras - all non-base price elements, excluding cancellations and long stay discount
        const extras = priceElements.filter((element) => {
          const name = element.name?.toLowerCase() || "";
          const type = element.type?.toLowerCase() || "";

          // Skip cancellation-related items and long stay discount
          if (
            name.includes("cancellation") ||
            name.includes("pass_through") ||
            name.includes("prix de base") ||
            name.includes("base price") ||
            name.includes("long stay") ||
            name.includes("long-stay") ||
            name === "base" ||
            type === "base"
          ) {
            return false;
          }

          // Include addons, linen fees, and exclude base price and discounts
          return (
            element.type === "addon" ||
            name.includes("linen fee") ||
            name.includes("frais de linge") ||
            (element.type !== "base" && element.type !== "discount")
          );
        });

        // Find commission from extras
        const commissionExtra = extras.find((extra) =>
          extra.name?.toLowerCase().includes("commission")
        );
        const commission = commissionExtra ? commissionExtra.amount : 0;

        // Remove commission from extras list if it exists
        const nonCommissionExtras = extras.filter(
          (extra) => !extra.name?.toLowerCase().includes("commission")
        );

        const linenFee =
          priceElements.find(
            (el) =>
              el.name?.toLowerCase().includes("linen_fee") ||
              el.name?.toLowerCase().includes("pass_through_linen_fee")
          )?.amount || 0;

        // Calculate base price
        const basePrice =
          priceElements.find(
            (el) =>
              el.name?.toLowerCase().includes("base") ||
              el.type?.toLowerCase() === "base"
          )?.amount || 0;

        // Calculate other discounts (excluding long stay)
        const otherDiscounts = priceElements
          .filter(
            (el) =>
              el.type === "discount" &&
              !el.name?.toLowerCase().includes("long stay") &&
              !el.name?.toLowerCase().includes("long-stay")
          )
          .reduce((sum, discount) => sum + Math.abs(discount.amount), 0);

        const extrasTotal = extras.reduce(
          (sum, extra) => sum + extra.amount,
          0
        );

        // Add portal name mapping

        const processedBooking = {
          id: booking.id,
          guest:
            booking["guest-name"] ||
            `${booking.firstName || ""} ${booking.lastName || ""}`.trim() ||
            (booking.notice?.match(/Message du client:?\s*([^\n]+)/) ||
              [])[1] ||
            booking.email?.split("@")[0] ||
            "Sans nom",
          property:
            roomNames[booking.apartmentId] || booking.apartment?.name || "",
          portal:
            portalNames[booking.channel?.name] ||
            booking.channel?.name ||
            "Website",
          created:
            booking["created-at"] ||
            booking.created ||
            new Date().toISOString(),
          email: booking.email || "",
          phone: booking.phone || "",
          address: booking.address || "",
          adults: parseInt(booking.adults) || 0,
          children: parseInt(booking.children) || 0,
          checkIn: booking.arrival,
          checkOut: booking.departure,
          arrivalTime: booking["check-in"] || "",
          departureTime: booking["check-out"] || "",
          notes: booking.notice || "",
          price: parseFloat(booking.price) || 0,
          priceDetails: {
            basePrice: parseFloat(basePrice),
            linenFee: parseFloat(linenFee),
            extrasTotal: parseFloat(extrasTotal),
            longStayDiscount: parseFloat(longStayDiscount),
            discounts: parseFloat(otherDiscounts),
            promoCode: priceElements.find(
              (el) =>
                el.name?.toLowerCase().includes("code promo") ||
                el.name?.toLowerCase().includes("coupon") ||
                (el.type === "discount" &&
                  !el.name?.toLowerCase().includes("long stay") &&
                  !el.name?.toLowerCase().includes("long-stay"))
            ),
            total:
              parseFloat(basePrice) +
              parseFloat(linenFee) +
              parseFloat(extrasTotal) +
              parseFloat(longStayDiscount) -
              parseFloat(otherDiscounts),
          },
          commission: parseFloat(commission),
          nights,
          extras:
            nonCommissionExtras
              .filter(
                (extra) =>
                  !extra.name?.toLowerCase().includes("code promo") &&
                  !extra.name?.toLowerCase().includes("coupon") &&
                  extra.type !== "discount"
              )
              .map((extra) => ({
                name: extra.name || "Extra sans nom",
                amount: parseFloat(extra.amount) || 0,
                quantity: parseInt(extra.quantity) || 1,
              })) || [],
        };

        processedBookings.push(processedBooking);
      } catch (error) {
        console.error(`Error processing booking ${booking.id}:`, error.message);
        console.error("Full error:", error);
      }
    }

    console.log("=== PROCESSING SUMMARY ===");
    console.log({
      period: `${finalStartMonth}/${finalStartYear} - ${finalEndMonth}/${finalEndYear}`,
      totalBookings: bookings.length,
      processedBookings: processedBookings.length,
      sampleBooking: processedBookings[0],
    });

    res.json({
      startMonth: finalStartMonth,
      startYear: finalStartYear,
      endMonth: finalEndMonth,
      endYear: finalEndYear,
      data: processedBookings,
    });
  } catch (error) {
    console.error("=== ERROR IN REQUEST ===");
    console.error("Full error:", error);
    console.error("Error response:", error.response?.data);
    res.status(500).json({
      error: "Failed to generate bookings report",
      details: error.message,
    });
  }
});

// AlexisVS: third-party/smobou/actions/api/apartments.js
app.get("/api/apartments", async (req, res) => {
  try {
    const response = await axios.get(
      "https://login.smoobu.com/api/apartments",
      {
        headers: {
          "Api-Key": "UZFV5QRY0ExHUfJi3c1DIG8Bpwet1X4knWa8rMkj6o",
          "Cache-Control": "no-cache",
          "Content-Type": "application/json",
        },
      }
    );
    res.json(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).json({
      status: error.response?.status,
      title: error.response?.data?.title || "Error",
      detail: error.response?.data?.detail || "Failed to fetch apartments",
    });
  }
});

// AlexisVS: third-party/smobou/actions/api/get-appartment.js
app.get("/api/apartments/:id", async (req, res) => {
  try {
    const response = await axios.get(
      `https://login.smoobu.com/api/apartments/${req.params.id}`,
      {
        headers: {
          "Api-Key": "UZFV5QRY0ExHUfJi3c1DIG8Bpwet1X4knWa8rMkj6o",
          "Content-Type": "application/json",
        },
      }
    );

    // Smoobu API returns images in the response
    const images = response.data.images || [];
    res.json({ images });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch apartment images" });
  }
});

// AlexisVS: third-party/smobou/actions/api/rates.js
// Replace your current /api/rates endpoint with this one
app.get("/api/rates", async (req, res) => {
  try {
    const { apartments, start_date, end_date, adults, children } = req.query;

    // console.log('Processing rates request:', {
    //   apartments,
    //   start_date,
    //   end_date,
    //   adults,
    //   children,
    // });

    // Validate required parameters
    if (!start_date || !end_date) {
      return res.status(400).json({
        error: "Missing dates",
        details: "Both start_date and end_date are required",
      });
    }

    if (!apartments) {
      return res.status(400).json({
        error: "Missing apartments",
        details: "Apartments parameter is required",
      });
    }

    // Make the API call to Smoobu
    const response = await axios.get("https://login.smoobu.com/api/rates", {
      headers: {
        "Api-Key": "UZFV5QRY0ExHUfJi3c1DIG8Bpwet1X4knWa8rMkj6o",
        "Content-Type": "application/json",
      },
      params: {
        apartments: Array.isArray(apartments) ? apartments : [apartments],
        start_date,
        end_date,
      },
    });

    if (!response.data || !response.data.data) {
      return res.status(404).json({
        error: "No rates found",
        details: "The API returned no data",
      });
    }

    const formattedData = {};
    const priceDetailsByApartment = {};
    let hasAvailability = false;

    // Process each apartment
    (Array.isArray(apartments) ? apartments : [apartments]).forEach(
      (apartmentId) => {
        const apartmentData = response.data.data[apartmentId];
        if (!apartmentData) return;

        formattedData[apartmentId] = apartmentData;
        const settings = discountSettings[apartmentId];

        if (!settings) {
          // console.log(`No settings found for apartment ${apartmentId}`);
          return;
        }

        try {
          // Calculate price details using your existing function
          const priceCalculation = calculatePriceWithSettings(
            apartmentData,
            start_date,
            end_date,
            parseInt(adults) || 1,
            parseInt(children) || 0,
            settings
          );

          if (priceCalculation && priceCalculation.finalPrice > 0) {
            priceDetailsByApartment[apartmentId] = {
              ...priceCalculation,
              isAvailable: true,
              settings: {
                maxGuests: settings.maxGuests,
                startingAtGuest: settings.startingAtGuest,
                extraGuestsPerNight: settings.extraGuestsPerNight,
                extraChildPerNight: settings.extraChildPerNight,
                lengthOfStayDiscount: settings.lengthOfStayDiscount,
              },
            };
            hasAvailability = true;
          }
        } catch (calcError) {
          // console.error(
          //   `Error calculating price for apartment ${apartmentId}:`,
          //   calcError
          // );
        }
      }
    );

    // Check if we found any available apartments
    if (!hasAvailability) {
      return res.status(200).json({
        data: formattedData,
        priceDetails: {},
        hasAvailability: false,
        message: "No apartments available for the selected dates and guests",
      });
    }

    // console.log('Sending response with price details:', {
    //   apartmentCount: Object.keys(priceDetailsByApartment).length,
    //   availableApartments: Object.keys(priceDetailsByApartment),
    // });

    res.json({
      data: formattedData,
      priceDetails: priceDetailsByApartment,
      hasAvailability: true,
    });
  } catch (error) {
    // console.error('Error in /api/rates:', error);
    res.status(500).json({
      error: "Failed to fetch rates",
      details: error.response?.data || error.message,
      status: error.response?.status || 500,
    });
  }
});

// AlexisVS: third-party/smobou/actions/api/create-payment-intent.js
//CREATE PAYMENT INTENT
app.post("/api/create-payment-intent", async (req, res) => {
  try {
    const { price, bookingData } = req.body;

    // Start with base price
    let totalPrice = Number(bookingData.basePrice);

    console.log("Starting price calculation:", {
      basePrice: bookingData.basePrice,
      guestFees: bookingData.guestFees,
      extras: bookingData.extras,
    });

    // Add guest fees
    totalPrice += Number(bookingData.guestFees || 0);

    // Add extras
    if (bookingData.extras && bookingData.extras.length > 0) {
      const extrasTotal = bookingData.extras.reduce((sum, extra) => {
        const extraAmount = Number(extra.amount) || 0;
        const extraPersonFee =
          (Number(extra.extraPersonPrice) || 0) *
          (Number(extra.extraPersonQuantity) || 0);
        return sum + extraAmount + extraPersonFee;
      }, 0);

      totalPrice += extrasTotal;
    }

    // Apply coupon discount if exists
    if (bookingData.couponApplied) {
      totalPrice -= Number(bookingData.couponApplied.discount || 0);
    }

    // Apply long stay discount if exists
    if (bookingData.priceDetails?.discount) {
      totalPrice -= Number(bookingData.priceDetails.discount);
    }

    console.log("Final price calculation:", {
      totalPrice,
      breakdown: {
        basePrice: Number(bookingData.basePrice),
        guestFees: Number(bookingData.guestFees || 0),
        extrasTotal:
          bookingData.extras?.reduce((sum, extra) => {
            return (
              sum +
              Number(extra.amount) +
              Number(extra.extraPersonPrice) * Number(extra.extraPersonQuantity)
            );
          }, 0) || 0,
        couponDiscount: bookingData.couponApplied
          ? Number(bookingData.couponApplied.discount)
          : 0,
        longStayDiscount: Number(bookingData.priceDetails?.discount || 0),
      },
    });

    const bookingReference = `BOOKING-${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    pendingBookings.set(bookingReference, {
      ...bookingData,
      totalPriceWithExtras: totalPrice,
    });

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(totalPrice * 100),
      currency: "eur",
      automatic_payment_methods: {
        enabled: true,
      },
      description: `Réservation - ${bookingData.firstName} ${
        bookingData.lastName
      }
        Chambre: ${roomNames[bookingData.apartmentId]} 
        (${bookingData.arrivalDate} - ${bookingData.departureDate})
        Base: ${bookingData.basePrice}€
        ${
          bookingData.guestFees > 0
            ? ` • Frais invités: ${bookingData.guestFees}€`
            : ""
        }
        ${
          bookingData.extras?.length
            ? ` • Extras: ${bookingData.extras.reduce(
                (sum, extra) =>
                  sum +
                  Number(extra.amount) +
                  Number(extra.extraPersonPrice) *
                    Number(extra.extraPersonQuantity),
                0
              )}€`
            : ""
        }
        ${
          bookingData.couponApplied
            ? ` • Code ${bookingData.couponApplied.code}: -${bookingData.couponApplied.discount}€`
            : ""
        }`,
      metadata: {
        clientName: `${bookingData.firstName} ${bookingData.lastName}`,
        clientEmail: bookingData.email,
        clientPhone: bookingData.phone || "",
        roomId: bookingData.apartmentId,
        roomName: roomNames[bookingData.apartmentId],
        bookingReference: bookingReference,
        checkIn: bookingData.arrivalDate,
        checkOut: bookingData.departureDate,
        basePrice: `${bookingData.basePrice}€`,
        guestFees: `${bookingData.guestFees}€`,
        extrasTotal: bookingData.extras?.length
          ? `${bookingData.extras.reduce(
              (sum, extra) =>
                sum +
                Number(extra.amount) +
                Number(extra.extraPersonPrice) *
                  Number(extra.extraPersonQuantity),
              0
            )}€`
          : "0€",
        ...(bookingData.couponApplied && {
          couponCode: bookingData.couponApplied.code,
          couponDiscount: `-${bookingData.couponApplied.discount}€`,
          couponType: bookingData.couponApplied.type,
        }),
        finalPrice: `${totalPrice}€`,
      },
    });

    res.json({
      clientSecret: paymentIntent.client_secret,
      bookingReference: bookingReference,
    });
  } catch (error) {
    console.error("Error creating payment intent:", error);
    res.status(500).json({
      error: "Failed to create payment intent",
      details: error.message,
    });
  }
});

// AlexisVS: third-party/smobou/actions/api/bookings/get-payment-intent.js
app.get("/api/bookings/:paymentIntentId", async (req, res) => {
  try {
    const { paymentIntentId } = req.params;

    // 1. Retrieve Payment Intent from Stripe (optional, but good for verification)
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    // 2. Retrieve Booking from Firebase
    const bookingsRef = db.collection("bookings");
    const bookingQuery = await bookingsRef
      .where("paymentIntentId", "==", paymentIntentId)
      .get();

    if (bookingQuery.empty) {
      return res.status(404).json({
        error: "Booking details not found",
        message: `No booking found for payment_intent: '${paymentIntentId}'`,
      });
    }

    const bookingDoc = bookingQuery.docs[0].data();

    // 3. Calculate Price Breakdown (Corrected)
    const basePrice = parseFloat(bookingDoc.basePrice);
    const guestFees = parseFloat(bookingDoc.guestFees || 0);

    const extrasTotal =
      bookingDoc.extras?.reduce((sum, extra) => {
        const baseAmount = parseFloat(extra.amount || 0);
        const extraPersonAmount =
          extra.extraPersonQuantity > 0
            ? parseFloat(extra.extraPersonPrice) *
              parseInt(extra.extraPersonQuantity)
            : 0;
        return sum + baseAmount + extraPersonAmount;
      }, 0) || 0;

    const longStayDiscount = parseFloat(bookingDoc.priceDetails?.discount || 0);
    const couponDiscount = parseFloat(bookingDoc.appliedCoupon?.discount || 0);

    const subtotalBeforeDiscounts = basePrice + guestFees + extrasTotal;
    const totalDiscounts = longStayDiscount + couponDiscount;
    const finalTotal = subtotalBeforeDiscounts - totalDiscounts;

    // 4. Format Response Data (Corrected extrasBreakdown)
    const responseData = {
      ...bookingDoc,
      paymentIntent: {
        id: paymentIntentId,
        ...(paymentIntent && {
          // Conditionally include paymentIntent data
          amount: paymentIntent.amount,
          currency: paymentIntent.currency,
          status: paymentIntent.status,
        }),
      },
      priceBreakdown: {
        basePrice,
        guestFees,
        extrasTotal,
        extrasBreakdown: bookingDoc.extras?.map((extra) => ({
          name: extra.name,
          baseAmount: parseFloat(extra.amount || 0),
          quantity: parseInt(extra.quantity || 1),
          extraPersonQuantity: parseInt(extra.extraPersonQuantity || 0),
          extraPersonAmount:
            extra.extraPersonQuantity > 0
              ? parseFloat(extra.extraPersonPrice) *
                parseInt(extra.extraPersonQuantity)
              : 0,
          totalAmount:
            parseFloat(extra.amount || 0) +
            (extra.extraPersonQuantity > 0
              ? parseFloat(extra.extraPersonPrice) *
                parseInt(extra.extraPersonQuantity)
              : 0),
        })),
        longStayDiscount,
        couponDiscount,
        subtotalBeforeDiscounts,
        totalDiscounts,
        finalTotal,
      },
    };

    res.json(responseData);
  } catch (error) {
    console.error("Error fetching booking:", error);
    res.status(500).json({
      error: "Failed to fetch booking details",
      message: error.message,
    });
  }
});

// AlexisVS: third-party/smobou/actions/api/pending-bookings.js
// Debug endpoint to check pending bookings
app.get("/api/pending-bookings", (req, res) => {
  const bookings = Array.from(pendingBookings.entries());
  res.json(bookings);
});

// AlexisVS: remove
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  // console.log(`Server running on port ${PORT}`);
  // console.log('Webhook endpoint ready at /webhook');
});

// AlexisVS: third-party/smobou/actions/api/get-booking-history-email.js
app.get("/api/bookings-history/:email", async (req, res) => {
  try {
    const { email } = req.params;
    const snapshot = await db
      .collection("bookings")
      .where("email", "==", email)
      .orderBy("createdAt", "desc")
      .get();

    const bookings = [];
    snapshot.forEach((doc) => {
      bookings.push({ id: doc.id, ...doc.data() });
    });

    res.json(bookings);
  } catch (error) {
    console.error("Error fetching bookings:", error);
    res.status(500).json({
      error: "Failed to fetch bookings",
      message: error.message,
    });
  }
});

// AlexisVS: third-party/smobou/actions/api/test-email.js
app.post("/api/test-email", async (req, res) => {
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: process.env.EMAIL_USER, // Send to yourself first
      subject: "Test Email",
      html: "<h1>Test booking confirmation</h1><p>This is a test email.</p>",
    });
    res.json({ success: true });
    console.error("Email test worked:");
  } catch (error) {
    console.error("Email test failed:", error);
    res.status(500).json({ error: error.message });
  }
});
