import { useEffect, useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
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
import { isRoomAvailable } from "../hooks/roomUtils"; // Add this line
import { roomsData } from "../hooks/roomsData";

const BookingForm = () => {

  // Added calendar view month state
  const [calendarViewMonth, setCalendarViewMonth] = useState(new Date());

  const {
    formData,
    currentStep,
    error,
    loading,

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
    spaValidationError,
    setSelectedCategory,
    handleChange,
    handleExtraChange,
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
    setFormData,
    handleApplyCoupon,
    handleSpaScheduleChange,
  } = useBookingForm();

  const { t } = useTranslation();

  const {
    availableDates,
    loading: availabilityLoading,
    error: availabilityError,
    hasSearched,
    checkAvailability,
    resetAvailability,
  } = useAvailabilityCheck(formData);

  // Added handler for calendar view changes
  const handleCalendarViewChange = useCallback((newViewMonth) => {
    setCalendarViewMonth(newViewMonth);
  }, []);

  // In BookingForm.jsx, add this useEffect
  useEffect(() => {
    // Load initial availability data when component mounts
    const loadInitialAvailability = async () => {
      try {
        // Create date range for current month plus next 12 months
        const today = new Date();
        const startOfRange = new Date(today.getFullYear(), today.getMonth(), 1);
        const endOfRange = new Date(
          today.getFullYear(),
          today.getMonth() + 12,
          0
        );

        // Use the existing checkAvailability function
        await checkAvailability(startOfRange, endOfRange);
        // This should populate availableDates through the existing state update
      } catch (error) {
        console.error("Error loading initial availability data:", error);
      }
    };
    loadInitialAvailability();
  }, []);

  const handleRoomSelect = async (roomId) => {
    try {
      setFormData((prev) => ({
        ...prev,
        apartmentId: roomId,
      }));

      if (startDate && endDate) {
        if (priceDetails && priceDetails[roomId]) {
          setFormData((prev) => ({
            ...prev,
            price: priceDetails[roomId].finalPrice,
          }));
          setShowPriceDetails(true);
          setIsAvailable(true);
        }
      } else {
        setDateError("Please select both arrival and departure dates");
      }

      setError("");

      if (!formData.apartmentId) {
        setCurrentStep(1);
      }

      // Scroll to room
      const roomElement = document.getElementById(`room-${roomId}`);
      if (roomElement) {
        const offset = 100;
        const elementPosition = roomElement.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - offset;

        window.scrollTo({
          top: offsetPosition,
          behavior: "smooth",
        });
      }
    } catch (err) {
      console.error("Errors in handleRoomSelect:", err);
      setError("Failed to update room selection. Please try again.");
      setIsAvailable(false);
      setShowPriceDetails(false);
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
      // Format dates consistently to ensure no timezone issues

      // Create consistent date objects at noon to avoid timezone issues
      const createConsistentDate = (date) => {
        if (!date) return null;
        const d = new Date(date);
        d.setHours(12, 0, 0, 0);
        return d;
      };

      const startDateForCheck = createConsistentDate(startDate);
      const endDateForCheck = createConsistentDate(endDate);

      const availabilityData = await checkAvailability(
        startDateForCheck,
        endDateForCheck
      );

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

  // Modified handleDateSelect to preserve calendar view month
  const handleDateSelect = useCallback(
    async (date, isStart, currentViewMonth) => {
      // Preserve the calendar view month if it's provided
      if (currentViewMonth) {
        setCalendarViewMonth(currentViewMonth);
      }



      // IMPORTANT: Only update the selected room if selectedRoomId is provided
      // and the user explicitly clicked the "Select this room" button
      if (currentViewMonth && typeof currentViewMonth === "string") {
        // Update apartmentId
        handleChange({
          target: {
            name: "apartmentId",
            value: currentViewMonth,
          },
        });

        // Update form data
        setFormData((prev) => ({
          ...prev,
          apartmentId: currentViewMonth,
        }));
      }

      try {
        // Handle date clearing
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

        // Create a new date at midnight in the local timezone
        const year = date.getFullYear();
        const month = date.getMonth();
        const day = date.getDate();
        const selectedDate = new Date(year, month, day, 0, 0, 0, 0);

        if (isStart) {
          // Setting start date
          console.log("Setting as START date");
          setStartDate(selectedDate);

          // If there's already an end date that's earlier than the new start date,
          // clear the end date to avoid invalid date ranges
          if (endDate && selectedDate >= endDate) {
            setEndDate(null);
            handleChange({ target: { name: "departureDate", value: "" } });
          }

          // Format date for form data
          const formattedDate = `${year}-${(month + 1)
            .toString()
            .padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
          handleChange({
            target: {
              name: "arrivalDate",
              value: formattedDate,
            },
          });
        } else {
          // Setting end date
          console.log("Setting as END date");
          setEndDate(selectedDate);

          // Format date for form data
          const formattedDate = `${year}-${(month + 1)
            .toString()
            .padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
          handleChange({
            target: {
              name: "departureDate",
              value: formattedDate,
            },
          });
        }

        // Get updated dates for availability check
        const updatedStartDate = isStart ? selectedDate : startDate;
        const updatedEndDate = isStart ? endDate : selectedDate;

        // Only check availability if both dates are set
        if (updatedStartDate && updatedEndDate) {
          console.log(
            "Both dates set, checking availability for room:",
            currentViewMonth || formData.apartmentId
          );

          try {
            // Call availability check but preserve existing data
            // Pass the current room ID (either from parameter or form data)
            const roomIdToCheck =
              currentViewMonth && typeof currentViewMonth === "string"
                ? currentViewMonth
                : formData.apartmentId;
            const preserveExistingData = true;

            const newAvailabilityData = await checkAvailability(
              updatedStartDate,
              updatedEndDate,
              roomIdToCheck,
              preserveExistingData
            );

            // If we got new data, merge it with existing data instead of replacing completely
            if (newAvailabilityData && newAvailabilityData.priceDetails) {
              // Use the new price details
              setPriceDetails(newAvailabilityData.priceDetails);
              setShowPriceDetails(true);

              // Check if the current room is available in the results
              const isCurrentRoomAvailable =
                roomIdToCheck &&
                newAvailabilityData.priceDetails[roomIdToCheck];

              setIsAvailable(isCurrentRoomAvailable);

              // If the current room has pricing, update the form data price
              if (isCurrentRoomAvailable) {
                setFormData((prev) => ({
                  ...prev,
                  price:
                    newAvailabilityData.priceDetails[roomIdToCheck].finalPrice,
                }));
              }
            } else {
              setDateError("No rates available for selected dates");
              setIsAvailable(false);
              // Still keep showing the container
              setShowPriceDetails(true);
            }
          } catch (err) {
            console.error("Error checking availability:", err);
            setError("Error checking availability");
            // Keep showing the UI with the error message
            setShowPriceDetails(true);
          }
        } else {
          // Keep showing price details while user selects second date
          setShowPriceDetails(true);
        }
      } catch (error) {
        console.error("Error in handleDateSelect:", error);
        setError("An error occurred while processing the date selection");
        // Maintain UI visibility even on error
        setShowPriceDetails(true);
      }
    },
    [
      // Add dependencies this function relies on
      availableDates,
      startDate,
      endDate,
      formData.apartmentId,
      setStartDate,
      setEndDate,
      handleChange,
      setFormData,
      checkAvailability,
      setPriceDetails,
      setShowPriceDetails,
      setIsAvailable,
      setDateError,
      setError,
      setCalendarViewMonth, // Add this new dependency
    ]
  );

  // Add this function to check if the currently selected room is available
  const isSelectedRoomAvailable = () => {
    // If no room is selected, it's not available
    if (!formData.apartmentId) return false;

    // If no dates are selected, default to false
    if (!startDate && !endDate) return false;

    // KEY FIX: If only one date is selected, consider the room available
    if (startDate && !endDate) return true;
    if (!startDate && endDate) return true;

    // Both dates selected, check actual availability
    return isRoomAvailable(
      formData.apartmentId,
      startDate,
      endDate,
      availableDates,
      hasSearched
    );
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
    setStartDate,
    setEndDate,
    setFormData,
    availableDates, // Add this prop
    hasSearched, // Add this prop
    calendarViewMonth, // Add this prop
    onCalendarViewChange: handleCalendarViewChange, // Add this prop
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
    handleDateSelect,
    calendarViewMonth, // Add this prop
    onCalendarViewChange: handleCalendarViewChange, // Add this prop
  };

  const extrasSectionProps = {
    selectedExtras,
    handleExtraChange,
    currentStep,
    selectedCategory,
    formData,
    setSelectedCategory,
  };

  const infoSupSectionProps = {
    formData,
    handleChange,
    appliedCoupon,
    handleApplyCoupon,
    selectedExtras,
    handleSpaScheduleChange,
    spaValidationError,
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
  startDate,
  endDate,
  availableDates,
  hasSearched,
  formData,
  selectedRoomId: formData.apartmentId,
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
      <div className=" mx-auto h-[100vh] w-full">
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

            <div
              className="space-y-8 px-[2%] md:px-[5%] py-[1%]"
              style={{ backgroundColor: "#FBFDFB" }}
            >
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
                      <h2
                        className="text-xl font-semibold text-[#668E73] mb-6"
                        id="extra_top"
                      >
                        {t("booking.sections.extras.title")}
                      </h2>
                      <BookingSteps
                        currentStep={currentStep}
                        formData={formData}
                        selectedRoom={roomsData[formData.apartmentId]}
                        setCurrentStep={setCurrentStep}
                      />
                      <div className="flex-1 mt-4 overflow-y-auto">
                        {!isSelectedRoomAvailable() ? (
                          <div className="flex flex-col items-center justify-center h-full p-6 text-center">
                            <div className="w-full max-w-md p-6 border border-red-200 rounded-md bg-red-50">
                              <p className="mb-2 font-medium text-red-600">
                                {t("booking.errors.roomUnavailable.title")}
                              </p>
                              <p className="text-sm text-gray-600">
                                {t("booking.errors.roomUnavailable.message")}
                              </p>
                            </div>
                          </div>
                        ) : (
                          <>
                            {currentStep === 1 && (
                              <ExtrasSection {...extrasSectionProps} />
                            )}
                            {currentStep === 2 && (
                              <InfoSupSection {...infoSupSectionProps} />
                            )}
                            {currentStep === 3 && (
                              <ContactSection {...contactSectionProps} />
                            )}
                          </>
                        )}
                      </div>
                      <div className="pt-4 mt-4 border-t border-gray-200">
                        <NavigationButtons
                          {...navigationButtonsProps}
                          disabled={!isSelectedRoomAvailable()}
                        />
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
              <h3 className="mb-4 text-lg font-medium">
                {t("booking.payment.title")}
              </h3>
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
