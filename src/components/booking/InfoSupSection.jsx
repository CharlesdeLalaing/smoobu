// src/components/booking/InfoSupSection.js
import React, { useState, useMemo, useEffect } from "react";
import { useTranslation } from "react-i18next";
import LongBird from "../../assets/GlobalImg/long_bird.webp"; // Adjust path as needed
import SpaScheduler from "../spa/SpaScheduler"; // Adjust path as needed
import { useSpaSettings } from "../spa/useSpaCalendarData"; // Adjust path as needed
import { extraCategories } from "../extraCategories"; // Adjust path as needed
import FreeDrinksSelection from "./FreeDrinksSelection"; // Adjust path as needed

// Define DRINK_OFFER_CONFIG and ALL_DRINK_ITEMS_MAP here or import them.
// For this example, defining them here. Ensure extraCategories is fully defined if it's in the same scope.

const ALL_DRINK_ITEMS_MAP = extraCategories.boissons.items.reduce(
  (acc, item) => {
    acc[item.id] = item;
    return acc;
  },
  {}
);

const DRINK_OFFER_CONFIG = {
  WINE_OFFER_1: {
    key: "WINE_OFFER_1",
    titleKey: "extras.drinks.wineOfferTitle",
    defaultTitle: "Choix de Vin Inclus (1 bouteille)",
    triggeringExtras: [
      "formuleGourmet",
      "formuleRaclette",
      "formuleBarbecue",
      "packDetenteGourmet",
      "packRacletteDetente",
      "packBbqRomantique",
      "packBbqDetente",
    ],
    drinks: [
      {
        id: "cortilBarco",
        nameKey: "extras.drinks.cortilBarcoLabel",
        defaultName: "Cortil Barco (rouge)",
      },
      {
        id: "terreCharlot",
        nameKey: "extras.drinks.terreCharlotLabel",
        defaultName: "Terre Charlot (blanc)",
      },
    ],
    maxSelection: 1,
    type: "wine_choice",
  },
  SOFTS_BEERS_OFFER_1: {
    key: "SOFTS_BEERS_OFFER_1",
    titleKey: "extras.drinks.softBeerOfferTitle",
    defaultTitle: "Choix de Boissons (2 incluses - Softs ou Bières)",
    triggeringExtras: ["formulePancheApero"],
    categories: {
      softs: extraCategories.boissons.items
        .filter((item) => item.typeKey === "extras.drinkTypes.soft")
        .map((item) => item.id),
      beers: extraCategories.boissons.items
        .filter((item) => item.typeKey === "extras.drinkTypes.beer")
        .map((item) => item.id),
    },
    maxTotal: 2,
    type: "soft_beer_choice",
  },
};

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

export const InfoSupSection = ({
  formData,
  handleChange, // General handler for inputs like 'notice'
  appliedCoupon,
  handleApplyCoupon,
  selectedExtras, // Map of selected paid extra IDs and quantities
  handleSpaScheduleChange,
  spaValidationError,
  selectedFreeDrinks, // This is formData.selectedFreeDrinks
  handleFreeDrinkChange,
}) => {
  const { t } = useTranslation();
  const [couponInput, setCouponInput] = useState(""); // Local state for the coupon input field value
  const [localCouponError, setLocalCouponError] = useState(null); // Local state for coupon validation errors
  const [activeTab, setActiveTab] = useState(""); // 'spa' or 'drinks'

  const {
    spaSettings,
    loading: spaSettingsLoading,
    error: spaSettingsError,
  } = useSpaSettings();

  const isSpaSelected = useMemo(() => {
    return SPA_ITEM_IDS.some((id) => selectedExtras && selectedExtras[id] > 0);
  }, [selectedExtras]);
  const shouldShowSpaSection = isSpaSelected;

  const activeDrinkOffersDetails = useMemo(() => {
    if (!selectedExtras || !DRINK_OFFER_CONFIG) return [];
    // Filter DRINK_OFFER_CONFIG to get only offers triggered by current selectedExtras
    return Object.values(DRINK_OFFER_CONFIG).filter((offer) =>
      offer.triggeringExtras.some((id) => selectedExtras[id] > 0)
    );
  }, [selectedExtras]); // Dependency: selectedExtras

  const shouldShowDrinksSection = activeDrinkOffersDetails.length > 0;

  // Effect to manage active tab based on available sections
  useEffect(() => {
    if (shouldShowSpaSection) {
      if (
        activeTab === "" ||
        (activeTab === "drinks" && !shouldShowDrinksSection)
      ) {
        setActiveTab("spa");
      }
    } else if (shouldShowDrinksSection) {
      if (activeTab === "" || (activeTab === "spa" && !shouldShowSpaSection)) {
        setActiveTab("drinks");
      }
    } else {
      setActiveTab(""); // No tabs to show if neither section is available
    }
    // If current activeTab's section becomes unavailable, switch if the other is available
    if (
      activeTab === "spa" &&
      !shouldShowSpaSection &&
      shouldShowDrinksSection
    ) {
      setActiveTab("drinks");
    } else if (
      activeTab === "drinks" &&
      !shouldShowDrinksSection &&
      shouldShowSpaSection
    ) {
      setActiveTab("spa");
    } else if (
      activeTab !== "" &&
      !shouldShowSpaSection &&
      !shouldShowDrinksSection
    ) {
      // If active tab was set but both sections became unavailable
      setActiveTab("");
    }
  }, [shouldShowSpaSection, shouldShowDrinksSection, activeTab]);

  const spaMinDate = useMemo(() => {
    return formData.arrivalDate && typeof formData.arrivalDate === "string"
      ? new Date(formData.arrivalDate)
      : undefined;
  }, [formData.arrivalDate]);

  const spaMaxDate = useMemo(() => {
    return formData.departureDate && typeof formData.departureDate === "string"
      ? new Date(formData.departureDate)
      : undefined;
  }, [formData.departureDate]);

  // Handler for the "Choose Non-Alcoholic Later" checkbox
  const handleChooseNonAlcoholicLaterChange = (offerKey, isChecked) => {
    handleFreeDrinkChange(offerKey, {
      type: "CHOOSE_NON_ALCOHOLIC_LATER",
      value: isChecked,
    });
  };

  const onApplyCouponClick = async () => {
    if (appliedCoupon) return; // Already applied
    if (!couponInput) {
      setLocalCouponError(t("booking.coupon.errors.enterCode"));
      return;
    }
    setLocalCouponError(null); // Clear previous error

    try {
      if (handleApplyCoupon) {
        // Ensure the prop is passed from useBookingForm
        const result = await handleApplyCoupon(couponInput); // Call the main handler
        if (result?.error) {
          // Map error codes to translated messages
          switch (result.error) {
            case "inactive":
              setLocalCouponError(t("booking.coupon.errors.inactive"));
              break;
            case "expired":
              setLocalCouponError(t("booking.coupon.errors.expired"));
              break;
            case "maxUsageReached":
              setLocalCouponError(t("booking.coupon.errors.maxUsageReached"));
              break;
            case "not_found":
              setLocalCouponError(t("booking.coupon.errors.notFound"));
              break;
            case "invalid_dates":
              setLocalCouponError(
                result.message ||
                  t("booking.coupon.errors.invalid_dates_generic")
              );
              break;
            case "invalid_room_selection":
              setLocalCouponError(
                result.message || t("booking.coupon.errors.selectRoomFirst")
              );
              break;
            case "no_amount_for_promo":
              setLocalCouponError(
                result.message ||
                  t("booking.coupon.errors.noAmountToDiscountRoom")
              );
              break;
            default:
              setLocalCouponError(
                result.message || t("booking.coupon.errors.invalid")
              );
          }
        } else {
          setLocalCouponError(null); // Clear error on success
          setCouponInput(""); // Clear input field on successful application
        }
      } else {
        console.warn("handleApplyCoupon prop is missing in InfoSupSection");
        setLocalCouponError(t("errors.generic")); // Generic error if handler is missing
      }
    } catch (error) {
      console.error(
        "Error during coupon application call in InfoSupSection:",
        error
      );
      setLocalCouponError(t("booking.coupon.errors.invalid")); // Fallback error
    }
  };

  return (
    <div className="relative w-full mt-6 space-y-8">
      {/* Background Bird Image */}
      <div
        className="absolute top-0 right-0 z-0 hidden w-64 h-64 pointer-events-none md:block" // Adjusted for visibility
        style={{
          backgroundImage: `url(${LongBird})`,
          backgroundPosition: "bottom right",
          backgroundRepeat: "no-repeat",
          backgroundSize: "contain", // Or "250px auto"
          opacity: 0.1,
        }}
        aria-hidden="true"
      />

      <div className="relative z-10">
        {/* Tab Navigation */}
        {(shouldShowSpaSection || shouldShowDrinksSection) && (
          <div className="flex flex-wrap justify-start mb-4 border-b border-gray-300">
            {shouldShowSpaSection && (
              <button
                type="button"
                onClick={() => setActiveTab("spa")}
                className={`py-2 px-4 text-sm font-medium focus:outline-none ${
                  activeTab === "spa"
                    ? "text-[#668E73] border-b-2 border-[#668E73]"
                    : "text-gray-500 hover:text-gray-700 hover:border-b-2 hover:border-gray-300"
                }`}
              >
                {t("extras.spa.scheduleTitle", "Planifier votre séance SPA")}
              </button>
            )}
            {shouldShowDrinksSection && (
              <button
                type="button"
                onClick={() => setActiveTab("drinks")}
                className={`py-2 px-4 text-sm font-medium focus:outline-none ${
                  activeTab === "drinks"
                    ? "text-[#668E73] border-b-2 border-[#668E73]"
                    : "text-gray-500 hover:text-gray-700 hover:border-b-2 hover:border-gray-300"
                }`}
              >
                {t("extras.drinks.tabTitle", "Boissons Incluses")}
              </button>
            )}
          </div>
        )}

        {/* SPA Section Content */}
        {activeTab === "spa" && shouldShowSpaSection && (
          <>
            {spaValidationError && (
              <div
                id="spa-validation-error"
                className="p-2 mb-3 text-sm text-red-700 bg-red-100 border border-red-300 rounded-md"
                role="alert"
              >
                {spaValidationError}
              </div>
            )}
            <div>
              {spaSettingsLoading && (
                <p className="text-sm text-gray-500 animate-pulse">
                  {t("extras.spa.loading")}
                </p>
              )}
              {spaSettingsError && !spaSettingsLoading && (
                <p className="p-2 text-sm text-red-600 rounded-md bg-red-50">
                  {t("extras.spa.errorLoadingSettings")}
                </p>
              )}
              {!spaSettingsLoading && !spaSettingsError && spaSettings && (
                <SpaScheduler
                  onScheduleChange={handleSpaScheduleChange}
                  initialDateTime={formData.spaDateTime}
                  initialPreference={formData.spaBookingPreference}
                  minDate={spaMinDate}
                  maxDate={spaMaxDate}
                  appliedCoupon={appliedCoupon}
                  spaSettings={spaSettings}
                />
              )}
              {!spaSettingsLoading && !spaSettingsError && !spaSettings && (
                <p className="p-2 text-sm text-orange-600 rounded-md bg-orange-50">
                  {t("extras.spa.settingsUnavailable")}
                </p>
              )}
            </div>
          </>
        )}

        {/* Drinks Section Content */}
        {activeTab === "drinks" && shouldShowDrinksSection && (
          <div className="space-y-8">
            {activeDrinkOffersDetails.map((offerConfig) => {
              const offerKey = offerConfig.key;
              const currentOfferDrinkData = selectedFreeDrinks?.[offerKey];

              let isChoosingNonAlcoholicLaterForThisOffer = false;
              if (offerConfig.type === "wine_choice" && currentOfferDrinkData) {
                isChoosingNonAlcoholicLaterForThisOffer =
                  currentOfferDrinkData.chooseNonAlcoholicLater || false;
              }

              return (
                <div
                  key={offerKey}
                  className="p-4 bg-white border border-gray-200 rounded-lg shadow-sm"
                >
                  <FreeDrinksSelection
                    offerKey={offerKey}
                    currentOfferDataForDisplay={currentOfferDrinkData}
                    onFreeDrinkChange={handleFreeDrinkChange}
                    disabled={
                      offerConfig.type === "wine_choice" &&
                      isChoosingNonAlcoholicLaterForThisOffer
                    }
                  />
                  {offerConfig.type === "wine_choice" && (
                    <div className="pl-1 mt-4">
                      <label className="flex items-center text-sm text-gray-700 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={isChoosingNonAlcoholicLaterForThisOffer}
                          onChange={(e) =>
                            handleChooseNonAlcoholicLaterChange(
                              offerKey,
                              e.target.checked
                            )
                          }
                          className="w-4 h-4 mr-2 text-green-600 border-gray-300 rounded focus:ring-2 focus:ring-green-500 focus:ring-offset-1 focus:ring-offset-white"
                        />
                        {t(
                          "extras.drinks.chooseNonAlcoholicLater",
                          "Préfère une boisson non-alcoolisée (à voir avec l'hôte)"
                        )}
                      </label>
                    </div>
                  )}
                </div>
              );
            })}
            {!activeDrinkOffersDetails.length && (
              <p className="text-sm text-gray-500">
                {t(
                  "extras.drinks.noOffer",
                  "Aucune offre de boisson incluse pour les options sélectionnées."
                )}
              </p>
            )}
          </div>
        )}

        {/* Message if no tabs are active or available after initial load */}
        {activeTab === "" &&
          (shouldShowSpaSection || shouldShowDrinksSection) && (
            <div className="pt-2 pb-2 mt-2 mb-2 text-sm text-gray-500">
              {t(
                "extras.infoSup.selectTabPrompt",
                "Veuillez sélectionner un onglet ci-dessus pour continuer."
              )}
            </div>
          )}
        {activeTab === "" &&
          !shouldShowSpaSection &&
          !shouldShowDrinksSection && (
            <div className="pt-2 pb-2 mt-2 mb-2 text-sm text-gray-500">
              {/* This space can be used for a general message if no extras needing tabs are selected */}
            </div>
          )}

        {/* Coupon and Owner Message Sections - always potentially visible */}
        <div className="pt-6 space-y-6">
          {/* Coupon Section */}
          <div>
            {" "}
            {/* This div wrapping the coupon might be from my previous suggestion, can be kept or removed if it causes issues */}
            <label
              htmlFor="couponInput"
              className="block text-[14px] md:text-[16px] font-medium text-[#9a9a9a] mb-1"
            >
              {t("extras.infoSup.promoCode.label")}
            </label>
            <div className="flex items-start gap-4">
              {" "}
              {/* Original flex container */}
              <div className="flex-grow">
                <input
                  id="couponInput"
                  type="text"
                  value={couponInput} // Use local state couponInput
                  onChange={(e) => {
                    setCouponInput(e.target.value);
                    setLocalCouponError(null); // Clear error on typing
                  }}
                  disabled={appliedCoupon !== null}
                  placeholder={t("extras.infoSup.promoCode.placeholder")}
                  className={`block w-full rounded border-[#668E73] border text-[14px] md:text-[16px] placeholder:text-[14px] md:placeholder:text-[16px] shadow-sm focus:border-[#668E73] focus:ring-1 focus:ring-[#668E73] text-black bg-white h-12 p-2 ${
                    localCouponError ? "border-red-500" : "" // Use localCouponError
                  } ${appliedCoupon ? "bg-gray-100" : ""}`}
                />
                <div className="h-5 mt-1">
                  {" "}
                  {/* Original height for error message */}
                  {localCouponError && ( // Use localCouponError
                    <p className="text-sm text-red-500">{localCouponError}</p>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={onApplyCouponClick} // Use the renamed click handler
                disabled={appliedCoupon !== null}
                className={`h-12 px-6 rounded shadow-sm text-[16px] font-medium text-white ${
                  // Original classes
                  appliedCoupon
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-[#668E73] hover:bg-opacity-90"
                } focus:outline-none`}
              >
                {t("extras.infoSup.promoCode.button")}
              </button>
            </div>
            {appliedCoupon &&
              !localCouponError && ( // Use localCouponError
                <div className="mt-2">
                  <p className="text-sm text-green-600">
                    {t("extras.infoSup.promoCode.appliedStart")}{" "}
                    <strong>{appliedCoupon.code}</strong>
                    {appliedCoupon.type === "percentage" &&
                    appliedCoupon.percentageValue
                      ? ` (${appliedCoupon.percentageValue}%) `
                      : appliedCoupon.type === "fixed" && appliedCoupon.discount
                      ? ` (-${appliedCoupon.discount.toFixed(2)}${t(
                          "currencySymbol",
                          "€"
                        )}) `
                      : " "}
                    {t("extras.infoSup.promoCode.appliedEnd")}
                  </p>
                </div>
              )}
          </div>
          {/* End of Coupon Section */}

          {/* Owner Message Section */}
          <div>
            <label className="block text-[14px] md:text-[16px] font-medium text-[#9a9a9a] mb-1">
              {t("extras.infoSup.ownerMessage.label")}
            </label>
            <textarea
              name="notice" // Make sure this name matches a key in formData if using general handleChange
              value={formData.notice}
              onChange={handleChange} // General handleChange from useBookingForm
              rows="3"
              placeholder={t("extras.infoSup.ownerMessage.placeholder")}
              className="mt-1 block w-full rounded border-[#668E73] border text-[14px] md:text-[16px] ... "
            />
          </div>
        </div>
      </div>
    </div>
  );
};

// Export DRINK_OFFER_CONFIG and ALL_DRINK_ITEMS_MAP if they are defined in this file
// and needed by useBookingForm.js or other components.
export { ALL_DRINK_ITEMS_MAP, DRINK_OFFER_CONFIG };
