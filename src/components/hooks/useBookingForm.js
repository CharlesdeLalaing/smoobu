import { useState } from "react";
import { api } from "../utils/api";
import { VALID_COUPONS } from "../utils/coupons";
import { calculateExtrasTotal } from "../utils/booking";
import { extraCategories } from "../extraCategories"
import { useNavigate } from "react-router-dom";

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

  // Replace your current handleChange function with this one
// const handleChange = async (e) => {
//   const { name, value } = e.target;

//   // Update form data
//   setFormData((prevData) => ({
//     ...prevData,
//     [name]: value,
//   }));

//   // Check if this is a date change
//   if (name === "arrivalDate" || name === "departureDate") {
//     setShowPriceDetails(false);
    
//     // Check if both dates are set
//     const updatedFormData = {
//       ...formData,
//       [name]: value
//     };

//     if (updatedFormData.arrivalDate && updatedFormData.departureDate) {
//       console.log("Both dates set, checking availability automatically");
//       try {
//         setLoading(true);
//         setError(null);
        
//         const response = await api.get("/rates", {
//           params: {
//             apartments: updatedFormData.apartmentId || ["1644643", "1946282", "1946279", "1946276", "1946270"],
//             start_date: updatedFormData.arrivalDate,
//             end_date: updatedFormData.departureDate,
//             adults: updatedFormData.adults,
//             children: updatedFormData.children,
//           },
//         });

//         if (response.data.priceDetails) {
//           setPriceDetails(response.data.priceDetails);
//           setShowPriceDetails(true);
//           setIsAvailable(true);

//           // If a room is already selected, update its price
//           if (updatedFormData.apartmentId && response.data.priceDetails[updatedFormData.apartmentId]) {
//             setFormData(prev => ({
//               ...prev,
//               price: response.data.priceDetails[updatedFormData.apartmentId].finalPrice
//             }));
//           }
//         } else {
//           setError("No rates available for selected dates");
//           setShowPriceDetails(false);
//           setIsAvailable(false);
//         }
//       } catch (error) {
//         console.error("Error checking availability:", error);
//         setError(error.response?.data?.error || "Unable to fetch rates");
//         setShowPriceDetails(false);
//         setIsAvailable(false);
//       } finally {
//         setLoading(false);
//       }
//     }
//   }
// };

const handleChange = (e) => {
  const { name, value } = e.target;

  // Simply update form data
  setFormData((prevData) => ({
    ...prevData,
    [name]: value,
  }));

  // Only clear date error when modifying dates
  if (name === "arrivalDate" || name === "departureDate") {
    setDateError("");
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

  // const handleCheckAvailability = async () => {
  //   if (!formData.arrivalDate || !formData.departureDate) {
  //     setDateError("Please select both dates");
  //     setIsAvailable(false);  // Add this
  //     setShowPriceDetails(false);  // Add this
  //     setPriceDetails(null);  // Add this
  //     return;
  //   }
  
  //   const numberOfNights = calculateNumberOfNights(startDate, endDate);
  //   console.log("Debugging dates:", {
  //     formDataArrival: formData.arrivalDate,
  //     formDataDeparture: formData.departureDate,
  //     startDate: startDate,
  //     endDate: endDate,
  //     calculatedNights: numberOfNights,
  //   });
  //   setLoading(true);
  //   setError(null);
  
  //   try {
  //     console.log("Checking rates for:", {
  //       dates: {
  //         arrival: formData.arrivalDate,
  //         departure: formData.departureDate,
  //       },
  //       guests: {
  //         adults: formData.adults,
  //         children: formData.children,
  //       },
  //       apartmentId: formData.apartmentId
  //     });
  
  //     const response = await api.get("/rates", {
  //       params: {
  //         apartments: formData.apartmentId || ["1644643", "1946282", "1946279", "1946276", "1946270"],
  //         start_date: formData.arrivalDate,
  //         end_date: formData.departureDate,
  //         adults: formData.adults,
  //         children: formData.children,
  //       },
  //     });
  
  //     // Detailed logging of the response
  //     console.log("Full rates response:", response.data);
  //     console.log("Price details for selected apartment:", 
  //       response.data.priceDetails?.[formData.apartmentId]);
  //     console.log("Original price:", 
  //       response.data.priceDetails?.[formData.apartmentId]?.originalPrice);
  
  //     if (response.data.priceDetails) {
  //       setPriceDetails(response.data.priceDetails);
  //       setShowPriceDetails(true);
  //       setIsAvailable(true);
  //     } else {
  //       setError("No rates available for selected dates");
  //       setShowPriceDetails(false);
  //       setIsAvailable(false);
  //     }
  //   } catch (error) {
  //     console.error("Error fetching rates:", error);
  //     setError(error.response?.data?.error || "Unable to fetch rates");
  //     setShowPriceDetails(false);
  //     setIsAvailable(false);
  //   } finally {
  //     setLoading(false);
  //   }
  // };

  // const handleCheckAvailability = async () => {
  //   console.log('handleCheckAvailability called with:', {
  //     startDate,
  //     endDate,
  //     formDataDates: {
  //       arrival: formData.arrivalDate,
  //       departure: formData.departureDate
  //     }
  //   });
  
  //   if (!startDate || !endDate) {
  //     setDateError("Please select both dates");
  //     setIsAvailable(false);
  //     setShowPriceDetails(false);
  //     setPriceDetails(null);
  //     return;
  //   }
  
  //   const numberOfNights = calculateNumberOfNights(startDate, endDate);
  //   console.log("Debugging dates:", {
  //     formDataArrival: formData.arrivalDate,
  //     formDataDeparture: formData.departureDate,
  //     startDate: startDate,
  //     endDate: endDate,
  //     calculatedNights: numberOfNights,
  //   });
  
  //   // Reset all states before checking
  //   setError("");
  //   setDateError("");
  //   setIsAvailable(false);
  //   setShowPriceDetails(false);
  //   setPriceDetails(null);
  //   setLoading(true);
  
  //   try {
  //     console.log("Checking rates for:", {
  //       dates: {
  //         arrival: formData.arrivalDate,
  //         departure: formData.departureDate,
  //       },
  //       guests: {
  //         adults: formData.adults,
  //         children: formData.children,
  //       },
  //       apartmentId: formData.apartmentId
  //     });
  
  //     const response = await api.get("/rates", {
  //       params: {
  //         apartments: formData.apartmentId || ["1644643", "1946282", "1946279", "1946276", "1946270"],
  //         start_date: formData.arrivalDate,
  //         end_date: formData.departureDate,
  //         adults: formData.adults,
  //         children: formData.children,
  //       },
  //     });
  
  //     // Detailed logging of the response
  //     console.log("Full rates response:", response.data);
  //     console.log("Price details for selected apartment:", 
  //       response.data.priceDetails?.[formData.apartmentId]);
  //     console.log("Original price:", 
  //       response.data.priceDetails?.[formData.apartmentId]?.originalPrice);
  
  //     if (response.data.priceDetails) {
  //       setPriceDetails(response.data.priceDetails);
  //       setShowPriceDetails(true);
  //       setIsAvailable(true);
  
  //       if (formData.apartmentId && response.data.priceDetails[formData.apartmentId]) {
  //         setFormData((prev) => ({
  //           ...prev,
  //           price: response.data.priceDetails[formData.apartmentId].finalPrice,
  //         }));
  //       }
  //     } else {
  //       setDateError("No rates available for selected dates");
  //       setShowPriceDetails(false);
  //       setIsAvailable(false);
  //       setPriceDetails(null);
  //     }
  //   } catch (error) {
  //     console.error("Error fetching rates:", error);
  //     setError(error.response?.data?.error || "Unable to fetch rates");
  //     setShowPriceDetails(false);
  //     setIsAvailable(false);
  //     setPriceDetails(null);
  //   } finally {
  //     setLoading(false);
  //   }
  // };

  const handleCheckAvailability = async () => {
    if (!startDate || !endDate) {
      setDateError("Please select both dates");
      setIsAvailable(false);
      setShowPriceDetails(false);
      setPriceDetails(null);
      return;
    }
  
    // Reset all states before checking
    setError("");
    setDateError("");
    setIsAvailable(false);
    setShowPriceDetails(false);
    setPriceDetails(null);
    setLoading(true);
  
    try {
      const response = await api.get("/rates", {
        params: {
          apartments: formData.apartmentId || ["1644643", "1946282", "1946279", "1946276", "1946270"],
          start_date: startDate.toISOString().split("T")[0],
          end_date: endDate.toISOString().split("T")[0],
          adults: formData.adults,
          children: formData.children,
        },
      });
  
      if (response.data.priceDetails) {
        setPriceDetails(response.data.priceDetails);
        setShowPriceDetails(true);
        setIsAvailable(true);
  
        if (formData.apartmentId && response.data.priceDetails[formData.apartmentId]) {
          setFormData((prev) => ({
            ...prev,
            price: response.data.priceDetails[formData.apartmentId].finalPrice,
          }));
        }
      } else {
        setDateError("No rates available for selected dates");
        setShowPriceDetails(false);
        setIsAvailable(false);
        setPriceDetails(null);
      }
    } catch (error) {
      console.error("Error fetching rates:", error);
      setError(error.response?.data?.error || "Unable to fetch rates");
      setShowPriceDetails(false);
      setIsAvailable(false);
      setPriceDetails(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Check if we have a selected room and price details
    const selectedRoomPrice = priceDetails?.[formData.apartmentId];

    if (!selectedRoomPrice) {
      setError("Veuillez attendre le calcul du prix avant de continuer.");
      return;
    }

    setLoading(true);
    try {
      const selectedExtrasArray = Object.entries(selectedExtras)
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

          return {
            type: "addon",
            name: extra.name,
            amount: extra.price * quantity,
            quantity: quantity,
            currencyCode: "EUR",
            extraPersonPrice: extra.extraPersonPrice,
            extraPersonQuantity: selectedExtras[`${extraId}-extra`] || 0,
          };
        })
        .filter(Boolean);

      // Calculate extras total
      const extrasTotal = selectedExtrasArray.reduce(
        (sum, extra) => sum + extra.amount,
        0
      );

      // Get the base price from price details
      const basePrice = selectedRoomPrice.originalPrice;
      const subtotalBeforeDiscounts = basePrice + extrasTotal;

      // Get discounts
      const longStayDiscount = selectedRoomPrice.discount || 0;
      const couponDiscount = appliedCoupon ? appliedCoupon.discount : 0;

      // Calculate final total
      const finalTotal =
        subtotalBeforeDiscounts - longStayDiscount - couponDiscount;

      console.log("Payment calculation:", {
        basePrice,
        extrasTotal,
        subtotalBeforeDiscounts,
        longStayDiscount,
        couponDiscount,
        finalTotal,
      });

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
            ...selectedRoomPrice,
            finalPrice: finalTotal,
            calculatedDiscounts: {
              longStay: longStayDiscount,
              coupon: couponDiscount,
            },
          },
        },
      });

      setClientSecret(response.data.clientSecret);
      setShowPayment(true);
      setError(null);
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
  
  // Get the base room price from priceDetails
  const selectedApartmentPriceDetails = priceDetails?.[formData.apartmentId];
  console.log("Selected apartment price details:", selectedApartmentPriceDetails);
  
  const roomBasePrice = selectedApartmentPriceDetails?.originalPrice || 0;
  console.log("Room base price:", roomBasePrice);
  
  // Calculate extras total
  const extrasTotal = selectedExtrasArray.reduce((sum, extra) => 
    sum + extra.amount + (extra.extraPersonAmount || 0), 0
  );
  console.log("Extras total:", extrasTotal);
  
  // Calculate total before discounts
  const subtotalBeforeDiscounts = roomBasePrice + extrasTotal;
  
  // Apply discounts
  const longStayDiscount = selectedApartmentPriceDetails?.discount || 0;
  const couponDiscount = appliedCoupon ? appliedCoupon.discount : 0;
  
  // Calculate final total
  const finalTotal = subtotalBeforeDiscounts - longStayDiscount - couponDiscount;

  const bookingData = {
    ...formData,
    extras: selectedExtrasArray,
    priceBreakdown: {
      basePrice: roomBasePrice,
      finalPrice: finalTotal,
      extrasTotal: extrasTotal
    },
    priceDetails: {
      ...selectedApartmentPriceDetails,
      discount: longStayDiscount,
      settings: selectedApartmentPriceDetails?.settings || {
        lengthOfStayDiscount: {
          discountPercentage: 0
        }
      }
    },
    price: finalTotal,
    couponApplied: appliedCoupon ? {
      code: appliedCoupon.code,
      discount: couponDiscount
    } : null
  };

  console.log('Final booking data:', bookingData);

  localStorage.setItem("bookingData", JSON.stringify(bookingData));

  const paymentIntent = clientSecret.split("_secret")[0];
  navigate(`/booking-confirmation?payment_intent=${paymentIntent}`);
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