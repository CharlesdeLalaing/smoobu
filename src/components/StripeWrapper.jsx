import React from "react";
import { Elements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";

// Add explicit console log
const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PK_KEY;
console.log('Stripe Setup:', {
  keyExists: !!publishableKey,
  keyPrefix: publishableKey?.substring(0, 7)
});

// Initialize Stripe outside component
const stripePromise = loadStripe(publishableKey);

const StripeWrapper = ({ clientSecret, children, onSuccess, onError }) => {
  if (!clientSecret) {
    console.error('No client secret provided');
    return null;
  }

  const options = {
    clientSecret,
    appearance: {
      theme: "stripe",
      variables: {
        colorPrimary: "#668E73",
      },
    },
  };

  // Add debug log for mounting
  console.log('Mounting StripeWrapper with:', {
    hasClientSecret: !!clientSecret,
    hasStripePromise: !!stripePromise
  });

  return (
    <Elements stripe={stripePromise} options={options}>
      {React.cloneElement(children, { onSuccess, onError })}
    </Elements>
  );
};

export default StripeWrapper;