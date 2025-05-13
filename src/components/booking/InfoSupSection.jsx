// File: src/components/booking/InfoSupSection.js

import React, { useState, useMemo } from "react"; // Import useMemo
import { useTranslation } from "react-i18next";
import LongBird from "../../assets/GlobalImg/long_bird.webp"; // Assuming this is used elsewhere or intended for future use
import SpaScheduler from "../spa/SpaScheduler"; // Adjust path if needed
import { useSpaSettings } from "../spa/useSpaCalendarData";

// Define SPA item IDs here or import from a shared constants file
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
  appliedCoupon, // Coupon object if successfully applied (from useBookingForm)
  handleApplyCoupon, // Function to trigger coupon validation (from useBookingForm)
  selectedExtras, // Map of selected extra IDs and quantities (from useBookingForm)
  handleSpaScheduleChange, // Callback for SPA selection changes (from useBookingForm, already memoized)
  spaValidationError, // Validation error message for SPA section (from useBookingForm)
}) => {
  const { t } = useTranslation();
  const [coupon, setCoupon] = useState(""); // Local state for the coupon input field value
  const [couponError, setCouponError] = useState(null); // Local state for coupon validation errors displayed near the input

  // Fetch SPA Settings
  const {
    spaSettings,
    loading: spaSettingsLoading,
    error: spaSettingsError,
  } = useSpaSettings();

  // Determine if the SPA section should be shown
  const isSpaSelected = useMemo(() => {
    return SPA_ITEM_IDS.some((id) => selectedExtras && selectedExtras[id] > 0);
  }, [selectedExtras]);

  const shouldShowSpaSection = isSpaSelected;

  // Memoize Date Objects for SpaScheduler
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

  // Handle the local coupon application attempt
  const onApplyCoupon = async () => {
    if (appliedCoupon) return;
    if (!coupon) {
      setCouponError(t("booking.coupon.errors.enterCode"));
      return;
    }
    setCouponError(null);

    try {
      if (handleApplyCoupon) {
        const result = await handleApplyCoupon(coupon);
        if (result?.error) {
          switch (result.error) {
            case "inactive":
              setCouponError(t("booking.coupon.errors.inactive"));
              break;
            case "expired":
              setCouponError(t("booking.coupon.errors.expired"));
              break;
            case "used":
              setCouponError(t("booking.coupon.errors.alreadyUsed"));
              break;
            case "not_found":
              setCouponError(t("booking.coupon.errors.notFound"));
              break;
            case "invalid_dates":
              const dateRegex = /entre le (.+) et le (.+)$/;
              const match = result.message?.match(dateRegex);
              if (match && match.length === 3) {
                setCouponError(
                  t("booking.coupon.errors.invalid_dates", {
                    start: match[1],
                    end: match[2],
                  })
                );
              } else {
                setCouponError(
                  result.message || t("booking.coupon.errors.invalid")
                );
              }
              break;
            default:
              setCouponError(
                result.message || t("booking.coupon.errors.invalid")
              );
          }
        } else {
          setCouponError(null);
          setCoupon("");
        }
      } else {
        console.warn("handleApplyCoupon prop is missing in InfoSupSection");
        setCouponError(t("errors.generic"));
      }
    } catch (error) {
      console.error("Error during coupon application call:", error);
      setCouponError(t("booking.coupon.errors.invalid"));
    }
  };

  return (
    <div className="relative w-full mt-6 space-y-8">
      {shouldShowSpaSection && (
        <>
          <div className="flex justify-start mb-4 border-b border-gray-300">
            <button
              type="button"
              className={`py-2 px-4 text-sm font-medium text-[#668E73] border-b-2 border-[#668E73] cursor-default`}
            >
              {t("extras.spa.scheduleTitle", "Planifier votre séance SPA")}
            </button>
          </div>

          {spaValidationError && (
            <div
              id="spa-validation-error"
              className="p-2 mb-3 text-sm text-red-700 bg-red-100 border border-red-300 rounded-md"
              role="alert"
            >
              {spaValidationError}
            </div>
          )}

          <div className="min-h-[200px]">
            {spaSettingsLoading && (
              <p className="text-sm text-gray-500 animate-pulse">
                {t("loading", "Chargement des paramètres SPA...")}
              </p>
            )}
            {spaSettingsError && !spaSettingsLoading && (
              <p className="p-2 text-sm text-red-600 rounded-md bg-red-50">
                {t(
                  "extras.spa.errorLoadingSettings",
                  "Erreur de chargement des paramètres SPA."
                )}
                {/* Consider showing spaSettingsError.message for more details in dev */}
              </p>
            )}
            {!spaSettingsLoading && !spaSettingsError && spaSettings && (
              <SpaScheduler
                onScheduleChange={handleSpaScheduleChange}
                initialDateTime={formData.spaDateTime}
                initialPreference={formData.spaBookingPreference}
                minDate={spaMinDate}
                maxDate={spaMaxDate}
                appliedCoupon={appliedCoupon} // SpaScheduler might not use this directly for logic
                spaSettings={spaSettings} // Pass the loaded spaSettings
              />
            )}
            {!spaSettingsLoading && !spaSettingsError && !spaSettings && (
              // This case might occur if useSpaSettings returns null for settings without error/loading (e.g., initial state)
              // Or if spaSettings document doesn't exist and hook returns null.
              <p className="p-2 text-sm text-orange-600 rounded-md bg-orange-50">
                {t(
                  "extras.spa.settingsUnavailable",
                  "Les paramètres SPA ne sont pas disponibles pour le moment."
                )}
              </p>
            )}
          </div>
        </>
      )}
      {/* --- Coupon Section --- */}
      <div className="pt-2 pb-2 mt-2 mb-2 ">
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
                value={coupon}
                onChange={(e) => {
                  setCoupon(e.target.value);
                  setCouponError(null);
                }}
                disabled={appliedCoupon !== null}
                placeholder={t("extras.infoSup.promoCode.placeholder")}
                className={`block w-full rounded border-[#668E73] border text-[14px] md:text-[16px] placeholder:text-[14px] md:placeholder:text-[16px] shadow-sm focus:border-[#668E73] focus:ring-1 focus:ring-[#668E73] text-black bg-white h-12 p-2 ${
                  couponError ? "border-red-500" : ""
                } ${appliedCoupon ? "bg-gray-100" : ""}`}
              />
              <div className="h-5 mt-1">
                {couponError && (
                  <p className="text-sm text-red-500">{couponError}</p>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={onApplyCoupon}
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
        </div>
        {appliedCoupon && !couponError && (
          <div className="mt-2">
            <p className="text-sm text-green-600">
              {t("extras.infoSup.promoCode.appliedStart")} {appliedCoupon.code}
              {appliedCoupon.type === "percentage" &&
              appliedCoupon.percentageValue
                ? ` (${appliedCoupon.percentageValue}%) `
                : appliedCoupon.type === "fixed" && appliedCoupon.discount
                ? ` (-${appliedCoupon.discount}${t("currencySymbol", "€")}) `
                : " "}
              {t("extras.infoSup.promoCode.appliedEnd")}
            </p>
          </div>
        )}
      </div>
      {/* --- Owner Message Section --- */}
      <div
        className={`col-span-full ${
          shouldShowSpaSection ? "pt-2" : "pt-0"
        } border-gray-200`}
      >
        <label className="block text-[14px] md:text-[16px] font-medium text-[#9a9a9a] mb-1">
          {t("extras.infoSup.ownerMessage.label")}
          <textarea
            name="notice"
            value={formData.notice}
            onChange={handleChange}
            rows="3"
            placeholder={t("extras.infoSup.ownerMessage.placeholder")}
            className="mt-1 block w-full rounded border-[#668E73] border text-[16px] placeholder:text-[16px] shadow-sm focus:border-[#668E73] focus:ring-1 focus:ring-[#668E73] text-black bg-white p-2"
          />
        </label>
      </div>
    </div>
  );
};