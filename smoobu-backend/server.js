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
import { fetchAndSync } from "./third-party/smoobu/actions/api/fetch-and-sync.js";
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
import { handleCancelSpaBooking } from "./third-party/smoobu/actions/api/cancel-booking.js"

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
app.get("/api/fetch-and-sync", fetchAndSync);
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
