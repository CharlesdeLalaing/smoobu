// server.js
import express from "express";
import cors from "cors";
import * as dotenv from "dotenv";

// Import db from your Firebase config file
import { db } from "./firebase-config.js"; // Ensure this path is correct

// Original imports from your server.js
import {
  handleWebhook,
  pendingBookings,
} from "./third-party/stripe/webhook/index.js";
import { deduplicateBookings } from "./third-party/firebase/deduplicate-bookings.js";
import { setupScheduledTasks } from "./third-party/smoobu/schedule.js";
import { handleCreateGiftVoucher } from "./third-party/wordpress/create-gift-voucher.js";
import { validateVoucher } from "./third-party/smoobu/actions/api/voucherValidation.js";
import { fetchDirectBookings } from "./third-party/smoobu/actions/api/fetch-direct-bookings.js";
import { generateExtrasReport } from "./third-party/smoobu/actions/api/extras-report.js";
import { generateBookingsReport } from "./third-party/smoobu/actions/api/booking-report.js";
import { fetchApartments } from "./third-party/smoobu/actions/api/apartments.js";
import { fetchApartmentsId } from "./third-party/smoobu/actions/api/apartment-id.js";
import { fetchRates } from "./third-party/smoobu/actions/api/rates.js";
import { createPaymentIntent } from "./third-party/stripe/create-payment-intent.js";
import { getBookingByPaymentIntentId } from "./third-party/stripe/get-payment-intent.js";
import { getBookingHistoryByEmail } from "./third-party/smoobu/actions/api/get-booking-history-email.js";
import { handleGetSpaAvailability } from "./third-party/smoobu/actions/api/spa-availability.js";
import { handleCancelSpaBooking } from "./third-party/smoobu/actions/api/cancel-booking.js";

// Updated import for the refactored Smoobu cancellation function
import { cancelSmoobuReservationById } from "./third-party/smoobu/actions/api/cancel-reservation.js";

dotenv.config();
const app = express();

// Stripe webhook endpoint needs raw body
app.post("/webhook", express.raw({ type: "application/json" }), handleWebhook);

// Middleware for all other routes
app.use(express.json());
app.use(
  cors({
    origin: [
      "https://reservation.fermedebasseilles.be",
      "https://smoobu-test.vercel.app",
      "https://spa-test-beige.vercel.app",
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

// Your existing routes
app.get("/api/deduplicate-bookings", deduplicateBookings);
// New reliable sync endpoint that processes all bookings individually
// Main fetch-and-sync endpoint (using proven simplified logic)
app.get("/api/fetch-and-sync", async (req, res) => {
  console.log("🚀 Starting fetch-and-sync with proven logic...");
  
  try {
    const { SmoobuClient } = await import('./third-party/smoobu/actions/api/fetch-and-sync/smoobu-client.js');
    const { BookingRepository } = await import('./third-party/smoobu/actions/api/fetch-and-sync/booking-repository.js');
    const { BookingProcessor } = await import('./third-party/smoobu/actions/api/fetch-and-sync/booking-processor.js');
    
    // Initialize clients
    const smoobuClient = new SmoobuClient();
    const repository = new BookingRepository();
    const processor = new BookingProcessor(smoobuClient, repository);
    
    // Date range - August to end of year 2025 (working logic with extended range)
    const startDate = '2025-08-01';
    const endDate = '2025-12-31';
    
    console.log(`📅 Date range: ${startDate} to ${endDate}`);
    
    // Fetch existing bookings from Firebase
    console.log("🔍 Fetching existing bookings from Firebase...");
    const existingBookingMap = await repository.fetchExistingBookings();
    console.log(`📋 Found ${existingBookingMap.size} existing bookings in Firebase`);
    
    // Fetch bookings using departure dates (more reliable)
    console.log("🌐 Fetching bookings from Smoobu using departure dates...");
    const bulkBookings = await smoobuClient.fetchBookingsByDepartureDate(startDate, endDate);
    console.log(`📦 Fetched ${bulkBookings.length} bookings from Smoobu`);
    
    let stats = {
      totalBookings: bulkBookings.length,
      processed: 0,
      updated: 0,
      added: 0,
      errors: 0
    };
    
    // Process each booking
    for (const bulkBooking of bulkBookings) {
      try {
        console.log(`🔄 Processing booking ${bulkBooking.id} (${bulkBooking['guest-name']})...`);
        
        // Always fetch detailed priceElements for accurate data
        const detailedBooking = await smoobuClient.fetchIndividualBooking(bulkBooking.id);
        const bookingToProcess = detailedBooking || bulkBooking;
        
        console.log(`  📊 PriceElements: ${bookingToProcess.priceElements?.length || 0}`);
        
        // Process the booking
        const tempStats = { added: 0, updated: 0, skipped: 0, errors: 0 };
        await processor.processBooking(bookingToProcess, existingBookingMap, tempStats);
        
        stats.processed++;
        stats.added += tempStats.added;
        stats.updated += tempStats.updated;
        
        console.log(`  ✅ Processed: ${tempStats.added ? 'ADDED' : tempStats.updated ? 'UPDATED' : 'UNCHANGED'}`);
        
      } catch (bookingError) {
        console.error(`❌ Error processing booking ${bulkBooking.id}:`, bookingError.message);
        stats.errors++;
      }
    }
    
    console.log("🎉 Fetch-and-sync completed!");
    console.log("📊 Final stats:", stats);
    
    res.json({
      success: true,
      message: "Fetch-and-sync completed successfully",
      stats: stats,
      dateRange: { startDate, endDate }
    });
    
  } catch (error) {
    console.error("🟥 Fetch-and-sync failed:", error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: "Failed to perform fetch-and-sync"
    });
  }
});




// Backup database endpoint
app.get("/api/backup-database", async (req, res) => {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupData = {};

    console.log("🔄 Starting database backup...");

    // Backup bookings collection
    const bookingsSnapshot = await db.collection("bookings").get();
    backupData.bookings = {};

    bookingsSnapshot.forEach((doc) => {
      backupData.bookings[doc.id] = doc.data();
    });

    // Save backup to file
    const backupFilename = `backup-manual-${timestamp}.json`;
    const fs = await import("fs");
    fs.writeFileSync(backupFilename, JSON.stringify(backupData, null, 2));

    console.log(`✅ Backed up ${bookingsSnapshot.size} bookings`);
    console.log(`📁 Backup saved to: ${backupFilename}`);

    res.json({
      success: true,
      message: "Database backup completed",
      timestamp: timestamp,
      filename: backupFilename,
      location: `${process.cwd()}/${backupFilename}`,
      collections: {
        bookings: bookingsSnapshot.size,
      },
      backup: backupData,
    });
  } catch (error) {
    console.error("🟥 Backup failed:", error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: "Failed to backup database",
    });
  }
});

// Test endpoint for specific booking sync
app.get("/api/test-booking-sync/:bookingId", async (req, res) => {
  try {
    const { SmoobuClient } = await import(
      "./third-party/smoobu/actions/api/fetch-and-sync/smoobu-client.js"
    );
    const { processExtrasWithPersons } = await import(
      "./third-party/smoobu/process-extras-with-persons.js"
    );

    const smoobuClient = new SmoobuClient();

    // Get booking ID from URL parameter
    const testBookingId = req.params.bookingId;

    console.log(`🔍 Testing sync for booking: ${testBookingId}`);

    // Fetch booking from Firebase
    const bookingDoc = await db
      .collection("bookings")
      .where("smoobuId", "==", testBookingId)
      .get();

    if (bookingDoc.empty) {
      return res.status(404).json({
        success: false,
        error: "Booking not found in Firebase",
        bookingId: testBookingId,
      });
    }

    const booking = { id: bookingDoc.docs[0].id, ...bookingDoc.docs[0].data() };
    console.log(`✅ Found booking in Firebase:`, {
      id: booking.smoobuId,
      guest: booking.guestName,
      arrival: booking.arrivalDate,
      extras: booking.extras?.length || 0,
      priceElements: booking.priceDetails?.priceElements?.length || 0,
    });

    // Test our sync logic by fetching price elements and processing them
    console.log(`🔍 Fetching price elements for booking ${testBookingId}`);
    const priceElements = await smoobuClient.fetchPriceElements(testBookingId);
    console.log(
      `📋 Retrieved ${priceElements.length} price elements from Smoobu`
    );

    // Log the price elements to see what we're working with
    console.log(
      `📋 Price elements:`,
      priceElements.map((pe) => ({
        id: pe.id,
        name: pe.name,
        amount: pe.amount,
        quantity: pe.quantity,
        type: pe.type,
      }))
    );

    // Test our enhanced processing logic
    console.log(`🔄 Processing extras with persons logic...`);
    const processedExtras = processExtrasWithPersons(priceElements);
    console.log(`✅ Processed ${processedExtras.extras.length} extras`);

    // Log the results
    console.log(
      `📋 Processed extras:`,
      processedExtras.extras.map((e) => ({
        name: e.name,
        amount: e.amount,
        quantity: e.quantity,
        hasExtraPerson: e.hasExtraPerson,
        extraPersonQuantity: e.extraPersonQuantity,
        extraPersonAmount: e.extraPersonAmount,
      }))
    );

    // Update the booking document with the processed data
    const updatedPriceElements = [...priceElements];

    // Add any missing extra person entries to priceElements
    processedExtras.extras.forEach((extra) => {
      if (extra.hasExtraPerson && extra.extraPersonAmount > 0) {
        const expectedPersonneName = `${extra.name} - Personne supplémentaire`;

        // Check if this extra person entry already exists in price elements
        const existingEntry = updatedPriceElements.find(
          (el) => el.name === expectedPersonneName
        );

        if (!existingEntry) {
          // Create the missing extra person entry
          const syntheticPersonElement = {
            name: expectedPersonneName,
            amount: extra.extraPersonAmount,
            quantity: extra.extraPersonQuantity,
            type: "addon",
            id: extra.id + 1000000, // Generate a unique ID
            currencyCode: extra.currencyCode || "EUR",
            priceIncludedInId: null,
            sortOrder: 100,
            tax: 0,
          };

          updatedPriceElements.push(syntheticPersonElement);
          console.log(
            `✅ Added missing extra person entry: "${expectedPersonneName}" (${extra.extraPersonQuantity}x ${extra.extraPersonPrice}€)`
          );
        }
      }
    });

    // Calculate the new extras total
    const newExtrasTotal = updatedPriceElements
      .filter((el) => el.type === "addon" && el.amount > 0)
      .reduce((sum, el) => sum + Math.abs(parseFloat(el.amount) || 0), 0);

    // Update the booking in Firebase
    const updatedBookingData = {
      ...booking,
      extras: processedExtras.extras,
      priceDetails: {
        ...booking.priceDetails,
        priceElements: updatedPriceElements,
        extrasTotal: newExtrasTotal,
      },
      lastSyncedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await db
      .collection("bookings")
      .doc(bookingDoc.docs[0].id)
      .update(updatedBookingData);

    res.json({
      success: true,
      message: "Booking sync tested and updated successfully",
      bookingId: testBookingId,
      results: {
        originalExtras: booking.extras?.length || 0,
        processedExtras: processedExtras.extras.length,
        originalPriceElements: booking.priceDetails?.priceElements?.length || 0,
        updatedPriceElements: updatedPriceElements.length,
        originalExtrasTotal: booking.priceDetails?.extrasTotal || 0,
        newExtrasTotal: newExtrasTotal,
        addedPersonEntries: updatedPriceElements.length - priceElements.length,
      },
      processedExtras: processedExtras.extras.map((e) => ({
        name: e.name,
        amount: e.amount,
        quantity: e.quantity,
        hasExtraPerson: e.hasExtraPerson,
        extraPersonQuantity: e.extraPersonQuantity,
        extraPersonAmount: e.extraPersonAmount,
      })),
    });
  } catch (error) {
    console.error("🟥 Error testing Mandy's booking sync:", error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: "Failed to test Mandy's booking sync",
    });
  }
});

// Bulk re-process bookings with missing extras
app.get("/api/fix-missing-extras", async (req, res) => {
  try {
    const { SmoobuClient } = await import(
      "./third-party/smoobu/actions/api/fetch-and-sync/smoobu-client.js"
    );
    const { processExtrasWithPersons } = await import(
      "./third-party/smoobu/process-extras-with-persons.js"
    );

    const smoobuClient = new SmoobuClient();
    let processedCount = 0;
    let updatedCount = 0;
    let errorCount = 0;

    console.log("🔄 Starting bulk fix for missing extras...");

    // Get all bookings that might have missing extras (Airbnb bookings with no extras)
    const bookingsQuery = await db
      .collection("bookings")
      .where("portalName", "==", "Airbnb")
      .get();

    const bookingsWithNoExtras = [];
    bookingsQuery.forEach((doc) => {
      const booking = doc.data();
      if (!booking.extras || booking.extras.length === 0) {
        bookingsWithNoExtras.push({ id: doc.id, ...booking });
      }
    });

    console.log(`Found ${bookingsWithNoExtras.length} Airbnb bookings with no extras to process`);

    for (const booking of bookingsWithNoExtras) {
      try {
        console.log(`🔍 Processing booking ${booking.smoobuId} - ${booking.guestName}`);
        
        // Fetch price elements from Smoobu
        const priceElements = await smoobuClient.fetchPriceElements(booking.smoobuId);
        
        if (priceElements.length === 0) {
          console.log(`⚠️ No price elements found for booking ${booking.smoobuId}`);
          processedCount++;
          continue;
        }

        // Process extras
        const processedExtras = processExtrasWithPersons(priceElements);
        
        if (processedExtras.extras.length === 0) {
          console.log(`ℹ️ No extras found in price elements for booking ${booking.smoobuId}`);
          processedCount++;
          continue;
        }

        // Apply Airbnb filtering
        const filteredExtras = processedExtras.extras.filter(
          (extra) => 
            extra.name && (
              extra.name.includes("anniversaire") ||
              extra.name.includes("barbecue") ||
              extra.name.includes("détente") ||
              extra.name.includes("formule") ||
              extra.name.includes("spa") ||
              extra.name.includes("massage") ||
              extra.type === "addon"
            )
        );

        if (filteredExtras.length === 0) {
          console.log(`ℹ️ No extras passed Airbnb filter for booking ${booking.smoobuId}`);
          processedCount++;
          continue;
        }

        console.log(`✅ Found ${filteredExtras.length} extras for booking ${booking.smoobuId}:`, 
          filteredExtras.map(e => `${e.name} (${e.amount}€)`).join(", "));

        // Calculate extras total
        const extrasTotal = filteredExtras.reduce((sum, extra) => {
          return sum + parseFloat(extra.amount || 0);
        }, 0);

        // Update the booking
        const updatedData = {
          extras: filteredExtras,
          priceDetails: {
            ...booking.priceDetails,
            priceElements: priceElements,
            extrasTotal: extrasTotal,
          },
          lastSyncedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        await db.collection("bookings").doc(booking.id).update(updatedData);
        
        updatedCount++;
        processedCount++;
        
        console.log(`✅ Updated booking ${booking.smoobuId} with ${filteredExtras.length} extras (${extrasTotal}€)`);

      } catch (error) {
        console.error(`🟥 Error processing booking ${booking.smoobuId}:`, error.message);
        errorCount++;
        processedCount++;
      }
    }

    console.log(`🎉 Bulk fix completed: ${processedCount} processed, ${updatedCount} updated, ${errorCount} errors`);

    res.json({
      success: true,
      message: "Bulk fix for missing extras completed",
      stats: {
        totalFound: bookingsWithNoExtras.length,
        processed: processedCount,
        updated: updatedCount,
        errors: errorCount,
      }
    });

  } catch (error) {
    console.error("🟥 Bulk fix failed:", error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: "Failed to fix missing extras",
    });
  }
});

// Debug fetch-and-sync for specific booking
app.get("/api/debug-fetch-sync/:bookingId", async (req, res) => {
  try {
    const targetBookingId = req.params.bookingId;
    console.log(`🔍 DEBUG: Looking for booking ${targetBookingId} in fetch-and-sync process`);
    
    const { SmoobuClient } = await import(
      "./third-party/smoobu/actions/api/fetch-and-sync/smoobu-client.js"
    );
    
    const smoobuClient = new SmoobuClient();
    
    // Check recently modified bookings (same logic as fetch-and-sync Phase 2)
    const lookbackHours = 25;
    const modifiedSince = new Date();
    modifiedSince.setHours(modifiedSince.getHours() - lookbackHours);
    const modifiedSinceDate = modifiedSince.toISOString().split("T")[0];
    
    const modifiedUntil = new Date();
    modifiedUntil.setDate(modifiedUntil.getDate() + 1);
    const modifiedUntilDate = modifiedUntil.toISOString().split("T")[0];
    
    console.log(`🔍 Checking recently modified bookings from ${modifiedSinceDate} to ${modifiedUntilDate}`);
    
    const recentlyModifiedBookings = await smoobuClient.fetchRecentlyModifiedBookings(
      modifiedSinceDate,
      modifiedUntilDate
    );
    
    console.log(`📋 Found ${recentlyModifiedBookings.length} recently modified bookings`);
    
    // Look for our target booking
    const targetBooking = recentlyModifiedBookings.find(booking => booking.id.toString() === targetBookingId);
    
    if (targetBooking) {
      console.log(`✅ Found target booking ${targetBookingId} in recently modified list!`);
      console.log(`📋 Booking details:`, {
        id: targetBooking.id,
        type: targetBooking.type,
        channel: targetBooking.channel?.name,
        guest: targetBooking["guest-name"],
        arrival: targetBooking.arrival
      });
      
      // Test price elements fetch
      const priceElements = await smoobuClient.fetchPriceElements(targetBookingId);
      console.log(`📋 Price elements (${priceElements.length}):`, 
        priceElements.map(pe => ({ name: pe.name, amount: pe.amount, type: pe.type }))
      );
      
    } else {
      console.log(`❌ Target booking ${targetBookingId} NOT found in recently modified list`);
      console.log(`📋 Available booking IDs:`, recentlyModifiedBookings.map(b => b.id).slice(0, 10));
    }
    
    res.json({
      success: true,
      found: !!targetBooking,
      totalModifiedBookings: recentlyModifiedBookings.length,
      bookingDetails: targetBooking || null,
      priceElementsCount: targetBooking ? (await smoobuClient.fetchPriceElements(targetBookingId)).length : 0
    });
    
  } catch (error) {
    console.error("🟥 Debug fetch-sync failed:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.post("/api/create-gift-voucher", handleCreateGiftVoucher);
app.post("/api/validate-voucher", validateVoucher);
app.get("/api/direct-bookings", fetchDirectBookings);
app.get("/api/extras-report", generateExtrasReport);
app.get("/api/bookings-report", generateBookingsReport);
app.get("/api/apartments", fetchApartments);
app.get("/api/apartments/:id", fetchApartmentsId);
app.get("/api/rates", fetchRates);
app.post("/api/create-payment-intent", createPaymentIntent);
app.post("/api/cancel-booking", handleCancelSpaBooking);
app.get("/api/bookings/:paymentIntentId", getBookingByPaymentIntentId);
app.get("/api/pending-bookings", (req, res) => {
  const bookings = Array.from(pendingBookings.entries());
  res.json(bookings);
});
app.get("/api/spa/availability", handleGetSpaAvailability);
app.get("/api/bookings-history/:email", getBookingHistoryByEmail);

// Schedule automatic sync (if it's not already started internally by the function)
setupScheduledTasks();

// UPDATED ROUTE HANDLER FOR CANCELLATION
app.delete(
  "/api/cancel-smoobu-reservation/:smoobuReservationId",
  async (req, res) => {
    const { smoobuReservationId: smoobuReservationIdStr } = req.params;

    if (!smoobuReservationIdStr) {
      return res
        .status(400)
        .json({ message: "Smoobu Reservation ID is required." });
    }

    const numericSmoobuId = parseInt(smoobuReservationIdStr, 10);
    if (isNaN(numericSmoobuId)) {
      return res.status(400).json({
        message: `Invalid Smoobu Reservation ID format: '${smoobuReservationIdStr}'. Must be a number.`,
      });
    }

    try {
      const smoobuResult = await cancelSmoobuReservationById(
        numericSmoobuId.toString()
      );

      const bookingsRef = db.collection("bookings");
      // Query using the NUMERIC smoobuReservationId field
      const querySnapshot = await bookingsRef
        .where("smoobuReservationId", "==", numericSmoobuId)
        .get();

      if (querySnapshot.empty) {
        return res.status(200).json({
          message: `${smoobuResult.message} No corresponding booking found in Firebase (it may have already been removed or never existed there).`,
          smoobuSuccess: true,
          firebaseSkipped: true,
        });
      }

      const batch = db.batch();
      let deletedFirebaseCount = 0;
      querySnapshot.forEach((doc) => {
        batch.delete(doc.ref);
        deletedFirebaseCount++;
      });
      await batch.commit();

      res.status(200).json({
        message: `${smoobuResult.message} Additionally, ${deletedFirebaseCount} corresponding booking(s) removed from Firebase.`,
        smoobuSuccess: true,
        firebaseDeletedCount: deletedFirebaseCount,
      });
    } catch (error) {
      console.error(
        `[API Route] Error processing cancellation for Smoobu Reservation ID ${numericSmoobuId}:`,
        error
      );

      if (error.source && error.source.startsWith("smoobu")) {
        // Error from our Smoobu wrapper
        return res.status(error.status || 502).json({
          message:
            error.message ||
            "Failed to cancel reservation with the external booking service.",
          details: error.smoobuData, // Contains data from Smoobu's error response
        });
      } else if (
        error.source === "inputValidation" ||
        error.source === "configValidation"
      ) {
        // Error from Smoobu wrapper's internal validation
        return res.status(error.status || 500).json({ message: error.message });
      } else if (error.code && error.code.startsWith("firestore/")) {
        // Firebase specific error
        return res.status(500).json({
          message: `Reservation might have been cancelled in Smoobu, but a subsequent error occurred with Firebase: ${error.message}. Please verify manually.`,
        });
      }
      // General unexpected error
      return res.status(500).json({
        message: `An unexpected error occurred during the cancellation process: ${
          error.message || "Unknown error"
        }`,
      });
    }
  }
);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server listening on port ${PORT}`);
});
