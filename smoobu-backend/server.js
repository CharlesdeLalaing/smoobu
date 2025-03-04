import express from "express";
import cors from "cors";
import axios from "axios";
import Stripe from "stripe";
import * as dotenv from "dotenv";
//Config imports
import { roomNames, discountSettings } from "./config/config.js"

//Helper imports 
import { calculatePriceWithSettings } from "./helpers/pricing/calculate-price-with-settings.js"

import { transporter } from "./config/nodemailer.js"
import { handleWebhook, pendingBookings } from "./third-party/stripe/webhook/index.js";
import { deduplicateBookings } from "./third-party/firebase/deduplicate-bookings.js";
import { fetchAndSync } from "./third-party/smoobu/actions/api/fetch-and-sync.js";
import { setupScheduledTasks } from "./third-party/smoobu/schedule.js";

import { handleCreateGiftVoucher } from "./third-party/wordpress/create-gift-voucher.js";
import { validateVoucher } from "./third-party/smoobu/actions/api/voucherValidation.js";
import { fetchDirectBookings } from "./third-party/smoobu/actions/api/fetch-direct-bookings.js";
import { generateExtrasReport } from "./third-party/smoobu/actions/api/extras-report.js";

import { db } from "./firebase-config.js";
import { generateBookingsReport } from "./third-party/smoobu/actions/api/booking-report.js";
import { fetchApartments } from "./third-party/smoobu/actions/api/apartments.js";
import { fetchApartmentsId } from "./third-party/smoobu/actions/api/apartment-id.js";
import { fetchRates } from "./third-party/smoobu/actions/api/rates.js";
import { createPaymentIntent } from "./third-party/stripe/create-payment-intent.js";

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

app.get("/api/deduplicate-bookings", deduplicateBookings);


app.get("/api/fetch-and-sync", fetchAndSync);


// Schedule automatic sync every 4 hours
setupScheduledTasks();
app.post("/api/create-gift-voucher", handleCreateGiftVoucher);


app.post("/api/validate-voucher", validateVoucher );

app.get("/api/direct-bookings", fetchDirectBookings);

app.get("/api/extras-report", generateExtrasReport);

app.get("/api/bookings-report", generateBookingsReport);

// AlexisVS: third-party/smobou/actions/api/apartments.js
app.get("/api/apartments", fetchApartments);

app.get("/api/apartments/:id", fetchApartmentsId);


// AlexisVS: third-party/smobou/actions/api/rates.js
app.get("/api/rates", fetchRates);


// AlexisVS: third-party/smobou/actions/api/create-payment-intent.js
//CREATE PAYMENT INTENT
app.post("/api/create-payment-intent", createPaymentIntent);


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


