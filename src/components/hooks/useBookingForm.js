import { useState } from "react";
import { api } from "../utils/api";

import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../firebase'; // Adjust the import path as needed


import { VALID_COUPONS } from "../utils/coupons";
import { calculateExtrasTotal } from "../utils/booking";
import { extraCategories } from "../extraCategories"
import { useNavigate } from "react-router-dom";
import {roomsData} from "../hooks/roomsData";
export const useBookingForm = () => {
  // Form State

  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    arrivalDate: "",
    departureDate: "",
    channelId: 2323525,
    apartmentId: "",
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



const calculateNumberOfNights = (startDate, endDate) => {
  if (!startDate || !endDate) return 0;
  const start = new Date(startDate);
  const end = new Date(endDate);
  return Math.floor((end - start) / (1000 * 60 * 60 * 24));
};

const calculateGuestFees = (adults, children, settings) => {
  const totalGuests = (parseInt(adults) || 0) + (parseInt(children) || 0);
  const extraGuests = Math.max(0, totalGuests - settings.startingAtGuest);
  return extraGuests * settings.extraGuestsPerNight; // Now treated as a flat fee
};

  
  // Coupon State
  const [coupon, setCoupon] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponError, setCouponError] = useState(null);


  // Handlers
  // const handleChange = (e) => {
  //   const { name, value } = e.target;

  //   if (name === "arrivalDate" || name === "departureDate") {
  //     setShowPriceDetails(false);
  //   }

  //   setFormData((prevData) => ({
  //     ...prevData,
  //     [name]: value,
  //   }));
  // };

const handleChange = async (e) => {
  const { name, value } = e.target;

  // Update form data without clearing room selection
  setFormData((prevData) => ({
    ...prevData,
    [name]: value,
  }));

  // Check if this is a date change and handle availability check
  if (name === "arrivalDate" || name === "departureDate") {
    setShowPriceDetails(false);

    const updatedFormData = {
      ...formData,
      [name]: value,
    };

    if (updatedFormData.arrivalDate && updatedFormData.departureDate) {
      try {
        setLoading(true);
        setError(null);

        const response = await api.get("/rates", {
          params: {
            apartments: updatedFormData.apartmentId || [
              "1946282",
              "1644643",
              "1946279",
              "1946276",
              "1946270",
            ],
            start_date: updatedFormData.arrivalDate,
            end_date: updatedFormData.departureDate,
            adults: updatedFormData.adults,
            children: updatedFormData.children,
          },
        });

        if (response.data.priceDetails) {
          setPriceDetails(response.data.priceDetails);
          setShowPriceDetails(true);
          setIsAvailable(true);

          if (
            updatedFormData.apartmentId &&
            response.data.priceDetails[updatedFormData.apartmentId]
          ) {
            setFormData((prev) => ({
              ...prev,
              price:
                response.data.priceDetails[updatedFormData.apartmentId]
                  .finalPrice,
            }));
          }
        } else {
          setError("No rates available for selected dates");
          setShowPriceDetails(false);
          setIsAvailable(false);
        }
      } catch (error) {
        console.error("Error checking availability:", error);
        setError(error.response?.data?.error || "Unable to fetch rates");
        setShowPriceDetails(false);
        setIsAvailable(false);
      } finally {
        setLoading(false);
      }
    }
  }
};

  const handleExtraChange = (extraId, quantity) => {
    if (quantity < 0) return;
    setSelectedExtras((prev) => ({
      ...prev,
      [extraId]: quantity,
    }));
  };

  const createSelectedExtrasArray = () => {
    // First, gather all base extras with their extra person info
    const extrasMap = new Map();

    Object.entries(selectedExtras)
      .filter(([_, quantity]) => quantity > 0)
      .forEach(([extraId, quantity]) => {
        const isExtraPerson = extraId.endsWith("-extra");
        const baseExtraId = isExtraPerson
          ? extraId.replace("-extra", "")
          : extraId;

        const extra = Object.values(extraCategories)
          .flatMap((category) => category.items)
          .find((item) => item.id === baseExtraId);

        if (!extra) return;

        if (isExtraPerson) {
          // If this is an extra person entry, add it to the base extra
          const baseExtra = extrasMap.get(baseExtraId);
          if (baseExtra) {
            baseExtra.extraPersonQuantity = quantity;
            baseExtra.extraPersonAmount = extra.extraPersonPrice * quantity;
          }
        } else {
          // This is a base extra
          extrasMap.set(baseExtraId, {
            type: "addon",
            name: extra.name,
            amount: extra.price * quantity,
            quantity: quantity,
            currencyCode: "EUR",
            extraPersonPrice: extra.extraPersonPrice,
            extraPersonQuantity: 0, // Will be updated if there's an extra person
            extraPersonAmount: 0, // Will be updated if there's an extra person
          });
        }
      });
    // Convert the map back to an array
    return Array.from(extrasMap.values());
  };

  const handleCheckAvailability = async () => {
    if (!formData.arrivalDate || !formData.departureDate) {
      setDateError("Please select both dates");
      return;
    }
  
    const numberOfNights = calculateNumberOfNights(startDate, endDate);
    // console.log("Debugging dates:", {
    //   formDataArrival: formData.arrivalDate,
    //   formDataDeparture: formData.departureDate,
    //   startDate: startDate,
    //   endDate: endDate,
    //   calculatedNights: numberOfNights,
    // });
    setLoading(true);
    setError(null);
  
    try {
      // console.log("Checking rates for:", {
      //   dates: {
      //     arrival: formData.arrivalDate,
      //     departure: formData.departureDate,
      //   },
      //   guests: {
      //     adults: formData.adults,
      //     children: formData.children,
      //   },
      //   apartmentId: formData.apartmentId
      // });
  
      const response = await api.get("/rates", {
        params: {
          apartments: formData.apartmentId || ["1946282", "1644643", "1946279", "1946276", "1946270"],
          start_date: formData.arrivalDate,
          end_date: formData.departureDate,
          adults: formData.adults,
          children: formData.children,
        },
      });
  
      // Detailed logging of the response
      console.log("Full rates response:", response.data);
      console.log("Price details for selected apartment:", 
        response.data.priceDetails?.[formData.apartmentId]);
      console.log("Original price:", 
        response.data.priceDetails?.[formData.apartmentId]?.originalPrice);
  
      if (response.data.priceDetails) {
        setPriceDetails(response.data.priceDetails);
        setShowPriceDetails(true);
        setIsAvailable(true);
      } else {
        setError("No rates available for selected dates");
        setShowPriceDetails(false);
        setIsAvailable(false);
      }
    } catch (error) {
      console.error("Error fetching rates:", error);
      setError(error.response?.data?.error || "Unable to fetch rates");
      setShowPriceDetails(false);
      setIsAvailable(false);
    } finally {
      setLoading(false);
    }
  };

const handleSubmit = async (e) => {
  e.preventDefault();

  // Check if we have a selected room and price details
  const selectedRoomPrice = priceDetails?.[formData.apartmentId];
  const settings = selectedRoomPrice?.settings;

  if (!selectedRoomPrice || !settings) {
    setError("Veuillez attendre le calcul du prix avant de continuer.");
    return;
  }

  setLoading(true);
  try {
    const selectedExtrasArray = createSelectedExtrasArray();

    // Calculate flat guest fees
    const guestFees = calculateGuestFees(
      formData.adults,
      formData.children,
      settings
    );

    // Calculate base price from price details
    const basePrice = selectedRoomPrice.originalPrice;

    // Calculate extras total
    const extrasTotal = selectedExtrasArray.reduce(
      (sum, extra) => sum + extra.amount + (extra.extraPersonAmount || 0),
      0
    );

    // Calculate all components of the final price
    const subtotalBeforeDiscounts = basePrice + extrasTotal + guestFees;
    const longStayDiscount = selectedRoomPrice.discount || 0;
    const couponDiscount = appliedCoupon ? appliedCoupon.discount : 0;

    const finalTotal = Math.max(
      subtotalBeforeDiscounts - longStayDiscount - couponDiscount,
      0
    );

    // Prepare booking data with all price components
    const bookingDataForPayment = {
      ...formData,
      price: finalTotal,
      basePrice: basePrice,
      guestFees: guestFees,
      extras: selectedExtrasArray,
      couponApplied: appliedCoupon ? {
        code: appliedCoupon.code,
        discount: appliedCoupon.discount,
        type: appliedCoupon.type,
        percentageValue: appliedCoupon.type === "percentage" ? appliedCoupon.percentageValue : null,
        validityStartDate: appliedCoupon.validityStartDate,
        validityEndDate: appliedCoupon.validityEndDate
      } : null,
      priceDetails: {
        ...selectedRoomPrice,
        guestFees,
        finalPrice: finalTotal,
        calculatedDiscounts: {
          longStay: longStayDiscount,
          coupon: couponDiscount,
        },
      },
    };

    // Create payment intent only if final total is greater than 0
    if (finalTotal > 0) {
      const response = await api.post("/create-payment-intent", {
        price: finalTotal,
        bookingData: bookingDataForPayment,
      });

      setClientSecret(response.data.clientSecret);
      setShowPayment(true);
      setError(null);
    } else {
      setError("Le montant total ne peut pas être négatif ou nul.");
    }
  } catch (err) {
    console.error("Error creating payment:", err);
    setError(
      err.response?.data?.error ||
        "Une erreur s'est produite lors de la création du paiement"
    );
  } finally {
    setLoading(false);
  }
};



const handlePaymentSuccess = () => {
  const selectedExtrasArray = createSelectedExtrasArray();
  const selectedApartmentPriceDetails = priceDetails?.[formData.apartmentId];

  if (!selectedApartmentPriceDetails) {
    setError("Missing price details");
    return;
  }

  const roomBasePrice = selectedApartmentPriceDetails.originalPrice || 0;

  // Calculate guest fees
  const guestFees = calculateGuestFees(
    formData.adults,
    formData.children,
    selectedApartmentPriceDetails.settings
  );

  // Calculate extras total
  const extrasTotal = selectedExtrasArray.reduce(
    (sum, extra) => sum + extra.amount + (extra.extraPersonAmount || 0),
    0
  );

  // Calculate total before discounts
  const subtotalBeforeDiscounts = roomBasePrice + extrasTotal + guestFees;

  // Apply discounts
  const longStayDiscount = selectedApartmentPriceDetails?.discount || 0;
  const couponDiscount = appliedCoupon ? appliedCoupon.discount : 0;

  // Calculate final total
  const finalTotal =
    subtotalBeforeDiscounts - longStayDiscount - couponDiscount;

  const bookingData = {
    ...formData,
    extras: selectedExtrasArray,
    guestFees, // Include guest fees
    priceBreakdown: {
      basePrice: roomBasePrice,
      guestFees, // Include guest fees in breakdown
      extrasTotal: extrasTotal,
      finalPrice: finalTotal,
      couponDiscount: couponDiscount,
    },
    priceDetails: {
      ...selectedApartmentPriceDetails,
      guestFees, // Include guest fees in price details
      discount: longStayDiscount,
      settings: selectedApartmentPriceDetails?.settings,
    },
    price: finalTotal,
    couponApplied: appliedCoupon
      ? {
          code: appliedCoupon.code,
          discount: appliedCoupon.discount,
          type: appliedCoupon.type,
          percentageValue:
            appliedCoupon.type === "percentage"
              ? appliedCoupon.percentageValue
              : null,
        }
      : null,
  };

  localStorage.setItem("bookingData", JSON.stringify(bookingData));

  const paymentIntent = clientSecret.split("_secret")[0];
  navigate(`/booking-confirmation?payment_intent=${paymentIntent}`);
};

const handleApplyCoupon = async (couponCode) => {
  try {
    const couponsRef = collection(db, "coupons");
    const q = query(couponsRef, where("code", "==", couponCode.toUpperCase()));

    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      return { error: "not_found" };
    }

    const couponDoc = querySnapshot.docs[0];
    const couponData = couponDoc.data();

    // Common validation for all types of coupons
    if (couponData.status !== "active") {
      return { error: "inactive" };
    }

    if (
      couponData.usedCount &&
      couponData.usedCount > 0 &&
      couponCode !== "POTES"
    ) {
      return { error: "used" };
    }

    const expiryDate =
      couponData.expiryDate?.toDate?.() || new Date(couponData.expiryDate);
    if (expiryDate && expiryDate < new Date()) {
      return { error: "expired" };
    }

    // Add after other validations (status, usedCount, expiryDate checks)
    if (couponData.validityStartDate && couponData.validityEndDate) {
      const validityStart = couponData.validityStartDate?.toDate?.() || new Date(couponData.validityStartDate);
      const validityEnd = couponData.validityEndDate?.toDate?.() || new Date(couponData.validityEndDate);
      const bookingStart = new Date(formData.arrivalDate);
      const bookingEnd = new Date(formData.departureDate);
    
      if (bookingStart > validityEnd || bookingEnd < validityStart) {
        const formattedStart = validityStart.toLocaleDateString('fr-BE', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
        const formattedEnd = validityEnd.toLocaleDateString('fr-BE', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
        return { error: "invalid_dates", message: `Ce code n'est valable que pour les séjours entre le ${formattedStart} et le ${formattedEnd}` };
      }
    }

    // Get the current total price
    const currentRoomPrice = priceDetails?.[formData.apartmentId]?.finalPrice;
    if (!currentRoomPrice) {
      return { error: "invalid" };
    }

    // Calculate discount - treat both types as fixed amount discounts
    const discountAmount = couponData.amount || couponData.discount;

    // Apply the coupon
    setAppliedCoupon({
      id: couponDoc.id,
      code: couponCode.toUpperCase(),
      type: "fixed",
      discount: discountAmount,
      currency: "EUR",
      validityStartDate: couponData.validityStartDate,
      validityEndDate: couponData.validityEndDate
    });

    // Update price details
    setPriceDetails((prev) => {
      if (!prev || !prev[formData.apartmentId]) return prev;

      const currentPriceDetails = prev[formData.apartmentId];
      const updatedPriceElements = [
        ...(currentPriceDetails.priceElements || []),
        {
          type: "discount",
          name: `Code promo (${couponCode.toUpperCase()})`,
          amount: -discountAmount,
          currencyCode: "EUR",
        },
      ];

      return {
        ...prev,
        [formData.apartmentId]: {
          ...currentPriceDetails,
          finalPrice: currentPriceDetails.finalPrice - discountAmount,
          priceElements: updatedPriceElements,
        },
      };
    });

    setCoupon("");
    return { success: true };
  } catch (error) {
    console.error("Error applying coupon:", error);
    return { error: "invalid" };
  }
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
    setPriceDetails,
    setEndDate,
    setDateError,
    setIsAvailable,
    setSelectedCategory,
    setFormData,
    setCurrentStep,
    setShowPriceDetails,
    setShowPayment,
  };
};