import React from "react";
import { HeaderSection } from "./HeaderSection";
import { SearchSection, RoomNavigation } from "./SearchSection";
import { PropertyDetails } from "./PropertyDetails";
import { BookingSteps } from "./BookingSteps";
import { ContactSection } from "./ContactSection";
import { ExtrasSection } from "./ExtrasSection";
import { InfoSupSection } from "./InfoSupSection";
import PaymentForm from "../PaymentForm";
import { useBookingForm } from "../hooks/useBookingForm";
import { useAvailabilityCheck } from "../hooks/useAvailabiltyCheck";
import { NavigationButtons } from "./NavigationButtons";
import { ErrorMessage } from "./ErrorMessage";
import { LoadingSpinner } from "./LoadingSpinner";
import StripeWrapper from "../StripeWrapper";
import { useNavigate } from "react-router-dom";
import { roomsData } from "../hooks/roomsData";

const BookingForm = () => {
   const navigate = useNavigate();
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
    setIsAvailable,
    setEndDate,
    setDateError,
    setCurrentStep,
    setPriceDetails,
    setShowPriceDetails,
    setShowPayment,
    setFormData,
    handleApplyCoupon,
  } = useBookingForm();

  const {
    availableDates,
    loading: availabilityLoading,
    error: availabilityError,
    hasSearched,
    checkAvailability,
    resetAvailability,
  } = useAvailabilityCheck(formData);

  const handleRoomSelect = async (roomId) => {
    setFormData((prev) => ({
      ...prev,
      apartmentId: roomId,
    }));

    if (startDate && endDate) {
      try {
        if (priceDetails && priceDetails[roomId]) {
          const roomPriceDetails = priceDetails[roomId];
          setFormData((prev) => ({
            ...prev,
            price: roomPriceDetails.finalPrice,
          }));
          setShowPriceDetails(true);
        } else {
          await handleAvailabilityCheck();
        }
      } catch (err) {
        console.error("Error updating prices:", err);
        setError("Failed to update prices for the selected room");
      }
    }

    if (!formData.apartmentId) {
      setCurrentStep(1);
    }
  };

  const handleAvailabilityCheck = async () => {
    if (!startDate || !endDate) {
      setDateError("Please select both arrival and departure dates");
      return;
    }

    setError("");
    setDateError("");

    try {
      const availabilityData = await checkAvailability(startDate, endDate);

      if (availabilityData) {
        if (availabilityData.priceDetails) {
          setPriceDetails(availabilityData.priceDetails);
          setShowPriceDetails(true);
          setIsAvailable(true);

          if (
            formData.apartmentId &&
            availabilityData.priceDetails[formData.apartmentId]
          ) {
            setFormData((prev) => ({
              ...prev,
              price:
                availabilityData.priceDetails[formData.apartmentId].finalPrice,
            }));
          }
        } else {
          setDateError("No rates available for selected dates");
          setShowPriceDetails(false);
          setIsAvailable(false);
        }
      } else {
        setDateError("No availability found for selected dates");
        setShowPriceDetails(false);
        setIsAvailable(false);
      }
    } catch (err) {
      console.error("Error in availability check:", err);
      setError("Error checking availability");
      setShowPriceDetails(false);
      setIsAvailable(false);
    }
  };

  const handleDateSelect = (date, isStart) => {
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

      // Reset availability states when dates change
      setIsAvailable(false);
      setShowPriceDetails(false);

    } else {
      setEndDate(selectedDate);
      setDateError("");
      handleChange({
        target: {
          name: "departureDate",
          value: selectedDate.toISOString().split("T")[0],
        },
      });

      // Reset availability states when dates change
      setIsAvailable(false);
      setShowPriceDetails(false);
    }
  };

  const searchSectionProps = {
    formData,
    handleChange,
    startDate,
    endDate,
    handleDateSelect,
    dateError,
    handleCheckAvailability: handleAvailabilityCheck,
    resetAvailability,
  };

  const propertyDetailsProps = {
    formData,
    startDate,
    endDate,
    priceDetails,
    showPriceDetails,
    selectedExtras,
    appliedCoupon,
    onRoomSelect: handleRoomSelect,
    availableDates,
    loading: availabilityLoading,
    hasSearched,
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
    handleApplyCoupon,
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

  const roomNavigationProps = {
    rooms: Object.values(roomsData),
    onRoomSelect: (roomId) => {
      const element = document.getElementById(`room-${roomId}`);
      if (element) {
        element.scrollIntoView({ behavior: "smooth" });
      }
    },
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#fbfdfb]">
          <HeaderSection />
    <div className=" mx-auto h-[100vh] w-full mt-[174px]">
      {error && <ErrorMessage message={error} />}
      {availabilityError && <ErrorMessage message={availabilityError} />}
      {successMessage && (
        <div className="mb-4 text-green-500">{successMessage}</div>
      )}
      {(loading || availabilityLoading) && <LoadingSpinner />}

      {!showPayment ? (
          <form onSubmit={handleSubmit} className="mx-auto space-y-4">
            <div style={{ backgroundColor: "#668E73" }}>
              <SearchSection {...searchSectionProps} />
              <RoomNavigation {...roomNavigationProps} />
            </div>

            <div className="space-y-8 px-[5%] py-[1%]">
            {formData.apartmentId && (
              <div className="flex flex-col lg:flex-row gap-4 h-auto lg:h-[calc(100vh-200px)]">
                <div className="w-full h-full lg:w-1/2">
                  <div className="h-full overflow-auto">
                    <PropertyDetails
                      {...propertyDetailsProps}
                      showOnlySelected={true}
                      selectedRoomId={formData.apartmentId}
                    />
                  </div>
                </div>

                <div className="w-full h-full lg:w-1/2">
                  <div className="border border-[#668E73] p-4 rounded h-full flex flex-col">
                    <h2 className="text-xl font-semibold text-[#668E73] mb-6">
                      Choix des extras
                    </h2>
                    <BookingSteps currentStep={currentStep} />
                    <div className="flex-1 mt-4 overflow-y-auto">
                      {currentStep === 1 && <ExtrasSection {...extrasSectionProps} />}
                      {currentStep === 2 && <InfoSupSection {...infoSupSectionProps} />}
                      {currentStep === 3 && <ContactSection {...contactSectionProps} />}
                    </div>
                    <div className="pt-4 mt-4 border-t border-gray-200">
                      <NavigationButtons {...navigationButtonsProps} />
                    </div>
                  </div>
                </div>
              </div>
              )}

              <div className="w-full">
                <PropertyDetails
                  {...propertyDetailsProps}
                  showOnlyUnselected={true}
                />
              </div>
            </div>
          </form>
        ) : (
          <div className="fixed inset-0 flex items-center justify-center">
  <div className="w-full p-5 mx-auto md:w-1/2">
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
</div>
      )}
    </div>
    </div>

  );
};

export default BookingForm;