import React, { useState } from "react";
import { useTranslation } from 'react-i18next';
import { PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";

const PaymentForm = ({ onSuccess, onError }) => {
  const { t } = useTranslation();
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  // Debug logs for initialization
  // console.log('PaymentForm Debug:', {
  //   stripeLoaded: !!stripe,
  //   elementsLoaded: !!elements,
  //   isLoading: loading,
  //   currentError: errorMessage
  // });

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!stripe || !elements) {
      // console.error("PaymentForm Error: Stripe or Elements not initialized", {
      //   stripeAvailable: !!stripe,
      //   elementsAvailable: !!elements
      // });
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      // console.log("Attempting payment confirmation...");
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/booking-confirmation`,
        },
        redirect: "if_required",
      });

      if (error) {
        // console.error("Payment confirmation error:", {
        //   errorType: error.type,
        //   errorMessage: error.message,
        //   errorCode: error.code,
        //   fullError: error
        // });
        setErrorMessage(error.message);
        if (onError) onError(error.message);
      } else if (paymentIntent && paymentIntent.status === "succeeded") {
        // console.log("Payment succeeded:", {
        //   paymentIntentId: paymentIntent.id,
        //   status: paymentIntent.status,
        //   amount: paymentIntent.amount
        // });
        
        const bookingData = {
          paymentIntent,
          timestamp: new Date().toISOString(),
        };
        localStorage.setItem("bookingData", JSON.stringify(bookingData));
        if (onSuccess) onSuccess(paymentIntent);
      } else {
        // console.log("Payment state:", { paymentIntent });
      }
    } catch (err) {
      console.error("Payment submission error:", {
        error: err,
        message: err.message,
        stack: err.stack
      });
      setErrorMessage(err.message);
      if (onError) onError(err.message);
    } finally {
      setLoading(false);
      // console.log("Payment attempt completed, loading state reset");
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