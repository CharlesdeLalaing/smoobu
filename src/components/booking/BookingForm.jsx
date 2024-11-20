// components/booking/BookingForm.jsx
import React from "react";
import { SearchSection } from "./SearchSection";
import { PropertyDetails } from "./PropertyDetails";
import { BookingSteps } from "./BookingSteps";
import { IntroRoomSection } from "./IntroRoomSection";
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
    setFormData,
    handleApplyCoupon,
  } = useBookingForm();

const { isDateUnavailable } = useAvailabilityCheck(formData);

  // Props for each section
  const searchSectionProps = {
    formData,
    handleChange,
    startDate,
    endDate,
    handleDateSelect: (date, isStart) => {
      // Implementation from your current handleDateSelect
      if (!date) {
        if (isStart) {
          setStartDate(null);
          setEndDate(null);
          handleChange({
            target: { name: "arrivalDate", value: "" },
          });
          handleChange({
            target: { name: "departureDate", value: "" },
          });
        } else {
          setEndDate(null);
          handleChange({
            target: { name: "departureDate", value: "" },
          });
        }
        setDateError("");
        return;
      }

      const selectedDate = new Date(date.setHours(12, 0, 0, 0));

      if (isStart) {
        if (isDateUnavailable(selectedDate, isStart)) {
          setDateError("Cette date n'est pas disponible pour l'arrivée");
          return;
        }
        setStartDate(selectedDate);
        setEndDate(null);
        setDateError("");

        const dateStr = selectedDate.toISOString().split("T")[0];
        handleChange({
          target: { name: "arrivalDate", value: dateStr },
        });
        handleChange({
          target: { name: "departureDate", value: "" },
        });
      } else {
        if (isDateUnavailable(selectedDate, isStart)) {
          setDateError("Cette date n'est pas disponible pour le départ");
          return;
        }
        setEndDate(selectedDate);
        setDateError("");

        const dateStr = selectedDate.toISOString().split("T")[0];
        handleChange({
          target: { name: "departureDate", value: dateStr },
        });
      }
    },
    isDateUnavailable,
    handleCheckAvailability,
    dateError,
  };

  const propertyDetailsProps = {
    formData,
    startDate,
    endDate,
    priceDetails,
    showPriceDetails,
    selectedExtras,
    appliedCoupon,
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
  handleApplyCoupon : handleApplyCoupon,
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
          <div className="flex flex-col space-y-4 md:flex-row md:space-y-0 md:space-x-4">
            {/* Property Details */}
            <PropertyDetails {...propertyDetailsProps} />

            {/* Form Steps */}
            <div className="w-full md:w-2/3 border border-[#668E73] p-4 rounded space-y-4 text-left">
              <h2 className="text-[18px] md:text-[23px] font-normal text-black">
                {currentStep === 0 && ""}
                {currentStep === 1 && "Extras"}
                {currentStep === 2 && "Notes"}
                {currentStep === 3 && "Contact"}
              </h2>

              <BookingSteps currentStep={currentStep} />

              {/* Step Content */}
              {currentStep === 0 && <IntroRoomSection />}
              {currentStep === 1 && <ExtrasSection {...extrasSectionProps} />}
              {currentStep === 2 && <InfoSupSection {...infoSupSectionProps} />}
              {currentStep === 3 && <ContactSection {...contactSectionProps} />}

              {/* Navigation Buttons */}
              <NavigationButtons {...navigationButtonsProps} />
            </div>
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
