// src/api/webhook/index.js (or your main webhook file)

import { validateWebhook } from "./validate-webhook.js";
import { createSmoobuReservation } from "./create-smoobu-reservation.js";
import {
  addBasePriceToReservation,
  addGuestFeesToReservation,
  addExtrasToReservation, // For PAID extras from bookingDoc.extras
  addDiscountsToReservation,
} from "./add-price-elements.js";
import { storeBookingInFirebase } from "./store-booking.js";
import { updateCouponUsage } from "./update-coupon-usage.js";
import { wait } from "../../../helpers/wait.js"; // Ensure this helper exists


export let pendingBookings = new Map(); // Export if create-payment-intent needs to set it.

export const handleWebhook = async (req, res) => {
  const sig = req.headers["stripe-signature"];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const apiKey = process.env.SMOOBU_API_KEY;

  if (!webhookSecret || !apiKey) {
    console.error(
      "🟥 Webhook Error: Missing STRIPE_WEBHOOK_SECRET or SMOOBU_API_KEY in environment variables."
    );
    return res.status(500).send("Webhook configuration error.");
  }

  const {
    valid,
    event,
    error: validationError,
  } = await validateWebhook(req, sig, webhookSecret);
  if (!valid) {
    console.error("🟥 Webhook validation failed:", validationError);
    return res.status(400).send(`Webhook Error: ${validationError}`);
  }

  if (event.type !== "payment_intent.succeeded") {

    return res.json({
      received: true,
      processed: false,
      reason: "Event type not payment_intent.succeeded",
    });
  }

  const paymentIntent = event.data.object;


  const bookingReference = paymentIntent.metadata.bookingReference;
  if (!bookingReference) {
    console.error(
      "🟥 Webhook Error: payment_intent.succeeded missing bookingReference in metadata.",
      paymentIntent.metadata
    );
    return res
      .status(400)
      .send("Missing bookingReference in payment intent metadata.");
  }

  const bookingData = pendingBookings.get(bookingReference);
  if (!bookingData) {
    console.warn(
      `⚠️ Webhook: No pending booking data found for reference: ${bookingReference}. May have already been processed or cleared.`
    );
    return res
      .status(200)
      .json({
        received: true,
        processed: false,
        reason: `No pending data for ${bookingReference}`,
      });
  }


  let reservationId; // To store Smoobu reservation ID for potential cleanup on error

  try {
    // Step 2: Create reservation in Smoobu
    const smoobuResult = await createSmoobuReservation(bookingData, apiKey);
    if (!smoobuResult.success || !smoobuResult.reservationId) {
      console.error(
        `🟥 Smoobu: Failed to create reservation for ${bookingReference}:`,
        smoobuResult.error
      );
      return res
        .status(500)
        .send(`Failed to create Smoobu reservation: ${smoobuResult.error}`);
    }
    reservationId = smoobuResult.reservationId;


    // Step 3: Store booking in Firebase (this calls prepareBookingDocument internally)
    const {
      success: storageSuccess,
      error: storageError,
      bookingDoc,
    } = await storeBookingInFirebase(bookingData, paymentIntent, reservationId);

    if (!storageSuccess || !bookingDoc) {
      console.error(
        `🟥 Firebase Store: Failed for ${bookingReference}, SmoobuID ${reservationId}:`,
        storageError
      );
      return res
        .status(500)
        .send(`Failed to store booking in Firebase: ${storageError}`);
    }


    await wait(1500); // Short delay

    // Step 4: Add price elements to Smoobu (using data from bookingDoc)


    // 4.1: Base Price
    const basePrice =
      bookingDoc.basePrice || bookingDoc.priceBreakdown?.roomBasePrice;
    if (basePrice !== undefined && basePrice > 0) {

      await addBasePriceToReservation(reservationId, basePrice, apiKey); // apiKey passed
      await wait(1000);
    }

    // 4.2: Guest Fees
    const guestFees =
      bookingDoc.guestFees || bookingDoc.priceBreakdown?.calculatedGuestFees;
    if (guestFees !== undefined && guestFees > 0) {

      await addGuestFeesToReservation(reservationId, bookingDoc, apiKey); // apiKey passed
      await wait(1000);
    }

    // 4.3: PAID Extras (from bookingDoc.extras)
    if (bookingDoc.extras && bookingDoc.extras.length > 0) {
      await addExtrasToReservation(reservationId, bookingDoc.extras, apiKey);
      await wait(1000);
    }

    // 4.4: Discounts
    if (
      bookingDoc.couponApplied ||
      bookingDoc.priceBreakdown?.appliedLongStayDiscount > 0
    ) {
      await addDiscountsToReservation(reservationId, bookingDoc, apiKey);
      await wait(1000);
    }


    // Step 5: Update coupon usage
    if (bookingDoc.couponApplied?.code) {
      const { success: couponSuccess, error: couponError } =
        await updateCouponUsage(
          bookingDoc.couponApplied,
          reservationId.toString()
        );
      if (!couponSuccess) {
        console.warn(
          `⚠️ Firebase Coupon: Failed to update usage for coupon ${bookingDoc.couponApplied.code}:`,
          couponError
        );
      } else {
        console.log(
          `🟩 Firebase Coupon: Usage updated for ${bookingDoc.couponApplied.code}.`
        );
      }
    }

    // Step 6: Clean up pending booking
    pendingBookings.delete(bookingReference);


    return res.json({
      received: true,
      processed: true,
      message: "Booking processed successfully.",
    });
  } catch (err) {
    console.error(
      `🟥 Webhook: Unhandled error during processing for ${
        bookingReference || paymentIntent.id
      }:`,
      err.message,
      err.stack
    );
    // Consider what to do with pendingBookings. If it's a transient error, Stripe will retry.
    // If it's a permanent error with the data, retries won't help.
    return res.status(500).send(`Webhook processing error: ${err.message}`);
  }
};
