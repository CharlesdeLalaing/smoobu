import React, {useEffect} from "react";
import { useTranslation } from 'react-i18next';
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
import { isRoomAvailable } from "../hooks/roomUtils";  // Add this line
import { roomsData } from "../hooks/roomsData";

const BookingForm = () => {
  const navigate = useNavigate();
  // const {
  //   formData,
  //   currentStep,
  //   error,
  //   loading,
  //   isAvailable,
  //   showPriceDetails,
  //   successMessage,
  //   priceDetails,
  //   showPayment,
  //   clientSecret,
  //   selectedExtras,
  //   dateError,
  //   startDate,
  //   endDate,
  //   appliedCoupon,
  //   selectedCategory,
  //   setSelectedCategory,
  //   handleChange,
  //   handleExtraChange,
  //   handleCheckAvailability,
  //   handleSubmit,
  //   nextStep,
  //   prevStep,
  //   isStepValid,
  //   handlePaymentSuccess,
  //   setError,
  //   setStartDate,
  //   setIsAvailable,
  //   setEndDate,
  //   setDateError,
  //   setCurrentStep,
  //   setPriceDetails,
  //   setShowPriceDetails,
  //   setShowPayment,
  //   setFormData,
  //   handleApplyCoupon,
  // } = useBookingForm();

  const { t } = useTranslation();

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

  // const {
  //   availableDates,
  //   loading: availabilityLoading,
  //   error: availabilityError,
  //   hasSearched,
  //   checkAvailability,
  //   resetAvailability,
  // } = useAvailabilityCheck(formData);

  const {
    availableDates,
    loading: availabilityLoading,
    error: availabilityError,
    hasSearched,
    checkAvailability,
    resetAvailability,
  } = useAvailabilityCheck(formData);

  // const handleRoomSelect = async (roomId) => {
  //   setFormData((prev) => ({
  //     ...prev,
  //     apartmentId: roomId,
  //   }));

  //   if (startDate && endDate) {
  //     try {
  //       if (priceDetails && priceDetails[roomId]) {
  //         const roomPriceDetails = priceDetails[roomId];
  //         setFormData((prev) => ({
  //           ...prev,
  //           price: roomPriceDetails.finalPrice,
  //         }));
  //         setShowPriceDetails(true);
  //       } else {
  //         await handleAvailabilityCheck();
  //       }
  //     } catch (err) {
  //       console.error("Error updating prices:", err);
  //       setError("Failed to update prices for the selected room");
  //     }
  //   }

  //   if (!formData.apartmentId) {
  //     setCurrentStep(1);
  //   }
  // };

  // In BookingForm.jsx, add this useEffect
  useEffect(() => {
    // Load initial availability data when component mounts
    const loadInitialAvailability = async () => {
      try {
        // Create date range for current month plus next month
        const today = new Date();
        const startOfRange = new Date(today.getFullYear(), today.getMonth(), 1);
        const endOfRange = new Date(
          today.getFullYear(),
          today.getMonth() + 2,
          0
        );

        console.log("Loading initial availability data for date range:", {
          start: startOfRange.toISOString().split("T")[0],
          end: endOfRange.toISOString().split("T")[0],
        });

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
    console.log("handleAvailabilityCheck called with:", {
      startDate,
      endDate,
      formDataDates: {
        arrival: formData.arrivalDate,
        departure: formData.departureDate,
      },
    });

    if (!startDate || !endDate) {
      setDateError("Please select both arrival and departure dates");
      return;
    }

    setError("");
    setDateError("");

    try {
      // Format dates consistently to ensure no timezone issues
      const formatDateToYYYYMMDD = (date) => {
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, "0");
        const day = date.getDate().toString().padStart(2, "0");
        return `${year}-${month}-${day}`;
      };

      // Create consistent date objects at noon to avoid timezone issues
      const createConsistentDate = (date) => {
        if (!date) return null;
        const d = new Date(date);
        d.setHours(12, 0, 0, 0);
        return d;
      };

      const startDateForCheck = createConsistentDate(startDate);
      const endDateForCheck = createConsistentDate(endDate);

      console.log(
        "Checking availability with formatted dates:",
        formatDateToYYYYMMDD(startDateForCheck),
        formatDateToYYYYMMDD(endDateForCheck)
      );

      const availabilityData = await checkAvailability(
        startDateForCheck,
        endDateForCheck
      );

      console.log("Availability data received:", availabilityData);

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

  // Add this function to your BookingForm component

const handleDateSelect = async (date, isStart) => {
  console.log("handleDateSelect called with date:", date, "isStart:", isStart);

  try {
    // Store the current availability data before making any changes
    const currentAvailableDates = { ...availableDates };

    // Handle date clearing
    if (!date) {
      if (isStart) {
        setStartDate(null);
        setEndDate(null);
        handleChange({ target: { name: "arrivalDate", value: "" } });
        handleChange({ target: { name: "departureDate", value: "" } });
        // Don't reset availability - keep the current data
        // resetAvailability(); <-- Remove or comment this line
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

    console.log("Normalized selected date:", selectedDate.toLocaleDateString());

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

      // Don't reset availability if we don't have an end date
      // if (!endDate) {
      //   resetAvailability(); <-- Remove or comment this line
      // }
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
      console.log("Both dates set, checking availability");

      try {
        // Call availability check but preserve existing data
        const newAvailabilityData = await checkAvailability(
          updatedStartDate,
          updatedEndDate
        );

        // If we got new data, merge it with existing data instead of replacing
        if (newAvailabilityData && newAvailabilityData.priceDetails) {
          // Use the new price details but keep existing availability data
          setPriceDetails(newAvailabilityData.priceDetails);
          setShowPriceDetails(true);
          setIsAvailable(true);

          // DON'T reset or replace availableDates here
          // Instead, we'll modify checkAvailability to preserve existing data
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
};

  // Make sure to include this in your propertyDetailsProps object:

  // Add this function to check if the currently selected room is available
  const isSelectedRoomAvailable = () => {
    if (!formData.apartmentId || !startDate || !endDate) return false;

    // Use the existing isRoomAvailable function from your roomUtils
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

            <div className="space-y-8 px-[2%] md:px-[5%] py-[1%]">
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