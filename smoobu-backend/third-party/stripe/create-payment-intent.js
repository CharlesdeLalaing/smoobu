// createPaymentIntent.js
import Stripe from "stripe";
import { roomNames } from "../../config/config.js";
import { pendingBookings } from "./webhook/index.js"; // Adjust path as needed

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export async function createPaymentIntent(req, res) {
  try {
    const { bookingData } = req.body;

    if (!bookingData) {
      return res
        .status(400)
        .json({ error: "Missing bookingData in request body." });
    }

    // Validate essential parts of bookingData (as in your current code)
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
      return res.status(400).json({
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
      return res.status(400).json({
        error: "Missing required booking details (dates, apartmentId).",
      });
    }

    // Use the finalPayableAmount from the detailed priceBreakdown.
    const finalAmountToCharge = Number(
      bookingData.priceBreakdown.finalPayableAmount
    );

    if (isNaN(finalAmountToCharge) || finalAmountToCharge < 0.5) {
      // Stripe minimum is often 0.50 units
      console.error(
        "🟥 Create PI Error: Invalid or too low finalAmountToCharge:",
        finalAmountToCharge,
        bookingData.priceBreakdown
      );
      return res
        .status(400)
        .json({
          error:
            "Calculated final amount is invalid or too low (min 0.50 EUR).",
        });
    }

    const finalAmountCents = Math.round(finalAmountToCharge * 100);

    if (finalAmountCents < 50) {
      // Double check minimum for EUR
      console.error(
        "🟥 Create PI Error: Amount is too low to be charged by Stripe.",
        finalAmountCents
      );
      return res.status(400).json({
        error:
          "The total amount is too low to process the payment (minimum 0.50 EUR).",
      });
    }

    const bookingReference = `BOOKING-${Date.now()}-${Math.random()
      .toString(36)
      .substring(2, 9)}`;

    pendingBookings.set(bookingReference, {
      ...bookingData,
      bookingReference: bookingReference,
    });
    console.log(
      `🟩 Create PI: Stored pending booking for reference: ${bookingReference}`
    );

    // --- START OF THE MODIFIED PART ---
    // Construct the detailed description (like "before")
    // Ensure all these fields (basePrice, guestFees, extras, couponApplied, spaDateTime)
    // are still being sent in bookingData from your frontend.
    // If some are now nested under priceBreakdown, adjust accordingly.
    // For example, bookingData.priceBreakdown.roomBasePrice instead of bookingData.basePrice

    const extrasTotalForDescription = bookingData.extras?.length
      ? bookingData.extras.reduce(
          (sum, extra) =>
            sum +
            (Number(extra.amount) || 0) +
            (Number(extra.extraPersonPrice) || 0) *
              (Number(extra.extraPersonQuantity) || 0),
          0
        )
      : 0;

    let detailedDescription = `Réservation - ${bookingData.firstName} ${
      bookingData.lastName
    }\nChambre: ${
      roomNames[bookingData.apartmentId] || bookingData.apartmentId
    }\n(${bookingData.arrivalDate} - ${bookingData.departureDate})\nBase: ${
      bookingData.priceBreakdown?.roomBasePrice ??
      bookingData.basePrice ??
      "N/A" // Prefer from priceBreakdown if available
    }€`;

    if (
      bookingData.priceBreakdown?.guestFeesTotal &&
      bookingData.priceBreakdown.guestFeesTotal > 0
    ) {
      detailedDescription += `\n • Frais invités: ${bookingData.priceBreakdown.guestFeesTotal}€`;
    } else if (Number(bookingData.guestFees) > 0) {
      // Fallback to older structure
      detailedDescription += `\n • Frais invités: ${bookingData.guestFees}€`;
    }

    if (extrasTotalForDescription > 0) {
      detailedDescription += `\n • Extras: ${extrasTotalForDescription}€`;
    }

    if (bookingData.couponApplied && bookingData.couponApplied.code) {
      detailedDescription += `\n • Code ${bookingData.couponApplied.code}: -${bookingData.couponApplied.discount}€`;
    }

    if (bookingData.spaDateTime) {
      detailedDescription += `\n • SPA: ${new Date(
        bookingData.spaDateTime
      ).toLocaleString("fr-BE", {
        dateStyle: "short",
        timeStyle: "short",
      })}`;
    } else if (bookingData.spaBookingPreference === "later") {
      detailedDescription += `\n • SPA: À réserver ultérieurement`;
    }
    detailedDescription += `\nTotal: ${finalAmountToCharge.toFixed(2)}€`; // Show the final amount being charged

    const paymentIntent = await stripe.paymentIntents.create({
      amount: finalAmountCents, // Crucially, use the new validated amount
      currency: bookingData.currency || "eur",
      automatic_payment_methods: {
        enabled: true,
      },
      description: detailedDescription.substring(0, 255), // Stripe description limit (max 255 for PI)
      receipt_email: bookingData.email, // Good to keep for Stripe receipts
      metadata: {
        // CRUCIAL for linking webhook to pending data:
        bookingReference: bookingReference,

        // Detailed metadata (like "before"), ensure data sources are correct
        clientName:
          `${bookingData.firstName} ${bookingData.lastName}`.substring(0, 100),
        clientEmail: bookingData.email.substring(0, 100),
        clientPhone: (bookingData.phone || "").substring(0, 100),
        roomId: bookingData.apartmentId,
        roomName: roomNames[bookingData.apartmentId] || bookingData.apartmentId,
        checkIn: bookingData.arrivalDate,
        checkOut: bookingData.departureDate,

        // Use priceBreakdown if available, otherwise fallback or omit if not critical for metadata
        basePrice: `${
          bookingData.priceBreakdown?.roomBasePrice ??
          bookingData.basePrice ??
          "N/A"
        }€`,
        guestFees: `${
          bookingData.priceBreakdown?.guestFeesTotal ??
          bookingData.guestFees ??
          0
        }€`,
        extrasTotal: `${
          bookingData.priceBreakdown?.extrasTotal ?? extrasTotalForDescription
        }€`,

        ...(bookingData.couponApplied && {
          couponCode: bookingData.couponApplied.code,
          couponDiscount: `-${bookingData.couponApplied.discount}€`,
          couponType: bookingData.couponApplied.type,
        }),
        ...(bookingData.spaDateTime && {
          spaDateTime: bookingData.spaDateTime,
          spaFormatted: new Date(bookingData.spaDateTime).toLocaleString(
            "fr-BE",
            {
              dateStyle: "short",
              timeStyle: "short",
            }
          ),
        }),
        ...(bookingData.spaBookingPreference && {
          spaBookingPreference: bookingData.spaBookingPreference,
        }),
        finalPriceCharged: `${finalAmountToCharge.toFixed(2)}€`, // Reflects the actual charge
        // Add any other metadata fields from your "before" version if needed
      },
    });
    // --- END OF THE MODIFIED PART ---

    console.log(
      `🟩 Create PI: Stripe PaymentIntent ${paymentIntent.id} created for ${bookingReference}.`
    );

    res.json({
      clientSecret: paymentIntent.client_secret,
      bookingReference: bookingReference,
    });
  } catch (error) {
    console.error(
      "🟥 Create PI Error: Error creating payment intent:",
      error.message,
      error.stack
    );
    let userMessage = "Failed to create payment intent. Please try again.";
    if (error.type === "StripeCardError") {
      userMessage = error.message;
    } else if (error.code === "amount_too_small") {
      userMessage =
        "The total amount is too low to process the payment (minimum 0.50 EUR).";
    } // Add more specific error handling if needed

    res.status(500).json({
      error: userMessage,
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}
