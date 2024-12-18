import React, { useState } from "react";
import { PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { useTranslation } from 'react-i18next';

const PaymentForm = ({ onSuccess, onError }) => {
  const { t } = useTranslation();
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!stripe || !elements) {
      console.log(t('paymentForm.notLoaded'));
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/booking-confirmation`,
        },
        redirect: "if_required",
      });

      if (error) {
        console.error("Payment error:", error);
        setErrorMessage(error.message || t('paymentForm.errors.generic'));
        if (onError) onError(error.message);
      } else if (paymentIntent && paymentIntent.status === "succeeded") {
        const bookingData = {
          paymentIntent,
          timestamp: new Date().toISOString(),
        };
        localStorage.setItem("bookingData", JSON.stringify(bookingData));
        if (onSuccess) onSuccess(paymentIntent);
      }
    } catch (err) {
      console.error("Payment error:", err);
      setErrorMessage(err.message || t('paymentForm.errors.generic'));
      if (onError) onError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="mb-4">
        <PaymentElement />
      </div>
      {errorMessage && (
        <div className="mt-2 text-sm text-red-500">{errorMessage}</div>
      )}
      <button
        type="submit"
        disabled={loading || !stripe || !elements}
        className="w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-[16px] font-medium text-white bg-[#668E73] hover:bg-opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#668E73] disabled:bg-gray-300 disabled:cursor-not-allowed"
      >
        {loading ? t('paymentForm.processing') : t('paymentForm.payNow')}
      </button>
    </form>
  );
};

export default PaymentForm;