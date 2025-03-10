import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";

const PaymentForm = ({ onSuccess, onError }) => {
  const { t } = useTranslation();
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (stripe && elements) {
      setMounted(true);
    }
  }, [stripe, elements]);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!stripe || !elements || !mounted) {

      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const result = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/booking-confirmation`,
        },
        redirect: "if_required",
      });

      if (result.error) {
        setErrorMessage(result.error.message);
        if (onError) onError(result.error.message);
      } else if (
        result.paymentIntent &&
        result.paymentIntent.status === "succeeded"
      ) {
        const bookingData = {
          paymentIntent: result.paymentIntent,
          timestamp: new Date().toISOString(),
        };
        localStorage.setItem("bookingData", JSON.stringify(bookingData));
        if (onSuccess) onSuccess(result.paymentIntent);
      }
    } catch (err) {
      console.error("Payment submission error:", err);
      setErrorMessage(err.message);
      if (onError) onError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!mounted) {
    return <div>Loading payment form...</div>;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="mb-4">
        <PaymentElement
          onReady={() => setMounted(true)}
          options={{
            layout: "tabs",
          }}
        />
      </div>
      {errorMessage && (
        <div className="mt-2 text-sm text-red-500">{errorMessage}</div>
      )}
      <button
        type="submit"
        disabled={loading || !mounted || !stripe || !elements}
        className="w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-[16px] font-medium text-white bg-[#668E73] hover:bg-opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#668E73] disabled:bg-gray-300 disabled:cursor-not-allowed"
      >
        {loading ? t("paymentForm.processing") : t("paymentForm.payNow")}
      </button>
    </form>
  );
};

export default PaymentForm;
