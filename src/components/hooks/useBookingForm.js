// src/components/hooks/useBookingForm.js

import { useState, useCallback, useEffect } from "react"; // Imports should be first
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
  const { t, i18n } = useTranslation();
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
    language: i18n.language,
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

  useEffect(() => {
    setFormData((prevData) => {
      if (prevData.language !== i18n.language) {
        return { ...prevData, language: i18n.language };
      }
      return prevData;
    });
  }, [i18n.language]);

  const calculateGuestFees = (adults, children, settings) => {
    if (!settings) return 0; // Add guard clause
    const totalGuests = (parseInt(adults) || 0) + (parseInt(children) || 0);
    const extraGuests = Math.max(
      0,
      totalGuests - (settings.startingAtGuest || 2)
    ); // Default startingAtGuest if missing
    return extraGuests * (settings.extraGuestsPerNight || 0); // Default extraGuestsPerNight if missing
  };

  // useBookingForm.js
  const validateCouponPeriod = (couponData, arrival, departure) => {
    if (!arrival || !departure) {
      console.warn("validateCouponPeriod: Missing arrival or departure date.");
      return false; // Or true depending on how you want to handle this incomplete data
    }

    // Get JS Dates from Firestore Timestamps (or null if not set)
    let validityStart = null;
    if (couponData?.validityStartDate) {
      if (couponData.validityStartDate.toDate) {
        // It's a Firestore Timestamp
        validityStart = couponData.validityStartDate.toDate();
      } else if (couponData.validityStartDate instanceof Date) {
        // Already a JS Date
        validityStart = couponData.validityStartDate;
      } else {
        // Try parsing if it's a string (less likely from Firestore directly for dates)
        try {
          validityStart = new Date(couponData.validityStartDate);
        } catch (e) {
          validityStart = null;
        }
      }
    }

    let validityEnd = null;
    if (couponData?.validityEndDate) {
      if (couponData.validityEndDate.toDate) {
        // Firestore Timestamp
        validityEnd = couponData.validityEndDate.toDate();
      } else if (couponData.validityEndDate instanceof Date) {
        // JS Date
        validityEnd = couponData.validityEndDate;
      } else {
        try {
          validityEnd = new Date(couponData.validityEndDate);
        } catch (e) {
          validityEnd = null;
        }
      }
    }

    // If the coupon has no specific validity period defined, it's considered valid for any date.
    if (!validityStart || !validityEnd) {
      console.log(
        "Coupon has no defined validity period, considered valid for dates."
      );
      return true;
    }

    // Ensure all dates are valid before comparison
    const bookingStart = new Date(arrival);
    const bookingEnd = new Date(departure);

    if (
      isNaN(validityStart.getTime()) ||
      isNaN(validityEnd.getTime()) ||
      isNaN(bookingStart.getTime()) ||
      isNaN(bookingEnd.getTime())
    ) {
      console.warn("validateCouponPeriod: One or more dates are invalid.", {
        validityStart,
        validityEnd,
        bookingStart,
        bookingEnd,
      });
      return false; // One of the crucial dates is invalid
    }

    // Actual comparison logic:
    // Booking period must overlap with the coupon's validity period.
    // Booking start must be before or on coupon end.
    // Booking end must be after or on coupon start.
    const isBookingStartValid = bookingStart <= validityEnd;
    const isBookingEndValid = bookingEnd >= validityStart;

    console.log("Coupon Validity Check:", {
      couponCode: couponData.code,
      couponStart: validityStart.toISOString(),
      couponEnd: validityEnd.toISOString(),
      bookingStart: bookingStart.toISOString(),
      bookingEnd: bookingEnd.toISOString(),
      isBookingStartValid,
      isBookingEndValid,
      overall: isBookingStartValid && isBookingEndValid,
    });

    return isBookingStartValid && isBookingEndValid;
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
      console.log("Form submit blocked, final step invalid.");
      return;
    }
    if (
      appliedCoupon &&
      !validateCouponPeriod(
        appliedCoupon,
        formData.arrivalDate,
        formData.departureDate
      )
    ) {
      setError(
        t(
          "booking.coupon.errors.invalidDatesSubmit",
          "Le code promo n'est plus valable pour ces dates. Veuillez le retirer ou changer vos dates."
        )
      );
      return;
    }

    const selectedRoomPrice = priceDetails?.[formData.apartmentId];
    const settings = selectedRoomPrice?.settings;

    if (!selectedRoomPrice || !settings) {
      setError(
        t(
          "booking.errors.priceDetailsMissing",
          "Les détails du prix ne sont pas disponibles. Veuillez sélectionner des dates et une chambre valide."
        )
      );
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const selectedExtrasArray = createSelectedExtrasArray();
      const guestFees = calculateGuestFees(
        formData.adults,
        formData.children,
        settings
      );
      const basePrice = selectedRoomPrice.originalPrice || 0;
      const extrasTotal = selectedExtrasArray.reduce(
        (sum, extra) =>
          sum + (extra.amount || 0) + (extra.extraPersonAmount || 0),
        0
      );

      const subtotalBeforeDiscounts = basePrice + extrasTotal + guestFees;
      const longStayDiscount = selectedRoomPrice.discount || 0;
      const couponDiscountAmount = appliedCoupon ? appliedCoupon.discount : 0;

      // Calculate total after long-stay discount but before coupon
      const totalAfterLongStay = Math.max(
        0,
        subtotalBeforeDiscounts - longStayDiscount
      );

      // Calculate final total after coupon application
      const finalTotal = Math.max(0, totalAfterLongStay - couponDiscountAmount);

      // --- CORE CHANGE: Enforce that the payable amount MUST be greater than 0 ---
      if (finalTotal <= 0) {
        setError(
          t(
            "booking.errors.mustPayAboveZero",
            "Le montant total de la réservation est de 0€ ou moins. Pour finaliser votre réservation, veuillez ajouter des extras ou ajuster votre sélection afin que le montant à payer soit supérieur à 0€."
          )
        );
        setLoading(false);
        return; // Stop processing, user needs to adjust booking
      }
      // --- END OF CORE CHANGE ---

      // If we reach here, finalTotal > 0, so proceed to create payment intent
      const bookingDataForPayment = {
        ...formData,
        price: finalTotal, // This is the amount for Stripe
        basePrice: basePrice, // Original room price before any discounts
        longStayDiscount: longStayDiscount,
        guestFees,
        extras: selectedExtrasArray,
        extrasTotal: extrasTotal,
        couponApplied: appliedCoupon
          ? {
              code: appliedCoupon.code,
              discount: couponDiscountAmount,
              type: appliedCoupon.type,
              isGiftVoucher: appliedCoupon.isGiftVoucher,
              originalAmount: appliedCoupon.originalAmount, // Store original coupon value
            }
          : null,
        // Detailed breakdown for records or confirmation
        priceBreakdown: {
          roomBasePrice: basePrice,
          calculatedExtrasTotal: extrasTotal,
          calculatedGuestFees: guestFees,
          subtotal: subtotalBeforeDiscounts,
          appliedLongStayDiscount: longStayDiscount,
          totalAfterLongStayDiscount: totalAfterLongStay,
          appliedCouponDiscount: couponDiscountAmount,
          finalPayableAmount: finalTotal, // The amount to be paid
        },
        // Snapshot of the price details used for this calculation
        priceDetailsSnapshot: {
          ...selectedRoomPrice, // Includes originalPrice, discount (long-stay), settings etc.
          guestFees, // Add calculated guest fees here too for the snapshot
        },
      };

      const response = await api.post("/create-payment-intent", {
        price: finalTotal, // Amount in currency's smallest unit if required by backend (e.g., cents for EUR)
        currency: "eur", // Or your default currency
        bookingData: bookingDataForPayment, // Send booking details for metadata or server-side processing
      });

      setClientSecret(response.data.clientSecret);
      setShowPayment(true);
      // setError(null); // Already cleared at the beginning of try block
    } catch (err) {
      console.error("Error creating payment or processing booking:", err);
      setError(
        err.response?.data?.error ||
          t(
            "booking.errors.paymentCreationError",
            "Une erreur s'est produite lors de la création du paiement ou du traitement de la réservation."
          )
      );
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentSuccess = () => {
    // Removed isFreeBooking flag
    if (!clientSecret) {
      setError(
        t(
          "booking.errors.missingPaymentIntentOnSuccess",
          "Erreur: Tentative de confirmation sans intention de paiement valide."
        )
      );
      return;
    }

    // Recalculate final details just before saving for data integrity.
    // This should ideally use the same source data as handleSubmit to avoid discrepancies.
    const selectedExtrasArray = createSelectedExtrasArray();
    const selectedApartmentPriceDetails = priceDetails?.[formData.apartmentId];

    if (!selectedApartmentPriceDetails) {
      setError(
        t(
          "booking.errors.priceDetailsMissingConfirm",
          "Détails de prix manquants lors de la confirmation."
        )
      );
      return;
    }

    const roomOriginalPrice = selectedApartmentPriceDetails.originalPrice || 0;
    const currentSettings = selectedApartmentPriceDetails.settings;
    const guestFees = calculateGuestFees(
      formData.adults,
      formData.children,
      currentSettings
    );
    const extrasTotal = selectedExtrasArray.reduce(
      (sum, extra) =>
        sum + (extra.amount || 0) + (extra.extraPersonAmount || 0),
      0
    );

    const subtotalBeforeDiscounts = roomOriginalPrice + extrasTotal + guestFees;
    const longStayDiscount = selectedApartmentPriceDetails?.discount || 0;
    const couponDiscount = appliedCoupon ? appliedCoupon.discount : 0;

    const totalAfterLongStay = Math.max(
      0,
      subtotalBeforeDiscounts - longStayDiscount
    );
    const finalTotal = Math.max(0, totalAfterLongStay - couponDiscount);

    // At this point, finalTotal should be > 0 because handleSubmit enforced it.
    // If it's somehow <=0 here, it indicates an inconsistency, but we proceed with what's calculated.

    const bookingDataToSave = {
      ...formData,
      extras: selectedExtrasArray,
      guestFees, // Calculated guest fees
      priceBreakdown: {
        roomBasePrice: roomOriginalPrice,
        calculatedExtrasTotal: extrasTotal,
        calculatedGuestFees: guestFees,
        subtotal: subtotalBeforeDiscounts,
        appliedLongStayDiscount: longStayDiscount,
        totalAfterLongStayDiscount: totalAfterLongStay,
        appliedCouponDiscount: couponDiscount,
        finalPayableAmount: finalTotal, // The amount that was paid
      },
      priceDetailsSnapshot: {
        ...selectedApartmentPriceDetails,
        guestFees,
      },
      price: finalTotal, // Final amount paid
      spaDateTime: formData.spaDateTime,
      spaEndDateTime: formData.spaEndDateTime, // Ensure these are correctly populated if used
      spaSlots: formData.spaSlots, // Ensure these are correctly populated if used
      spaBookingPreference: formData.spaBookingPreference,
      couponApplied: appliedCoupon
        ? {
            code: appliedCoupon.code,
            discount: appliedCoupon.discount,
            type: appliedCoupon.type,
            isGiftVoucher: appliedCoupon.isGiftVoucher,
            originalAmount: appliedCoupon.originalAmount,
            percentageValue: appliedCoupon.percentageValue,
          }
        : null,
    };

    localStorage.setItem("bookingData", JSON.stringify(bookingDataToSave));

    const paymentIntentQuery = clientSecret
      ? `?payment_intent=${clientSecret.split("_secret")[0]}`
      : ""; // This should always be populated if we reach here
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
    setError(null); // Clear previous general errors
    setCouponError(null); // Clear previous coupon-specific errors

    try {
      const couponsRef = collection(db, "coupons");
      const q = query(
        couponsRef,
        where("code", "==", couponCode.toUpperCase())
      );
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        return {
          error: "not_found",
          message: t("booking.coupon.errors.notFound"),
        };
      }

      const couponDoc = querySnapshot.docs[0];
      const couponData = { id: couponDoc.id, ...couponDoc.data() };

      if (couponData.status !== "active") {
        return {
          error: "inactive",
          message: t("booking.coupon.errors.inactive"),
        };
      }
      if (couponData.maxUsage && couponData.usedCount >= couponData.maxUsage) {
        // Check maxUsage only if defined
        return {
          error: "used",
          message: t("booking.coupon.errors.maxUsageReached"),
        };
      }

      const now = new Date();
      const expiryDate = couponData.expiryDate?.toDate
        ? couponData.expiryDate.toDate()
        : couponData.expiryDate
        ? new Date(couponData.expiryDate)
        : null;
      if (expiryDate && now > expiryDate) {
        return {
          error: "expired",
          message: t("booking.coupon.errors.expired"),
        };
      }

      if (
        !validateCouponPeriod(
          couponData,
          formData.arrivalDate,
          formData.departureDate
        )
      ) {
        const validityStart =
          couponData.validityStartDate?.toDate?.() ||
          new Date(couponData.validityStartDate);
        const validityEnd =
          couponData.validityEndDate?.toDate?.() ||
          new Date(couponData.validityEndDate);
        return {
          error: "invalid_dates",
          message: t("booking.coupon.errors.invalid_dates", {
            start: validityStart.toLocaleDateString(i18n.language, {
              year: "numeric",
              month: "long",
              day: "numeric",
            }),
            end: validityEnd.toLocaleDateString(i18n.language, {
              year: "numeric",
              month: "long",
              day: "numeric",
            }),
          }),
        };
      }

      const currentRoomPriceDetails = priceDetails?.[formData.apartmentId];
      if (
        !currentRoomPriceDetails ||
        currentRoomPriceDetails.originalPrice === undefined
      ) {
        return {
          error: "invalid_room_selection",
          message: t(
            "booking.coupon.errors.selectRoomFirst",
            "Veuillez sélectionner une chambre et des dates valides avant d'appliquer un code."
          ),
        };
      }

      // --- START OF MODIFIED LOGIC FOR COUPON APPLICATION ---

      const isGiftCard = couponData.isGiftVoucher === true;

      // Calculate price components
      const roomOriginalPrice = currentRoomPriceDetails.originalPrice || 0;
      const longStayDiscount = currentRoomPriceDetails.discount || 0;
      const roomPriceAfterLongStay = Math.max(
        0,
        roomOriginalPrice - longStayDiscount
      );

      const selectedExtrasArrayForCoupon = createSelectedExtrasArray();
      const extrasTotalForCoupon = selectedExtrasArrayForCoupon.reduce(
        (sum, extra) =>
          sum + (extra.amount || 0) + (extra.extraPersonAmount || 0),
        0
      );

      const guestFeesForCoupon = calculateGuestFees(
        formData.adults,
        formData.children,
        currentRoomPriceDetails.settings
      );

      let priceEligibleForDiscountTotal;

      if (isGiftCard) {
        // Gift cards apply to the total booking value (room after long stay + extras + guest fees)
        priceEligibleForDiscountTotal =
          roomPriceAfterLongStay + extrasTotalForCoupon + guestFeesForCoupon;
      } else {
        // Promo codes apply only to the room price (after long-stay discount)
        priceEligibleForDiscountTotal = roomPriceAfterLongStay;
      }
      priceEligibleForDiscountTotal = Math.max(
        0,
        priceEligibleForDiscountTotal
      ); // Ensure it's not negative

      // Validation: If it's a promo code, there must be a positive room price to apply it to.
      if (
        !isGiftCard &&
        roomPriceAfterLongStay <= 0 &&
        (couponData.percentageValue > 0 || couponData.amount > 0)
      ) {
        return {
          error: "no_amount_for_promo",
          message: t(
            "booking.coupon.errors.noAmountToDiscountRoom",
            "Le prix de la chambre n'est pas éligible à une réduction promotionnelle."
          ),
        };
      }

      // If total eligible amount for discount is zero, coupon (even gift card) will result in zero discount value.
      if (
        priceEligibleForDiscountTotal <= 0 &&
        (couponData.percentageValue > 0 || couponData.amount > 0)
      ) {
        // This means the entire booking is already free or less, so coupon provides no further discount.
        // This is not an error, but the discount will be 0.
        // We can proceed, and calculatedDiscount will naturally be 0.
      }

      let calculatedDiscount = 0;
      if (couponData.type === "percentage" && couponData.percentageValue > 0) {
        if (isGiftCard) {
          // Percentage gift cards apply to the total eligible amount
          calculatedDiscount =
            (priceEligibleForDiscountTotal * couponData.percentageValue) / 100;
        } else {
          // Percentage promo codes apply only to room price after long stay
          calculatedDiscount =
            (roomPriceAfterLongStay * couponData.percentageValue) / 100;
        }
      } else if (couponData.type === "fixed" && couponData.amount > 0) {
        calculatedDiscount = couponData.amount;
      }

      // The discount cannot exceed the price it's being applied to.
      // For gift cards, this means it can cover up to the total eligible amount.
      // For promo codes, it can cover up to the room price after long stay.
      calculatedDiscount = Math.min(
        calculatedDiscount,
        priceEligibleForDiscountTotal
      );

      calculatedDiscount = parseFloat(calculatedDiscount.toFixed(2));
      calculatedDiscount = Math.max(0, calculatedDiscount); // Ensure discount is not negative

      // If a coupon that should provide value results in 0 discount (e.g. total eligible price was 0)
      // it's not an error, it just means no discount is applied. The coupon is still "valid".
      // The user specifically wants gift cards to apply their "whole value", which Math.min handles correctly relative to the total.

      const couponToApply = {
        id: couponData.id,
        code: couponData.code,
        type: couponData.type,
        discount: calculatedDiscount,
        originalAmount: couponData.amount || null, // Store original fixed amount if any
        percentageValue: couponData.percentageValue || null,
        isGiftVoucher: isGiftCard, // Store if it's a gift voucher
        // You might want to store more couponData fields if needed later
      };

      setAppliedCoupon(couponToApply);
      // Clear coupon code input on successful application
      // setCoupon(""); // Optionally clear the input field via parent component state

      return {
        success: true,
        appliedCouponData: couponToApply,
        message: t(
          "booking.coupon.success",
          "Code promo appliqué avec succès !"
        ),
      };

      // --- END OF MODIFIED LOGIC ---
    } catch (error) {
      console.error("Error applying coupon in useBookingForm:", error);
      // Set a generic error for unexpected issues
      return {
        error: "invalid",
        message: t("errors.generic", "Une erreur s'est produite."),
      };
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
