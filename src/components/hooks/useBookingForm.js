// src/components/hooks/useBookingForm.js

import { useState, useCallback, useEffect } from "react";
import { api } from "../utils/api";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../../firebase"; // Adjust the import path as needed
import { extraCategories } from "../extraCategories";
import { useNavigate } from "react-router-dom";
// roomsData import was commented out in your provided code, keeping it that way.
// import { roomsData } from "../hooks/roomsData";
import { useTranslation } from "react-i18next";

// Assuming DRINK_OFFER_CONFIG and ALL_DRINK_ITEMS_MAP are exported from InfoSupSection.js
// Adjust this path if they are in a different shared constants file.
// e.g., if InfoSupSection.js is in src/components/booking/InfoSupSection.js
// and useBookingForm.js is in src/components/hooks/useBookingForm.js
// then the relative path would be '../booking/InfoSupSection'
import {
  DRINK_OFFER_CONFIG,
  ALL_DRINK_ITEMS_MAP,
} from "../booking/InfoSupSection";

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
    channelId: 2323525, // Example Channel ID
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
    price: "", // This will be dynamically calculated
    priceStatus: 1, // Example status
    deposit: 0, // Example deposit
    depositStatus: 1, // Example status
    language: i18n.language,
    street: "",
    postalCode: "",
    location: "",
    country: "",
    spaDateTime: null,
    spaBookingPreference: null, // 'later' or 'scheduled'
    // spaEndDateTime and spaSlots are handled by handleSpaScheduleChange if SpaScheduler provides them
    conditions: false,
    selectedFreeDrinks: {}, // For storing selected free drinks
  });
  const [currentStep, setCurrentStep] = useState(1);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isAvailable, setIsAvailable] = useState(false); // Availability from Smoobu
  const [showPriceDetails, setShowPriceDetails] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [showPayment, setShowPayment] = useState(false);
  const [dateError, setDateError] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("packs"); // For extras section
  const [priceDetails, setPriceDetails] = useState(null); // From Smoobu getPrice
  const [clientSecret, setClientSecret] = useState(""); // For Stripe
  const [selectedExtras, setSelectedExtras] = useState({});
  const [spaValidationError, setSpaValidationError] = useState("");
  const [startDate, setStartDate] = useState(null); // For date picker
  const [endDate, setEndDate] = useState(null); // For date picker
  const [coupon, setCoupon] = useState(""); // Input field for coupon code
  const [appliedCoupon, setAppliedCoupon] = useState(null); // The successfully applied coupon object
  const [couponError, setCouponError] = useState(null); // Error message for coupon input

  useEffect(() => {
    setFormData((prevData) => {
      if (prevData.language !== i18n.language) {
        return { ...prevData, language: i18n.language };
      }
      return prevData;
    });
  }, [i18n.language]);

  // Effect to clear free drink selections if triggering extras are removed
  useEffect(() => {
    if (!DRINK_OFFER_CONFIG || Object.keys(DRINK_OFFER_CONFIG).length === 0) {
      // console.warn("DRINK_OFFER_CONFIG is not available or empty in useBookingForm useEffect for clearing free drinks.");
      return;
    }

    const activeOfferKeys = Object.values(DRINK_OFFER_CONFIG)
      .filter((offer) =>
        offer.triggeringExtras.some((id) => selectedExtras[id] > 0)
      )
      .map((offer) => offer.key);

    setFormData((prevData) => {
      const currentSelectedFreeDrinks = prevData.selectedFreeDrinks || {};
      const newSelectedFreeDrinks = { ...currentSelectedFreeDrinks };
      let changed = false;

      Object.keys(currentSelectedFreeDrinks).forEach((offerKey) => {
        if (!activeOfferKeys.includes(offerKey)) {
          delete newSelectedFreeDrinks[offerKey];
          changed = true;
        }
      });

      return changed
        ? { ...prevData, selectedFreeDrinks: newSelectedFreeDrinks }
        : prevData;
    });
  }, [selectedExtras]); // DRINK_OFFER_CONFIG is stable due to import

  const calculateGuestFees = (adults, children, settings) => {
    if (!settings) return 0;
    const totalGuests = (parseInt(adults) || 0) + (parseInt(children) || 0);
    const extraGuests = Math.max(
      0,
      totalGuests - (settings.startingAtGuest || 2)
    );
    return extraGuests * (settings.extraGuestsPerNight || 0);
  };

  const validateCouponPeriod = (couponData, arrival, departure) => {
    if (!arrival || !departure) {
      // console.warn("validateCouponPeriod: Missing arrival or departure date.");
      return false;
    }
    let validityStart = null;
    if (couponData?.validityStartDate) {
      validityStart = couponData.validityStartDate.toDate
        ? couponData.validityStartDate.toDate()
        : new Date(couponData.validityStartDate);
    }
    let validityEnd = null;
    if (couponData?.validityEndDate) {
      validityEnd = couponData.validityEndDate.toDate
        ? couponData.validityEndDate.toDate()
        : new Date(couponData.validityEndDate);
    }
    if (!validityStart || !validityEnd) return true; // No period defined, considered valid
    const bookingStart = new Date(arrival);
    const bookingEnd = new Date(departure);
    if (
      isNaN(validityStart.getTime()) ||
      isNaN(validityEnd.getTime()) ||
      isNaN(bookingStart.getTime()) ||
      isNaN(bookingEnd.getTime())
    ) {
      return false;
    }
    return bookingStart <= validityEnd && bookingEnd >= validityStart;
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    const val = type === "checkbox" ? checked : value;
    setFormData((prevData) => ({ ...prevData, [name]: val }));
    if (name === "arrivalDate" || name === "departureDate") {
      setShowPriceDetails(false);
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
          setCouponError(
            t(
              "booking.coupon.errors.noLongerValidForDates",
              "Le code promo n'est plus valable pour ces dates."
            )
          );
        }
      }
    }
  };

  const handleExtraChange = (extraId, quantity) => {
    if (quantity < 0) return; // Quantity cannot be negative
    setSelectedExtras((prev) => {
      const updatedExtras = { ...prev, [extraId]: quantity };
      // If main extra quantity is zero, also zero out its -extra counterpart
      if (!extraId.endsWith("-extra") && quantity === 0) {
        const extraPersonId = `${extraId}-extra`;
        if (prev[extraPersonId]) {
          updatedExtras[extraPersonId] = 0;
        }
      }
      return updatedExtras;
    });
    // Clear SPA validation error if a SPA extra affecting validation is changed
    if (SPA_ITEM_IDS.includes(extraId)) {
      const anySpaStillSelected = SPA_ITEM_IDS.some(
        (id) =>
          (selectedExtras[id] > 0 && id !== extraId) ||
          (id === extraId && quantity > 0)
      );
      if (!anySpaStillSelected) {
        setSpaValidationError("");
        // Also reset SPA selection in formData if no SPA item is selected anymore
        setFormData((prev) => ({
          ...prev,
          spaDateTime: null,
          spaBookingPreference: null,
          spaEndDateTime: null, // if you use this
          spaSlots: null, // if you use this
        }));
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
        const extraDetails = Object.values(extraCategories)
          .flatMap((cat) => cat.items)
          .find((item) => item.id === baseExtraId);
        if (!extraDetails) return;

        if (isExtraPerson) {
          const baseExtra = extrasMap.get(baseExtraId);
          if (baseExtra) {
            baseExtra.extraPersonQuantity = quantity;
            baseExtra.extraPersonAmount =
              (extraDetails.extraPersonPrice || 0) * quantity;
          }
        } else {
          extrasMap.set(baseExtraId, {
            type: "addon", // Smoobu expects this type for extras
            name: t(extraDetails.name, extraDetails.name), // Translate if name is a key, else use name directly
            amount: (extraDetails.price || 0) * quantity,
            quantity: quantity,
            currencyCode: "EUR", // Or your default currency
            // Fields for potential extra person pricing for this main extra
            extraPersonPrice: extraDetails.extraPersonPrice || 0,
            extraPersonQuantity: 0, // Will be updated if -extra variant exists
            extraPersonAmount: 0, // Will be updated if -extra variant exists
          });
        }
      });
    return Array.from(extrasMap.values());
  };

  const handleFreeDrinkChange = useCallback((offerKey, payload) => {
    // console.log(`useBookingForm: handleFreeDrinkChange - offerKey: ${offerKey}, payload:`, payload);

    // Guard clause: Ensure DRINK_OFFER_CONFIG is available.
    // This should be imported or defined in a scope accessible to useBookingForm.
    if (!DRINK_OFFER_CONFIG) {
      console.error(
        "useBookingForm: DRINK_OFFER_CONFIG is not available in handleFreeDrinkChange."
      );
      return;
    }

    setFormData((prevData) => {
      // Clone the existing selectedFreeDrinks or initialize if it doesn't exist
      const newSelectedFreeDrinks = { ...(prevData.selectedFreeDrinks || {}) };
      const offerConfig = DRINK_OFFER_CONFIG[offerKey];

      // Guard clause: If no config for the offer key, return previous data
      if (!offerConfig) {
        console.warn(
          `useBookingForm: No configuration found for drink offer key: ${offerKey}`
        );
        return prevData;
      }

      // Ensure the entry for the current offerKey exists in newSelectedFreeDrinks with the correct initial structure
      // This is important if an offer becomes active and this is the first interaction with it.
      if (!newSelectedFreeDrinks[offerKey]) {
        if (offerConfig.type === "wine_choice") {
          newSelectedFreeDrinks[offerKey] = {
            selection: null,
            chooseNonAlcoholicLater: false,
          };
        } else if (offerConfig.type === "soft_beer_choice") {
          newSelectedFreeDrinks[offerKey] = {}; // For softs/beers, it's an object of { drinkId: quantity }
        } else {
          // Should not happen if DRINK_OFFER_CONFIG is well-defined
          console.warn(
            `useBookingForm: Unknown offer type for offerKey: ${offerKey}`
          );
          return prevData;
        }
      }

      // Get the current state for the specific offer being changed
      let currentOfferState = newSelectedFreeDrinks[offerKey];

      // --- Logic for Wine Offers ---
      if (offerConfig.type === "wine_choice") {
        // Ensure currentOfferState for wine has the expected structure
        let wineOfferData = {
          selection: null,
          chooseNonAlcoholicLater: false,
          ...(currentOfferState || {}), // Spread existing state or default
        };

        if (payload.type === "CHOOSE_NON_ALCOHOLIC_LATER") {
          // User toggled the "choose non-alcoholic later" checkbox
          // Expected payload: { type: 'CHOOSE_NON_ALCOHOLIC_LATER', value: boolean }
          wineOfferData.chooseNonAlcoholicLater = payload.value;
          if (payload.value === true) {
            // If they choose "later", clear any existing wine selection for this offer
            wineOfferData.selection = null;
          }
        } else if (payload.selectedWineId !== undefined) {
          // User selected a specific wine (or cleared it by passing null)
          // Expected payload: { selectedWineId: 'wine_id_string' or null }
          wineOfferData.selection = payload.selectedWineId;
          // If a wine is actively selected, they are not choosing "non-alcoholic later"
          wineOfferData.chooseNonAlcoholicLater = false;
        }
        newSelectedFreeDrinks[offerKey] = wineOfferData;

        // --- Logic for Soft/Beer Offers ---
      } else if (offerConfig.type === "soft_beer_choice") {
        // currentOfferState for soft/beer is an object like { drink_id: quantity }
        let softBeerSelections = { ...(currentOfferState || {}) }; // Ensure it's an object

        // Expected payload for soft/beer: { drinkId: 'drink_id_string', newQuantity: number }
        const { drinkId, newQuantity } = payload;

        if (drinkId !== undefined && typeof newQuantity === "number") {
          let totalSelectedForThisOffer = 0;
          // Calculate current total quantity for this offer, excluding the item being changed
          Object.keys(softBeerSelections).forEach((id) => {
            if (id !== drinkId) {
              totalSelectedForThisOffer += softBeerSelections[id];
            }
          });

          if (newQuantity > 0) {
            // Check against the offer's maxTotal
            if (
              totalSelectedForThisOffer + newQuantity <=
              offerConfig.maxTotal
            ) {
              softBeerSelections[drinkId] = newQuantity;
            } else {
              // If exceeding max, set to the remaining allowed quantity (can be 0)
              softBeerSelections[drinkId] = Math.max(
                0,
                offerConfig.maxTotal - totalSelectedForThisOffer
              );
            }
          } else {
            // If newQuantity is 0 or less, remove the drink from selections
            delete softBeerSelections[drinkId];
          }
        }
        newSelectedFreeDrinks[offerKey] = softBeerSelections;
      }

      // Return the updated formData
      return { ...prevData, selectedFreeDrinks: newSelectedFreeDrinks };
    });
  }, []); // Empty dependency array because DRINK_OFFER_CONFIG is a stable import
  // and setFormData from useState is guaranteed to be stable.

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
      setError(t("booking.coupon.errors.invalidDatesSubmit"));
      return;
    }

    const selectedRoomPrice = priceDetails?.[formData.apartmentId];
    const settings = selectedRoomPrice?.settings;
    if (!selectedRoomPrice || !settings) {
      setError(t("booking.errors.priceDetailsMissing"));
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
      const longStayDiscount = selectedRoomPrice.discount || 0; // This is the Smoobu calculated long-stay discount
      const couponDiscountAmount = appliedCoupon ? appliedCoupon.discount : 0;
      const totalAfterLongStay = Math.max(
        0,
        subtotalBeforeDiscounts - longStayDiscount
      );
      const finalTotal = Math.max(0, totalAfterLongStay - couponDiscountAmount);

      if (finalTotal <= 0) {
        setError(t("booking.errors.mustPayAboveZero"));
        setLoading(false);
        return;
      }

      const bookingDataForPayment = {
        ...formData, // Includes selectedFreeDrinks
        price: finalTotal,
        basePrice: basePrice,
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
              originalAmount: appliedCoupon.originalAmount,
              percentageValue: appliedCoupon.percentageValue,
            }
          : null,
        priceBreakdown: {
          roomBasePrice: basePrice,
          calculatedExtrasTotal: extrasTotal,
          calculatedGuestFees: guestFees,
          subtotal: subtotalBeforeDiscounts,
          appliedLongStayDiscount: longStayDiscount,
          totalAfterLongStayDiscount: totalAfterLongStay,
          appliedCouponDiscount: couponDiscountAmount,
          finalPayableAmount: finalTotal,
        },
        priceDetailsSnapshot: { ...selectedRoomPrice, guestFees },
      };

      const response = await api.post("/create-payment-intent", {
        price: finalTotal,
        currency: "eur",
        bookingData: bookingDataForPayment,
      });
      setClientSecret(response.data.clientSecret);
      setShowPayment(true);
    } catch (err) {
      console.error("Error creating payment or processing booking:", err);
      setError(
        err.response?.data?.error || t("booking.errors.paymentCreationError")
      );
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentSuccess = () => {
    if (!clientSecret) {
      setError(t("booking.errors.missingPaymentIntentOnSuccess"));
      return;
    }
    const selectedExtrasArray = createSelectedExtrasArray();
    const selectedApartmentPriceDetails = priceDetails?.[formData.apartmentId];
    if (!selectedApartmentPriceDetails) {
      setError(t("booking.errors.priceDetailsMissingConfirm"));
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

    const bookingDataToSave = {
      ...formData, // Includes selectedFreeDrinks
      extras: selectedExtrasArray,
      guestFees,
      priceBreakdown: {
        roomBasePrice: roomOriginalPrice,
        calculatedExtrasTotal: extrasTotal,
        calculatedGuestFees: guestFees,
        subtotal: subtotalBeforeDiscounts,
        appliedLongStayDiscount: longStayDiscount,
        totalAfterLongStayDiscount: totalAfterLongStay,
        appliedCouponDiscount: couponDiscount,
        finalPayableAmount: finalTotal,
      },
      priceDetailsSnapshot: { ...selectedApartmentPriceDetails, guestFees },
      price: finalTotal,
      // spaDateTime, spaEndDateTime, spaSlots, spaBookingPreference are already in formData
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
      : "";
    navigate(`/booking-confirmation${paymentIntentQuery}`);
  };

  const handleSpaScheduleChange = useCallback(
    (value) => {
      setFormData((prev) => {
        let newState = { ...prev };
        if (value === "later") {
          newState.spaDateTime = null;
          newState.spaEndDateTime = null;
          newState.spaSlots = null;
          newState.spaBookingPreference = "later";
        } else if (value && value.startDateTime instanceof Date) {
          newState.spaDateTime = value.startDateTime.toISOString();
          newState.spaEndDateTime = value.endDateTime
            ? value.endDateTime.toISOString()
            : null;
          newState.spaSlots = value.slots || [];
          newState.spaBookingPreference = "scheduled";
        } else {
          // Handles null or unexpected value by resetting
          newState.spaDateTime = null;
          newState.spaEndDateTime = null;
          newState.spaSlots = null;
          newState.spaBookingPreference = null;
        }
        return newState;
      });
      if (value !== null) {
        // If any selection (later or specific time) is made
        setSpaValidationError("");
      }
    },
    [setFormData, setSpaValidationError]
  ); // setSpaValidationError was missing

  const handleApplyCoupon = async (couponCode) => {
    setError(null);
    setCouponError(null);
    try {
      const couponsRef = collection(db, "coupons");
      const q = query(
        couponsRef,
        where("code", "==", couponCode.toUpperCase())
      );
      const querySnapshot = await getDocs(q);
      if (querySnapshot.empty)
        return {
          error: "not_found",
          message: t("booking.coupon.errors.notFound"),
        };
      const couponDoc = querySnapshot.docs[0];
      const couponData = { id: couponDoc.id, ...couponDoc.data() };
      if (couponData.status !== "active")
        return {
          error: "inactive",
          message: t("booking.coupon.errors.inactive"),
        };
      if (couponData.maxUsage && couponData.usedCount >= couponData.maxUsage)
        return {
          error: "maxUsageReached",
          message: t("booking.coupon.errors.maxUsageReached"),
        };
      const now = new Date();
      const expiryDate = couponData.expiryDate?.toDate
        ? couponData.expiryDate.toDate()
        : couponData.expiryDate
        ? new Date(couponData.expiryDate)
        : null;
      if (expiryDate && now > expiryDate)
        return {
          error: "expired",
          message: t("booking.coupon.errors.expired"),
        };
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
      )
        return {
          error: "invalid_room_selection",
          message: t("booking.coupon.errors.selectRoomFirst"),
        };

      const isGiftCard = couponData.isGiftVoucher === true;
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
      let priceEligibleForDiscountTotal = isGiftCard
        ? roomPriceAfterLongStay + extrasTotalForCoupon + guestFeesForCoupon
        : roomPriceAfterLongStay;
      priceEligibleForDiscountTotal = Math.max(
        0,
        priceEligibleForDiscountTotal
      );

      if (
        !isGiftCard &&
        roomPriceAfterLongStay <= 0 &&
        (couponData.percentageValue > 0 || couponData.amount > 0)
      ) {
        return {
          error: "no_amount_for_promo",
          message: t("booking.coupon.errors.noAmountToDiscountRoom"),
        };
      }

      let calculatedDiscount = 0;
      if (couponData.type === "percentage" && couponData.percentageValue > 0) {
        calculatedDiscount =
          (priceEligibleForDiscountTotal * couponData.percentageValue) / 100;
      } else if (couponData.type === "fixed" && couponData.amount > 0) {
        calculatedDiscount = couponData.amount;
      }
      calculatedDiscount = Math.min(
        calculatedDiscount,
        priceEligibleForDiscountTotal
      );
      calculatedDiscount = parseFloat(calculatedDiscount.toFixed(2));
      calculatedDiscount = Math.max(0, calculatedDiscount);

      const couponToApply = {
        id: couponData.id,
        code: couponData.code,
        type: couponData.type,
        discount: calculatedDiscount,
        originalAmount: couponData.amount || null,
        percentageValue: couponData.percentageValue || null,
        isGiftVoucher: isGiftCard,
      };
      setAppliedCoupon(couponToApply);
      return {
        success: true,
        appliedCouponData: couponToApply,
        message: t("booking.coupon.success"),
      };
    } catch (error) {
      console.error("Error applying coupon in useBookingForm:", error);
      return { error: "invalid", message: t("errors.generic") };
    }
  };

  const isStepValid = useCallback(() => {
    switch (currentStep) {
      case 3:
        return (
          formData.firstName &&
          formData.lastName &&
          formData.email &&
          formData.conditions
        );
      case 2:
        const spaPackageSelected = SPA_ITEM_IDS.some(
          (id) => selectedExtras && selectedExtras[id] > 0
        );
        if (spaPackageSelected) {
          const spaSelectionMade =
            formData.spaDateTime || formData.spaBookingPreference === "later";
          if (!spaSelectionMade) {
            setSpaValidationError(t("extras.spa.selectTimeOrBookLater"));
            return false;
          } else {
            setSpaValidationError(""); // Clear error if selection is made
          }
        } else {
          setSpaValidationError(""); // Clear error if no SPA package is selected
        }
        return true; // Step 2 is always valid if SPA check passes or is not applicable
      case 1:
        // For step 1, typically date and room selection are primary.
        // This might be handled by disabling "Next" button until these are met.
        // For explicit validation here:
        // const roomSelected = !!formData.apartmentId;
        // const datesSelected = !!startDate && !!endDate;
        // if (!roomSelected) setError("Veuillez sélectionner une chambre.");
        // if (!datesSelected) setDateError("Veuillez sélectionner les dates.");
        // return roomSelected && datesSelected;
        return true; // Assuming these are handled by UI enabling/disabling next button
      default:
        return false;
    }
  }, [
    currentStep,
    formData,
    selectedExtras,
    startDate,
    endDate,
    t,
    setSpaValidationError,
  ]); // Added setSpaValidationError to dependencies

  const nextStep = () => {
    if (isStepValid()) {
      setCurrentStep((prev) => Math.min(prev + 1, 3));
    } else {
      if (currentStep === 2 && spaValidationError) {
        // Check if spaValidationError was set
        const errorElement = document.getElementById("spa-validation-error");
        if (errorElement)
          errorElement.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      // Add similar logic for other steps if needed
    }
  };

  const prevStep = () => setCurrentStep((prev) => Math.max(prev - 1, 1));

  return {
    formData, // Includes selectedFreeDrinks
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
    coupon, // Coupon input field value
    appliedCoupon,
    couponError,
    selectedCategory,
    spaValidationError,
    setSpaValidationError,
    handleChange,
    handleExtraChange,
    handleFreeDrinkChange, // New handler for free drinks
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
    handleSpaScheduleChange,
  };
};
