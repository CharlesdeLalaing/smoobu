import React from "react";
import { Elements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";

// Use import.meta.env for Vite or process.env for Create React App
const publishableKey = "pk_live_51PMSZgHkTpmdfEQCSR3cuwrc3Xs9XfsS8b08KuRFuJhnQu6T0rKrUqWM5Iv71vvGXttyegtEvn2cqQzIvX342bzJ000DVG0SfF";

if (!publishableKey) {
  console.error('Stripe publishable key is not defined in environment variables');
}

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

  return (
    <Elements stripe={stripePromise} options={options}>
      {React.cloneElement(children, { onSuccess, onError })}
    </Elements>
  );
};

export default StripeWrapper;