import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { Elements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import PaymentForm from "./components/PaymentForm";
import StripeWrapper from "./components/StripeWrapper";
import { fetchAvailability } from "./smoobuService";
import {
  extraCategories,
  calculateExtrasTotal,
} from "./components/extraCategories";

import Calendar from "./assets/icons8-calendar-50.png";
import Group from "./assets/icons8-group-48.png";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { registerLocale, setDefaultLocale } from "react-datepicker";
import fr from 'date-fns/locale/fr';

registerLocale('fr', fr);



import { Label, Listbox, ListboxButton, ListboxOption, ListboxOptions } from '@headlessui/react'
import { CheckIcon, ChevronUpDownIcon } from '@heroicons/react/20/solid'


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
    conditions: false,
  });

  const timeSlots = [
    { id: 1, hour: '17:00' },
    { id: 2, hour: '17:30' },
    { id: 3, hour: '18:00' },
    { id: 4, hour: '18:30' },
    { id: 5, hour: '19:00' },
    { id: 6, hour: '19:30' },
    { id: 7, hour: '20:00' },
    { id: 8, hour: '20:30' },
    { id: 9, hour: '21:00' },
    { id: 10, hour: '21:30' },
    { id: 11, hour: '22:00' }
  ];

  const adultes = [
    { id: 1, quantity: '1' },
    { id: 2, quantity: '2' },
    { id: 3, quantity: '3' },
    { id: 4, quantity: '4' },
    { id: 5, quantity: '5' },
    { id: 6, quantity: '6' },
    { id: 7, quantity: '7' },
    { id: 8, quantity: '8' },
    { id: 9, quantity: '9' },
    { id: 10, quantity: '10' }
  ];

  const childrenOptions = [
    { id: 1, quantity: '0' },
    { id: 2, quantity: '1' },
    { id: 3, quantity: '2' },
    { id: 4, quantity: '3' },
    { id: 5, quantity: '4' },
    { id: 6, quantity: '5' },
    { id: 7, quantity: '6' },
    { id: 8, quantity: '7' },
    { id: 9, quantity: '8' },
    { id: 10, quantity: '9' },
    { id: 11, quantity: '10' },
  ];


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
  const [coupon, setCoupon] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponError, setCouponError] = useState(null);
  const [availableDates, setAvailableDates] = useState({});
  

  const [startDate, setStartDate] = useState(null);
const [endDate, setEndDate] = useState(null);
const [dateError, setDateError] = useState('');

useEffect(() => {
  const fetchDates = async () => {
    const startDate = new Date().toISOString().split('T')[0];
    const endDate = new Date(new Date().setMonth(new Date().getMonth() + 12))
      .toISOString().split('T')[0];
    
    try {
      const response = await api.get("/rates", {
        params: {
          apartments: [formData.apartmentId],
          start_date: startDate,
          end_date: endDate,
        },
      });
      
      if (response.data.data && response.data.data[formData.apartmentId]) {
        setAvailableDates(response.data.data[formData.apartmentId]);
      }
    } catch (error) {
      console.error('Error fetching dates:', error);
    }
  };

  fetchDates();
}, [formData.apartmentId]);

const isDateUnavailable = (date, isStart) => {
  if (!date) return true;

  // Block today
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const inputDate = new Date(date);
  inputDate.setHours(0, 0, 0, 0);

  if (inputDate.getTime() === today.getTime()) {
    return true;
  }

  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  const dateStr = localDate.toISOString().split("T")[0];
  const dayData = availableDates[dateStr];

  console.log("Checking date availability:", {
    date: dateStr,
    normalizedDate: localDate,
    isStart,
    dayData,
    available: dayData?.available,
    isToday: inputDate.getTime() === today.getTime(),
  });
  // Rest of your function remains the same
  if (isStart) {
    if (!dayData) return true;

    const prevDate = new Date(localDate);
    prevDate.setDate(prevDate.getDate() - 1);
    const prevLocalDate = new Date(
      prevDate.getTime() - prevDate.getTimezoneOffset() * 60000
    );
    const prevDayStr = prevLocalDate.toISOString().split("T")[0];
    const prevDayData = availableDates[prevDayStr];

    console.log("Departure day check:", {
      currentDate: dateStr,
      prevDate: prevDayStr,
      currentDayData: dayData,
      prevDayData,
      isDepartureDay:
        (!prevDayData || prevDayData.available === 0) &&
        dayData.available === 1,
    });

    // If it's a departure day, it's available for new arrivals regardless of next day
    if (
      (!prevDayData || prevDayData.available === 0) &&
      dayData.available === 1
    ) {
      return false;
    }

    // For non-departure days, check if the day is available
    return dayData.available === 0;
  }

  // For departure date selection
  if (startDate) {
    let checkDate = new Date(startDate);

    // Only check dates between start and end (exclusive of end date)
    while (checkDate < date) {
      const checkLocalDate = new Date(
        checkDate.getTime() - checkDate.getTimezoneOffset() * 60000
      );
      const checkDateStr = checkLocalDate.toISOString().split("T")[0];
      const checkDayData = availableDates[checkDateStr];

      console.log("Checking date in range:", {
        checkDateStr,
        checkDayData,
        available: checkDayData?.available,
      });

      // Skip availability check for the first day if it's a departure day
      if (checkDate.getTime() !== startDate.getTime()) {
        if (!checkDayData || checkDayData.available === 0) {
          return true;
        }
      }
      checkDate.setDate(checkDate.getDate() + 1);
    }

    return false;
  }

  return false;
};

const handleDateSelect = (date, isStart) => {
  if (!date) {
    if (isStart) {
      setStartDate(null);
      setEndDate(null);
      handleChange({ target: { name: "arrivalDate", value: "" } });
      handleChange({ target: { name: "departureDate", value: "" } });
    } else {
      setEndDate(null);
      handleChange({ target: { name: "departureDate", value: "" } });
    }
    setDateError("");
    return;
  }

  const selectedDate = new Date(date.setHours(12, 0, 0, 0));
  if (isStart) {
    setStartDate(selectedDate);
    setEndDate(null);
    setDateError("");
    handleChange({
      target: {
        name: "arrivalDate",
        value: selectedDate.toISOString().split("T")[0],
      },
    });
    handleChange({ target: { name: "departureDate", value: "" } });
  } else {
    setEndDate(selectedDate);
    setDateError("");
    handleChange({
      target: {
        name: "departureDate",
        value: selectedDate.toISOString().split("T")[0],
      },
    });
  }
  // Remove all the reset states here - don't reset isAvailable or showPriceDetails
};

  const VALID_COUPONS = {
    TESTDISCOUNT: {
      discount: 10,
      type: "fixed", // 'fixed' for euro amount, 'percentage' for percentage discount
      currency: "EUR",
    },
    // Add more coupons as needed
  };


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


  const handleCheckAvailability = async () => {
    setError("");
    setDateError("");
  
    if (!formData.arrivalDate || !formData.departureDate) {
      setDateError("Veuillez sélectionner les dates d'arrivée et de départ");
      return;
    }
  
    setLoading(true);
    try {
      const response = await api.get("/rates", {
        params: {
          apartments: [formData.apartmentId],
          start_date: formData.arrivalDate,
          end_date: formData.departureDate,
          adults: formData.adults,
          children: formData.children
        },
      });
  
      if (response.data.data && response.data.data[formData.apartmentId]) {
        // If there's a price calculated, the dates are available
        if (response.data.priceDetails && response.data.priceDetails.finalPrice > 0) {
          setPriceDetails(response.data.priceDetails);
          setFormData(prev => ({
            ...prev,
            price: response.data.priceDetails?.finalPrice || 0
          }));
          setIsAvailable(true);
          setShowPriceDetails(true);
          setError(null);
        } else {
          setDateError("Cette chambre n'est malheureusement pas disponible pour les dates sélectionnées");
          setIsAvailable(false);
          setShowPriceDetails(false);
        }
      }
    } catch (err) {
      console.error("Error:", err);
      setIsAvailable(false);
      setShowPriceDetails(false);
      setError("Impossible de récupérer les tarifs");
    } finally {
      setLoading(false);
    }
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
    if (!priceDetails) {
      return <div className="text-sm text-gray-500">Not available</div>;
    }
  
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
    const longStayDiscount = Math.abs(priceDetails.discount || 0);
    const couponDiscount = appliedCoupon ? Math.abs(appliedCoupon.discount) : 0;
  
    // Subtract both discounts from the subtotal
    const finalTotal =
      subtotalBeforeDiscounts - longStayDiscount - couponDiscount;
  
    // If finalTotal is 0, display "Room not available"
    if (finalTotal === 0) {
      return <div className="my-4 text-sm font-bold text-red-500">Cette chambre n'est malheureusement pas disponible pour les dates sélectionnées.</div>;
    }
  
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
    <div className="flex items-center justify-between mb-4 text-center">
      <div className="w-3/5 h-2 bg-gray-300 rounded md:w-3/5 lg:w-4/5">
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
      <div className="w-full mt-6 space-y-8">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
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
                {/* <div>
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
                </div> */}

                <div>
                  <label
                    htmlFor="arrivalTime"
                    className="block text-[14px] md:text-[16px] font-medium text-[#9a9a9a] mb-1"
                  >
                    Check-in*
                  </label>
                  <Listbox
                    value={formData.arrivalTime}
                    onChange={(value) => handleChange({ target: { name: "arrivalTime", value: value.hour } })}
                  >
                    <div className="relative">
                      <Listbox.Button
                        id="arrivalTime"  // Add an id to the Listbox button to associate it with the label
                        className="mt-1 block w-full rounded border-[#668E73] border text-[14px] md:text-[16px] placeholder:text-[14px] md:placeholder:text-[16px] shadow-sm focus:border-[#668E73] focus:ring-1 focus:ring-[#668E73] text-black bg-white h-12 p-2"
                      >
                        <span className="flex items-center">
                          <span className="block ml-3 truncate">{formData.arrivalTime || "Heure d'arrivée"}</span>
                        </span>
                        <span className="absolute inset-y-0 right-0 flex items-center pr-2 ml-3 pointer-events-none">
                          <ChevronUpDownIcon aria-hidden="true" className="text-gray-400 size-5" />
                        </span>
                      </Listbox.Button>

                      <Listbox.Options className="absolute z-10 w-full py-1 mt-1 overflow-auto text-base bg-white rounded-md shadow-lg max-h-56 ring-1 ring-black/5 focus:outline-none sm:text-sm">
                        {timeSlots.map((timeSlot) => (
                          <Listbox.Option
                            key={timeSlot.id}
                            value={timeSlot}
                            className="group relative cursor-default select-none py-2 pl-3 pr-9 text-gray-900 data-[focus]:bg-[#668E73] data-[focus]:text-white"
                          >
                            <div className="flex items-center">
                              <span className="ml-3 block truncate font-normal group-data-[selected]:font-semibold">
                                {timeSlot.hour}
                              </span>
                            </div>
                            <span className="absolute inset-y-0 right-0 flex items-center pr-4 text-[#668E73] group-data-[focus]:text-white [.group:not([data-selected])_&]:hidden">
                              <CheckIcon aria-hidden="true" className="size-5" />
                            </span>
                          </Listbox.Option>
                        ))}
                      </Listbox.Options>
                    </div>
                  </Listbox>
                </div>


        </div>
        <div className="grid grid-cols-1">
          {/* Contact form fields */}
          <div>
          <label className="flex items-center text-[14px] md:text-[16px] font-medium text-[#9a9a9a] mb-1">
            <input
              type="checkbox"
              name="conditions"
              checked={formData.conditions || false}
              onChange={(e) =>
                setFormData((prevData) => ({
                  ...prevData,
                  conditions: e.target.checked,
                }))
              }
              className="mr-2 rounded border-[#668E73] text-[#668E73] focus:ring-[#668E73]"
              required
            />
            <span>
              J'accepte les{" "}
              <a
                href="https://fermedebasseilles.be/conditions-generales/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#668E73] underline hover:text-[#445E54]"
              >
                conditions générales
              </a>
              .
            </span>
          </label>
          {!formData.conditions && (
            <p className="mt-1 text-sm text-red-500">
              Vous devez accepter les conditions générales pour continuer.
            </p>
          )}
        </div>
      </div>
        </div>

      </div>
  );

  const renderExtrasSection = () => (
    <div>
      <div className="w-full mt-6 space-y-8">
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
          <div
            className={`grid grid-cols-1 gap-6 md:grid-cols-1 ${
              selectedCategory === "boissons" ? "lg:grid-cols-1" : "lg:grid-cols-2"
            }`}
          >
            {selectedCategory === "boissons" ? (
              (() => {
                const groupedBoissons = extraCategories.boissons.items.reduce(
                  (groups, item) => {
                    if (!groups[item.type]) {
                      groups[item.type] = [];
                    }
                    groups[item.type].push(item);
                    return groups;
                  },
                  {}
                );

                return Object.entries(groupedBoissons).map(([type, items]) => (
                  <div key={type} className="mb-8">
                    {/* Display the subtitle for each type */}
                    <h2 className="mb-4 text-xl font-semibold text-gray-800 capitalize">
                      {type === "wine"
                        ? "Vins"
                        : type === "beer"
                        ? "Bières"
                        : type === "soft"
                        ? "Boissons non alcoolisées"
                        : type === "bulles"
                        ? "Bulles"
                        : type}
                    </h2>

                    {/* Display items of this type */}
                    {items.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-start gap-4 p-4 mb-4 transition-shadow bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md"
                      >
                        <img
                          src={item.image}
                          alt={item.name}
                          className="object-cover w-24 h-24 rounded-lg"
                        />
                        <div className="flex-grow space-y-2">
                          <div className="flex items-start justify-between">
                            <h3 className="text-[15px] font-medium text-gray-900">
                              {item.name}
                            </h3>
                            <div className="bg-[#668E73] px-2 py-1 rounded text-white text-[13px] font-medium">
                              {item.price}€
                            </div>
                          </div>
                          <p className="text-[13px] text-gray-600 line-clamp-2">
                            {item.description}
                          </p>
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => {
                                const newQuantity =
                                  (selectedExtras[item.id] || 0) - 1;
                                handleExtraChange(item.id, newQuantity);
                              }}
                              disabled={(selectedExtras[item.id] || 0) === 0}
                              className="w-8 h-8 flex items-center justify-center rounded-full border-2 border-[#668E73] text-[#668E73] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#668E73] hover:border-[#668E73] hover:text-white transition-colors"
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
                              className="w-8 h-8 flex items-center bg-[#668E73] justify-center rounded-full border-2 border-[#668E73] text-white hover:bg-[#668E73] hover:border-[#668E73] hover:text-white transition-colors"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ));
              })()
            ) : (
              extraCategories[selectedCategory].items.map((item) => (
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
                      <h3 className="text-[15px] font-medium text-gray-900">
                        {item.name}
                      </h3>
                      <div className="bg-[#668E73] px-2 py-1 rounded text-white text-[13px] font-medium">
                        {item.price}€
                      </div>
                    </div>
                    <p className="text-[13px] text-gray-600 line-clamp-2">
                      {item.description}
                    </p>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          const newQuantity =
                            (selectedExtras[item.id] || 0) - 1;
                          handleExtraChange(item.id, newQuantity);
                        }}
                        disabled={(selectedExtras[item.id] || 0) === 0}
                        className="w-8 h-8 flex items-center justify-center rounded-full border-2 border-[#668E73] text-[#668E73] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#668E73] hover:border-[#668E73] hover:text-white transition-colors"
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
                        className="w-8 h-8 flex items-center bg-[#668E73] justify-center rounded-full border-2 border-[#668E73] text-white hover:bg-[#668E73] hover:border-[#668E73] hover:text-white transition-colors"
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
                            className="w-8 h-8 flex items-center justify-center rounded-full border-2 border-[#668E73] text-[#668E73] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#668E73] hover:border-[#668E73] hover:text-white transition-colors"
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
                            className="w-8 h-8 flex items-center bg-[#668E73] justify-center rounded-full border-2 border-[#668E73] text-white hover:bg-[#668E73] hover:border-[#668E73] hover:text-white transition-colors"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

        </div>
    </div>
  );

  const renderInfoSupSection = () => (
    <div>
      <div className="w-full mt-6 space-y-8">
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

              <div className="pt-4 pb-4 mt-6 mb-6 border-t border-b border-gray-200">
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
        return renderExtrasSection();
      case 2:
        return renderInfoSupSection();
      case 3:
        return renderContactSection();
      default:
        return null;
    }
  };

  const isStepValid = () => {
    if (currentStep === 3) {
      return (
        formData.firstName &&
        formData.lastName &&
        formData.email &&
        formData.arrivalTime &&
        formData.conditions
      );
    }
    if (currentStep === 2) {
      return true; // Adjust based on requirements for step 2
    }
    if (currentStep === 1) {
      return true; // Adjust based on requirements for step 3
    }
    return false;
  };



  const renderPaymentForm = () => (
    <div className="w-full mx-auto mt-8">
      <h3 className="mb-4 text-lg font-medium">Finaliser votre paiement</h3>
      {clientSecret && (
        <StripeWrapper
          clientSecret={clientSecret}
          onSuccess={handlePaymentSuccess}
          onError={(error) => setError(error)}
        >
          <PaymentForm />
        </StripeWrapper>
      )}
    </div>
  );

  return (
    <div className="p-6 mx-auto h-[100vh] overflow-y-scroll w-full lg:w-[1024px] xl:w-[1440px] ">
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
                  Arrivée
                  <DatePicker
                    selected={startDate}
                    onChange={(date) => handleDateSelect(date, true)}
                    selectsStart
                    startDate={startDate}
                    endDate={endDate}
                    minDate={
                      new Date(new Date().setDate(new Date().getDate() + 1))
                    }
                    locale="fr"
                    dateFormat="dd/MM/yyyy"
                    placeholderText="Sélectionnez une date"
                    className="mt-1 block w-full rounded border-[#668E73] border text-[14px] md:text-[16px] shadow-sm focus:border-[#668E73] focus:ring-1 focus:ring-[#668E73] text-black bg-white h-12 p-2"
                    excludeDates={[new Date()]} // Add this line
                    filterDate={(date) => !isDateUnavailable(date, true)}
                    isClearable={true}
                  />
                </label>
              </div>

              <div className="relative">
                <label className="block text-[14px] md:text-[16px] font-medium text-[#9a9a9a] mb-1">
                  Départ
                  <DatePicker
                    selected={endDate}
                    onChange={(date) => handleDateSelect(date, false)}
                    selectsEnd
                    startDate={startDate}
                    endDate={endDate}
                    minDate={startDate || new Date()}
                    locale="fr"
                    dateFormat="dd/MM/yyyy"
                    placeholderText="Sélectionnez une date"
                    className="mt-1 block w-full rounded border-[#668E73] border text-[14px] md:text-[16px] shadow-sm focus:border-[#668E73] focus:ring-1 focus:ring-[#668E73] text-black bg-white h-12 p-2"
                    filterDate={(date) => !isDateUnavailable(date, false)}
                    isClearable={true}
                    disabled={!startDate}
                  />
                </label>
              </div>

              {dateError && (
                <div className="mt-2 text-sm font-medium text-red-500">
                  {dateError}
                </div>
              )}

              {/* Adults Dropdown */}
              {/* <div>
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
              </div> */}

              <div>
                <label
                  htmlFor="adults"
                  className="block text-[14px] md:text-[16px] font-medium text-[#9a9a9a] mb-1"
                >
                  Adultes
                </label>
                <Listbox
                  value={formData.adults}
                  onChange={(value) =>
                    handleChange({
                      target: { name: "adults", value: value.quantity },
                    })
                  }
                >
                  <div className="relative">
                    <Listbox.Button
                      id="adults" // Add an id to the Listbox button to associate it with the label
                      className="mt-1 block w-full rounded border-[#668E73] border text-[14px] md:text-[16px] placeholder:text-[14px] md:placeholder:text-[16px] shadow-sm focus:border-[#668E73] focus:ring-1 focus:ring-[#668E73] text-black bg-white h-12 p-2"
                    >
                      <span className="flex items-center">
                        <span className="block ml-3 truncate">
                          {formData.adults || "Adultes"}
                        </span>
                      </span>
                      <span className="absolute inset-y-0 right-0 flex items-center pr-2 ml-3 pointer-events-none">
                        <ChevronUpDownIcon
                          aria-hidden="true"
                          className="text-gray-400 size-5"
                        />
                      </span>
                    </Listbox.Button>

                    <Listbox.Options className="absolute z-10 w-full py-1 mt-1 overflow-auto text-base bg-white rounded-md shadow-lg max-h-56 ring-1 ring-black/5 focus:outline-none sm:text-sm">
                      {adultes.map((adulte) => (
                        <Listbox.Option
                          key={adulte.id}
                          value={adulte}
                          className="group relative cursor-default select-none py-2 pl-3 pr-9 text-gray-900 data-[focus]:bg-[#668E73] data-[focus]:text-white"
                        >
                          <div className="flex items-center">
                            <span className="ml-3 block truncate font-normal group-data-[selected]:font-semibold">
                              {adulte.quantity}
                            </span>
                          </div>
                          <span className="absolute inset-y-0 right-0 flex items-center pr-4 text-[#668E73] group-data-[focus]:text-white [.group:not([data-selected])_&]:hidden">
                            <CheckIcon aria-hidden="true" className="size-5" />
                          </span>
                        </Listbox.Option>
                      ))}
                    </Listbox.Options>
                  </div>
                </Listbox>
              </div>

              {/* Children Dropdown */}
              {/* <div>
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
              </div> */}

              <div>
                <label
                  htmlFor="childrenDropdown" // Unique id for the Listbox
                  className="block text-[14px] md:text-[16px] font-medium text-[#9a9a9a] mb-1"
                >
                  Enfants
                </label>
                <Listbox
                  value={formData.children}
                  onChange={(value) =>
                    handleChange({
                      target: { name: "children", value: value.quantity },
                    })
                  }
                >
                  <div className="relative">
                    <Listbox.Button
                      id="childrenDropdown" // Ensure unique id here
                      className="mt-1 block w-full rounded border-[#668E73] border text-[14px] md:text-[16px] placeholder:text-[14px] md:placeholder:text-[16px] shadow-sm focus:border-[#668E73] focus:ring-1 focus:ring-[#668E73] text-black bg-white h-12 p-2"
                    >
                      <span className="flex items-center">
                        <span className="block ml-3 truncate">
                          {formData.children || "0"}
                        </span>
                      </span>
                      <span className="absolute inset-y-0 right-0 flex items-center pr-2 ml-3 pointer-events-none">
                        <ChevronUpDownIcon
                          aria-hidden="true"
                          className="text-gray-400 size-5"
                        />
                      </span>
                    </Listbox.Button>

                    <Listbox.Options className="absolute z-10 w-full py-1 mt-1 overflow-auto text-base bg-white rounded-md shadow-lg max-h-56 ring-1 ring-black/5 focus:outline-none sm:text-sm">
                      {childrenOptions.map((child) => (
                        <Listbox.Option
                          key={child.id} // Ensure unique key for each option
                          value={child}
                          className="group relative cursor-default select-none py-2 pl-3 pr-9 text-gray-900 data-[focus]:bg-[#668E73] data-[focus]:text-white"
                        >
                          <div className="flex items-center">
                            <span className="ml-3 block truncate font-normal group-data-[selected]:font-semibold">
                              {child.quantity}
                            </span>
                          </div>
                          <span className="absolute inset-y-0 right-0 flex items-center pr-4 text-[#668E73] group-data-[focus]:text-white [.group:not([data-selected])_&]:hidden">
                            <CheckIcon aria-hidden="true" className="size-5" />
                          </span>
                        </Listbox.Option>
                      ))}
                    </Listbox.Options>
                  </div>
                </Listbox>
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

          {dateError && (
            <div className="mt-2 text-sm font-medium text-red-500">
              {dateError}
            </div>
          )}

          {/* Main Content Section */}
          <div className="flex flex-col space-y-4 md:flex-row md:space-y-0 md:space-x-4">
            {/* Left Column - Property Details */}
            <div className="w-full p-4 text-left border border-[#668E73] rounded md:w-1/3">
              <img
                src="https://images.unsplash.com/photo-1720293315632-37efe958d5ec?q=80&w=3432&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"
                alt="Property"
                className="w-[100%] h-[250px] object-cover rounded-[0.3em] my-4"
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
                  {startDate && <span>{formatDate(startDate)}</span>}
                  {(startDate || endDate) && (
                    <span className="mx-2 text-black">→</span>
                  )}
                  {endDate && <span>{formatDate(endDate)}</span>}
                </div>
              </div>

              <hr />
              {showPriceDetails && renderPriceDetails()}
            </div>

            {/* Right Column - Contact Form */}
            <div className="w-full md:w-2/3 border border-[#668E73] p-4 rounded space-y-4 text-left">
              {currentStep == 1 && (
                <h2 className="text-[18px] md:text-[23px] font-normal text-black">
                  {" "}
                  Extras{" "}
                </h2>
              )}
              {currentStep == 2 && (
                <h2 className="text-[18px] md:text-[23px] font-normal text-black">
                  {" "}
                  Notes{" "}
                </h2>
              )}
              {currentStep == 3 && (
                <h2 className="text-[18px] md:text-[23px] font-normal text-black">
                  {" "}
                  Contact{" "}
                </h2>
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
                    className="px-4 py-2 bg-[#668E73] text-white rounded hover:bg-opacity-90"
                  >
                    Suivant
                  </button>
                )}
                {currentStep === 3 && (
                  <button
                    type="submit"
                    disabled={!isStepValid()}
                    className={`px-4 py-2 ${
                      isStepValid()
                        ? "bg-[#668E73] hover:bg-opacity-90"
                        : "bg-gray-300 cursor-not-allowed"
                    } text-white rounded`}
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