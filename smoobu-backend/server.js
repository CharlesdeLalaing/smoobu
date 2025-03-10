import express from "express";
import cors from "cors";
import * as dotenv from "dotenv";

import { handleWebhook, pendingBookings } from "./third-party/stripe/webhook/index.js";
import { fetchAndSync } from "./third-party/smoobu/actions/api/fetch-and-sync.js";
import { setupScheduledTasks } from "./third-party/smoobu/schedule.js";

import { handleCreateGiftVoucher } from "./third-party/wordpress/create-gift-voucher.js";
import { validateVoucher } from "./third-party/smoobu/actions/api/voucherValidation.js";
import { generateExtrasReport } from "./third-party/smoobu/actions/api/extras-report.js";

import { fetchApartments } from "./third-party/smoobu/actions/api/apartments.js";
import { fetchApartmentsId } from "./third-party/smoobu/actions/api/apartment-id.js";
import { fetchRates } from "./third-party/smoobu/actions/api/rates.js";
import { createPaymentIntent } from "./third-party/stripe/create-payment-intent.js";
import { getBookingByPaymentIntentId } from "./third-party/stripe/get-payment-intent.js";
import { getBookingHistoryByEmail } from "./third-party/smoobu/actions/api/get-booking-history-email.js";

// AlexisVS: init.js
dotenv.config();
const app = express();

// AlexisVS: je sais pas c'est quoi
app.options("/webhook", cors());

// AlexisVS: third-party/stripe/stripe.js

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


app.get("/api/fetch-and-sync", fetchAndSync);

// Schedule automatic sync every 4 hours
setupScheduledTasks();
app.post("/api/create-gift-voucher", handleCreateGiftVoucher);


app.post("/api/validate-voucher", validateVoucher );


app.get("/api/extras-report", generateExtrasReport);

// AlexisVS: third-party/smobou/actions/api/apartments.js
app.get("/api/apartments", fetchApartments);

app.get("/api/apartments/:id", fetchApartmentsId);



app.get("/api/rates", fetchRates);



//CREATE PAYMENT INTENT
app.post("/api/create-payment-intent", createPaymentIntent);

app.get("/api/bookings/:paymentIntentId", getBookingByPaymentIntentId);



// Debug endpoint to check pending bookings
app.get("/api/pending-bookings", (req, res) => {
  const bookings = Array.from(pendingBookings.entries());
  res.json(bookings);
});

// AlexisVS: remove Pour l'instant je garde quand même
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {

});

// AlexisVS: third-party/smobou/actions/api/get-booking-history-email.js
app.get("/api/bookings-history/:email", getBookingHistoryByEmail);


