import React from "react";
import { Elements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";

// Add console.log to check if the key is being loaded
console.log("Stripe Key:", process.env.VITE_STRIPE_PUBLISHABLE_KEY);

const stripePromise = loadStripe(
  process.env.VITE_STRIPE_PUBLISHABLE_KEY
);

const StripeWrapper = ({ clientSecret, children, onSuccess, onError }) => {
  // Add error handling for missing key
  if (!process.env.VITE_STRIPE_PUBLISHABLE_KEY) {
    console.error("Stripe publishable key is missing!");
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