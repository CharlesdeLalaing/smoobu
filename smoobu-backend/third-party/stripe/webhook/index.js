import { validateWebhook } from "./validate-webhook.js";
import { createSmoobuReservation } from "./create-smoobu-reservation.js";
import {
  addBasePriceToReservation,
  addGuestFeesToReservation,
  addExtrasToReservation,
  addDiscountsToReservation,
} from "./add-price-elements.js";
import { storeBookingInFirebase } from "./store-booking.js";
import { updateCouponUsage } from "./update-coupon-usage.js";
import { wait } from "../../../helpers/wait.js";

// Keep track of the pending bookings
let pendingBookings = new Map();

export const handleWebhook = async (req, res) => {
  console.log("🟦 Webhook received:", new Date().toISOString());

  const sig = req.headers["stripe-signature"];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const apiKey = process.env.SMOOBU_API_KEY;

  // Step 1: Validate the webhook
  const { valid, event, error } = await validateWebhook(
    req,
    sig,
    webhookSecret
  );

  if (!valid) {
    console.error("🟥 Webhook validation failed:", error);
    return res.status(400).send(`Webhook Error: ${error}`);
  }

  // Only handle payment_intent.succeeded events
  if (event.type !== "payment_intent.succeeded") {
    return res.json({ received: true });
  }

  try {
    const paymentIntent = event.data.object;
    console.log("🟦 Payment Intent metadata:", paymentIntent.metadata);

    const bookingReference = paymentIntent.metadata.bookingReference;
    console.log("🟦 Booking Reference:", bookingReference);

    const bookingData = pendingBookings.get(bookingReference);
    console.log("🟦 Retrieved booking data:", {
      hasBookingData: !!bookingData,
      couponData: bookingData?.couponApplied,
      bookingReference,
    });

    if (!bookingData) {
      console.error("No booking data found for reference:", bookingReference);
      return res.status(400).send("No booking data found");
    }

    // Step 2: Create reservation in Smoobu
    const {
      success: reservationSuccess,
      reservationId,
      error: reservationError,
    } = await createSmoobuReservation(bookingData);

    if (!reservationSuccess) {
      console.error(
        "🟥 Failed to create Smoobu reservation:",
        reservationError
      );
      return res.status(500).send("Failed to create Smoobu reservation");
    }

    // Step 3: Store booking in Firebase
    const { success: storageSuccess, error: storageError } =
      await storeBookingInFirebase(bookingData, paymentIntent, reservationId);

    if (!storageSuccess) {
      console.error("🟥 Failed to store booking in Firebase:", storageError);
      return res.status(500).send("Failed to store booking in Firebase");
    }

    await wait(2000);

    // Step 4: Add price elements to Smoobu
    // 4.1: Add base price
    const { success: basePriceSuccess } = await addBasePriceToReservation(
      reservationId,
      bookingData.basePrice,
      apiKey
    );

    if (!basePriceSuccess) {
      console.error("🟥 Failed to add base price to Smoobu");
    }

    await wait(1000);

    // 4.2: Add guest fees if present
    if (bookingData.guestFees > 0) {
      const { success: guestFeesSuccess } = await addGuestFeesToReservation(
        reservationId,
        bookingData,
        apiKey
      );

      if (!guestFeesSuccess) {
        console.error("🟥 Failed to add guest fees to Smoobu");
      }

      await wait(1000);
    }

    // 4.3: Add extras if present
    if (bookingData.extras?.length > 0) {
      const { success: extrasSuccess } = await addExtrasToReservation(
        reservationId,
        bookingData.extras,
        apiKey
      );

      if (!extrasSuccess) {
        console.error("🟥 Failed to add extras to Smoobu");
      }
    }

    // 4.4: Add discounts
    const { success: discountsSuccess } = await addDiscountsToReservation(
      reservationId,
      bookingData,
      apiKey
    );

    if (!discountsSuccess) {
      console.error("🟥 Failed to add one or more discounts to Smoobu");
    }

    // Step 5: Update coupon usage in Firebase if present
    if (bookingData.couponApplied?.code) {
      const { success: couponSuccess } = await updateCouponUsage(bookingData);

      if (!couponSuccess) {
        console.error("🟥 Failed to update coupon usage");
      }
    }

    // Step 6: Clean up
    pendingBookings.delete(bookingReference);

    console.log("🟩 Booking process completed successfully");
    return res.json({ received: true });
  } catch (err) {
    console.error("🟥 Webhook processing error:", err);
    return res.status(500).send(`Webhook processing error: ${err.message}`);
  }
};

// Export pendingBookings to be accessed from outside
export { pendingBookings };

