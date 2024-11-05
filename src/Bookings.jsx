import React, { useState, useEffect } from "react";
import axios from "axios";
import { Elements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import PaymentForm from "./components/PaymentForm";

// Initialize Stripe
const stripePromise = loadStripe(
  "pk_test_51QHmafIhkftuEy3nUnQeADHtSgrHJDHFtkQDfKK7dtkN8XwYw4qImtQTAgGiV0o9TR2m2DZfHhc4VmugNUw0pEuF009YsiV98I"
); // Replace with your key

// Create API instance
const api = axios.create({
  baseURL: "http://localhost:3000/api",
  headers: {
    "Content-Type": "application/json",
  },
});

const BookingForm = () => {
  const [formData, setFormData] = useState({
    arrivalDate: "",
    departureDate: "",
    channelId: 3960043,
    apartmentId: 2402388,
    arrivalTime: "",
    departureTime: "",
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    notice: "",
    adults: 1,
    children: 0,
    price: "",
    priceStatus: 1,
    deposit: 0,
    depositStatus: 1,
    language: "en",
  });

  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [dailyRates, setDailyRates] = useState({});
  const [priceDetails, setPriceDetails] = useState(null);
  const [showPayment, setShowPayment] = useState(false);
  const [clientSecret, setClientSecret] = useState(null);

  const fetchRates = async (apartmentId, startDate, endDate) => {
    if (!apartmentId || !startDate || !endDate) return;

    setLoading(true);
    try {
      const response = await api.get("/rates", {
        params: {
          apartments: [apartmentId],
          start_date: startDate,
          end_date: endDate,
          adults: formData.adults,
          children: formData.children,
        },
      });

      console.log("Rates response:", response.data);

      if (response.data.data && response.data.data[apartmentId]) {
        setDailyRates(response.data.data[apartmentId]);
        setPriceDetails(response.data.priceDetails);

        setFormData((prevData) => ({
          ...prevData,
          price: response.data.priceDetails?.finalPrice || 0,
        }));

        setError(null);
      } else {
        setError("No rates found for the selected dates");
        setFormData((prevData) => ({
          ...prevData,
          price: 0,
        }));
        setPriceDetails(null);
      }
    } catch (err) {
      console.error("Error fetching rates:", err);
      setError(
        err.response?.data?.error ||
          "Could not fetch rates. Please try again later."
      );
      setFormData((prevData) => ({
        ...prevData,
        price: 0,
      }));
      setPriceDetails(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (formData.arrivalDate && formData.departureDate) {
      fetchRates(
        formData.apartmentId,
        formData.arrivalDate,
        formData.departureDate
      );
    }
  }, [
    formData.apartmentId,
    formData.arrivalDate,
    formData.departureDate,
    formData.adults,
    formData.children,
  ]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prevData) => ({
      ...prevData,
      [name]: value,
    }));
  };

const handleSubmit = async (e) => {
  e.preventDefault();

  setLoading(true);
  try {
    console.log("Submitting booking data:", formData);
    const response = await api.post("/create-payment-intent", {
      price: formData.price,
      bookingData: {
        ...formData,
        price: Number(formData.price),
        adults: Number(formData.adults),
        children: Number(formData.children),
        deposit: Number(formData.deposit),
      },
    });

    console.log("Payment intent created:", response.data);
    setClientSecret(response.data.clientSecret);
    setShowPayment(true);
    setError(null);
  } catch (err) {
    console.error("Error:", err);
    setError(err.response?.data?.error || "An error occurred");
  } finally {
    setLoading(false);
  }
};

  const handlePaymentSuccess = () => {
    setSuccessMessage("Payment successful! Your booking is confirmed.");
    setShowPayment(false);
    // Optionally redirect to confirmation page
    // window.location.href = '/booking-confirmation';
  };

  const handlePaymentError = (errorMessage) => {
    setError(`Payment failed: ${errorMessage}`);
  };

  const renderPriceDetails = () => {
    if (!priceDetails) return null;

    return (
      <div className="mt-4 p-4 bg-gray-50 rounded-lg">
        <h3 className="font-bold mb-2">Price Breakdown:</h3>
        {priceDetails.priceElements.map((element, index) => (
          <div
            key={index}
            className={`flex justify-between items-center ${
              element.type === "longStayDiscount" ? "text-green-600" : ""
            } ${element.amount < 0 ? "text-green-600" : ""}`}
          >
            <span>{element.name}</span>
            <span>
              {Math.abs(element.amount).toFixed(2)} {element.currencyCode}
            </span>
          </div>
        ))}
        <div className="mt-2 pt-2 border-t border-gray-200 font-bold flex justify-between items-center">
          <span>Final Price</span>
          <span>{priceDetails.finalPrice.toFixed(2)} EUR</span>
        </div>
        {priceDetails.discount > 0 && (
          <div className="mt-2 text-sm text-green-600">
            Youre saving {priceDetails.discount.toFixed(2)} EUR with our length
            of stay discount!
          </div>
        )}
      </div>
    );
  };

  const renderBookingForm = () => (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">
            First Name
            <input
              type="text"
              name="firstName"
              value={formData.firstName}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              required
            />
          </label>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Last Name
            <input
              type="text"
              name="lastName"
              value={formData.lastName}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              required
            />
          </label>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Email
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              required
            />
          </label>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Phone
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              required
            />
          </label>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Arrival Date
            <input
              type="date"
              name="arrivalDate"
              value={formData.arrivalDate}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              required
            />
          </label>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Departure Date
            <input
              type="date"
              name="departureDate"
              value={formData.departureDate}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              required
            />
          </label>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Number of Adults
            <input
              type="number"
              name="adults"
              value={formData.adults}
              onChange={handleChange}
              min="1"
              max="4"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              required
            />
          </label>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Number of Children
            <input
              type="number"
              name="children"
              value={formData.children}
              onChange={handleChange}
              min="0"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </label>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">
          Notes
          <textarea
            name="notice"
            value={formData.notice}
            onChange={handleChange}
            rows="3"
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          />
        </label>
      </div>

      {renderPriceDetails()}

      <button
        type="submit"
        disabled={loading || !formData.price}
        className="w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-300 disabled:cursor-not-allowed"
      >
        {loading ? "Processing..." : "Proceed to Payment"}
      </button>
    </form>
  );

  const renderPaymentForm = () => (
    <div className="mt-8">
      <h3 className="text-lg font-medium mb-4">Complete your payment</h3>
      {clientSecret && (
        <Elements stripe={stripePromise} options={{ clientSecret }}>
          <PaymentForm
            onSuccess={handlePaymentSuccess}
            onError={handlePaymentError}
          />
        </Elements>
      )}
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h2 className="text-2xl font-bold mb-4">Book Your Stay</h2>
      {error && <p className="text-red-500 mb-4">{error}</p>}
      {successMessage && (
        <p className="text-green-500 mb-4">{successMessage}</p>
      )}
      {loading && <p className="text-blue-500 mb-4">Loading...</p>}

      {!showPayment ? renderBookingForm() : renderPaymentForm()}
    </div>
  );
};

export default BookingForm;
