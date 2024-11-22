// components/booking/BookingForm.jsx
import React from "react";
import { SearchSection } from "./SearchSection";
import { PropertyDetails } from "./PropertyDetails";
import { BookingSteps } from "./BookingSteps";
import { ContactSection } from "./ContactSection";
import { ExtrasSection } from "./ExtrasSection";
import { InfoSupSection } from "./InfoSupSection";
import  PaymentForm  from "../PaymentForm";
import { useBookingForm } from "../hooks/useBookingForm";
import { useAvailabilityCheck } from "../hooks/useAvailabiltyCheck";
import { NavigationButtons } from "./NavigationButtons";
import { ErrorMessage } from "./ErrorMessage";
import { LoadingSpinner } from "./LoadingSpinner";
import StripeWrapper from "../StripeWrapper";

const BookingForm = () => {
  const {
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
    appliedCoupon,
    selectedCategory,
    setSelectedCategory,
    handleChange,
    handleExtraChange,
    handleCheckAvailability,
    handleSubmit,
    nextStep,
    prevStep,
    isStepValid,
    handlePaymentSuccess,
    setError,
    setStartDate,
    setEndDate,
    setDateError,
    setCurrentStep,
    setShowPayment,
    setFormData,
    handleApplyCoupon,
  } = useBookingForm();

const {
  availableDates: roomAvailability,
  loading: availabilityLoading,
  error: availabilityError,
} = useAvailabilityCheck(formData);

 // Add loading state to UI
 {
   availabilityLoading && <LoadingSpinner />;
 }
 {
   availabilityError && <ErrorMessage message={availabilityError} />;
 }

  const handleRoomSelect = (roomId) => {
    // Reset form steps when selecting a new room
    setCurrentStep(1);
    setShowPayment(false);
    setFormData((prev) => ({
      ...prev,
      apartmentId: roomId,
    }));
    handleCheckAvailability();
  };

  // Props for each section
  const searchSectionProps = {
    formData,
    handleChange,
    startDate,
    endDate,
    handleDateSelect: (date, isStart) => {
      if (!date) {
        if (isStart) {
          setStartDate(null);
          setEndDate(null);
          handleChange({ target: { name: "arrivalDate", value: "" } });
          handleChange({ target: { name: "departureDate", value: "" } });
        } else {
          setEndDate(null);
          handleChange({ target: { name: "departureDate", value: "" } });
        }
        setDateError("");
        return;
      }

      const selectedDate = new Date(date.setHours(12, 0, 0, 0));
      if (isStart) {
        setStartDate(selectedDate);
        setEndDate(null);
        setDateError("");
        handleChange({
          target: {
            name: "arrivalDate",
            value: selectedDate.toISOString().split("T")[0],
          },
        });
        handleChange({ target: { name: "departureDate", value: "" } });
      } else {
        setEndDate(selectedDate);
        setDateError("");
        handleChange({
          target: {
            name: "departureDate",
            value: selectedDate.toISOString().split("T")[0],
          },
        });
      }
    },
    dateError,
  };

  console.log("Selected dates:", { startDate, endDate }); // Add this to debug

  const propertyDetailsProps = {
    formData,
    startDate,
    endDate,
    priceDetails,
    showPriceDetails,
    selectedExtras,
    appliedCoupon,
    onRoomSelect: handleRoomSelect,
    availableDates : roomAvailability,
    loading: availabilityLoading,
  };

  const extrasSectionProps = {
    selectedExtras,
    handleExtraChange,
    currentStep,
    selectedCategory,
    setSelectedCategory,
  };

  const infoSupSectionProps = {
    formData,
    handleChange,
    appliedCoupon,
    handleApplyCoupon: handleApplyCoupon,
  };

  const contactSectionProps = {
    formData,
    handleChange,
    setFormData,
  };

  const navigationButtonsProps = {
    currentStep,
    prevStep,
    nextStep,
    isStepValid,
    loading,
  };

  return (
    <div className="p-6 mx-auto h-[100vh] overflow-y-scroll w-full lg:w-[1024px] xl:w-[1440px]">
      {/* Error and Success Messages */}
      {error && <ErrorMessage message={error} />}
      {successMessage && (
        <div className="mb-4 text-green-500">{successMessage}</div>
      )}
      {loading && <LoadingSpinner />}

      {!showPayment ? (
        <form onSubmit={handleSubmit} className="mx-auto space-y-4">
          {/* Search Section */}
          <SearchSection {...searchSectionProps} />

          {/* Main Content */}
          <div
            className={`flex flex-col space-y-4 md:flex-row md:space-y-0 ${
              formData.apartmentId ? "md:space-x-4" : ""
            }`}
          >
            {/* Property Details - Full width when no room selected */}
            <div
              className={formData.apartmentId ? "w-full md:w-1/2" : "w-full"}
            >
              <PropertyDetails {...propertyDetailsProps} />
            </div>

            {/* Form Steps - Only show when room is selected */}
            {formData.apartmentId && showPriceDetails && (
              <div className="w-full md:w-1/2 border border-[#668E73] p-4 rounded space-y-4 text-left">
                <h2 className="text-[18px] md:text-[23px] font-normal text-black">
                  {currentStep === 1 && "Extras"}
                  {currentStep === 2 && "Notes"}
                  {currentStep === 3 && "Contact"}
                </h2>

                <BookingSteps currentStep={currentStep} />

                {/* Step Content */}
                {currentStep === 1 && <ExtrasSection {...extrasSectionProps} />}
                {currentStep === 2 && (
                  <InfoSupSection {...infoSupSectionProps} />
                )}
                {currentStep === 3 && (
                  <ContactSection {...contactSectionProps} />
                )}

                {/* Navigation Buttons */}
                <NavigationButtons {...navigationButtonsProps} />
              </div>
            )}
          </div>
        </form>
      ) : (
        /* Payment Form */
        <div className="w-2/5 mx-auto mt-8">
          <h3 className="mb-4 text-lg font-medium">Finaliser votre paiement</h3>
          {clientSecret && (
            <StripeWrapper
              clientSecret={clientSecret}
              onSuccess={handlePaymentSuccess}
              onError={(error) => setError(error)}
            >
              <PaymentForm />
            </StripeWrapper>
          )}
        </div>
      )}
    </div>
  );
};

export default BookingForm;
