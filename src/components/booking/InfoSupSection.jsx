import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import LongBird from "../../assets/GlobalImg/long_bird.webp";
import SpaScheduler from "../spa/SpaScheduler";
export const InfoSupSection = ({
  formData,
  handleChange,
  appliedCoupon,
  handleApplyCoupon,
  selectedExtras,
  handleSpaScheduleChange,
}) => {
  const { t } = useTranslation();
  const [coupon, setCoupon] = useState("");
  const [couponError, setCouponError] = useState(null);

  const [infoSupActiveTab, setInfoSupActiveTab] = useState("spa"); // Default to SPA tab

  // --- ADDED: Check if a SPA extra is selected ---
  const spaItemIds = ["formuleSpa", "formuleSpaBottle"]; // Your SPA extra IDs
  const isSpaSelected = spaItemIds.some(
    (id) => selectedExtras && selectedExtras[id] > 0
  );

  const onApplyCoupon = async () => {
    // Don't allow applying if there's already a coupon
    if (appliedCoupon) {
      return;
    }

    if (!coupon) {
      setCouponError(t("booking.coupon.errors.enterCode"));
      return;
    }

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
              // Extract start and end dates from the server message if available
              if (result.message) {
                // Try to extract dates using regex (matches dates in French format)
                const dateRegex = /entre le (.+) et le (.+)$/;
                const match = result.message.match(dateRegex);

                if (match && match.length === 3) {
                  // Use the captured start and end dates with the translation
                  setCouponError(
                    t("booking.coupon.errors.invalid_dates", {
                      start: match[1],
                      end: match[2],
                    })
                  );
                } else {
                  // Fallback to using the server message directly
                  setCouponError(result.message);
                }
              } else {
                // Fallback to generic message if no specific message
                setCouponError(t("booking.coupon.errors.invalid"));
              }
              break;
            default:
              setCouponError(t("booking.coupon.errors.invalid"));
          }
        } else {
          setCouponError(null);
          // Clear the input field after successful application
          setCoupon("");
        }
      }
    } catch (error) {
      setCouponError(t("booking.coupon.errors.invalid"));
    }
  };

  return (
    <div className="relative w-full">
      {/* --- MODIFIED: Conditionally render the entire Tab Section --- */}
      {isSpaSelected && (
        <>
          {" "}
          {/* Use Fragment to group tab elements without adding extra divs */}
          {/* Tab Buttons Container (Now only shows SPA tab if relevant) */}
          <div className="flex justify-start mb-4 border-b border-gray-300">
            {/* SPA Tab Button - Always the 'active' one visually if this section is shown */}
            <button
              type="button"
              className={`py-2 px-4 text-sm font-medium text-[#668E73] border-b-2 border-[#668E73]`} // Style is always active now
              // onClick is no longer needed as there's nothing to switch to
            >
              {t("extras.spa.scheduleTitle", "Planifier votre séance SPA")}
            </button>
            {/* Test Tab Button REMOVED */}
          </div>
          {/* Tab Content Area (Now only shows SPA content if relevant) */}
          <div className="min-h-[200px]">
            {/* SPA Tab Content */}
            <SpaScheduler
              onScheduleChange={handleSpaScheduleChange}
              initialDateTime={formData.spaDateTime}
              initialPreference={formData.spaBookingPreference}
              // Optional: Date constraints (make sure arrival/departure are passed if needed)
              minDate={
                formData.arrivalDate
                  ? new Date(formData.arrivalDate)
                  : undefined
              }
              maxDate={
                formData.departureDate
                  ? new Date(formData.departureDate)
                  : undefined
              } // Adjust last day logic if needed
            />
            {/* Test Tab Content REMOVED */}
          </div>
        </>
      )}
      {/* --- END MODIFIED: Conditional Tab Section --- */}

      {/* Notes Section - Ensure consistent spacing whether tabs are shown or not */}
      {/* Added conditional top margin/padding/border */}
      <div
        className={`col-span-full ${
          isSpaSelected ? "pt-6 border-t" : "pt-0 border-t-0"
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

      {/* Coupon Section */}
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
          <div className="flex items-center gap-4">
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
              {couponError && (
                <p className="mt-1 text-sm text-red-500">{couponError}</p>
              )}
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

      {/* Bird Image */}
      <div className="absolute top-[70px] left-[220px] sm:top-[70px] sm:left-[250px] md:top-[50px] md:left-[550px] lg:top-[50px] lg:left-[300px] xl:top-[230px] xl:left-[550px]">
        {/* ... (existing bird image) ... */}
      </div>
    </div>
  );
};

export default InfoSupSection;
