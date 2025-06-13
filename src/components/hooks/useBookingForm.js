// src/components/hooks/useBookingForm.js
import { useState, useCallback, useEffect } from "react";
import { api } from "../utils/api"; // Ensure this path is correct
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../../firebase"; // Ensure this path is correct
import { extraCategories } from "../extraCategories"; // Ensure this path is correct
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { format } from 'date-fns';

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
    spaSlots: null, // Ensure this is handled if SpaScheduler provides it
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
  const [drinkValidationError, setDrinkValidationError] = useState("");

  // --- Helper function defined using useCallback, BEFORE effects/handlers that use it ---
  const calculateDynamicMaxForInstance = useCallback(
    (paidExtraId, offerConfig, currentSelectedExtras) => {
      if (
        !offerConfig ||
        offerConfig.type !== "soft_beer_choice" ||
        !currentSelectedExtras ||
        typeof offerConfig.itemsPerUnit !== "number"
      ) {
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
    },
    []
  ); // Empty dependency array: stable function identity, relies only on arguments.

  // --- useEffects ---
  useEffect(() => {
    setFormData((prevData) =>
      prevData.language !== i18n.language
        ? { ...prevData, language: i18n.language }
        : prevData
    );
  }, [i18n.language]);

  useEffect(() => {
    if (!DRINK_OFFER_CONFIG || !selectedExtras) {
      // console.log("[useEffect selectedFreeDrinks] Skipping: No DRINK_OFFER_CONFIG or selectedExtras");
      return;
    }
    // console.log("[useEffect selectedFreeDrinks] Running with selectedExtras:", JSON.parse(JSON.stringify(selectedExtras)));

    setFormData((prevData) => {
      const newSelectedFreeDrinksState = {};
      const prevSelectedFreeDrinks = prevData.selectedFreeDrinks || {};
      let hasChanged = false;

      Object.entries(selectedExtras).forEach(([paidExtraId, quantity]) => {
        if (quantity > 0 && !paidExtraId.endsWith("-extra")) {
          Object.values(DRINK_OFFER_CONFIG).forEach((offerConfig) => {
            if (offerConfig.triggeringExtras.includes(paidExtraId)) {
              const instanceId = `${paidExtraId}-${offerConfig.key}`;
              let currentInstanceData = prevSelectedFreeDrinks[instanceId];

              if (!currentInstanceData) {
                hasChanged = true;
                if (offerConfig.type === "wine_choice")
                  currentInstanceData = {
                    selection: null,
                    chooseNonAlcoholicLater: false,
                  };
                else if (offerConfig.type === "soft_beer_choice")
                  currentInstanceData = {};
                else currentInstanceData = {};
              }
              newSelectedFreeDrinksState[instanceId] = JSON.parse(
                JSON.stringify(currentInstanceData)
              );

              if (offerConfig.type === "soft_beer_choice") {
                const instanceMax = calculateDynamicMaxForInstance(
                  paidExtraId,
                  offerConfig,
                  selectedExtras
                );
                let currentInstanceSelections =
                  newSelectedFreeDrinksState[instanceId] || {};
                let totalSelectedForInstance = Object.values(
                  currentInstanceSelections
                ).reduce((sum, qty) => sum + Number(qty), 0);

                if (totalSelectedForInstance > instanceMax) {
                  hasChanged = true;
                  let overflow = totalSelectedForInstance - instanceMax;
                  const itemsToAdjust = Object.entries(
                    currentInstanceSelections
                  ).sort((a, b) => b[1] - a[1]);
                  for (const [drinkIdToAdjust, qtyToAdjust] of itemsToAdjust) {
                    if (overflow <= 0) break;
                    const reduction = Math.min(qtyToAdjust, overflow);
                    currentInstanceSelections[drinkIdToAdjust] -= reduction;
                    overflow -= reduction;
                    if (currentInstanceSelections[drinkIdToAdjust] <= 0)
                      delete currentInstanceSelections[drinkIdToAdjust];
                  }
                  newSelectedFreeDrinksState[instanceId] =
                    currentInstanceSelections;
                }
                if (
                  instanceMax === 0 &&
                  Object.keys(currentInstanceSelections).length > 0
                ) {
                  newSelectedFreeDrinksState[instanceId] = {};
                  hasChanged = true;
                }
              }
            }
          });
        }
      });

      if (
        JSON.stringify(prevSelectedFreeDrinks) !==
        JSON.stringify(newSelectedFreeDrinksState)
      ) {
        hasChanged = true;
      }

      return hasChanged
        ? { ...prevData, selectedFreeDrinks: newSelectedFreeDrinksState }
        : prevData;
    });
  }, [selectedExtras, calculateDynamicMaxForInstance]);

  // --- Event Handlers & Logic Functions ---
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
    if (!arrival || !departure) return false;
    let validityStart = couponData.validityStartDate?.toDate
      ? couponData.validityStartDate.toDate()
      : couponData.validityStartDate
      ? new Date(couponData.validityStartDate)
      : null;
    let validityEnd = couponData.validityEndDate?.toDate
      ? couponData.validityEndDate.toDate()
      : couponData.validityEndDate
      ? new Date(couponData.validityEndDate)
      : null;
    if (!validityStart || !validityEnd) return true;
    const bookingStart = new Date(arrival);
    const bookingEnd = new Date(departure);
    if (
      isNaN(validityStart.getTime()) ||
      isNaN(validityEnd.getTime()) ||
      isNaN(bookingStart.getTime()) ||
      isNaN(bookingEnd.getTime())
    )
      return false;
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
      const anySpaStillSelected = SPA_ITEM_IDS.some(
        (id) =>
          (selectedExtras[id] > 0 && id !== extraId) ||
          (id === extraId && quantity > 0)
      );
      if (!anySpaStillSelected) {
        setSpaValidationError("");
        setFormData((prev) => ({
          ...prev,
          spaDateTime: null,
          spaBookingPreference: null,
          spaEndDateTime: null,
          spaSlots: null,
        }));
      }
    }
  };

  const createSelectedExtrasArray = () => {
    const extrasArray = []; // Use an array to build the list

    // Iterate over selectedExtras, which is like: { "packEssentiel": 1, "packEssentiel-extra": 1 }
    Object.entries(selectedExtras)
      .filter(([_, quantity]) => quantity > 0) // Only process extras with quantity > 0
      .forEach(([itemId, quantity]) => {
        // itemId is like "packEssentiel" or "packEssentiel-extra"

        const isExtraPerson = itemId.endsWith("-extra");
        const baseExtraId = isExtraPerson
          ? itemId.replace("-extra", "")
          : itemId;

        // Find the full definition of the extra from your frontend extraCategories
        // This assumes `extraCategories` is imported and available in this scope.
        // If not, you might need to pass `extraCategories` to this hook or import it directly.
        const extraDefinition = Object.values(extraCategories) // `extraCategories` from `../extraCategories`
          .flatMap((cat) => cat.items)
          .find((item) => item.id === baseExtraId);

        if (!extraDefinition) {
          console.warn(
            `[useBookingForm - createSelectedExtrasArray] Extra definition not found for base ID: ${baseExtraId}. Skipping this extra.`
          );
          return; // Skip if no definition found
        }

        // Find or create the main entry for this extra in extrasArray
        let mainExtraEntry = extrasArray.find((e) => e.id === baseExtraId);

        if (!mainExtraEntry) {
          mainExtraEntry = {
            id: baseExtraId, // <<< CRITICAL: Canonical String ID
            name: extraDefinition.name, // <<< CRUCIAL: i18n key (e.g., "extras.packs.essential.name")
            quantity: 0, // Initialize, will be set below if not extraPerson
            amount: 0, // Initialize, will be set below
            currencyCode: "EUR",
            extraPersonPrice: extraDefinition.extraPersonPrice || 0, // Unit price for an extra person
            extraPersonQuantity: 0, // Initialize
            // extraPersonAmount will be calculated by prepareBookingDocument based on quantity and price
            type: "addon", // Default type
          };
          extrasArray.push(mainExtraEntry);
        }

        // Update quantities and amounts
        if (isExtraPerson) {
          mainExtraEntry.extraPersonQuantity = quantity;
        } else {
          // This is the main extra item itself
          mainExtraEntry.quantity = quantity;
          mainExtraEntry.amount = (extraDefinition.price || 0) * quantity; // Total amount for the main extra
        }
      });

    // Filter out any entries that might have ended up with 0 main quantity AND 0 extra person quantity,
    // though the initial filter `quantity > 0` should prevent most of these.
    return extrasArray.filter(
      (e) => e.quantity > 0 || e.extraPersonQuantity > 0
    );
  };

  const handleFreeDrinkChange = useCallback(
    (instanceId, payload) => {


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
 
        const newSelectedFreeDrinks = JSON.parse(
          JSON.stringify(prevData.selectedFreeDrinks || {})
        );

        // Initialize instance if it doesn't exist (should be rare now with useEffect)
        if (!newSelectedFreeDrinks[instanceId]) {

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
      const longStayDiscount = selectedRoomPrice.discount || 0;
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
        ...formData,
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

        spaDateString: formData.spaDateTime
          ? format(new Date(formData.spaDateTime), "yyyy-MM-dd")
          : null,
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


    // Create the final object that will be stored, including our new reliable date string.
    const finalDataForStorage = {
      ...bookingDataToSave,

      // Add the new spaDateString field for reliable querying.
      // It checks if a spaDateTime exists, and if so, formats it. Otherwise, it sets it to null.
      spaDateString: bookingDataToSave.spaDateTime
        ? format(new Date(bookingDataToSave.spaDateTime), "yyyy-MM-dd")
        : null,
    };

    // Use the new finalDataForStorage object to save to localStorage.
    localStorage.setItem("bookingData", JSON.stringify(finalDataForStorage));

    // <<< --- MODIFICATION END --- >>>

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
    setCouponError(null); // Clear previous coupon error
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

      // Basic coupon validations
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
      ) {
        return {
          error: "invalid_room_selection",
          message: t("booking.coupon.errors.selectRoomFirst"),
        };
      }

      const isGiftCard = couponData.isGiftVoucher === true;
      const roomOriginalPrice = currentRoomPriceDetails.originalPrice || 0;
      const longStayDiscount = currentRoomPriceDetails.discount || 0;

      const roomPriceAfterLongStay = Math.max(
        0,
        roomOriginalPrice - longStayDiscount
      );

      const selectedExtrasArrayForCoupon = createSelectedExtrasArray();
      // Corrected calculation for extrasTotalForCoupon
      const extrasTotalForCoupon = selectedExtrasArrayForCoupon.reduce(
        (sum, extra) => {
          const mainItemTotal = extra.amount || 0;
          const extraPersonTotal =
            (extra.extraPersonQuantity || 0) * (extra.extraPersonPrice || 0);
          return sum + mainItemTotal + extraPersonTotal;
        },
        0
      );

      const guestFeesForCoupon = calculateGuestFees(
        formData.adults,
        formData.children,
        currentRoomPriceDetails.settings
      );

      const grandTotalEligibleItems = Math.max(
        0,
        roomPriceAfterLongStay + extrasTotalForCoupon + guestFeesForCoupon
      );

      let applicablePriceBase;

      if (isGiftCard) {
        applicablePriceBase = grandTotalEligibleItems;
      } else {
        // Promo code
        if (couponData.type === "percentage") {
          applicablePriceBase = roomPriceAfterLongStay;
        } else if (couponData.type === "fixed") {
          applicablePriceBase = grandTotalEligibleItems;
        } else {
          console.warn(
            `[handleApplyCoupon] Unknown coupon type "${couponData.type}" for promo ${couponData.code}. Defaulting to room price.`
          );
          applicablePriceBase = roomPriceAfterLongStay;
        }
      }

      if (applicablePriceBase <= 0) {
        if (
          !isGiftCard &&
          couponData.type === "percentage" &&
          couponData.percentageValue > 0
        ) {
          return {
            error: "no_amount_for_promo_percentage",
            message: t(
              "booking.coupon.errors.noAmountToDiscountRoomForPercentage",
              "This percentage promo code applies to the room, but the room's value is currently zero or less."
            ),
          };
        } else if (
          !isGiftCard &&
          couponData.type === "fixed" &&
          couponData.amount > 0
        ) {
          return {
            error: "no_amount_for_promo_fixed",
            message: t(
              "booking.coupon.errors.noAmountToDiscountTotalForFixed",
              "This fixed amount promo code has no eligible total to apply to, as the value is zero or less."
            ),
          };
        }
        // For gift cards on zero total, or promos with 0 value, discount will be 0 by calculation below.
      }

      let calculatedDiscount = 0;
      if (couponData.type === "percentage" && couponData.percentageValue > 0) {
        calculatedDiscount =
          (applicablePriceBase * couponData.percentageValue) / 100;
      } else if (
        (couponData.type === "fixed" || isGiftCard) &&
        couponData.amount > 0
      ) {
        calculatedDiscount = couponData.amount;
      }

      calculatedDiscount = Math.min(calculatedDiscount, applicablePriceBase);
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
      setCouponError(null); // Clear any previous error on success
      return {
        success: true,
        appliedCouponData: couponToApply,
        message: t("booking.coupon.success"),
      };
    } catch (error) {
      console.error("Error applying coupon in useBookingForm:", error);
      setCouponError(t("errors.generic")); // Set coupon error for display
      return { error: "invalid", message: t("errors.generic") };
    }
  };

  const isStepValid = useCallback(() => {
    // console.log(`[isStepValid] Checking step: ${currentStep}`);
    // console.log(`[isStepValid] formData.selectedFreeDrinks:`, JSON.stringify(formData.selectedFreeDrinks, null, 2));
    // console.log(`[isStepValid] selectedExtras:`, JSON.stringify(selectedExtras, null, 2));

    let isSpaValid = true;
    let areDrinksValid = true;

    switch (currentStep) {
      case 3: // Contact Details Step
        // Clear errors from previous steps when moving to/validating step 3
        setSpaValidationError("");
        setDrinkValidationError("");

        const isValidContact =
          formData.firstName &&
          formData.lastName &&
          formData.email &&
          formData.conditions;
        // Add more checks if needed (e.g., phone format using a regex)
        return isValidContact;

      case 2: // Extras & Supplementary Info (SPA, Drinks) Step
        // --- SPA Validation (existing logic) ---
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
                "Veuillez sélectionner une date/heure pour le SPA ou choisir 'Réserver plus tard'."
              )
            );
            isSpaValid = false; // Mark SPA as invalid
          } else {
            setSpaValidationError("");
            isSpaValid = true;
          }
        } else {
          setSpaValidationError(""); // No SPA package selected, so no SPA error
          isSpaValid = true;
        }
        // --- End SPA Validation ---

        // --- Drink Selection Validation ---
        let incompleteDrinkOffers = [];
        if (
          formData.selectedFreeDrinks &&
          DRINK_OFFER_CONFIG &&
          ALL_DRINK_ITEMS_MAP &&
          Object.keys(formData.selectedFreeDrinks).length > 0
        ) {
          // Iterate over active drink offer instances implied by selectedFreeDrinks keys
          Object.keys(formData.selectedFreeDrinks).forEach((instanceId) => {
            const instanceData = formData.selectedFreeDrinks[instanceId];
            const parts = instanceId.split("-");
            if (parts.length < 2) {
              console.warn("[isStepValid] Malformed instanceId:", instanceId);
              return; // Skip malformed instanceId
            }
            const offerConfigKey = parts.pop();
            const paidExtraId = parts.join("-");
            const offerConfig = DRINK_OFFER_CONFIG[offerConfigKey];

            if (!offerConfig) {
              console.warn(
                "[isStepValid] No offerConfig for key:",
                offerConfigKey
              );
              return; // Skip if no offer config
            }

            const paidExtraDisplayName = getPaidExtraNameFromCategories(
              paidExtraId,
              t
            );

            if (offerConfig.type === "wine_choice") {
              if (
                instanceData &&
                !instanceData.chooseNonAlcoholicLater &&
                !instanceData.selection
              ) {
                incompleteDrinkOffers.push(paidExtraDisplayName);
              }
            } else if (offerConfig.type === "soft_beer_choice") {
              // calculateDynamicMaxForInstance needs selectedExtras from the hook's scope
              const dynamicMaxForThisInstance = calculateDynamicMaxForInstance(
                paidExtraId,
                offerConfig,
                selectedExtras
              );
              const currentSelectedCount = Object.values(
                instanceData || {}
              ).reduce((sum, qty) => sum + Number(qty), 0);

              if (
                dynamicMaxForThisInstance > 0 &&
                currentSelectedCount < dynamicMaxForThisInstance
              ) {
                const remainingToChoose =
                  dynamicMaxForThisInstance - currentSelectedCount;

                // THE CORRECTED WAY:
                const needsMoreText = t(
                  "extras.drinks.needsMoreSelections", // Key for "{{count}} more to choose"
                  {
                    // Interpolation object
                    count: remainingToChoose,
                  }
                );

                incompleteDrinkOffers.push(
                  `${paidExtraDisplayName} (${needsMoreText})`
                );
              }
            }
          });
        }

        if (incompleteDrinkOffers.length > 0) {
          const errorMsg =
            t(
              "extras.drinks.validation.incomplete",
              "Veuillez compléter votre sélection de boissons pour : "
            ) + incompleteDrinkOffers.join(", ");
          setDrinkValidationError(errorMsg);
          areDrinksValid = false;
        } else {
          setDrinkValidationError("");
          areDrinksValid = true;
        }
        // --- End Drink Selection Validation ---

        return isSpaValid && areDrinksValid; // Step 2 is valid if both SPA and Drinks pass

      case 1: // Room/Date Selection Step
        // Clear errors from other steps when on step 1
        setSpaValidationError("");
        setDrinkValidationError("");

        const roomSelected = !!formData.apartmentId;
        const datesSelected = !!startDate && !!endDate;

        // Example of how you might enforce selection for step 1:
        // if (!roomSelected) {
        //   setError(t("booking.errors.selectRoom", "Veuillez sélectionner une chambre."));
        //   return false;
        // }
        // if (!datesSelected) {
        //   setDateError(t("booking.errors.selectDates", "Veuillez sélectionner les dates d'arrivée et de départ."));
        //   return false;
        // }
        // setError(""); // Clear general error if conditions met for step 1
        // setDateError(""); // Clear date error

        return true; // Modify this based on your actual validation needs for step 1

      default:
        return false;
    }
  }, [
    currentStep,
    formData, // formData.firstName, .lastName, .email, .conditions, .spaDateTime, .spaBookingPreference, .selectedFreeDrinks, .apartmentId
    selectedExtras,
    startDate,
    endDate,
    t,
    setSpaValidationError, // Added setter
    setDrinkValidationError, // Added setter
    // setError, setDateError, // Add if used for step 1 validation errors
    calculateDynamicMaxForInstance, // Added helper
    // SPA_ITEM_IDS, DRINK_OFFER_CONFIG, ALL_DRINK_ITEMS_MAP are stable constants from outer scope
  ]);

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
    drinkValidationError,
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
