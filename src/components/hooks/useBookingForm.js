// src/components/hooks/useBookingForm.js
import { useState, useCallback, useEffect } from "react";
import { api } from "../utils/api"; // Ensure this path is correct
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../../firebase"; // Ensure this path is correct
import { extraCategories } from "../extraCategories"; // Ensure this path is correct
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

// Assuming DRINK_OFFER_CONFIG and ALL_DRINK_ITEMS_MAP are correctly exported
// from InfoSupSection.js or a shared constants file.
import { DRINK_OFFER_CONFIG, ALL_DRINK_ITEMS_MAP } from "../booking/InfoSupSection"; // Adjust path

const SPA_ITEM_IDS = [
  "formuleSpa", "formuleSpaBottle", "packEssentiel", "packDetenteGourmet",
  "packRomantiqueGourmet", "packRacletteDetente", "packRacletteRomantique",
  "packBbqDetente", "packBbqRomantique",
];

// Helper for extra name - defined outside the hook
const getPaidExtraNameFromCategories = (paidExtraId, tFunction) => {
  // console.log(`[getPaidExtraName] Called for paidExtraId: "${paidExtraId}"`);
  if (!extraCategories) {
    console.warn("[getPaidExtraName] extraCategories not available.");
    return paidExtraId; // Fallback to ID
  }

  for (const categoryKey in extraCategories) {
    const category = extraCategories[categoryKey];
    if (category && category.items) {
      const item = category.items.find((i) => i.id === paidExtraId);
      if (item) {
        // console.log(`[getPaidExtraName] Found item for "${paidExtraId}":`, item);
        if (item.name) {
          // Check if item.name (the translation key) exists
          // Directly try to translate item.name.
          // tFunction will return item.name itself if the key is not found in translations.
          const translatedName = tFunction(item.name, paidExtraId); // Provide paidExtraId as fallback for t()
          // console.log(`[getPaidExtraName] Translating item.name (as key) "${item.name}". Result: "${translatedName}"`);
          return translatedName;
        }
        // console.log(`[getPaidExtraName] No item.name found for "${paidExtraId}", falling back to ID.`);
        return paidExtraId; // Fallback if item.name is missing
      }
    }
  }
  // console.log(`[getPaidExtraName] Item with ID "${paidExtraId}" not found in extraCategories.`);
  return paidExtraId; // Fallback if item not found
};


export const useBookingForm = () => {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();

  // --- State Definitions ---
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
    spaEndDateTime: null, // Ensure this is handled if SpaScheduler provides it
    spaSlots: null,      // Ensure this is handled if SpaScheduler provides it
    conditions: false,
    selectedFreeDrinks: {}, // Keyed by instanceId: "paidExtraId-offerConfigKey"
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
  const [selectedExtras, setSelectedExtras] = useState({}); // Separate state for paid extras
  const [spaValidationError, setSpaValidationError] = useState("");
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [coupon, setCoupon] = useState(""); // For the input field value in InfoSupSection
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponError, setCouponError] = useState(null); // For errors related to coupon application

  // --- Helper function defined using useCallback, BEFORE effects/handlers that use it ---
  const calculateDynamicMaxForInstance = useCallback((paidExtraId, offerConfig, currentSelectedExtras) => {
    if (!offerConfig || offerConfig.type !== 'soft_beer_choice' || !currentSelectedExtras || typeof offerConfig.itemsPerUnit !== 'number') {
      return offerConfig?.maxSelection || 0; // For wine or other non-dynamic types
    }
    let dynamicMax = 0;
    const baseQty = currentSelectedExtras[paidExtraId] || 0;
    if (baseQty > 0) {
      dynamicMax += baseQty * offerConfig.itemsPerUnit;
    }
    const supExtraId = `${paidExtraId}-extra`;
    const supQty = currentSelectedExtras[supExtraId] || 0;
    if (supQty > 0) {
      const itemsPerSup = offerConfig.itemsPerSupplementaryPerson || 1; // Default if not specified
      dynamicMax += supQty * itemsPerSup;
    }
    return dynamicMax;
  }, []); // Empty dependency array: stable function identity, relies only on arguments.

  // --- useEffects ---
  useEffect(() => {
    setFormData((prevData) => (prevData.language !== i18n.language ? { ...prevData, language: i18n.language } : prevData));
  }, [i18n.language]);

  useEffect(() => {
    if (!DRINK_OFFER_CONFIG || !selectedExtras) {
      // console.log("[useEffect selectedFreeDrinks] Skipping: No DRINK_OFFER_CONFIG or selectedExtras");
      return;
    }
    // console.log("[useEffect selectedFreeDrinks] Running with selectedExtras:", JSON.parse(JSON.stringify(selectedExtras)));

    setFormData(prevData => {
      const newSelectedFreeDrinksState = {};
      const prevSelectedFreeDrinks = prevData.selectedFreeDrinks || {};
      let hasChanged = false;

      Object.entries(selectedExtras).forEach(([paidExtraId, quantity]) => {
        if (quantity > 0 && !paidExtraId.endsWith('-extra')) {
          Object.values(DRINK_OFFER_CONFIG).forEach(offerConfig => {
            if (offerConfig.triggeringExtras.includes(paidExtraId)) {
              const instanceId = `${paidExtraId}-${offerConfig.key}`;
              let currentInstanceData = prevSelectedFreeDrinks[instanceId];

              if (!currentInstanceData) {
                hasChanged = true;
                if (offerConfig.type === 'wine_choice') currentInstanceData = { selection: null, chooseNonAlcoholicLater: false };
                else if (offerConfig.type === 'soft_beer_choice') currentInstanceData = {};
                else currentInstanceData = {};
              }
              newSelectedFreeDrinksState[instanceId] = JSON.parse(JSON.stringify(currentInstanceData));

              if (offerConfig.type === 'soft_beer_choice') {
                const instanceMax = calculateDynamicMaxForInstance(paidExtraId, offerConfig, selectedExtras);
                let currentInstanceSelections = newSelectedFreeDrinksState[instanceId] || {};
                let totalSelectedForInstance = Object.values(currentInstanceSelections).reduce((sum, qty) => sum + Number(qty), 0);

                if (totalSelectedForInstance > instanceMax) {
                  hasChanged = true;
                  let overflow = totalSelectedForInstance - instanceMax;
                  const itemsToAdjust = Object.entries(currentInstanceSelections).sort((a,b) => b[1] - a[1]);
                  for (const [drinkIdToAdjust, qtyToAdjust] of itemsToAdjust) {
                    if (overflow <= 0) break;
                    const reduction = Math.min(qtyToAdjust, overflow);
                    currentInstanceSelections[drinkIdToAdjust] -= reduction;
                    overflow -= reduction;
                    if (currentInstanceSelections[drinkIdToAdjust] <= 0) delete currentInstanceSelections[drinkIdToAdjust];
                  }
                  newSelectedFreeDrinksState[instanceId] = currentInstanceSelections;
                }
                if (instanceMax === 0 && Object.keys(currentInstanceSelections).length > 0) {
                    newSelectedFreeDrinksState[instanceId] = {};
                    hasChanged = true;
                }
              }
            }
          });
        }
      });
      
      if (JSON.stringify(prevSelectedFreeDrinks) !== JSON.stringify(newSelectedFreeDrinksState)) {
          hasChanged = true;
      }

      return hasChanged ? { ...prevData, selectedFreeDrinks: newSelectedFreeDrinksState } : prevData;
    });
  }, [selectedExtras, calculateDynamicMaxForInstance]);


  // --- Event Handlers & Logic Functions ---
  const calculateGuestFees = (adults, children, settings) => {
    if (!settings) return 0;
    const totalGuests = (parseInt(adults) || 0) + (parseInt(children) || 0);
    const extraGuests = Math.max(0, totalGuests - (settings.startingAtGuest || 2));
    return extraGuests * (settings.extraGuestsPerNight || 0);
  };

  const validateCouponPeriod = (couponData, arrival, departure) => {
    if (!arrival || !departure) return false;
    let validityStart = couponData.validityStartDate?.toDate ? couponData.validityStartDate.toDate() : (couponData.validityStartDate ? new Date(couponData.validityStartDate) : null);
    let validityEnd = couponData.validityEndDate?.toDate ? couponData.validityEndDate.toDate() : (couponData.validityEndDate ? new Date(couponData.validityEndDate) : null);
    if (!validityStart || !validityEnd) return true;
    const bookingStart = new Date(arrival);
    const bookingEnd = new Date(departure);
    if (isNaN(validityStart.getTime()) || isNaN(validityEnd.getTime()) || isNaN(bookingStart.getTime()) || isNaN(bookingEnd.getTime())) return false;
    return bookingStart <= validityEnd && bookingEnd >= validityStart;
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    const val = type === "checkbox" ? checked : value;
    setFormData((prevData) => ({ ...prevData, [name]: val }));
    if (name === "arrivalDate" || name === "departureDate") {
      setShowPriceDetails(false);
      if (appliedCoupon) {
        const newDates = { arrivalDate: name === "arrivalDate" ? val : formData.arrivalDate, departureDate: name === "departureDate" ? val : formData.departureDate };
        if (newDates.arrivalDate && newDates.departureDate && !validateCouponPeriod(appliedCoupon, newDates.arrivalDate, newDates.departureDate)) {
          setAppliedCoupon(null);
          setCouponError(t("booking.coupon.errors.noLongerValidForDates"));
        }
      }
    }
  };

  const handleExtraChange = (extraId, quantity) => {
    if (quantity < 0) return;
    setSelectedExtras((prev) => {
      const updatedExtras = { ...prev, [extraId]: quantity };
      if (!extraId.endsWith("-extra") && quantity === 0) {
        const extraPersonId = `${extraId}-extra`;
        if (prev[extraPersonId]) updatedExtras[extraPersonId] = 0;
      }
      return updatedExtras;
    });
    if (SPA_ITEM_IDS.includes(extraId)) {
      const anySpaStillSelected = SPA_ITEM_IDS.some(id => (selectedExtras[id] > 0 && id !== extraId) || (id === extraId && quantity > 0));
      if (!anySpaStillSelected) {
        setSpaValidationError("");
        setFormData(prev => ({ ...prev, spaDateTime: null, spaBookingPreference: null, spaEndDateTime: null, spaSlots: null }));
      }
    }
  };

  const createSelectedExtrasArray = () => {
    const extrasMap = new Map();
    Object.entries(selectedExtras)
      .filter(([_, quantity]) => quantity > 0)
      .forEach(([extraId, quantity]) => {
        const isExtraPerson = extraId.endsWith("-extra");
        const baseExtraId = isExtraPerson ? extraId.replace("-extra", "") : extraId;
        const extraDetails = Object.values(extraCategories).flatMap((cat) => cat.items).find((item) => item.id === baseExtraId);
        if (!extraDetails) return;
        if (isExtraPerson) {
          const baseExtra = extrasMap.get(baseExtraId);
          if (baseExtra) {
            baseExtra.extraPersonQuantity = quantity;
            baseExtra.extraPersonAmount = (extraDetails.extraPersonPrice || 0) * quantity;
          }
        } else {
          extrasMap.set(baseExtraId, {
            type: "addon", name: t(extraDetails.name, extraDetails.name), amount: (extraDetails.price || 0) * quantity,
            quantity: quantity, currencyCode: "EUR", extraPersonPrice: extraDetails.extraPersonPrice || 0,
            extraPersonQuantity: 0, extraPersonAmount: 0,
          });
        }
      });
    return Array.from(extrasMap.values());
  };
  
  const handleFreeDrinkChange = useCallback(
    (instanceId, payload) => {
      console.log(
        `[useBookingForm] handleFreeDrinkChange ENTERED. instanceId: "${instanceId}", payload:`,
        JSON.stringify(payload, null, 2)
      );

      if (!DRINK_OFFER_CONFIG || !instanceId) {
        console.error(
          "[useBookingForm] handleFreeDrinkChange: Missing DRINK_OFFER_CONFIG or instanceId."
        );
        return;
      }
      // ... (parsing instanceId to get paidExtraId and offerConfigKey) ...
      const parts = instanceId.split("-");
      if (parts.length < 2) {
        console.error("Malformed instanceId:", instanceId);
        return;
      }
      const offerConfigKey = parts.pop();
      const paidExtraId = parts.join("-");
      const offerConfig = DRINK_OFFER_CONFIG[offerConfigKey];
      if (!offerConfig) {
        /* ... error handling ... */ return;
      }

      setFormData((prevData) => {
        console.log(
          `[useBookingForm] setFormData for instanceId "${instanceId}". Prev selectedFreeDrinks:`,
          JSON.stringify(prevData.selectedFreeDrinks, null, 2)
        );
        const newSelectedFreeDrinks = JSON.parse(
          JSON.stringify(prevData.selectedFreeDrinks || {})
        );

        // Initialize instance if it doesn't exist (should be rare now with useEffect)
        if (!newSelectedFreeDrinks[instanceId]) {
          console.log(
            `[useBookingForm] Initializing new instance data for ${instanceId}`
          );
          if (offerConfig.type === "wine_choice")
            newSelectedFreeDrinks[instanceId] = {
              selection: null,
              chooseNonAlcoholicLater: false,
            };
          else if (offerConfig.type === "soft_beer_choice")
            newSelectedFreeDrinks[instanceId] = {};
        }

        let currentInstanceData = newSelectedFreeDrinks[instanceId]; // This should now be an object

        if (offerConfig.type === "wine_choice") {
          let wineData = {
            ...(currentInstanceData || {
              selection: null,
              chooseNonAlcoholicLater: false,
            }),
          };
          if (payload.type === "CHOOSE_NON_ALCOHOLIC_LATER") {
            wineData.chooseNonAlcoholicLater = payload.value;
            if (payload.value) wineData.selection = null;
          } else if (payload.selectedWineId !== undefined) {
            wineData.selection = payload.selectedWineId;
            wineData.chooseNonAlcoholicLater = false;
          }
          newSelectedFreeDrinks[instanceId] = wineData;
        } else if (offerConfig.type === "soft_beer_choice") {
          let softBeerSelections = { ...(currentInstanceData || {}) };
          const { drinkId, newQuantity } = payload;
          if (drinkId !== undefined && typeof newQuantity === "number") {
            const instanceMax = calculateDynamicMaxForInstance(
              paidExtraId,
              offerConfig,
              selectedExtras
            );
            let totalSelectedForInstance = 0;
            Object.keys(softBeerSelections).forEach((id) => {
              if (id !== drinkId)
                totalSelectedForInstance += Number(softBeerSelections[id]);
            });
            let cappedNewQuantity = newQuantity;
            if (newQuantity > 0) {
              if (totalSelectedForInstance + newQuantity > instanceMax) {
                cappedNewQuantity = Math.max(
                  0,
                  instanceMax - totalSelectedForInstance
                );
              }
            }
            if (cappedNewQuantity > 0)
              softBeerSelections[drinkId] = cappedNewQuantity;
            else delete softBeerSelections[drinkId];
          }
          newSelectedFreeDrinks[instanceId] = softBeerSelections;
        }

        if (
          JSON.stringify(prevData.selectedFreeDrinks[instanceId]) !==
          JSON.stringify(newSelectedFreeDrinks[instanceId])
        ) {
          return { ...prevData, selectedFreeDrinks: newSelectedFreeDrinks };
        }
        return prevData;
      });
    },
    [selectedExtras, calculateDynamicMaxForInstance]
  );

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
    getPaidExtraName: (paidExtraId) =>
    getPaidExtraNameFromCategories(paidExtraId, t),
  };
};
