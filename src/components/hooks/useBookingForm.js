import { useState } from "react";
import { api } from "../utils/api";
import { VALID_COUPONS } from "../utils/coupons";
import { calculateExtrasTotal } from "../utils/booking";
import { extraCategories } from "../extraCategories"

export const useBookingForm = () => {
  // Form State
  const [formData, setFormData] = useState({
    arrivalDate: "",
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
  const [currentStep, setCurrentStep] = useState(1);
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
  const [startDate, setStartDate] = useState(null);
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

  const handleExtraChange = (extraId, quantity) => {
    if (quantity < 0) return;
    setSelectedExtras((prev) => ({
      ...prev,
      [extraId]: quantity,
    }));
  };

  const createSelectedExtrasArray = () => {
    return Object.entries(selectedExtras)
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

        if (isExtraPerson) {
          return {
            type: "addon",
            name: `${extra.name} - Personne supplémentaire`,
            amount: extra.extraPersonPrice * quantity,
            quantity: quantity,
            currencyCode: "EUR",
          };
        }

        const extraPersonQuantity = selectedExtras[`${extraId}-extra`] || 0;
        return {
          type: "addon",
          name: extra.name,
          amount: extra.price * quantity,
          quantity: quantity,
          currencyCode: "EUR",
          extraPersonPrice: extra.extraPersonPrice,
          extraPersonQuantity: extraPersonQuantity,
          extraPersonAmount:
            extraPersonQuantity > 0
              ? extra.extraPersonPrice * extraPersonQuantity
              : 0,
        };
      })
      .filter(Boolean);
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.price) {
      setError("Veuillez attendre le calcul du prix avant de continuer.");
      return;
    }

    setLoading(true);
    try {
      const selectedExtrasArray = createSelectedExtrasArray();
      const extrasTotal = calculateExtrasTotal(selectedExtrasArray);
      const basePrice = priceDetails.originalPrice;
      const subtotalBeforeDiscounts = basePrice + extrasTotal;
      const longStayDiscount = priceDetails.discount || 0;
      const couponDiscount = appliedCoupon ? appliedCoupon.discount : 0;
      const finalTotal =
        subtotalBeforeDiscounts - longStayDiscount - couponDiscount;

      const response = await api.post("/create-payment-intent", {
        price: finalTotal,
        bookingData: {
          ...formData,
          price: finalTotal,
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
    const extrasTotal = calculateExtrasTotal(selectedExtrasArray);
    const subtotal = priceDetails.finalPrice + extrasTotal;
    const couponDiscount = appliedCoupon ? appliedCoupon.discount : 0;
    const finalTotal = subtotal - couponDiscount;

    const bookingData = {
      ...formData,
      extras: selectedExtrasArray,
      priceDetails: priceDetails,
      totalPrice: finalTotal,
    };

    localStorage.setItem("bookingData", JSON.stringify(bookingData));

    const paymentIntent = clientSecret.split("_secret")[0];
    window.location.href = `/booking-confirmation?payment_intent=${paymentIntent}`;
  };

 // useBookingForm.js
const handleApplyCoupon = (couponCode) => {
  console.log('handleApplyCoupon called with:', couponCode);
  setCouponError(null);

  if (!couponCode) {
    console.log('No coupon code provided');
    setCouponError("Veuillez entrer un code promo");
    return;
  }

  const couponInfo = VALID_COUPONS[couponCode.toUpperCase()];
  console.log('Found coupon info:', couponInfo);

  if (!couponInfo) {
    console.log('Invalid coupon code');
    setCouponError("Code promo invalide");
    return;
  }

  setAppliedCoupon({
    code: couponCode.toUpperCase(),
    ...couponInfo,
  });
  console.log('Applied coupon:', {
    code: couponCode.toUpperCase(),
    ...couponInfo,
  });

  setPriceDetails((prev) => {
    const newPriceDetails = {
      ...prev,
      priceElements: [
        ...(prev?.priceElements || []),
        {
          type: "coupon",
          name: `Code promo ${couponCode.toUpperCase()}`,
          amount: -couponInfo.discount,
          currencyCode: couponInfo.currency,
        },
      ],
    };
    console.log('Updated price details:', newPriceDetails);
    return newPriceDetails;
  });

  setCoupon("");
};
  const nextStep = () => setCurrentStep((prev) => Math.min(prev + 1, 3));
  const prevStep = () => setCurrentStep((prev) => Math.max(prev - 1, 1));

  const isStepValid = () => {
    switch (currentStep) {
      case 3:
        return (
          formData.firstName &&
          formData.lastName &&
          formData.email &&
          formData.arrivalTime &&
          formData.conditions
        );
      case 2:
        return true;
      case 1:
        return true;
      default:
        return false;
    }
  };

  return {
    // Form State
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

    // Handlers
    handleChange,
    handleExtraChange,
    handleCheckAvailability,
    handleSubmit,
    handlePaymentSuccess,
    handleApplyCoupon,
    nextStep,
    prevStep,
    isStepValid,
    setError,
    setStartDate,
    setEndDate,
    setDateError,
    setSelectedCategory,
    setFormData,
  };
};
