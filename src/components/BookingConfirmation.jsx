import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

const BookingConfirmation = () => {
  const [status, setStatus] = useState("loading");
  const [searchParams] = useSearchParams();
  const paymentIntent = searchParams.get("payment_intent");

  useEffect(() => {
    if (paymentIntent) {
      setStatus("success");
    }
  }, [paymentIntent]);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-center">
          <h2 className="text-xl font-semibold">Processing your booking...</h2>
          <p className="mt-2 text-gray-600">
            Please wait while we confirm your payment.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-lg p-8">
        <div className="text-center">
          <div className="mb-6">
            <svg
              className="mx-auto h-12 w-12 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>

          <h1 className="text-3xl font-bold text-green-600 mb-4">
            Booking Confirmed!
          </h1>

          <p className="text-lg text-gray-600 mb-8">
            Thank you for your booking. Weve sent a confirmation email with all
            the details.
          </p>

          <div className="bg-gray-50 rounded-lg p-6 mb-8">
            <h3 className="text-lg font-semibold mb-2">Whats Next?</h3>
            <ul className="text-left space-y-3">
              <li className="flex items-start">
                <svg
                  className="h-6 w-6 text-green-500 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                  />
                </svg>
                Check your email for booking confirmation details
              </li>
              <li className="flex items-start">
                <svg
                  className="h-6 w-6 text-green-500 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                Save the check-in and check-out dates to your calendar
              </li>
              <li className="flex items-start">
                <svg
                  className="h-6 w-6 text-green-500 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z"
                  />
                </svg>
                Contact us if you have any questions
              </li>
            </ul>
          </div>

          <div className="space-x-4">
            <button
              onClick={() => (window.location.href = "/")}
              className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Return Home
            </button>
            <button
              onClick={() => window.print()}
              className="inline-flex items-center px-6 py-3 border border-gray-300 text-base font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Print Confirmation
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BookingConfirmation;
