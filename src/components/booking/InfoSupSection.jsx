// src/components/booking/InfoSupSection.js

import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import LongBird from "../../assets/GlobalImg/long_bird.webp";
import SpaScheduler from "../spa/SpaScheduler"; // Adjust path if needed

// *** LETSGOMYLOVE related: Definition of the special coupon code constant (Commented Out) ***
// const SINGLE_SLOT_COUPON_CODE = "LETSGOMYLOVE";

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
  handleChange,
  appliedCoupon,
  handleApplyCoupon,
  selectedExtras,
  handleSpaScheduleChange,
  spaValidationError,
}) => {
  const { t } = useTranslation();
  const [coupon, setCoupon] = useState(""); // Local state for coupon input
  const [couponError, setCouponError] = useState(null); // Local state for coupon validation errors

  // --- Determine if the SPA section should be shown ---
  // Condition 1: Check if a standard SPA extra is selected
  const isSpaSelected = SPA_ITEM_IDS.some(
    (id) => selectedExtras && selectedExtras[id] > 0
  );

  // Condition 2: Check if the specific coupon is applied (Commented Out)
  /*
  const isSingleSlotCouponApplied =
    appliedCoupon?.code?.toUpperCase() === SINGLE_SLOT_COUPON_CODE.toUpperCase();
  */

  // Combined Condition: Show SPA scheduler only if a SPA extra is selected
  // The commented-out part `|| isSingleSlotCouponApplied` is removed.
  const shouldShowSpaSection = isSpaSelected;
  // --- End SPA section visibility check ---

  // Handle coupon application attempt
  const onApplyCoupon = async () => {
    if (appliedCoupon) return; // Don't allow applying if one is already active
    if (!coupon) {
      setCouponError(t("booking.coupon.errors.enterCode"));
      return;
    }
    try {
      if (handleApplyCoupon) {
        // Ensure the handler function exists
        const result = await handleApplyCoupon(coupon); // Call the function passed from useBookingForm

        // Handle potential errors returned from the validation logic
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
              setCouponError(t("booking.coupon.errors.invalid"));
          }
        } else {
          // Success! Clear error and input field
          setCouponError(null);
          setCoupon("");
        }
      }
    } catch (error) {
      console.error("Error during coupon application:", error);
      setCouponError(t("booking.coupon.errors.invalid")); // Generic error
    }
  };

  return (
    <div className="relative w-full mt-6 space-y-8">
      {/* --- Conditionally Rendered SPA Scheduling Section --- */}
      {shouldShowSpaSection && (
        <>
          {/* Title/Tab Area */}
          <div className="flex justify-start mb-4 border-b border-gray-300">
            <button
              type="button"
              className={`py-2 px-4 text-sm font-medium text-[#668E73] border-b-2 border-[#668E73] cursor-default`} // Made button non-interactive visually
            >
              {t("extras.spa.scheduleTitle", "Planifier votre séance SPA")}
            </button>
          </div>

          {/* *** Display SPA Validation Error Message *** */}
          {/* This div will render only if spaValidationError has content */}
          {spaValidationError && (
            <div
              id="spa-validation-error"
              className="p-2 mb-3 text-sm text-red-700 bg-red-100 border border-red-300 rounded-md"
              role="alert"
            >
              {spaValidationError}
            </div>
          )}

          {/* SpaScheduler Component */}
          <div className="min-h-[200px]">
            <SpaScheduler
              onScheduleChange={handleSpaScheduleChange} // Pass handler down
              initialDateTime={formData.spaDateTime} // Pass current selected date/time
              initialPreference={formData.spaBookingPreference} // Pass current preference
              minDate={
                // Pass booking start date
                formData.arrivalDate
                  ? new Date(formData.arrivalDate)
                  : undefined
              }
              maxDate={
                // Pass booking end date (adjust if last day is non-bookable)
                formData.departureDate
                  ? new Date(formData.departureDate)
                  : undefined
              }
              // Pass coupon data - SpaScheduler internally decides if/how to use it (currently commented out there)
              appliedCoupon={appliedCoupon}
            />
          </div>
        </>
      )}
      <div className="absolute top-[70px] left-[220px] sm:top-[70px] sm:left-[250px] md:top-[50px] md:left-[550px] lg:top-[50px] lg:left-[300px] xl:top-[230px] xl:left-[550px]">
        <img
          src={LongBird}
          alt="Long Bird"
          className="w-24 h-auto opacity-50 pointer-events-none md:w-32 lg:w-40" // Added opacity/pointer-events if needed
        />
      </div>
      {/* --- Coupon Section --- */}
      <div className="pt-4 pb-4 mt-6 mb-6 border-t border-b border-gray-200">
        <div>
          {/* Label is now separate from the input */}
          <label
            htmlFor="couponInput"
            className="block text-[14px] md:text-[16px] font-medium text-[#9a9a9a] mb-1"
          >
            {t("extras.infoSup.promoCode.label")}
          </label>
          {/* Flex container for the input and button */}
          <div className="flex items-start gap-4">
            <div className="flex-grow">
              <input
                id="couponInput"
                type="text"
                value={coupon}
                onChange={(e) => {
                  setCoupon(e.target.value);
                  setCouponError(null); // Clear local coupon error on change
                }}
                disabled={appliedCoupon !== null} // Disable if any coupon is applied
                placeholder={t("extras.infoSup.promoCode.placeholder")}
                className={`block w-full rounded border-[#668E73] border text-[14px] md:text-[16px] placeholder:text-[14px] md:placeholder:text-[16px] shadow-sm focus:border-[#668E73] focus:ring-1 focus:ring-[#668E73] text-black bg-white h-12 p-2 ${
                  couponError ? "border-red-500" : "" // Style for local coupon input error
                } ${appliedCoupon ? "bg-gray-100" : ""}`} // Style when a coupon is successfully applied
              />
              {/* Fixed height container for local coupon error message */}
              <div className="h-5 mt-1">
                {couponError && (
                  <p className="text-sm text-red-500">{couponError}</p>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={onApplyCoupon}
              disabled={appliedCoupon !== null} // Disable button if any coupon applied
              className={`h-12 px-6 rounded shadow-sm text-[16px] font-medium text-white ${
                appliedCoupon
                  ? "bg-gray-400 cursor-not-allowed" // Disabled style
                  : "bg-[#668E73] hover:bg-opacity-90" // Enabled style
              } focus:outline-none`}
            >
              {t("extras.infoSup.promoCode.button")}
            </button>
          </div>
        </div>
        {/* Display message if *any* coupon is successfully applied */}
        {appliedCoupon && !couponError && (
          <div className="mt-2">
            <p className="text-sm text-green-600">
              {t("extras.infoSup.promoCode.appliedStart")} {appliedCoupon.code}
              {appliedCoupon.type === "percentage"
                ? ` (${appliedCoupon.percentageValue}%) `
                : " "}
              {t("extras.infoSup.promoCode.appliedEnd")}: -
              {appliedCoupon.discount}{" "}
              {t("extras.infoSup.promoCode.appliedCurrency")}
            </p>
            <p className="mt-4 text-sm text-gray-500">
              {t("booking.coupon.minusZero")}
            </p>
          </div>
        )}
      </div>

      <div
        className={`col-span-full ${
          shouldShowSpaSection ? "pt-6 border-t" : "pt-0 border-t-0"
        } border-gray-200`}
      >
        <label className="block text-[14px] md:text-[16px] font-medium text-[#9a9a9a] mb-1">
          {t("extras.infoSup.ownerMessage.label")}
          <textarea
            name="notice"
            value={formData.notice}
            onChange={handleChange} // Use general handleChange from parent
            rows="3"
            placeholder={t("extras.infoSup.ownerMessage.placeholder")}
            className="mt-1 block w-full rounded border-[#668E73] border text-[16px] placeholder:text-[16px] shadow-sm focus:border-[#668E73] focus:ring-1 focus:ring-[#668E73] text-black bg-white p-2"
          />
        </label>
      </div>
      {/* --- End Coupon Section --- */}
    </div>
  );
};

// export default InfoSupSection; // Uncomment if this is the default export
