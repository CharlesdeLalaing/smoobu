import React from "react";
import { Elements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";

// Add these debug logs
console.log("All env variables:", import.meta.env);
console.log("Stripe Key:", import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

const stripePromise = loadStripe(
  import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
);

const StripeWrapper = ({ clientSecret, children, onSuccess, onError }) => {
  // Add another log here
  if (!import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY) {
    console.error("⚠️ Stripe key is missing in environment!");
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

  return (
    <Elements stripe={stripePromise} options={options}>
      {React.cloneElement(children, { onSuccess, onError })}
    </Elements>
  );
};

export default StripeWrapper;