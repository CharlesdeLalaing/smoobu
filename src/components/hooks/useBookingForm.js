import { useState } from "react";
import { api } from "../utils/api";
import { VALID_COUPONS } from "../utils/coupons";
import { calculateExtrasTotal } from "../utils/booking";
import { extraCategories } from "../extraCategories";

export const useBookingForm = () => {
  const today = new Date(); // Get today's date

  // Form State
  const [formData, setFormData] = useState({
    arrivalDate: today.toISOString().split("T")[0], // Default to today
    departureDate: "",
    channelId: 4033148,
    apartmentId: 2428698,
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

  // UI State
  const [currentStep, setCurrentStep] = useState(0);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isAvailable, setIsAvailable] = useState(false);
  const [showPriceDetails, setShowPriceDetails] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [showPayment, setShowPayment] = useState(false);
  const [dateError, setDateError] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("packs");

  // Data State
  const [priceDetails, setPriceDetails] = useState(null);
  const [clientSecret, setClientSecret] = useState("");
  const [selectedExtras, setSelectedExtras] = useState({});
  const [startDate, setStartDate] = useState(today); // Default to today
  const [endDate, setEndDate] = useState(null);

  // Coupon State
  const [coupon, setCoupon] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponError, setCouponError] = useState(null);

  // Handlers
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

  // Update the date when the user selects a new date
  const handleDateSelect = (date, isStart) => {
    if (isStart) {
      setStartDate(date);
      setFormData((prevData) => ({
        ...prevData,
        arrivalDate: date.toISOString().split("T")[0],
      }));
    } else {
      setEndDate(date);
      setFormData((prevData) => ({
        ...prevData,
        departureDate: date.toISOString().split("T")[0],
      }));
    }
  };

  // Rest of the handlers and methods remain unchanged...
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
          children: formData.children,
        },
      });

      if (response.data.data && response.data.data[formData.apartmentId]) {
        if (
          response.data.priceDetails &&
          response.data.priceDetails.finalPrice > 0
        ) {
          setPriceDetails(response.data.priceDetails);
          setFormData((prev) => ({
            ...prev,
            price: response.data.priceDetails?.finalPrice || 0,
          }));
          setIsAvailable(true);
          setShowPriceDetails(true);
          setError(null);
        } else {
          setDateError(
            "Cette chambre n'est malheureusement pas disponible pour les dates sélectionnées"
          );
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

  // Return all states and handlers
  return {
    formData,
    currentStep,
    error,
    loading,
    isAvailable,
    showPriceDetails,
    successMessage,
    priceDetails,
    showPayment,
    clientSecret,
    selectedExtras,
    dateError,
    startDate,
    endDate,
    coupon,
    appliedCoupon,
    couponError,
    selectedCategory,
    handleChange,
    handleDateSelect,
    handleCheckAvailability,
    setStartDate,
    setEndDate,
    setDateError,
    setFormData,
    setError,
    setSelectedCategory,
  };
};
