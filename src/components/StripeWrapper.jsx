import React from "react";
import { Elements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";

const stripePromise = loadStripe(
  "pk_test_51QHmafIhkftuEy3nUnQeADHtSgrHJDHFtkQDfKK7dtkN8XwYw4qImtQTAgGiV0o9TR2m2DZfHhc4VmugNUw0pEuF009YsiV98I"
); // Replace with your key

const StripeWrapper = ({ clientSecret, children }) => {
  const options = {
    clientSecret,
    appearance: {
      theme: 'stripe',
      variables: {
        colorPrimary: '#0064ff',
      },
    },
  };

  return (
    <Elements stripe={stripePromise} options={options}>
      {children}
    </Elements>
  );
};

export default StripeWrapper;
