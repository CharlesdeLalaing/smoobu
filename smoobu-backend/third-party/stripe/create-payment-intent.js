import Stripe from "stripe";
import { roomNames } from "../../config/config.js"; // Assuming this contains room names
// Import pendingBookings from where it's actually defined and exported (likely your webhook index.js)
// Ensure this is the SAME instance.
import { pendingBookings } from "./webhook/index.js"; // Adjust path as needed

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export async function createPaymentIntent(req, res) {
  try {
    // bookingData comes from the frontend (useBookingForm state)
    // It should contain all necessary details for the booking.
    const { bookingData } = req.body;

    if (!bookingData) {
      return res
        .status(400)
        .json({ error: "Missing bookingData in request body." });
    }

    // Validate essential parts of bookingData
    if (
      !bookingData.priceBreakdown ||
      typeof bookingData.priceBreakdown.finalPayableAmount !== "number"
    ) {
      console.error(
        "🟥 Create PI Error: bookingData.priceBreakdown.finalPayableAmount is missing or not a number.",
        bookingData.priceBreakdown
      );
      return res
        .status(400)
        .json({ error: "Invalid pricing information in bookingData." });
    }
    if (!bookingData.firstName || !bookingData.lastName || !bookingData.email) {
      console.error(
        "🟥 Create PI Error: Missing required customer information.",
        bookingData
      );
      return res
        .status(400)
        .json({
          error:
            "Missing required customer information (firstName, lastName, email).",
        });
    }
    if (
      !bookingData.arrivalDate ||
      !bookingData.departureDate ||
      !bookingData.apartmentId
    ) {
      console.error(
        "🟥 Create PI Error: Missing required booking details.",
        bookingData
      );
      return res
        .status(400)
        .json({
          error: "Missing required booking details (dates, apartmentId).",
        });
    }

    // Use the finalPayableAmount from the detailed priceBreakdown calculated on the frontend.
    // This is the single source of truth for the amount to be charged.
    const finalAmountToCharge = Number(
      bookingData.priceBreakdown.finalPayableAmount
    );

    if (isNaN(finalAmountToCharge) || finalAmountToCharge < 0) {
      // Or some minimum amount like 0.50 EUR
      console.error(
        "🟥 Create PI Error: Invalid finalAmountToCharge:",
        finalAmountToCharge,
        bookingData.priceBreakdown
      );
      return res
        .status(400)
        .json({ error: "Calculated final amount is invalid." });
    }

    const finalAmountCents = Math.round(finalAmountToCharge * 100);

    // Ensure minimum chargeable amount for Stripe (e.g., 50 cents for EUR)
    if (finalAmountCents < 50) {
      console.error(
        "🟥 Create PI Error: Amount is too low to be charged by Stripe.",
        finalAmountCents
      );
      // You might want to translate this error or handle it more gracefully on the frontend.
      return res
        .status(400)
        .json({
          error:
            "The total amount is too low to process the payment (minimum 0.50 EUR).",
        });
    }

    const bookingReference = `BOOKING-${Date.now()}-${Math.random()
      .toString(36)
      .substring(2, 9)}`;

    // Store the *entire* bookingData (as received from the client) in pendingBookings.
    // This bookingData should already contain:
    // - selectedExtras (paid ones)
    // - selectedFreeDrinks
    // - priceBreakdown (with roomBasePrice, calculatedExtrasTotal, finalPayableAmount, etc.)
    // - couponApplied
    // - spaDateTime, spaBookingPreference
    // - All customer and stay details.
    // `prepareBookingDocument` in the webhook will use this comprehensive data.
    pendingBookings.set(bookingReference, {
      ...bookingData, // Spread all data received from the client
      bookingReference: bookingReference, // Add the reference itself
      // No need to add 'totalPriceWithExtras' here if priceBreakdown.finalPayableAmount is used.
    });
    console.log(
      `🟩 Create PI: Stored pending booking for reference: ${bookingReference}`
    );

    // Construct a concise description for Stripe.
    // Details will be in your Firebase record and Smoobu.
    const stripeDescription = `Réservation ${
      roomNames[bookingData.apartmentId] || bookingData.apartmentId
    } - ${bookingData.lastName}`;

    const paymentIntent = await stripe.paymentIntents.create({
      amount: finalAmountCents,
      currency: bookingData.currency || "eur", // Use currency from bookingData or default
      automatic_payment_methods: {
        enabled: true,
      },
      description: stripeDescription.substring(0, 255), // Stripe description limit
      receipt_email: bookingData.email, // Stripe can send a basic receipt
      metadata: {
        // CRUCIAL for linking webhook to pending data:
        bookingReference: bookingReference,

        // Essential for Stripe's view and basic identification:
        clientName:
          `${bookingData.firstName} ${bookingData.lastName}`.substring(0, 100),
        clientEmail: bookingData.email.substring(0, 100),
        // Optional: other key identifiers if absolutely needed by Stripe or for quick lookup
        // but avoid duplicating the entire bookingData here.
        // apartmentId: bookingData.apartmentId,
        // arrivalDate: bookingData.arrivalDate,
      },
    });
    console.log(
      `🟩 Create PI: Stripe PaymentIntent ${paymentIntent.id} created for ${bookingReference}.`
    );

    res.json({
      clientSecret: paymentIntent.client_secret,
      bookingReference: bookingReference, // Can be useful for client-side logging/debugging if needed
    });
  } catch (error) {
    console.error(
      "🟥 Create PI Error: Error creating payment intent:",
      error.message,
      error.stack
    );
    let userMessage = "Failed to create payment intent. Please try again.";
    if (error.type === "StripeCardError") {
      userMessage = error.message; // Show Stripe's card error message directly
    } else if (error.code === "amount_too_small") {
      userMessage =
        "The total amount is too low to process the payment (minimum 0.50 EUR).";
    }
    // Add more specific error handling if needed

    res.status(500).json({
      error: userMessage,
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined, // Only show full details in dev
    });
  }
}
