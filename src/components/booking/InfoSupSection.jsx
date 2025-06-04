// src/components/booking/InfoSupSection.js
import React, { useState, useMemo, useEffect } from "react";
import { useTranslation } from "react-i18next";
import LongBird from "../../assets/GlobalImg/long_bird.webp";
import SpaScheduler from "../spa/SpaScheduler";
import { useSpaSettings } from "../spa/useSpaCalendarData";
import {
  // extraCategories, // No longer directly used in this component's render if not needed elsewhere
  ALL_DRINK_ITEMS_MAP,
  DRINK_OFFER_CONFIG,
} from "../extraCategories";
import FreeDrinksSelection from "./FreeDrinksSelection";
import { ArrowRight } from "lucide-react";


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
  handleChange,
  appliedCoupon,
  handleApplyCoupon,
  selectedExtras,
  handleSpaScheduleChange,
  spaValidationError,
  drinkValidationError,
  selectedFreeDrinks,
  handleFreeDrinkChange,
  getPaidExtraName,
}) => {
  const { t } = useTranslation();
  const [couponInput, setCouponInput] = useState("");
  const [localCouponError, setLocalCouponError] = useState(null);
  const [mainActiveTab, setMainActiveTab] = useState("");
  const [activeDrinkOfferInstanceId, setActiveDrinkOfferInstanceId] =
    useState("");

  const {
    spaSettings,
    loading: spaSettingsLoading,
    error: spaSettingsError,
  } = useSpaSettings();

  const isSpaSelected = useMemo(() => {
    return SPA_ITEM_IDS.some((id) => selectedExtras && selectedExtras[id] > 0);
  }, [selectedExtras]);
  const shouldShowSpaSection = isSpaSelected;

  const activeDrinkOfferInstanceList = useMemo(() => {
    const instances = [];
    if (!selectedExtras || !DRINK_OFFER_CONFIG || !getPaidExtraName)
      return instances;
    Object.entries(selectedExtras).forEach(([paidExtraId, quantity]) => {
      if (quantity > 0 && !paidExtraId.endsWith("-extra")) {
        Object.values(DRINK_OFFER_CONFIG).forEach((offerConfig) => {
          if (offerConfig.triggeringExtras.includes(paidExtraId)) {
            instances.push({
              instanceId: `${paidExtraId}-${offerConfig.key}`,
              paidExtraId: paidExtraId,
              paidExtraName: getPaidExtraName(paidExtraId),
              offerConfigKey: offerConfig.key,
            });
          }
        });
      }
    });
    return instances;
  }, [selectedExtras, getPaidExtraName]);

  const shouldShowDrinksSection = activeDrinkOfferInstanceList.length > 0;

  // --- Existing useEffects for tab management (kept as is) ---
  useEffect(() => {
    if (shouldShowSpaSection) {
      if (
        mainActiveTab === "" ||
        (mainActiveTab === "drinks" && !shouldShowDrinksSection)
      )
        setMainActiveTab("spa");
    } else if (shouldShowDrinksSection) {
      if (
        mainActiveTab === "" ||
        (mainActiveTab === "spa" && !shouldShowSpaSection)
      )
        setMainActiveTab("drinks");
    } else setMainActiveTab("");
    if (
      mainActiveTab === "spa" &&
      !shouldShowSpaSection &&
      shouldShowDrinksSection
    )
      setMainActiveTab("drinks");
    else if (
      mainActiveTab === "drinks" &&
      !shouldShowDrinksSection &&
      shouldShowSpaSection
    )
      setMainActiveTab("spa");
    else if (
      mainActiveTab !== "" &&
      !shouldShowSpaSection &&
      !shouldShowDrinksSection
    )
      setMainActiveTab("");
  }, [shouldShowSpaSection, shouldShowDrinksSection, mainActiveTab]);

  useEffect(() => {
    if (mainActiveTab === "drinks" && shouldShowDrinksSection) {
      if (activeDrinkOfferInstanceList.length > 0) {
        const currentSubTabStillActive = activeDrinkOfferInstanceList.some(
          (instance) => instance.instanceId === activeDrinkOfferInstanceId
        );
        if (!activeDrinkOfferInstanceId || !currentSubTabStillActive) {
          setActiveDrinkOfferInstanceId(
            activeDrinkOfferInstanceList[0].instanceId
          );
        }
      } else {
        setActiveDrinkOfferInstanceId("");
      }
    }
  }, [
    mainActiveTab,
    shouldShowDrinksSection,
    activeDrinkOfferInstanceList,
    activeDrinkOfferInstanceId,
  ]);
  // --- End of existing useEffects ---

  const spaMinDate = useMemo(
    () => (formData.arrivalDate ? new Date(formData.arrivalDate) : undefined),
    [formData.arrivalDate]
  );
  const spaMaxDate = useMemo(
    () =>
      formData.departureDate ? new Date(formData.departureDate) : undefined,
    [formData.departureDate]
  );

  const handleChooseNonAlcoholicLaterChange = (instanceId, isChecked) => {
    handleFreeDrinkChange(instanceId, {
      type: "CHOOSE_NON_ALCOHOLIC_LATER",
      value: isChecked,
    });
  };

  const onApplyCouponClick = async () => {
    // ... (coupon logic - kept as is)
    if (appliedCoupon) return;
    if (!couponInput) {
      setLocalCouponError(t("booking.coupon.errors.enterCode"));
      return;
    }
    setLocalCouponError(null);
    try {
      if (handleApplyCoupon) {
        const result = await handleApplyCoupon(couponInput);
        if (result?.error) {
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
          setLocalCouponError(null);
          setCouponInput("");
        }
      } else {
        console.warn("handleApplyCoupon prop is missing in InfoSupSection");
        setLocalCouponError(t("errors.generic"));
      }
    } catch (error) {
      console.error(
        "Error during coupon application call in InfoSupSection:",
        error
      );
      setLocalCouponError(t("booking.coupon.errors.invalid"));
    }
  };

  const showGoToDrinksButton =
    shouldShowSpaSection &&
    shouldShowDrinksSection &&
    mainActiveTab === "spa" &&
    !spaValidationError;

  return (
    <div className="relative w-full mt-6 space-y-8">
      <div
        className="absolute top-0 right-0 z-0 block w-64 h-64 pointer-events-none"
        style={{
          backgroundImage: `url(${LongBird})`,
          backgroundPosition: "bottom right",
          backgroundRepeat: "no-repeat",
          backgroundSize: "contain",
          opacity: 0.06,
        }}
        aria-hidden="true"
      />
      <div className="relative z-10">
        {/* Main Tab Navigation */}
        {(shouldShowSpaSection || shouldShowDrinksSection) && (
          <div className="flex flex-wrap justify-start mb-4 border-b border-gray-300">
            {shouldShowSpaSection && (
              <button
                type="button"
                onClick={() => setMainActiveTab("spa")}
                className={`py-2 px-4 text-sm font-medium focus:outline-none transition-colors duration-150 ease-in-out 
                            ${
                              mainActiveTab === "spa"
                                ? "text-[#668E73] border-b-2 border-[#668E73]"
                                : "text-gray-500 hover:text-gray-700 hover:border-b-2 hover:border-gray-300"
                            }
                            ${
                              spaValidationError
                                ? "text-red-600 !border-red-500 font-semibold"
                                : ""
                            } 
                          `}
              >
                {t("extras.spa.scheduleTitle")}
                {spaValidationError && (
                  <span className="ml-1 text-red-500">*</span>
                )}
              </button>
            )}
            {shouldShowDrinksSection && (
              <button
                type="button"
                onClick={() => setMainActiveTab("drinks")}
                className={`py-2 px-4 text-sm font-medium focus:outline-none transition-colors duration-150 ease-in-out 
                            ${
                              mainActiveTab === "drinks"
                                ? "text-[#668E73] border-b-2 border-[#668E73]"
                                : "text-gray-500 hover:text-gray-700 hover:border-b-2 hover:border-gray-300"
                            }
                            ${
                              drinkValidationError
                                ? "text-red-600 !border-red-500 font-semibold"
                                : ""
                            }
                          `}
              >
                {t("extras.drinks.tabTitle", "Choisir les boissons incluses")}
                {drinkValidationError && (
                  <span className="ml-1 text-red-500">*</span>
                )}
              </button>
            )}
          </div>
        )}

        {/* SPA Section Content */}
        {mainActiveTab === "spa" && shouldShowSpaSection && (
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

            {/* --- MODIFIED BUTTON TO GO TO DRINKS --- */}
            {showGoToDrinksButton && (
              <div className="flex justify-center mt-6 mb-2">
                {" "}
                {/* Adjusted margins */}
                <button
                  type="button"
                  onClick={() => setMainActiveTab("drinks")}
                  className="px-4 py-2 text-base font-medium text-white bg-[#668E73] rounded-md shadow-sm hover:bg-opacity-90 focus:outline-none focus:ring-2 focus:ring-[#557761] focus:ring-opacity-75"
                  aria-label={t(
                    "extras.drinks.goToDrinksButton.ariaLabel",
                    "Passer à la sélection des boissons"
                  )}
                >
                  {t(
                    "extras.drinks.goToDrinksButton.nextStepText",
                    "Suivant : Choisir vos boissons"
                  )}
                      <ArrowRight size={18} className="inline ml-2" /> 
  
                </button>
              </div>
            )}
            {/* --- END OF MODIFIED BUTTON --- */}
          </>
        )}

        {/* Drinks Section Content */}
        {mainActiveTab === "drinks" && shouldShowDrinksSection && (
          <div>
            {drinkValidationError && (
              <div
                id="drink-validation-error"
                className="p-2 mb-3 text-sm text-red-700 bg-red-100 border border-red-300 rounded-md"
                role="alert"
              >
                {drinkValidationError}
              </div>
            )}
            {activeDrinkOfferInstanceList.length > 1 && (
              <div className="flex flex-wrap items-end -mb-px">
                {activeDrinkOfferInstanceList.map((instance) => (
                  <button
                    key={instance.instanceId}
                    type="button"
                    onClick={() =>
                      setActiveDrinkOfferInstanceId(instance.instanceId)
                    }
                    className={`py-2 px-3 text-xs sm:text-sm font-medium focus:outline-none rounded-t-md mr-1 border-l border-t border-r transition-colors duration-150 ease-in-out ${
                      activeDrinkOfferInstanceId === instance.instanceId
                        ? "bg-white text-[#668E73] border-gray-300 shadow-sm"
                        : "bg-gray-100 text-gray-500 hover:text-gray-700 hover:bg-gray-200 border-transparent"
                    }`}
                    aria-pressed={
                      activeDrinkOfferInstanceId === instance.instanceId
                    }
                  >
                    {instance.paidExtraName.substring(0, 25) +
                      (instance.paidExtraName.length > 25 ? "..." : "")}
                  </button>
                ))}
              </div>
            )}
            <div
              className={`${
                activeDrinkOfferInstanceList.length > 1
                  ? "p-4 border border-gray-300 rounded-b-md rounded-tr-md shadow-sm"
                  : "space-y-8"
              }`}
            >
              {activeDrinkOfferInstanceList
                .filter(
                  (instance) =>
                    activeDrinkOfferInstanceList.length === 1 ||
                    instance.instanceId === activeDrinkOfferInstanceId
                )
                .map((instance) => {
                  const offerConfig =
                    DRINK_OFFER_CONFIG[instance.offerConfigKey];
                  if (!offerConfig) return null;

                  const currentInstanceDrinkData =
                    selectedFreeDrinks?.[instance.instanceId];
                  let isChoosingNonAlcoholicLater = false;
                  let currentCalculatedMaxTotal;

                  if (offerConfig.type === "wine_choice") {
                    isChoosingNonAlcoholicLater =
                      currentInstanceDrinkData?.chooseNonAlcoholicLater ||
                      false;
                    currentCalculatedMaxTotal = offerConfig.maxSelection || 1;
                  } else if (
                    offerConfig.type === "soft_beer_choice" &&
                    typeof offerConfig.itemsPerUnit === "number"
                  ) {
                    currentCalculatedMaxTotal = 0;
                    if (
                      selectedExtras &&
                      selectedExtras[instance.paidExtraId] > 0
                    ) {
                      currentCalculatedMaxTotal +=
                        selectedExtras[instance.paidExtraId] *
                        offerConfig.itemsPerUnit;
                    }
                    const supExtraId = `${instance.paidExtraId}-extra`;
                    if (selectedExtras && selectedExtras[supExtraId] > 0) {
                      const itemsPerSup =
                        offerConfig.itemsPerSupplementaryPerson || 1;
                      currentCalculatedMaxTotal +=
                        selectedExtras[supExtraId] * itemsPerSup;
                    }
                  } else {
                    currentCalculatedMaxTotal = 0;
                  }

                  return (
                    <div
                      key={instance.instanceId}
                      className={`${
                        activeDrinkOfferInstanceList.length > 1
                          ? ""
                          : "p-4 border border-gray-200 rounded-lg shadow-sm"
                      }`}
                    >
                      <FreeDrinksSelection
                        offerKey={instance.offerConfigKey}
                        currentOfferDataForDisplay={currentInstanceDrinkData}
                        onFreeDrinkChange={(payload) =>
                          handleFreeDrinkChange(instance.instanceId, payload)
                        }
                        disabled={
                          offerConfig.type === "wine_choice" &&
                          isChoosingNonAlcoholicLater
                        }
                        dynamicMaxTotalForOffer={currentCalculatedMaxTotal}
                      />
                      {offerConfig.type === "wine_choice" && (
                        <div className="pl-1 mt-4">
                          <label className="flex items-center text-sm text-gray-700 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={isChoosingNonAlcoholicLater}
                              onChange={(e) =>
                                handleChooseNonAlcoholicLaterChange(
                                  instance.instanceId,
                                  e.target.checked
                                )
                              }
                              className="w-4 h-4 mr-2 text-green-600 border-gray-300 rounded focus:ring-2 focus:ring-green-500 focus:ring-offset-1 focus:ring-offset-white"
                            />
                            {t(
                              "extras.drinks.chooseNonAlcoholicLater",
                              "Préfère une boisson non-alcoolisée (à voir avec l'hôte) "
                            )}
                          </label>
                        </div>
                      )}
                    </div>
                  );
                })}
              {activeDrinkOfferInstanceList.length === 0 && (
                <p className="p-4 text-sm text-gray-500">
                  {t(
                    "extras.drinks.noOffer",
                    "Aucune offre de boisson n'est active avec les options sélectionnées."
                  )}
                </p>
              )}
            </div>
          </div>
        )}

        {/* ... Tab prompt and coupon/notice sections - kept as is ... */}
        {mainActiveTab === "" &&
          (shouldShowSpaSection || shouldShowDrinksSection) && (
            <div className="pt-2 pb-2 mt-2 mb-2 text-sm text-gray-500">
              {t(
                "extras.infoSup.selectTabPrompt",
                "Veuillez sélectionner un onglet ci-dessus pour continuer."
              )}
            </div>
          )}
        {mainActiveTab === "" &&
          !shouldShowSpaSection &&
          !shouldShowDrinksSection && (
            <div className="pt-2 pb-2 mt-2 mb-2 text-sm text-gray-500">
              {/* Placeholder if no tabs are relevant */}
            </div>
          )}

        <div className="pt-6 space-y-6">
          <div>
            <label
              htmlFor="couponInput"
              className="block text-[14px] md:text-[16px] font-medium text-[#9a9a9a] mb-1"
            >
              {t("extras.infoSup.promoCode.label")}
            </label>
            <div className="flex items-start gap-4">
              <div className="flex-grow">
                <input
                  id="couponInput"
                  type="text"
                  value={couponInput}
                  onChange={(e) => {
                    setCouponInput(e.target.value);
                    setLocalCouponError(null);
                  }}
                  disabled={appliedCoupon !== null}
                  placeholder={t("extras.infoSup.promoCode.placeholder")}
                  className={`block w-full rounded border-[#668E73] border text-[14px] md:text-[16px] placeholder:text-[14px] md:placeholder:text-[16px] shadow-sm focus:border-[#668E73] focus:ring-1 focus:ring-[#668E73] text-black bg-white h-12 p-2 ${
                    localCouponError ? "border-red-500" : ""
                  } ${appliedCoupon ? "bg-gray-100" : ""}`}
                />
                <div className="h-5 mt-1">
                  {localCouponError && (
                    <p className="text-sm text-red-500">{localCouponError}</p>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={onApplyCouponClick}
                disabled={appliedCoupon !== null}
                className={`h-12 px-6 rounded shadow-sm text-[16px] font-medium text-white ${
                  appliedCoupon
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-[#668E73] hover:bg-opacity-90"
                } focus:outline-none`}
              >
                {t("extras.infoSup.promoCode.button")}
              </button>
            </div>
            {appliedCoupon && !localCouponError && (
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
          <div>
            <label className="block text-[14px] md:text-[16px] font-medium text-[#9a9a9a] mb-1">
              {t("extras.infoSup.ownerMessage.label")}
            </label>
            <textarea
              name="notice"
              value={formData.notice}
              onChange={handleChange}
              rows="3"
              placeholder={t("extras.infoSup.ownerMessage.placeholder")}
              className="mt-1 block w-full rounded border-[#668E73] border text-[14px] md:text-[16px] placeholder:text-[14px] md:placeholder:text-[16px] shadow-sm focus:border-[#668E73] focus:ring-1 focus:ring-[#668E73] text-black bg-white p-2"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export { ALL_DRINK_ITEMS_MAP, DRINK_OFFER_CONFIG };
