import Stripe from "stripe";
import { db } from "../../firebase-config.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export async function getBookingByPaymentIntentId(req, res) {
  try {
    const { paymentIntentId } = req.params;

    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

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

    const responseData = {
      ...bookingDoc,
      paymentIntent: {
        id: paymentIntentId,
        ...(paymentIntent && {
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
}
