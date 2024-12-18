import React from "react";
import { Elements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { useTranslation } from 'react-i18next';

const stripePromise = loadStripe(
  "pk_test_51QHmafIhkftuEy3nUnQeADHtSgrHJDHFtkQDfKK7dtkN8XwYw4qImtQTAgGiV0o9TR2m2DZfHhc4VmugNUw0pEuF009YsiV98I"
);

const StripeWrapper = ({ clientSecret, children, onSuccess, onError }) => {
  const { i18n } = useTranslation();

  // Map i18n language codes to Stripe locale codes if needed
  const getStripeLocale = (language) => {
    const localeMap = {
      fr: 'fr',
      nl: 'nl',
      en: 'en'
      // Add more mappings if needed
    };
    return localeMap[language] || 'en';
  };

  const options = {
    clientSecret,
    appearance: {
      theme: "stripe",
      variables: {
        colorPrimary: "#668E73",
      },
    },
    locale: getStripeLocale(i18n.language),
  };

  return (
    <Elements stripe={stripePromise} options={options}>
      {React.cloneElement(children, { onSuccess, onError })}
    </Elements>
  );
};

export default StripeWrapper;