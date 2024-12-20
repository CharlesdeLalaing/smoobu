import React from "react";
import { Elements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";

const publishableKey = process.env.REACT_APP_STRIPE_PK_KEY;
console.log('Stripe Setup:', {
  keyExists: !!publishableKey,
  keyPrefix: publishableKey?.substring(0, 7)
});

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