// File: src/components/booking/InfoSupSection.js

import React, { useState, useMemo } from "react"; // Import useMemo
import { useTranslation } from "react-i18next";
import LongBird from "../../assets/GlobalImg/long_bird.webp"; // Assuming this is used elsewhere or intended for future use
import SpaScheduler from "../spa/SpaScheduler"; // Adjust path if needed

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

  // --- Determine if the SPA section should be shown ---
  // Memoize this calculation to avoid re-computing on every render unless selectedExtras changes
  const isSpaSelected = useMemo(() => {
    // Check if any of the predefined SPA item IDs have a quantity greater than 0
    return SPA_ITEM_IDS.some((id) => selectedExtras && selectedExtras[id] > 0);
  }, [selectedExtras]); // Dependency: selectedExtras map

  // Use the memoized value to decide whether to render the SPA section
  const shouldShowSpaSection = isSpaSelected;
  // --- End SPA section visibility check ---

  // --- Memoize Date Objects for SpaScheduler ---
  // This prevents creating new Date objects on every render if the date strings haven't changed,
  // stabilizing the props passed to SpaScheduler and preventing unnecessary effect runs.
  const spaMinDate = useMemo(() => {
    // console.log("Recalculating spaMinDate", formData.arrivalDate); // Debug log if needed
    // Ensure arrivalDate is a valid string representation of a date before creating Date object
    // Return undefined if arrivalDate is missing or not a string, preventing errors
    return formData.arrivalDate && typeof formData.arrivalDate === "string"
      ? new Date(formData.arrivalDate)
      : undefined;
  }, [formData.arrivalDate]); // Only recalculate if the arrivalDate string changes

  const spaMaxDate = useMemo(() => {
    // console.log("Recalculating spaMaxDate", formData.departureDate); // Debug log if needed
    // Ensure departureDate is a valid string representation of a date before creating Date object
    // Return undefined if departureDate is missing or not a string, preventing errors
    return formData.departureDate && typeof formData.departureDate === "string"
      ? new Date(formData.departureDate)
      : undefined;
  }, [formData.departureDate]); // Only recalculate if the departureDate string changes

  // Handle the local coupon application attempt (calls the parent handler)
  const onApplyCoupon = async () => {
    // Do nothing if a coupon is already successfully applied (state from parent hook)
    if (appliedCoupon) return;
    // Check if the local input field is empty
    if (!coupon) {
      setCouponError(t("booking.coupon.errors.enterCode")); // Set local error message
      return;
    }
    // Clear any previous local error message before attempting validation
    setCouponError(null);

    try {
      // Check if the handler function passed from the parent hook exists
      if (handleApplyCoupon) {
        // Call the function passed from useBookingForm, which performs the actual validation
        const result = await handleApplyCoupon(coupon);

        // Handle potential errors returned from the validation logic in useBookingForm
        if (result?.error) {
          // Set the local error state based on the error code returned
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
              // Try to extract dates from the message if the format is known (specific to useBookingForm logic)
              const dateRegex = /entre le (.+) et le (.+)$/;
              const match = result.message?.match(dateRegex);
              if (match && match.length === 3) {
                // Use translated string with extracted dates
                setCouponError(
                  t("booking.coupon.errors.invalid_dates", {
                    start: match[1],
                    end: match[2],
                  })
                );
              } else {
                // Use the message directly from the result or a generic fallback
                setCouponError(
                  result.message || t("booking.coupon.errors.invalid")
                );
              }
              break;
            default:
              // Use the message from the result if available, otherwise a generic invalid message
              setCouponError(
                result.message || t("booking.coupon.errors.invalid")
              );
          }
        } else {
          // Success! The parent hook (useBookingForm) should have updated the appliedCoupon state.
          // Clear the local error and the input field.
          setCouponError(null);
          setCoupon(""); // Clear the input field text on successful application
        }
      } else {
        // Log a warning if the necessary handler prop wasn't provided
        console.warn("handleApplyCoupon prop is missing in InfoSupSection");
        setCouponError(t("errors.generic")); // Set a generic error if handler is missing
      }
    } catch (error) {
      // Catch any unexpected errors during the async call
      console.error("Error during coupon application call:", error);
      setCouponError(t("booking.coupon.errors.invalid")); // Set a generic error on exception
    }
  };

  // --- JSX Rendering ---
  return (
    <div className="relative w-full mt-6 space-y-8">
      {" "}
      {/* Main container with spacing */}
      {/* --- Conditionally Rendered SPA Scheduling Section --- */}
      {/* This entire block is only rendered if shouldShowSpaSection is true */}
      {shouldShowSpaSection && (
        <>
          {/* Title/Tab Area for SPA section */}
          <div className="flex justify-start mb-4 border-b border-gray-300">
            <button
              type="button"
              // Visually styled like a tab, but not interactive (cursor-default)
              className={`py-2 px-4 text-sm font-medium text-[#668E73] border-b-2 border-[#668E73] cursor-default`}
            >
              {t("extras.spa.scheduleTitle", "Planifier votre séance SPA")}
            </button>
          </div>

          {/* *** Display SPA Validation Error Message *** */}
          {/* Renders only if spaValidationError (from useBookingForm) has content */}
          {spaValidationError && (
            <div
              id="spa-validation-error" // ID used for scrolling to error in useBookingForm
              className="p-2 mb-3 text-sm text-red-700 bg-red-100 border border-red-300 rounded-md"
              role="alert" // Accessibility role
            >
              {spaValidationError} {/* Display the error message */}
            </div>
          )}

          {/* SpaScheduler Component Instance */}
          <div className="min-h-[200px]">
            {" "}
            {/* Ensure minimum height for layout consistency */}
            {/* {console.log("Rendering SpaScheduler with dates:", spaMinDate, spaMaxDate)} // Optional debug log */}
            <SpaScheduler
              // Pass the memoized callback from useBookingForm
              onScheduleChange={handleSpaScheduleChange}
              // Pass initial values from formData (managed by useBookingForm)
              initialDateTime={formData.spaDateTime}
              initialPreference={formData.spaBookingPreference}
              // Pass the memoized Date objects for stability
              minDate={spaMinDate}
              maxDate={spaMaxDate}
              // Pass the applied coupon object (from useBookingForm)
              appliedCoupon={appliedCoupon}
            />
          </div>
        </>
      )}{" "}
      {/* End of conditional SPA section */}
      {/* --- Coupon Section --- */}
      <div className="pt-2 pb-2 mt-2 mb-2 ">
        {" "}
        {/* Container for coupon input and info */}
        <div>
          {/* Label for the coupon input field */}
          <label
            htmlFor="couponInput"
            className="block text-[14px] md:text-[16px] font-medium text-[#9a9a9a] mb-1"
          >
            {t("extras.infoSup.promoCode.label")}
          </label>
          {/* Flex container to align input and button */}
          <div className="flex items-start gap-4">
            {" "}
            {/* Use items-start to align tops */}
            {/* Container for the input field and its potential error message */}
            <div className="flex-grow">
              {" "}
              {/* Allows input to take available space */}
              <input
                id="couponInput"
                type="text"
                value={coupon} // Controlled input using local state
                onChange={(e) => {
                  setCoupon(e.target.value); // Update local state on change
                  setCouponError(null); // Clear local validation error when user types
                }}
                // Disable input if a coupon is already applied (state from parent hook)
                disabled={appliedCoupon !== null}
                placeholder={t("extras.infoSup.promoCode.placeholder")}
                // Dynamic classes for styling based on state
                className={`block w-full rounded border-[#668E73] border text-[14px] md:text-[16px] placeholder:text-[14px] md:placeholder:text-[16px] shadow-sm focus:border-[#668E73] focus:ring-1 focus:ring-[#668E73] text-black bg-white h-12 p-2 ${
                  couponError ? "border-red-500" : "" // Add red border if local error exists
                } ${appliedCoupon ? "bg-gray-100" : ""}`} // Style when disabled due to applied coupon
              />
              {/* Fixed height container to prevent layout shifts when error appears/disappears */}
              <div className="h-5 mt-1">
                {/* Display the local coupon error message if it exists */}
                {couponError && (
                  <p className="text-sm text-red-500">{couponError}</p>
                )}
              </div>
            </div>
            {/* Apply Coupon Button */}
            <button
              type="button"
              onClick={onApplyCoupon} // Trigger the local handler
              // Disable button if a coupon is already applied
              disabled={appliedCoupon !== null}
              // Dynamic classes for styling based on disabled state
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
        {/* Display message confirming which coupon is applied */}
        {/* Show only if a coupon is applied (from parent state) AND no local error is currently shown */}
        {appliedCoupon && !couponError && (
          <div className="mt-2">
            {" "}
            {/* Add margin-top for spacing */}
            <p className="text-sm text-green-600">
              {" "}
              {/* Success message styling */}
              {t("extras.infoSup.promoCode.appliedStart")} {appliedCoupon.code}{" "}
              {/* Show coupon code */}
              {/* Optionally display discount details based on coupon type */}
              {appliedCoupon.type === "percentage" &&
              appliedCoupon.percentageValue
                ? ` (${appliedCoupon.percentageValue}%) `
                : appliedCoupon.type === "fixed" && appliedCoupon.discount
                ? ` (-${appliedCoupon.discount}${t("currencySymbol", "€")}) ` // Assuming discount and fixed type exist
                : " "}{" "}
              {/* Default space if no specific details to show */}
              {t("extras.infoSup.promoCode.appliedEnd")}
            </p>
            {/* You could add more specific success/info messages here if needed */}
          </div>
        )}
      </div>{" "}
      {/* End of Coupon Section */}
      {/* --- Owner Message Section --- */}
      <div
        // Use col-span-full if this component is inside a CSS Grid container
        className={`col-span-full ${
          shouldShowSpaSection ? "pt-2" : "pt-0" // Adjust top padding based on whether SPA section is visible
        } border-gray-200`} // Optional border styling
      >
        <label className="block text-[14px] md:text-[16px] font-medium text-[#9a9a9a] mb-1">
          {t("extras.infoSup.ownerMessage.label")}
          <textarea
            name="notice" // This 'name' must match the key in the formData state object (useBookingForm)
            value={formData.notice} // Controlled component linked to formData.notice
            onChange={handleChange} // Use the general handleChange passed from useBookingForm
            rows="3" // Suggest initial height
            placeholder={t("extras.infoSup.ownerMessage.placeholder")}
            // Standard styling for the textarea
            className="mt-1 block w-full rounded border-[#668E73] border text-[16px] placeholder:text-[16px] shadow-sm focus:border-[#668E73] focus:ring-1 focus:ring-[#668E73] text-black bg-white p-2"
          />
        </label>
      </div>
      {/* --- End Owner Message Section --- */}
    </div> // Closing main component div
  );
};

// Default export is usually commented out if using named exports primarily
// export default InfoSupSection;
