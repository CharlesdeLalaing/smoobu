import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { Elements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import PaymentForm from "./components/PaymentForm";
import StripeWrapper from "./components/StripeWrapper";
import {
  extraCategories,
  calculateExtrasTotal,
} from "./components/extraCategories";

import Calendar from "./assets/icons8-calendar-50.png";
import Group from "./assets/icons8-group-48.png";

// Initialize Stripe
const stripePromise = loadStripe(
  "pk_test_51QHmafIhkftuEy3nUnQeADHtSgrHJDHFtkQDfKK7dtkN8XwYw4qImtQTAgGiV0o9TR2m2DZfHhc4VmugNUw0pEuF009YsiV98I"
);

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
    street: "",
    postalCode: "",
    location: "",
    country: "",
  });


  const [currentStep, setCurrentStep] = useState(1); // Step state
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isAvailable, setIsAvailable] = useState(false);
  const [showPriceDetails, setShowPriceDetails] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [dailyRates, setDailyRates] = useState({});
  const [priceDetails, setPriceDetails] = useState(null);
  const [showPayment, setShowPayment] = useState(false);
  const [clientSecret, setClientSecret] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("packs");
  const [selectedExtras, setSelectedExtras] = useState({});
  const [showExtras, setShowExtras] = useState(false);
  const [showContact, setShowContact] = useState(true);
  const [showInfoSup, setShowInfoSup] = useState(false);
  const [coupon, setCoupon] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponError, setCouponError] = useState(null);
  



  // Toggle contact section and close others if open
  const toggleContact = () => {
    setShowContact((prev) => {
      const isOpening = !prev;
      if (isOpening) {
        setShowExtras(false);
        setShowInfoSup(false);
      }
      return isOpening;
    });
  };

  // Toggle extras section and close others if open
  const toggleExtras = () => {
    setShowExtras((prev) => {
      const isOpening = !prev;
      if (isOpening) {
        setShowContact(false);
        setShowInfoSup(false);
      }
      return isOpening;
    });
  };

  // Toggle infoSup section and close others if open
  const toggleInfoSup = () => {
    setShowInfoSup((prev) => {
      const isOpening = !prev;
      if (isOpening) {
        setShowContact(false);
        setShowExtras(false);
      }
      return isOpening;
    });
  };

  const VALID_COUPONS = {
    TESTDISCOUNT: {
      discount: 10,
      type: "fixed", // 'fixed' for euro amount, 'percentage' for percentage discount
      currency: "EUR",
    },
    // Add more coupons as needed
  };

  const arrivalDateRef = useRef(null);
  const departureDateRef = useRef(null);

  const openArrivalDatePicker = () => arrivalDateRef.current?.showPicker();
  const openDepartureDatePicker = () => departureDateRef.current?.showPicker();

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const day = date.getDate();
    const month = date.getMonth() + 1;
    const year = date.getFullYear().toString().slice(-2);
    return `${day}.${month}.${year}`;
  };

const createSelectedExtrasArray = () => {
  return Object.entries(selectedExtras)
    .filter(([_, quantity]) => quantity > 0)
    .map(([extraId, quantity]) => {
      // Check if this is an extra person selection
      const isExtraPerson = extraId.endsWith("-extra");
      const baseExtraId = isExtraPerson
        ? extraId.replace("-extra", "")
        : extraId;

      // Find the extra in all categories
      const extra = Object.values(extraCategories)
        .flatMap((category) => category.items)
        .find((item) => item.id === baseExtraId);

      if (!extra) return null;

      // Return extra person details only when it's an extra person selection
      if (isExtraPerson) {
        return {
          type: "addon",
          name: `${extra.name} - Personne supplémentaire`,
          amount: extra.extraPersonPrice * quantity,
          quantity: quantity,
          currencyCode: "EUR",
        };
      }

      // For regular extras, include extra person info in the same object
      const extraPersonQuantity = selectedExtras[`${extraId}-extra`] || 0;
      return {
        type: "addon",
        name: extra.name,
        amount: extra.price * quantity,
        quantity: quantity,
        currencyCode: "EUR",
        extraPersonPrice: extra.extraPersonPrice,
        extraPersonQuantity: extraPersonQuantity,
        // Include extra person amount in a separate field if there are extra persons
        extraPersonAmount:
          extraPersonQuantity > 0
            ? extra.extraPersonPrice * extraPersonQuantity
            : 0,
      };
    })
    .filter(Boolean); // Remove any null entries
};

  const handleExtraChange = (extraId, quantity) => {
    // Prevent event bubbling just in case
    event?.preventDefault?.();
    if (quantity < 0) return;
    setSelectedExtras((prev) => ({
      ...prev,
      [extraId]: quantity,
    }));
  };

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

      if (response.data.data && response.data.data[apartmentId]) {
        setPriceDetails(response.data.priceDetails);
        setFormData((prevData) => ({
          ...prevData,
          price: response.data.priceDetails?.finalPrice || 0,
        }));
        setIsAvailable(true);
        setShowPriceDetails(true);
        setError(null);
      } else {
        setIsAvailable(false);
        setShowPriceDetails(false);
        setError("Aucun tarif trouvé pour les dates sélectionnées");
        setPriceDetails(null);
      }
    } catch (err) {
      setIsAvailable(false);
      setShowPriceDetails(false);
      setError(
        err.response?.data?.error ||
          "Impossible de récupérer les tarifs. Veuillez réessayer plus tard."
      );
      setPriceDetails(null);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckAvailability = () => {
    fetchRates(
      formData.apartmentId,
      formData.arrivalDate,
      formData.departureDate
    );
  };

  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name === "arrivalDate" || name === "departureDate") {
      setShowPriceDetails(false);
    }

    setFormData((prevData) => ({
      ...prevData,
      [name]: value,
    }));
  };

const handleSubmit = async (e) => {
  e.preventDefault();
  if (!formData.price) {
    setError("Veuillez attendre le calcul du prix avant de continuer.");
    return;
  }
  setLoading(true);
  try {
    const selectedExtrasArray = createSelectedExtrasArray();

    // Calculate total with extras
    const extrasTotal = selectedExtrasArray.reduce(
      (sum, extra) => sum + extra.amount + (extra.extraPersonAmount || 0),
      0
    );

    const basePrice = priceDetails.originalPrice;
    const subtotalBeforeDiscounts = basePrice + extrasTotal; // 400 + 105 = 505

    // Apply long stay discount
    const longStayDiscount = priceDetails.discount || 0; // 160
    // Apply coupon discount
    const couponDiscount = appliedCoupon ? appliedCoupon.discount : 0; // 10

    // Calculate final total by subtracting both discounts
    const finalTotal =
      subtotalBeforeDiscounts - longStayDiscount - couponDiscount;
    // 505 - 160 - 10 = 335

    console.log("Price calculation:", {
      basePrice,
      extrasTotal,
      subtotalBeforeDiscounts,
      longStayDiscount,
      couponDiscount,
      finalTotal,
    });

    const response = await api.post("/create-payment-intent", {
      price: finalTotal, // Using the correct final total
      bookingData: {
        ...formData,
        price: finalTotal, // Using the correct final total here too
        basePrice: basePrice,
        extras: selectedExtrasArray,
        couponApplied: appliedCoupon
          ? {
              code: appliedCoupon.code,
              discount: couponDiscount,
            }
          : null,
        priceDetails: {
          ...priceDetails,
          finalPrice: finalTotal,
          calculatedDiscounts: {
            longStay: longStayDiscount,
            coupon: couponDiscount,
          },
        },
        metadata: {
          basePrice: basePrice.toString(),
          extrasTotal: extrasTotal.toString(),
          longStayDiscount: longStayDiscount.toString(),
          couponDiscount: couponDiscount.toString(),
        },
      },
    });

    console.log("Payment intent created:", response.data);
    setClientSecret(response.data.clientSecret);
    setShowPayment(true);
    setError(null);
  } catch (err) {
    console.error("Error:", err);
    setError(err.response?.data?.error || "Une erreur s'est produite");
  } finally {
    setLoading(false);
  }
};


const handlePaymentSuccess = () => {
  const selectedExtrasArray = createSelectedExtrasArray();

  // Calculate the total price using the current values
  const extrasTotal = selectedExtrasArray.reduce(
    (sum, extra) => sum + extra.amount,
    0
  );

  const subtotal = priceDetails.finalPrice + extrasTotal;
  const couponDiscount = appliedCoupon ? appliedCoupon.discount : 0;
  const finalTotal = subtotal - couponDiscount;

  // Pass booking data through localStorage
  const bookingData = {
    ...formData,
    extras: selectedExtrasArray,
    priceDetails: priceDetails,
    totalPrice: finalTotal,
  };

  // Store booking data in localStorage before redirect
  localStorage.setItem("bookingData", JSON.stringify(bookingData));

  // Get paymentIntent from clientSecret (it's the first part before the _secret)
  const paymentIntent = clientSecret.split("_secret")[0];

  // Redirect to confirmation page
  window.location.href = `/booking-confirmation?payment_intent=${paymentIntent}`;
};



  //  const verifyAndApplyCoupon = async (couponCode, reservationId) => {
  //    try {
  //      // First create a coupon price element
  //      const response = await api.post(
  //        `/reservations/${reservationId}/price-elements`,
  //        {
  //          type: "coupon",
  //          name: `Coupon ${couponCode}`,
  //          amount: 0, // Initial amount, will be calculated based on the response
  //          currencyCode: "EUR",
  //        }
  //      );

  //      // Get updated price elements to see the applied coupon
  //      const priceElementsResponse = await api.get(
  //        `/reservations/${reservationId}/price-elements`
  //      );

  //      // Find the coupon in the price elements
  //      const couponElement = priceElementsResponse.data.priceElements.find(
  //        (element) => element.type === "coupon"
  //      );

  //      if (couponElement) {
  //        setAppliedCoupon({
  //          id: couponElement.id,
  //          code: couponCode,
  //          amount: Math.abs(couponElement.amount),
  //          type: "fixed",
  //        });
  //        return true;
  //      }

  //      return false;
  //    } catch (error) {
  //      console.error("Error applying coupon:", error);
  //      return false;
  //    }
  //  };

  const handleApplyCoupon = () => {
     setCouponError(null);

     if (!coupon) {
       setCouponError("Veuillez entrer un code promo");
       return;
     }

     const couponInfo = VALID_COUPONS[coupon.toUpperCase()];

     if (!couponInfo) {
       setCouponError("Code promo invalide");
       return;
     }

     setAppliedCoupon({
       code: coupon.toUpperCase(),
       ...couponInfo,
     });

     // Update price details to include coupon
     setPriceDetails((prev) => ({
       ...prev,
       priceElements: [
         ...(prev?.priceElements || []),
         {
           type: "coupon",
           name: `Code promo ${coupon.toUpperCase()}`,
           amount: -couponInfo.discount,
           currencyCode: couponInfo.currency,
         },
       ],
     }));

     setCoupon(""); // Clear input
  };

   // Then add the coupon input UI in your form, before the submit button:

const renderPriceDetails = () => {
  if (!priceDetails) return null;

  const selectedExtrasDetails = Object.entries(selectedExtras)
    .filter(([_, quantity]) => quantity > 0)
    .map(([extraId, quantity]) => {
      const isExtraPerson = extraId.endsWith("-extra");
      const baseExtraId = isExtraPerson
        ? extraId.replace("-extra", "")
        : extraId;
      const extra = Object.values(extraCategories)
        .flatMap((category) => category.items)
        .find((item) => item.id === baseExtraId);
      if (!extra) return null;
      return {
        name: isExtraPerson
          ? `${extra.name} - Personne supplémentaire`
          : extra.name,
        quantity: quantity,
        price: isExtraPerson ? extra.extraPersonPrice : extra.price,
        total:
          (isExtraPerson ? extra.extraPersonPrice : extra.price) * quantity,
      };
    })
    .filter(Boolean);

  // Calculate initial total with extras
  const extrasTotal = selectedExtrasDetails.reduce(
    (sum, extra) => sum + extra.total,
    0
  );

  // Base price + extras before any discounts
  const subtotalBeforeDiscounts = priceDetails.originalPrice + extrasTotal;

  // IMPORTANT: Make sure these are treated as reductions
  const longStayDiscount = Math.abs(priceDetails.discount || 0); // Use Math.abs to ensure positive number
  const couponDiscount = appliedCoupon ? Math.abs(appliedCoupon.discount) : 0;

  // Subtract both discounts from the subtotal
  const finalTotal =
    subtotalBeforeDiscounts - longStayDiscount - couponDiscount;

  console.log("Calculation breakdown:", {
    basePrice: priceDetails.originalPrice,
    extrasTotal,
    subtotalBeforeDiscounts,
    longStayDiscount,
    couponDiscount,
    finalTotal,
  });

  return (
    <div className="p-4 mt-4 rounded-lg bg-gray-50">
      <h3 className="mb-2 font-bold">Détail des prix:</h3>

      {/* Base price */}
      <div className="flex items-center justify-between">
        <span>Prix de base</span>
        <span>{priceDetails.originalPrice.toFixed(2)} EUR</span>
      </div>

      {/* Extras */}
      {selectedExtrasDetails.map((extra, index) => (
        <div
          key={index}
          className="flex items-center justify-between text-gray-600"
        >
          <span>
            {extra.name} ({extra.quantity}x)
          </span>
          <span>{extra.total.toFixed(2)} EUR</span>
        </div>
      ))}

      {/* Long stay discount */}
      {longStayDiscount > 0 && (
        <div className="flex items-center justify-between text-green-600">
          <span>
            Réduction long séjour (
            {priceDetails.settings.lengthOfStayDiscount.discountPercentage}%)
          </span>
          <span>-{longStayDiscount.toFixed(2)} EUR</span>
        </div>
      )}

      {/* Coupon discount */}
      {couponDiscount > 0 && (
        <div className="flex items-center justify-between text-green-600">
          <span>Code promo ({appliedCoupon.code})</span>
          <span>-{couponDiscount.toFixed(2)} EUR</span>
        </div>
      )}

      {/* Final total */}
      <div className="flex items-center justify-between pt-2 mt-4 font-bold border-t border-gray-200">
        <span>Total</span>
        <span>{finalTotal.toFixed(2)} EUR</span>
      </div>
    </div>
  );
};

  const nextStep = () => setCurrentStep((prev) => Math.min(prev + 1, 3));
  const prevStep = () => setCurrentStep((prev) => Math.max(prev - 1, 1));

  const renderProgressBar = () => (
    <div className="flex justify-between items-center text-center mb-4">
      <div className="w-3/5 md:w-3/5 lg:w-4/5 h-2 bg-gray-300 rounded">
        <div
          className={`h-2 rounded ${
            currentStep === 1 ? "w-1/3" : currentStep === 2 ? "w-2/3" : "w-full"
          } bg-[#668E73]`}
        ></div>
      </div>
      <span className="w-2/5 md:w-2/5 lg:w-1/5 ml-2 text-sm text-[#668E73]">
        Étape {currentStep} sur 3
      </span>
    </div>
  );

  const renderContactSection = () => (
    <div>
      <div className="mt-6 space-y-8 w-full">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {/* Contact form fields */}
                <div>
                  <label className="block text-[14px] md:text-[16px] font-medium text-[#9a9a9a] mb-1">
                    Prénom*
                    <input
                      type="text"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleChange}
                      placeholder="Prénom"
                      className="mt-1 block w-full rounded border-[#668E73] border text-[14px] md:text-[16px] placeholder:text-[14px] md:placeholder:text-[16px] shadow-sm focus:border-[#668E73] focus:ring-1 focus:ring-[#668E73] text-black bg-white h-12 p-2"
                      required
                    />
                  </label>
                </div>

                {/* Last Name */}
                <div>
                  <label className="block text-[14px] md:text-[16px] font-medium text-[#9a9a9a] mb-1">
                    Nom*
                    <input
                      type="text"
                      name="lastName"
                      value={formData.lastName}
                      onChange={handleChange}
                      placeholder="Nom"
                      className="mt-1 block w-full rounded border-[#668E73] border text-[14px] md:text-[16px] placeholder:text-[14px] md:placeholder:text-[16px] shadow-sm focus:border-[#668E73] focus:ring-1 focus:ring-[#668E73] text-black bg-white h-12 p-2"
                      required
                    />
                  </label>
                </div>

                {/* Email */}
                <div>
                  <label className="block text-[14px] md:text-[16px] font-medium text-[#9a9a9a] mb-1">
                    Email*
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      placeholder="Email"
                      className="mt-1 block w-full rounded border-[#668E73] border text-[14px] md:text-[16px] placeholder:text-[14px] md:placeholder:text-[16px] shadow-sm focus:border-[#668E73] focus:ring-1 focus:ring-[#668E73] text-black bg-white h-12 p-2"
                      required
                    />
                  </label>
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-[14px] md:text-[16px] font-medium text-[#9a9a9a] mb-1">
                    Téléphone
                    <input
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                      placeholder="Téléphone"
                      className="mt-1 block w-full rounded border-[#668E73] border text-[14px] md:text-[16px] placeholder:text-[14px] md:placeholder:text-[16px] shadow-sm focus:border-[#668E73] focus:ring-1 focus:ring-[#668E73] text-black bg-white h-12 p-2"
                    />
                  </label>
                </div>

                {/* Street */}
                <div>
                  <label className="block text-[14px] md:text-[16px] font-medium text-[#9a9a9a] mb-1">
                    Rue/numéro
                    <input
                      type="text"
                      name="street"
                      value={formData.street}
                      onChange={handleChange}
                      placeholder="Rue/Numéro"
                      className="mt-1 block w-full rounded border-[#668E73] border text-[14px] md:text-[16px] placeholder:text-[14px] md:placeholder:text-[16px] shadow-sm focus:border-[#668E73] focus:ring-1 focus:ring-[#668E73] text-black bg-white h-12 p-2"
                    />
                  </label>
                </div>

                {/* Postal Code */}
                <div>
                  <label className="block text-[14px] md:text-[16px] font-medium text-[#9a9a9a] mb-1">
                    Code postal
                    <input
                      type="number"
                      name="postalCode"
                      value={formData.postalCode}
                      onChange={handleChange}
                      placeholder="Code postal"
                      className="mt-1 block w-full rounded border-[#668E73] border text-[14px] md:text-[16px] placeholder:text-[14px] md:placeholder:text-[16px] shadow-sm focus:border-[#668E73] focus:ring-1 focus:ring-[#668E73] text-black bg-white h-12 p-2"
                    />
                  </label>
                </div>

                {/* City */}
                <div>
                  <label className="block text-[14px] md:text-[16px] font-medium text-[#9a9a9a] mb-1">
                    Ville
                    <input
                      type="text"
                      name="location"
                      value={formData.location}
                      onChange={handleChange}
                      placeholder="Ville"
                      className="mt-1 block w-full rounded border-[#668E73] border text-[14px] md:text-[16px] placeholder:text-[14px] md:placeholder:text-[16px] shadow-sm focus:border-[#668E73] focus:ring-1 focus:ring-[#668E73] text-black bg-white h-12 p-2"
                    />
                  </label>
                </div>

                {/* Country */}
                <div>
                  <label className="block text-[14px] md:text-[16px] font-medium text-[#9a9a9a] mb-1">
                    Pays
                    <input
                      type="text"
                      name="country"
                      value={formData.country}
                      onChange={handleChange}
                      placeholder="Pays"
                      className="mt-1 block w-full rounded border-[#668E73] border text-[14px] md:text-[16px] placeholder:text-[14px] md:placeholder:text-[16px] shadow-sm focus:border-[#668E73] focus:ring-1 focus:ring-[#668E73] text-black bg-white h-12 p-2"
                    />
                  </label>
                </div>

                {/* Check-in */}
                <div>
                  <label className="block text-[14px] md:text-[16px] font-medium text-[#9a9a9a] mb-1">
                    Check-in*
                    <select
                      name="arrivalTime"
                      value={formData.arrivalTime}
                      onChange={handleChange}
                      className="mt-1 block w-full rounded border-[#668E73] border text-[14px] md:text-[16px] placeholder:text-[14px] md:placeholder:text-[16px] shadow-sm focus:border-[#668E73] focus:ring-1 focus:ring-[#668E73] text-black bg-white h-12 p-2 appearance-none"
                      required
                      style={{
                        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20'%3E%3Cpath fill='green' d='M5.23 7.21a.75.75 0 011.06 0L10 10.92l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.23 8.27a.75.75 0 010-1.06z'/%3E%3C/svg%3E")`,
                        backgroundPosition: "right 0.5rem center",
                        backgroundRepeat: "no-repeat",
                        backgroundSize: "1.5rem 1.5rem",
                      }}
                    >
                      <option value="">Heure d'arrivée</option>
                      <option value="17:00">17:00</option>
                      <option value="17:30">17:30</option>
                      <option value="18:00">18:00</option>
                      <option value="18:30">18:30</option>
                      <option value="19:00">19:00</option>
                      <option value="19:30">19:30</option>
                      <option value="20:00">20:00</option>
                      <option value="20:30">20:30</option>
                      <option value="21:00">21:00</option>
                      <option value="21:30">21:30</option>
                      <option value="22:00">22:00</option>
                      <option value="22:30">22:30</option>
                      <option value="23:00">23:00</option>
                    </select>
                  </label>
                </div>

              </div>
        </div>
    </div>
  );

  const renderExtrasSection = () => (
    <div>
      <div className="mt-6 space-y-8 w-full">
          <div className="flex flex-wrap gap-3">
            {Object.entries(extraCategories).map(([key, category]) => (
              <button
                key={key}
                type="button"
                onClick={() => setSelectedCategory(key)}
                className={`px-4 py-2 rounded-lg transition-all text-[14px] font-bolder ${
                  selectedCategory === key
                    ? "bg-[#668E73] text-white"
                    : "bg-[#668E73] bg-opacity-10 text-[#668E73] hover:bg-opacity-20"
                }`}
              >
                {category.name}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-1 lg:grid-cols-2">
            {extraCategories[selectedCategory].items.map((item) => (
              <div
                key={item.id}
                className="flex items-start gap-4 p-4 transition-shadow bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md"
              >
                <img
                  src={item.image}
                  alt={item.name}
                  className="object-cover w-24 h-24 rounded-lg"
                />
                <div className="flex-grow space-y-2">
                  <div className="flex items-start justify-between">
                    <h3 className="text-[16px] font-medium text-gray-900">
                      {item.name}
                    </h3>
                    <div className="bg-[#668E73] px-3 py-1 rounded text-white text-[14px] font-medium">
                      {item.price}€
                    </div>
                  </div>
                  <p className="text-[14px] text-gray-600 line-clamp-2">
                    {item.description}
                  </p>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        const newQuantity = (selectedExtras[item.id] || 0) - 1;
                        handleExtraChange(item.id, newQuantity);
                        // Si on supprime l'extra complètement, supprimer aussi les personnes supplémentaires
                        if (newQuantity === 0) {
                          handleExtraChange(`${item.id}-extra`, 0);
                        }
                      }}
                      disabled={(selectedExtras[item.id] || 0) === 0}
                      className="w-8 h-8 flex items-center justify-center rounded-full border-2 border-[#668E73] text-[#668E73] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#668E73] hover:text-white transition-colors"
                    >
                      -
                    </button>
                    <span className="w-8 font-medium text-center text-gray-900">
                      {selectedExtras[item.id] || 0}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        handleExtraChange(
                          item.id,
                          (selectedExtras[item.id] || 0) + 1
                        )
                      }
                      className="w-8 h-8 flex items-center justify-center rounded-full border-2 border-[#668E73] text-[#668E73] hover:bg-[#668E73] hover:text-white transition-colors"
                    >
                      +
                    </button>
                  </div>

                  {/* Extra person selector - only show if item has extraPersonPrice AND base item is selected */}
                  {item.extraPersonPrice &&
                    (selectedExtras[item.id] || 0) > 0 && (
                      <div className="mt-2">
                        <p className="text-[14px] text-gray-600 mb-1">
                          Personne supplémentaire (+{item.extraPersonPrice}
                          €/pers)
                        </p>
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() =>
                              handleExtraChange(
                                `${item.id}-extra`,
                                (selectedExtras[`${item.id}-extra`] || 0) - 1
                              )
                            }
                            disabled={
                              (selectedExtras[`${item.id}-extra`] || 0) === 0
                            }
                            className="w-8 h-8 flex items-center justify-center rounded-full border-2 border-[#668E73] text-[#668E73] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#668E73] hover:text-white transition-colors"
                          >
                            -
                          </button>
                          <span className="w-8 font-medium text-center text-gray-900">
                            {selectedExtras[`${item.id}-extra`] || 0}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              handleExtraChange(
                                `${item.id}-extra`,
                                (selectedExtras[`${item.id}-extra`] || 0) + 1
                              )
                            }
                            className="w-8 h-8 flex items-center justify-center rounded-full border-2 border-[#668E73] text-[#668E73] hover:bg-[#668E73] hover:text-white transition-colors"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    )}
                </div>
              </div>
            ))}
          </div>
        </div>
    </div>
  );

  const renderInfoSupSection = () => (
    <div>
      <div className="mt-6 space-y-8 w-full">
              {/* Notes */}
              <div className="col-span-full">
                  <label className="block text-[14px] md:text-[16px] font-medium text-[#9a9a9a] mb-1">
                    Laissez un message pour le propriétaire
                    <textarea
                      name="notice"
                      value={formData.notice}
                      onChange={handleChange}
                      rows="3"
                      placeholder="Laissez un message pour le propriétaire"
                      className="mt-1 block w-full rounded border-[#668E73] border text-[16px] placeholder:text-[16px] shadow-sm focus:border-[#668E73] focus:ring-1 focus:ring-[#668E73] text-black bg-white p-2"
                    />
                  </label>
                </div>

              <div className="pt-4 mt-6 pb-4 mb-6 border-t border-b border-gray-200">
                <div className="flex items-end gap-4">
                  <div className="flex-grow">
                    <label className="block text-[14px] md:text-[16px] font-medium text-[#9a9a9a] mb-1">
                      Code promo
                      <input
                        type="text"
                        value={coupon}
                        onChange={(e) => setCoupon(e.target.value)}
                        placeholder="Entrez votre code promo"
                        className="mt-1 block w-full rounded border-[#668E73] border text-[14px] md:text-[16px] placeholder:text-[14px] md:placeholder:text-[16px] shadow-sm focus:border-[#668E73] focus:ring-1 focus:ring-[#668E73] text-black bg-white h-12 p-2"
                      />
                    </label>
                    {couponError && (
                      <p className="mt-1 text-sm text-red-500">{couponError}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={handleApplyCoupon}
                    className="h-12 px-6 rounded shadow-sm text-[16px] font-medium text-white bg-[#668E73] hover:bg-opacity-90 focus:outline-none"
                  >
                    Appliquer
                  </button>
                </div>
                {appliedCoupon && (
                  <div className="mt-2 text-sm text-green-600">
                    Code promo {appliedCoupon.code} appliqué : -
                    {appliedCoupon.discount}€
                  </div>
                )}
              </div>
        </div>
    </div>
  );

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return renderContactSection();
      case 2:
        return renderExtrasSection();
      case 3:
        return renderInfoSupSection();
      default:
        return null;
    }
  };

  const isStepValid = () => {
    if (currentStep === 1) {
      return (
        formData.firstName &&
        formData.lastName &&
        formData.email &&
        formData.arrivalTime
      );
    }
    if (currentStep === 2) {
      return true; // Adjust based on requirements for step 2
    }
    if (currentStep === 3) {
      return true; // Adjust based on requirements for step 3
    }
    return false;
  };



const renderPaymentForm = () => (
  <div className="mt-8">
    <h3 className="mb-4 text-lg font-medium">Finaliser votre paiement</h3>
    {clientSecret && (
      <StripeWrapper
        clientSecret={clientSecret}
        onSuccess={handlePaymentSuccess}
        onError= 'erreur oops'
      >
        <PaymentForm />
      </StripeWrapper>
    )}
  </div>
);

  return (
    <div className="p-6 mx-auto h-[100vh] w-full lg:w-[1024px] xl:w-[1440px]">
      <h1 className="mb-4 text-2xl font-bold">
        Réserver le Dôme des Libellules
      </h1>
      {error && <p className="mb-4 text-red-500">{error}</p>}
      {successMessage && (
        <p className="mb-4 text-green-500">{successMessage}</p>
      )}
      {loading && <p className="mb-4 text-blue-500">Chargement...</p>}

      {!showPayment ? (
        <form onSubmit={handleSubmit} className="mx-auto space-y-4">
          {/* Search Section */}
          <div className="border border-[#668E73] p-5 rounded space-y-4">
            <div className="grid grid-cols-1 gap-4 text-left md:grid-cols-4 lg:grid-cols-5">
              {/* Arrival Date */}
              <div className="relative">
                <label className="block text-[14px] md:text-[16px] font-medium text-[#9a9a9a] mb-1">
                  Arrivé
                  <div className="relative">
                    <input
                      type="date"
                      name="arrivalDate"
                      value={formData.arrivalDate}
                      onChange={handleChange}
                      ref={arrivalDateRef}
                      className="mt-1 block w-full rounded border-[#668E73] border text-[14px] md:text-[16px] placeholder:text-[14px] md:placeholder:text-[16px] shadow-sm focus:border-[#668E73] focus:ring-1 focus:ring-[#668E73] text-black bg-white h-12 p-2 pr-10"
                      required
                    />
                    <img
                      src={Calendar}
                      alt="Calendar Icon"
                      className="absolute w-6 h-6 transform -translate-y-1/2 cursor-pointer right-3 top-1/2"
                      onClick={openArrivalDatePicker}
                    />
                  </div>
                </label>
              </div>

              {/* Departure Date */}
              <div className="relative">
                <label className="block text-[14px] md:text-[16px] font-medium text-[#9a9a9a] mb-1">
                  Départ
                  <div className="relative">
                    <input
                      type="date"
                      name="departureDate"
                      value={formData.departureDate}
                      onChange={handleChange}
                      ref={departureDateRef}
                      className="mt-1 block w-full rounded border-[#668E73] border text-[14px] md:text-[16px] placeholder:text-[14px] md:placeholder:text-[16px] shadow-sm focus:border-[#668E73] focus:ring-1 focus:ring-[#668E73] text-black bg-white h-12 p-2 pr-10"
                      required
                    />
                    <img
                      src={Calendar}
                      alt="Calendar Icon"
                      className="absolute w-6 h-6 transform -translate-y-1/2 cursor-pointer right-3 top-1/2"
                      onClick={openDepartureDatePicker}
                    />
                  </div>
                </label>
              </div>

              {/* Adults Dropdown */}
              <div>
                <label className="block text-[14px] md:text-[16px] font-medium text-[#9a9a9a] mb-1">
                  Adultes
                  <select
                    name="adults"
                    value={formData.adults}
                    onChange={handleChange}
                    className="mt-1 block w-full rounded border-[#668E73] border text-[14px] md:text-[16px] shadow-sm focus:border-[#668E73] focus:ring-1 focus:ring-[#668E73] text-black bg-white h-12 p-2 appearance-none"
                    required
                    style={{
                      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20'%3E%3Cpath fill='%23668E73' d='M5.23 7.21a.75.75 0 011.06 0L10 10.92l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.23 8.27a.75.75 0 010-1.06z'/%3E%3C/svg%3E")`,
                      backgroundPosition: "right 0.5rem center",
                      backgroundRepeat: "no-repeat",
                      backgroundSize: "1.5rem 1.5rem",
                    }}
                  >
                    {[...Array(10)].map((_, i) => (
                      <option key={i + 1} value={i + 1} >
                        {i + 1}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {/* Children Dropdown */}
              <div>
                <label className="block text-[14px] md:text-[16px] font-medium text-[#9a9a9a] mb-1">
                  Enfants
                  <select
                    name="children"
                    value={formData.children}
                    onChange={handleChange}
                    className="mt-1 block w-full rounded border-[#668E73] border text-[14px] md:text-[16px] shadow-sm focus:border-[#668E73] focus:ring-1 focus:ring-[#668E73] text-black bg-white h-12 p-2 appearance-none"
                    style={{
                      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20'%3E%3Cpath fill='%23668E73' d='M5.23 7.21a.75.75 0 011.06 0L10 10.92l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.23 8.27a.75.75 0 010-1.06z'/%3E%3C/svg%3E")`,
                      backgroundPosition: "right 0.5rem center",
                      backgroundRepeat: "no-repeat",
                      backgroundSize: "1.5rem 1.5rem",
                    }}
                  >
                    {[...Array(11)].map((_, i) => (
                      <option key={i} value={i}>
                        {i}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {/* Check Availability Button */}
              <div className="block align-baseline">
                <button
                  type="button"
                  onClick={handleCheckAvailability}
                  className="w-full h-12 p-2 mt-7 border rounded shadow-sm text-[16px] font-medium text-white bg-[#668E73] hover:bg-opacity-90 focus:outline-none"
                >
                  Rechercher
                </button>
              </div>
            </div>
          </div>

          {/* Main Content Section */}
          <div className="flex flex-col space-y-4 md:flex-row md:space-y-0 md:space-x-4">
            {/* Left Column - Property Details */}
            <div className="w-full p-4 text-left border rounded md:w-1/3">
              <img
                src="https://images.unsplash.com/photo-1720293315632-37efe958d5ec?q=80&w=3432&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"
                alt="Property"
                className="w-[100%] h-[250px] object-cover rounded-[0.3em] mt-4"
              />
              <h2 className="text-[18px] md:text-[23px] font-normal text-black">
                Le dôme des libellules
              </h2>

              {/* Guest Count */}
              <div className="flex items-center justify-between mt-4">
                <img src={Group} alt="Profile Icon" className="w-6 h-6" />
                <span className="text-[16px] font-light text-black">
                  {Number(formData.adults) + Number(formData.children)}{" "}
                  {Number(formData.adults) + Number(formData.children) > 1
                    ? "personnes"
                    : "personne"}
                </span>
              </div>

              {/* Dates */}
              <div className="flex items-center justify-between mt-2 mb-5">
                <img src={Calendar} alt="Calendar Icon" className="w-6 h-6" />
                <div className="flex items-center text-[16px] font-light text-black">
                  {formData.arrivalDate && (
                    <span>{formatDate(formData.arrivalDate)}</span>
                  )}
                  <span className="mx-2 text-black">→</span>
                  {formData.departureDate && (
                    <span>{formatDate(formData.departureDate)}</span>
                  )}
                </div>
              </div>

              <hr />
              {showPriceDetails && renderPriceDetails()}
            </div>

            {/* Right Column - Contact Form */}
            <div className="w-full md:w-2/3 border border-[#668E73] p-4 rounded space-y-4 text-left">


                  {currentStep == 1 && (
                    <h2 className="text-[18px] md:text-[23px] font-normal text-black"> Contact </h2>
                  )}
                  {currentStep == 2 && (
                    <h2 className="text-[18px] md:text-[23px] font-normal text-black"> Extras </h2>
                  )}
                  {currentStep == 3 && (
                    <h2 className="text-[18px] md:text-[23px] font-normal text-black"> Notes </h2>
                  )}

              {/* Render progress bar */}
              {renderProgressBar()}

              {/* Render current step content */}
              {renderStepContent()}

              {/* Navigation buttons */}
                <div className="flex justify-between mt-6">
                  {currentStep > 1 && (
                    <button
                      type="button"
                      onClick={prevStep}
                      className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
                    >
                      Précédent
                    </button>
                  )}
                  {currentStep < 3 && (
                    <button
                      type="button"
                      onClick={nextStep}
                      disabled={!isStepValid()}
                      className={`px-4 py-2 ${
                        isStepValid() ? "bg-[#668E73] hover:bg-opacity-90" : "bg-gray-300 cursor-not-allowed"
                      } text-white rounded`}
                    >
                      Suivant
                    </button>
                  )}
                  {currentStep === 3 && (
                    <button
                      type="submit"
                      className="px-4 py-2 bg-[#668E73] text-white rounded hover:bg-opacity-90"
                    >
                      {loading ? "En cours..." : "Passer au paiement"}
                    </button>
                  )}
                </div>

            </div>
          </div>
        </form>
      ) : (
        renderPaymentForm()
      )}
    </div>
  );
};

export default BookingForm;