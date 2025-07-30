// File: createPaymentIntent.js

import Stripe from "stripe";
import { roomNames } from "../../config/config.js";
import { pendingBookings } from "./webhook/index.js";
import { formatInTimeZone } from "date-fns-tz";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Test function to verify timezone formatting
function testTimezoneFormatting() {
  const timeZone = "Europe/Brussels";

  // Test with a sample SPA datetime (11:00 - 13:00)
  const testSpaDateTime = "2024-01-15T11:00:00.000Z"; // UTC time

  console.log("=== TIMEZONE FORMATTING TEST ===");
  console.log("Original UTC datetime:", testSpaDateTime);
  console.log("Original Date object:", new Date(testSpaDateTime));

  // Old method (what was showing 09:00 instead of 11:00)
  const oldFormatting = new Date(testSpaDateTime).toLocaleString("fr-BE", {
    dateStyle: "short",
    timeStyle: "short",
  });
  console.log("Old formatting (toLocaleString):", oldFormatting);

  // New method (should show correct time)
  const newFormatting = formatInTimeZone(
    new Date(testSpaDateTime),
    timeZone,
    "dd/MM/yyyy HH:mm"
  );
  console.log("New formatting (formatInTimeZone):", newFormatting);

  // Test with different times
  const testTimes = [
    "2024-01-15T09:00:00.000Z", // 9 AM UTC
    "2024-01-15T11:00:00.000Z", // 11 AM UTC
    "2024-01-15T13:00:00.000Z", // 1 PM UTC
    "2024-01-15T15:00:00.000Z", // 3 PM UTC
  ];

  console.log("\n=== Multiple Time Tests ===");
  testTimes.forEach((time) => {
    const oldFormat = new Date(time).toLocaleString("fr-BE", {
      dateStyle: "short",
      timeStyle: "short",
    });
    const newFormat = formatInTimeZone(
      new Date(time),
      timeZone,
      "dd/MM/yyyy HH:mm"
    );
    console.log(`UTC: ${time} | Old: ${oldFormat} | New: ${newFormat}`);
  });

  console.log("=== END TEST ===\n");
}

// Uncomment the line below to run the test
// testTimezoneFormatting();

export async function createPaymentIntent(req, res) {
  try {
    const { price, bookingData } = req.body;

    // Define the target timezone for consistent formatting
    const timeZone = "Europe/Brussels";

    // The price calculation logic remains the same
    let totalPrice = Number(bookingData.basePrice);
    totalPrice += Number(bookingData.guestFees || 0);
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
    if (bookingData.couponApplied) {
      totalPrice -= Number(bookingData.couponApplied.discount || 0);
    }
    if (bookingData.priceDetailsSnapshot?.discount) {
      totalPrice -= Number(bookingData.priceDetailsSnapshot.discount);
    }

    const bookingReference = `BOOKING-${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    // --- MODIFICATION #1: Add spaDateString to the pending booking data ---
    pendingBookings.set(bookingReference, {
      ...bookingData,
      totalPriceWithExtras: totalPrice,
      // The bookingData object from the frontend already contains spaDateString,
      // so the spread operator `...bookingData` automatically includes it here.
      // We just need to ensure the other fields are explicitly set if they are calculated here.
      spaDateTime: bookingData.spaDateTime || null,
      spaBookingPreference: bookingData.spaBookingPreference || null,
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
    }
    ${
      bookingData.spaDateTime
        ? ` • SPA: ${formatInTimeZone(
            new Date(bookingData.spaDateTime),
            timeZone,
            "dd/MM/yyyy HH:mm"
          )}`
        : bookingData.spaBookingPreference === "later"
        ? ` • SPA: À réserver ultérieurement`
        : ""
    }`,

      // --- MODIFICATION #2: Add spaDateString to the Stripe metadata ---
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
        ...(bookingData.spaDateTime && {
          spaDateTime: bookingData.spaDateTime,
          spaFormatted: formatInTimeZone(
            new Date(bookingData.spaDateTime),
            timeZone,
            "dd/MM/yyyy HH:mm"
          ),
        }),
        ...(bookingData.spaBookingPreference && {
          spaBookingPreference: bookingData.spaBookingPreference,
        }),
        finalPrice: `${totalPrice}€`,

        // --- THIS IS THE NEWLY ADDED LINE ---
        // We add the spaDateString here so it's permanently attached to the payment record.
        // The webhook can then read it from here. Use a fallback to an empty string for safety.
        spaDateString: bookingData.spaDateString || "",
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
}
