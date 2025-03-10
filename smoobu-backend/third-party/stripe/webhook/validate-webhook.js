import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export const validateWebhook = async (req, sig, webhookSecret) => {
  try {
    const event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    return { valid: true, event };
  } catch (err) {
    return { valid: false, error: err.message };
  }
};
