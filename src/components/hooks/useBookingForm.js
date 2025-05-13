// src/components/hooks/useBookingForm.js

import { useState, useCallback } from "react"; // Imports should be first
import { api } from "../utils/api";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../../firebase"; // Adjust the import path as needed
// Remove any invalid characters or stray code *before* this line

// Import other utilities if needed
// import { VALID_COUPONS } from "../utils/coupons"; // Make sure these are valid imports if used
// import { calculateExtrasTotal } from "../utils/booking";
import { extraCategories } from "../extraCategories";
import { useNavigate } from "react-router-dom";
import { roomsData } from "../hooks/roomsData";
import { useTranslation } from "react-i18next";

// Define constants outside the hook if they don't depend on props/state
const SPA_ITEM_IDS = [
  "formuleSpa",
  "formuleSpaBottle",
  "packEssentiel",
  "packDetenteGourmet",
  "packRomantiqueGourmet",
  "packRacletteDetente",
  "packRacletteRomantique",
  "packBbqDetente",
  "packBbqRomantique",
];

// Start the hook definition
export const useBookingForm = () => {
  // --- State Definitions ---
  const navigate = useNavigate();
  const {t} = useTranslation();
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
    spaDateTime: null,
    spaBookingPreference: null,
    conditions: false,
  });
  const [currentStep, setCurrentStep] = useState(1);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isAvailable, setIsAvailable] = useState(false);
  const [showPriceDetails, setShowPriceDetails] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [showPayment, setShowPayment] = useState(false);
  const [dateError, setDateError] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("packs");
  const [priceDetails, setPriceDetails] = useState(null);
  const [clientSecret, setClientSecret] = useState("");
  const [selectedExtras, setSelectedExtras] = useState({});
  const [spaValidationError, setSpaValidationError] = useState("");
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [coupon, setCoupon] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponError, setCouponError] = useState(null);

  // --- Helper Functions (defined INSIDE the hook) ---
  const calculateNumberOfNights = (start, end) => {
    // Renamed params for clarity
    if (!start || !end) return 0;
    const startDateObj = new Date(start);
    const endDateObj = new Date(end);
    return Math.floor((endDateObj - startDateObj) / (1000 * 60 * 60 * 24));
  };

  const calculateGuestFees = (adults, children, settings) => {
    if (!settings) return 0; // Add guard clause
    const totalGuests = (parseInt(adults) || 0) + (parseInt(children) || 0);
    const extraGuests = Math.max(
      0,
      totalGuests - (settings.startingAtGuest || 2)
    ); // Default startingAtGuest if missing
    return extraGuests * (settings.extraGuestsPerNight || 0); // Default extraGuestsPerNight if missing
  };

  const validateCouponPeriod = (couponData, arrival, departure) => {
    // Renamed params
    if (
      !couponData ||
      !couponData.validityStartDate ||
      !couponData.validityEndDate ||
      !arrival ||
      !departure
    ) {
      return true; // Cannot validate or no period defined
    }
    const validityStart =
      couponData.validityStartDate?.toDate?.() ||
      new Date(couponData.validityStartDate);
    const validityEnd =
      couponData.validityEndDate?.toDate?.() ||
      new Date(couponData.validityEndDate);
    const bookingStart = new Date(arrival);
    const bookingEnd = new Date(departure);
    // Ensure valid dates before comparison
    if (
      isNaN(validityStart) ||
      isNaN(validityEnd) ||
      isNaN(bookingStart) ||
      isNaN(bookingEnd)
    ) {
      return false; // Invalid dates involved
    }
    return bookingStart <= validityEnd && bookingEnd >= validityStart;
  };

  // --- Event Handlers & Logic Functions (defined INSIDE the hook) ---

  const handleChange = /*async*/ (e) => {
    // Removed async if not needed here
    const { name, value, type, checked } = e.target;
    const val = type === "checkbox" ? checked : value; // Handle checkboxes

    setFormData((prevData) => ({
      ...prevData,
      [name]: val,
    }));

    // Simplified date change logic - relies on separate date picker state (startDate, endDate)
    // and handleDateSelect from BookingForm for API calls
    if (name === "arrivalDate" || name === "departureDate") {
      // If dates are changed directly in text inputs (less common with date picker)
      // Reset price details, maybe trigger re-validation if needed
      setShowPriceDetails(false);
      // Re-validate coupon if applied
      if (appliedCoupon) {
        const newDates = {
          arrivalDate: name === "arrivalDate" ? val : formData.arrivalDate,
          departureDate:
            name === "departureDate" ? val : formData.departureDate,
        };
        if (
          newDates.arrivalDate &&
          newDates.departureDate &&
          !validateCouponPeriod(
            appliedCoupon,
            newDates.arrivalDate,
            newDates.departureDate
          )
        ) {
          setAppliedCoupon(null);
          setCouponError("Le code promo n'est plus valable pour ces dates.");
          // Potentially remove coupon discount from priceDetails here if needed
        }
      }
    }
    // Removed the API call from here - let handleCheckAvailability or handleDateSelect manage it
  };

  const handleExtraChange = (extraId, quantity) => {
    if (quantity < 0) return;
    setSelectedExtras((prev) => {
      const updatedExtras = { ...prev, [extraId]: quantity };
      if (!extraId.endsWith("-extra") && quantity === 0) {
        const extraPersonId = `${extraId}-extra`;
        if (prev[extraPersonId]) {
          updatedExtras[extraPersonId] = 0;
        }
      }
      return updatedExtras;
    });
    // Clear SPA validation error if a SPA extra is removed
    if (SPA_ITEM_IDS.includes(extraId) && quantity === 0) {
      const anySpaStillSelected = SPA_ITEM_IDS.some(
        (id) => updatedExtras[id] > 0
      );
      if (!anySpaStillSelected) {
        setSpaValidationError("");
      }
    }
  };

  const createSelectedExtrasArray = () => {
    const extrasMap = new Map();
    Object.entries(selectedExtras)
      .filter(([_, quantity]) => quantity > 0)
      .forEach(([extraId, quantity]) => {
        const isExtraPerson = extraId.endsWith("-extra");
        const baseExtraId = isExtraPerson
          ? extraId.replace("-extra", "")
          : extraId;
        const extra = Object.values(extraCategories)
          .flatMap((cat) => cat.items)
          .find((item) => item.id === baseExtraId);
        if (!extra) return;
        if (isExtraPerson) {
          const baseExtra = extrasMap.get(baseExtraId);
          if (baseExtra) {
            baseExtra.extraPersonQuantity = quantity;
            baseExtra.extraPersonAmount =
              (extra.extraPersonPrice || 0) * quantity;
          }
        } else {
          extrasMap.set(baseExtraId, {
            type: "addon",
            name: extra.name,
            amount: (extra.price || 0) * quantity,
            quantity: quantity,
            currencyCode: "EUR",
            extraPersonPrice: extra.extraPersonPrice || 0,
            extraPersonQuantity: 0,
            extraPersonAmount: 0,
          });
        }
      });
    return Array.from(extrasMap.values());
  };

  // handleCheckAvailability - Assumed to be passed from useAvailabilityCheck hook in BookingForm
  // So it should *not* be defined here.

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isStepValid()) {
      // Check final step validity
      console.log("Form submit blocked, final step invalid.");
      // Optionally scroll to the first error on the final page
      return;
    }
    // Final coupon validation
    if (
      appliedCoupon &&
      !validateCouponPeriod(
        appliedCoupon,
        formData.arrivalDate,
        formData.departureDate
      )
    ) {
      setError(
        "Le code promo n'est plus valable pour ces dates. Veuillez le retirer ou changer vos dates."
      );
      return; // Block submission
    }
    const selectedRoomPrice = priceDetails?.[formData.apartmentId];
    const settings = selectedRoomPrice?.settings;
    if (!selectedRoomPrice || !settings) {
      setError(
        "Les détails du prix ne sont pas disponibles. Veuillez sélectionner des dates et une chambre valide."
      );
      return;
    }
    setLoading(true);
    try {
      const selectedExtrasArray = createSelectedExtrasArray();
      const guestFees = calculateGuestFees(
        formData.adults,
        formData.children,
        settings
      );
      const basePrice = selectedRoomPrice.originalPrice || 0;
      const extrasTotal = selectedExtrasArray.reduce(
        (sum, extra) => sum + extra.amount + (extra.extraPersonAmount || 0),
        0
      );
      const subtotalBeforeDiscounts = basePrice + extrasTotal + guestFees;
      const longStayDiscount = selectedRoomPrice.discount || 0;
      const couponDiscount = appliedCoupon ? appliedCoupon.discount : 0;
      const finalTotal = Math.max(
        0,
        subtotalBeforeDiscounts - longStayDiscount - couponDiscount
      );

      const bookingDataForPayment = {
        /* ... construct data ... */ ...formData,
        price: finalTotal,
        basePrice,
        guestFees,
        extras: selectedExtrasArray,
        couponApplied: appliedCoupon
          ? { code: appliedCoupon.code, discount: couponDiscount /* etc */ }
          : null,
        priceDetails: {
          ...selectedRoomPrice,
          guestFees,
          finalPrice: finalTotal /* etc */,
        },
      };

      if (finalTotal > 0) {
        const response = await api.post("/create-payment-intent", {
          price: finalTotal,
          bookingData: bookingDataForPayment,
        });
        setClientSecret(response.data.clientSecret);
        setShowPayment(true);
        setError(null);
      } else {
        // Handle free bookings or show error
        if (finalTotal === 0 && appliedCoupon) {
          // Allow booking with 0 total if coupon made it free?
          console.log(
            "Booking total is 0 due to coupon. Proceeding without payment intent."
          );
          // Simulate payment success directly or call a specific backend endpoint for free bookings
          handlePaymentSuccess(true); // Pass a flag indicating free booking maybe
        } else {
          setError("Le montant total ne peut pas être négatif ou nul.");
        }
      }
    } catch (err) {
      console.error("Error creating payment:", err);
      setError(
        err.response?.data?.error ||
          "Une erreur s'est produite lors de la création du paiement."
      );
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentSuccess = (isFreeBooking = false) => {
    // Accept optional flag
    if (!clientSecret && !isFreeBooking) {
      // Check clientSecret only if not free
      setError(
        "Erreur: Tentative de confirmation sans intention de paiement valide."
      );
      return;
    }
    // Recalculate final details just before saving (important!)
    const selectedExtrasArray = createSelectedExtrasArray();
    const selectedApartmentPriceDetails = priceDetails?.[formData.apartmentId];
    if (!selectedApartmentPriceDetails) {
      setError("Détails de prix manquants lors de la confirmation.");
      return;
    }
    const roomBasePrice = selectedApartmentPriceDetails.originalPrice || 0;
    const guestFees = calculateGuestFees(
      formData.adults,
      formData.children,
      selectedApartmentPriceDetails.settings
    );
    const extrasTotal = selectedExtrasArray.reduce(
      (sum, extra) => sum + extra.amount + (extra.extraPersonAmount || 0),
      0
    );
    const subtotalBeforeDiscounts = roomBasePrice + extrasTotal + guestFees;
    const longStayDiscount = selectedApartmentPriceDetails?.discount || 0;
    const couponDiscount = appliedCoupon ? appliedCoupon.discount : 0;
    const finalTotal = Math.max(
      0,
      subtotalBeforeDiscounts - longStayDiscount - couponDiscount
    );

    const bookingData = {
      /* ... construct final booking data ... */ ...formData,
      extras: selectedExtrasArray,
      guestFees,
      priceBreakdown: {
        basePrice: roomBasePrice,
        guestFees,
        extrasTotal: extrasTotal,
        finalPrice: finalTotal,
        couponDiscount: couponDiscount,
      },
      priceDetails: {
        ...selectedApartmentPriceDetails,
        guestFees,
        discount: longStayDiscount,
        settings: selectedApartmentPriceDetails?.settings,
      },
      price: finalTotal,
      spaDateTime: formData.spaDateTime,
      spaBookingPreference: formData.spaBookingPreference,
      couponApplied: appliedCoupon
        ? {
            /* ... */
          }
        : null,
    };

    
    localStorage.setItem("bookingData", JSON.stringify(bookingData));

    // Include payment_intent only if it exists (not a free booking)
    const paymentIntentQuery = clientSecret
      ? `?payment_intent=${clientSecret.split("_secret")[0]}`
      : "";
    navigate(`/booking-confirmation${paymentIntentQuery}`);
  };

 const handleSpaScheduleChange = useCallback(
   (value) => {
     setFormData((prev) => {
       let newState = { ...prev };
       if (value === "later") {
         newState.spaDateTime = null;
         newState.spaEndDateTime = null; // Add this field
         newState.spaSlots = null; // Add this field
         newState.spaBookingPreference = "later";
       } else if (value && value.startDateTime instanceof Date) {
         // Handle the new object format
         newState.spaDateTime = value.startDateTime.toISOString();
         newState.spaEndDateTime = value.endDateTime
           ? value.endDateTime.toISOString()
           : null;
         newState.spaSlots = value.slots || [];
         newState.spaBookingPreference = "scheduled";
       } else {
         newState.spaDateTime = null;
         newState.spaEndDateTime = null;
         newState.spaSlots = null;
         newState.spaBookingPreference = null;
       }
       return newState;
     });
     if (value !== null) {
       setSpaValidationError("");
     }
   },
   [setFormData, setSpaValidationError]
 );

  const handleApplyCoupon = async (couponCode) => {
    // ... (Coupon application logic - seems okay) ...
    try {
      const couponsRef = collection(db, "coupons");
      const q = query(
        couponsRef,
        where("code", "==", couponCode.toUpperCase())
      );
      const querySnapshot = await getDocs(q);
      if (querySnapshot.empty) {
        return { error: "not_found" };
      }
      const couponDoc = querySnapshot.docs[0];
      const couponData = couponDoc.data();
      // ... (rest of validation: status, usedCount, expiry, dates) ...
      if (
        !validateCouponPeriod(
          couponData,
          formData.arrivalDate,
          formData.departureDate
        )
      ) {
        // ... return invalid_dates error ...
        const validityStart =
          couponData.validityStartDate?.toDate?.() ||
          new Date(couponData.validityStartDate);
        const validityEnd =
          couponData.validityEndDate?.toDate?.() ||
          new Date(couponData.validityEndDate);
        const formattedStart = validityStart.toLocaleDateString("fr-BE", {
          year: "numeric",
          month: "long",
          day: "numeric",
        });
        const formattedEnd = validityEnd.toLocaleDateString("fr-BE", {
          year: "numeric",
          month: "long",
          day: "numeric",
        });
        return {
          error: "invalid_dates",
          message: `Ce code n'est valable que pour les séjours entre le ${formattedStart} et le ${formattedEnd}`,
        };
      }

      const currentRoomPriceDetails = priceDetails?.[formData.apartmentId];
      if (!currentRoomPriceDetails) {
        return {
          error: "invalid",
          message: "Veuillez d'abord sélectionner une chambre et des dates.",
        };
      }
      // Base discount calculation on price *before* other coupons/discounts if possible
      const priceToApplyDiscount =
        currentRoomPriceDetails.originalPrice +
        calculateGuestFees(
          formData.adults,
          formData.children,
          currentRoomPriceDetails.settings
        ) +
        createSelectedExtrasArray().reduce(
          (sum, extra) => sum + extra.amount + (extra.extraPersonAmount || 0),
          0
        ) -
        (currentRoomPriceDetails.discount || 0); // Price before this coupon

      let discount = 0;
      if (couponData.type === "percentage") {
        discount =
          (priceToApplyDiscount * (couponData.percentageValue || 0)) / 100;
      } else {
        discount = couponData.amount || couponData.discount || 0;
      }
      discount = Math.min(discount, priceToApplyDiscount); // Ensure discount isn't more than the price

      setAppliedCoupon({
        id: couponDoc.id,
        code: couponCode.toUpperCase(),
        type: couponData.type,
        discount /* etc */,
      });
      // Update price details correctly
      setPriceDetails((prev) => {
        if (!prev || !prev[formData.apartmentId]) return prev;
        const currentDetails = prev[formData.apartmentId];
        const newFinalPrice = currentDetails.finalPrice - discount; // Adjust current final price
        const updatedElements = [
          ...(currentDetails.priceElements || []),
          {
            type: "discount",
            name: `Code promo (${couponCode.toUpperCase()})`,
            amount: -discount /* etc */,
          },
        ];
        return {
          ...prev,
          [formData.apartmentId]: {
            ...currentDetails,
            finalPrice: Math.max(0, newFinalPrice),
            priceElements: updatedElements,
          },
        };
      });
      setCoupon("");
      setCouponError(null); // Clear error on success
      return { success: true };
    } catch (error) {
      console.error("Error applying coupon:", error);
      return { error: "invalid" };
    }
  };

  // --- Step Navigation and Validation (Make sure these are INSIDE the hook body) ---

  const isStepValid = useCallback(() => {
    // The isStepValid function definition you provided previously goes here
    switch (currentStep) {
      case 3:
        const isValidContact =
          formData.firstName &&
          formData.lastName &&
          formData.email &&
          formData.conditions;
        // Add more checks if needed (e.g., phone format)
        return isValidContact;
      case 2:
        const spaPackageSelected = SPA_ITEM_IDS.some(
          (id) => selectedExtras && selectedExtras[id] > 0
        );
        if (spaPackageSelected) {
          const spaSelectionMade =
            formData.spaDateTime || formData.spaBookingPreference === "later";
          if (!spaSelectionMade) {
            setSpaValidationError(
              t(
                "extras.spa.selectTimeOrBookLater",
                "Please select a date/time for the SPA or choose 'Book later'."
              )
            );
            return false;
          } else {
            setSpaValidationError("");
          }
        } else {
          setSpaValidationError("");
        }
        return true;
      case 1:
        // Example validation for step 1
        const roomSelected = !!formData.apartmentId;
        const datesSelected = !!startDate && !!endDate;
        if (!roomSelected) {
          // Maybe set a general error?
          //setError("Veuillez sélectionner une chambre.");
          // return false; // Uncomment to enforce room selection for step 1
        }
        if (!datesSelected) {
          // Maybe set dateError?
          // setDateError("Veuillez sélectionner les dates d'arrivée et de départ.");
          // return false; // Uncomment to enforce date selection for step 1
        }
        return true; // Or return roomSelected && datesSelected; to enforce
      default:
        return false;
    }
  }, [currentStep, formData, selectedExtras, startDate, endDate]); // Added date dependencies

  const nextStep = () => {
    // The corrected nextStep function definition goes here
    if (isStepValid()) {
      setCurrentStep((prev) => Math.min(prev + 1, 3));
    } else {
      console.log("Step is invalid, cannot proceed.");
      if (currentStep === 2) {
        const errorElement = document.getElementById("spa-validation-error");
        if (errorElement) {
          errorElement.scrollIntoView({
            behavior: "smooth",
            block: "center",
            inline: "nearest",
          });
          console.log("Scrolled to SPA validation error.");
        } else {
          console.log("SPA validation error element not found.");
        }
      }
      // Add similar scrolling for step 1 or 3 errors if needed
    }
  };

  const prevStep = () => setCurrentStep((prev) => Math.max(prev - 1, 1));

  // --- Return Values ---
  return {
    // Return all the state values and functions needed by the component
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
    spaValidationError,
    setSpaValidationError, // Expose if needed outside, otherwise maybe not

    // Handlers/Functions
    handleChange,
    handleExtraChange,
    handleSubmit,
    handlePaymentSuccess,
    handleApplyCoupon,
    nextStep,
    prevStep,
    isStepValid, // Return the validation function
    setError,
    setStartDate, // Needed by BookingForm
    setPriceDetails, // Needed by BookingForm / useAvailabilityCheck
    setEndDate, // Needed by BookingForm
    setDateError, // Needed by BookingForm
    setIsAvailable, // Needed by BookingForm / useAvailabilityCheck
    setSelectedCategory,
    setFormData, // Needed by BookingForm
    setCurrentStep, // Needed by BookingForm
    setShowPriceDetails, // Needed by BookingForm / useAvailabilityCheck
    setShowPayment,
    handleSpaScheduleChange, // Expose this
  };
}; 
