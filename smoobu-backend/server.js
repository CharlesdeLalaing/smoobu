import express from "express";
import cors from "cors";
import axios from "axios";
import Stripe from "stripe";
import * as dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();

const app = express();
const stripe = new Stripe(
  "sk_test_51QHmafIhkftuEy3nihoW4ZunaXVY1D85r176d91x9BAhGfvW92zG7r7A5rVeGuL1ysHVMOzflF0jwoCpyKJl760n00GC9ZYSJ4"
);
const pendingBookings = new Map();

// Discount settings
const discountSettings = {
  2402388: {
    cleaningFee: 0,
    prepayment: 0,
    minDaysBetweenBookingAndArrival: 1,
    extraGuestsPerNight: 20,
    startingAtGuest: 2,
    maxGuests: 4,
    extraChildPerNight: 20,
    lengthOfStayDiscount: {
      minNights: 2,
      discountPercentage: 40,
    },
  },
};

// Calculate price with settings
const calculatePriceWithSettings = (
  rates,
  startDate,
  endDate,
  numberOfGuests,
  numberOfChildren,
  settings
) => {
  let totalPrice = 0;
  let numberOfNights = 0;
  const currentDate = new Date(startDate);
  const endDateTime = new Date(endDate);

  while (currentDate < endDateTime) {
    const dateStr = currentDate.toISOString().split("T")[0];
    const dayRate = rates[dateStr];

    if (dayRate && dayRate.price !== null && dayRate.available === 1) {
      totalPrice += dayRate.price;
      numberOfNights++;
    }

    currentDate.setDate(currentDate.getDate() + 1);
  }

  const extraGuests = Math.max(0, numberOfGuests - settings.startingAtGuest);
  const extraGuestsFee =
    extraGuests * settings.extraGuestsPerNight * numberOfNights;
  const extraChildrenFee =
    numberOfChildren * settings.extraChildPerNight * numberOfNights;

  let discount = 0;
  if (numberOfNights >= settings.lengthOfStayDiscount.minNights) {
    discount =
      (totalPrice * settings.lengthOfStayDiscount.discountPercentage) / 100;
  }

  const priceElements = [
    {
      type: "basePrice",
      name: "Base price",
      amount: totalPrice,
      currencyCode: "EUR",
    },
  ];

  if (extraGuestsFee > 0) {
    priceElements.push({
      type: "addon",
      name: "Extra guests fee",
      amount: extraGuestsFee,
      currencyCode: "EUR",
    });
  }

  if (extraChildrenFee > 0) {
    priceElements.push({
      type: "addon",
      name: "Extra children fee",
      amount: extraChildrenFee,
      currencyCode: "EUR",
    });
  }

  if (settings.cleaningFee > 0) {
    priceElements.push({
      type: "cleaningFee",
      name: "Cleaning fee",
      amount: settings.cleaningFee,
      currencyCode: "EUR",
    });
  }

  if (discount > 0) {
    priceElements.push({
      type: "longStayDiscount",
      name: `Long stay discount (${settings.lengthOfStayDiscount.discountPercentage}%)`,
      amount: -discount,
      currencyCode: "EUR",
    });
  }

  const subtotal =
    totalPrice + extraGuestsFee + extraChildrenFee + settings.cleaningFee;
  const finalPrice = subtotal - discount;

  return {
    originalPrice: totalPrice,
    extraGuestsFee,
    extraChildrenFee,
    cleaningFee: settings.cleaningFee,
    discount,
    finalPrice,
    numberOfNights,
    priceElements,
    settings,
  };
};

// Webhook endpoint must come before JSON middleware
app.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const sig = req.headers["stripe-signature"];
    let event;

    console.log("Received webhook call");

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        "whsec_d9b86273072de6b319134fbc08752e2b4e66bae72aaa2cf4cb7db1411974c20a"
      );

      console.log("Webhook event verified:", event.type);

      if (event.type === "payment_intent.succeeded") {
        const paymentIntent = event.data.object;
        const bookingReference = paymentIntent.metadata.bookingReference;
        const bookingData = pendingBookings.get(bookingReference);

        console.log("Retrieved booking data:", bookingData);

        if (!bookingData) {
          console.error(
            "No booking data found for reference:",
            bookingReference
          );
          return res.status(400).json({ error: "Booking data not found" });
        }

        try {
          const smoobuResponse = await axios.post(
            "https://login.smoobu.com/api/reservations",
            {
              arrivalDate: bookingData.arrivalDate,
              departureDate: bookingData.departureDate,
              channelId: bookingData.channelId,
              apartmentId: bookingData.apartmentId,
              firstName: bookingData.firstName,
              lastName: bookingData.lastName,
              email: bookingData.email,
              phone: bookingData.phone,
              notice: bookingData.notice,
              adults: Number(bookingData.adults),
              children: Number(bookingData.children),
              price: Number(bookingData.price),
              priceStatus: 1,
              deposit: Number(bookingData.deposit),
              depositStatus: 1,
              language: "en",
            },
            {
              headers: {
                "Api-Key": "3QrCCtDgMURVQn1DslPKbUu69DReBzWRY0DOe2SIVB",
                "Content-Type": "application/json",
              },
            }
          );

          console.log("Smoobu booking created:", smoobuResponse.data);
          pendingBookings.delete(bookingReference);
        } catch (error) {
          console.error(
            "Error creating Smoobu booking:",
            error.response?.data || error.message
          );
        }
      }

      res.json({ received: true });
    } catch (err) {
      console.error("Webhook Error:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }
  }
);

// Use JSON parsing and CORS for all other routes
app.use(express.json());
app.use(
  cors({
    origin: "http://localhost:5173",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Get rates endpoint
app.get("/api/rates", async (req, res) => {
  try {
    const { apartments, start_date, end_date, adults, children } = req.query;
    const apartmentId = Array.isArray(apartments) ? apartments[0] : apartments;
    const settings = discountSettings[apartmentId];

    if (!settings) {
      return res
        .status(404)
        .json({ error: "Settings not found for this apartment" });
    }

    const response = await axios.get("https://login.smoobu.com/api/rates", {
      headers: {
        "Api-Key":
        "3QrCCtDgMURVQn1DslPKbUu69DReBzWRY0DOe2SIVB",
        "Content-Type": "application/json",
      },
      params: {
        apartments: apartments,
        start_date: start_date,
        end_date: end_date,
      },
    });

    if (response.data.data && response.data.data[apartmentId]) {
      const priceData = calculatePriceWithSettings(
        response.data.data[apartmentId],
        start_date,
        end_date,
        parseInt(adults) || 1,
        parseInt(children) || 0,
        settings
      );

      res.json({
        ...response.data,
        priceDetails: priceData,
      });
    } else {
      res.json(response.data);
    }
  } catch (error) {
    console.error(
      "Error fetching rates:",
      error.response?.data || error.message
    );
    res.status(error.response?.status || 500).json({
      error: error.response?.data?.detail || "Failed to fetch rates",
    });
  }
});

// Create payment intent endpoint
app.post("/api/create-payment-intent", async (req, res) => {
  try {
    const { price, bookingData } = req.body;
    console.log("Received booking data:", bookingData);

    const bookingReference = `BOOKING-${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 9)}`;
    console.log("Generated booking reference:", bookingReference);

    pendingBookings.set(bookingReference, bookingData);
    console.log("Stored booking data in pending bookings");

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(price * 100),
      currency: "eur",
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
        bookingReference: bookingReference,
      },
    });

    console.log("Created payment intent:", paymentIntent.id);

    res.json({
      clientSecret: paymentIntent.client_secret,
      bookingReference: bookingReference,
    });
  } catch (error) {
    console.error("Error creating payment intent:", error);
    res.status(500).json({ error: "Failed to create payment intent" });
  }
});

// Test Smoobu endpoint
app.post("/api/test-smoobu", async (req, res) => {
  try {
    const testBooking = {
      arrivalDate: "2024-11-10",
      departureDate: "2024-11-12",
      channelId: 3960043,
      apartmentId: 2402388,
      firstName: "Test",
      lastName: "Booking",
      email: "test@example.com",
      phone: "1234567890",
      adults: 1,
      children: 0,
      price: 100,
      priceStatus: 1,
      deposit: 0,
      depositStatus: 1,
      language: "en",
    };

    console.log("Testing Smoobu API with data:", testBooking);

    const response = await axios.post(
      "https://login.smoobu.com/api/reservations",
      testBooking,
      {
        headers: {
          "Api-Key": "3QrCCtDgMURVQn1DslPKbUu69DReBzWRY0DOe2SIVB",
          "Content-Type": "application/json",
        },
      }
    );

    console.log("Smoobu test response:", response.data);
    res.json(response.data);
  } catch (error) {
    console.error("Smoobu test error:", error.response?.data || error.message);
    res.status(500).json({
      error: "Smoobu test failed",
      details: error.response?.data,
    });
  }
});

// Debug endpoint to check pending bookings
app.get("/api/pending-bookings", (req, res) => {
  const bookings = Array.from(pendingBookings.entries());
  res.json(bookings);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log("Webhook endpoint ready at /webhook");
});
