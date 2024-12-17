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

  const handleRoomSelect = async (roomId) => {
    try {
      setFormData(prev => ({
        ...prev,
        apartmentId: roomId,
      }));

      if (startDate && endDate) {
        if (priceDetails && priceDetails[roomId]) {
          setFormData(prev => ({
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
          behavior: "smooth"
        });
      }

    } catch (err) {
      console.error("Error in handleRoomSelect:", err);
      setError("Failed to update room selection. Please try again.");
      setIsAvailable(false);
      setShowPriceDetails(false);
    }
  };
  
  const handleAvailabilityCheck = async () => {
    console.log('handleAvailabilityCheck called with:', {
      startDate,
      endDate,
      formDataDates: {
        arrival: formData.arrivalDate,
        departure: formData.departureDate
      }
    });
  
    if (!startDate || !endDate) {
      setDateError("Please select both arrival and departure dates");
      return;
    }
  
    setError("");
    setDateError("");
  
    try {
      const availabilityData = await checkAvailability(startDate, endDate);
      console.log('Availability data received:', availabilityData);

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

  // const handleDateSelect = (date, isStart) => {
  //   // Reset handling
  //   if (!date) {
  //     if (isStart) {
  //       setStartDate(null);
  //       setEndDate(null);
  //       handleChange({ target: { name: "arrivalDate", value: "" } });
  //       handleChange({ target: { name: "departureDate", value: "" } });
  //     } else {
  //       setEndDate(null);
  //       handleChange({ target: { name: "departureDate", value: "" } });
  //     }
  //     setDateError("");
  //     resetAvailability(); // Add this to ensure state is reset
  //     return;
  //   }
  
  //   // Set the selected date
  //   const selectedDate = new Date(date.setHours(12, 0, 0, 0));
  
  //   if (isStart) {
  //     // Setting start date
  //     setStartDate(selectedDate);
  //     setEndDate(null); // Clear end date when start date changes
  //     handleChange({
  //       target: {
  //         name: "arrivalDate",
  //         value: selectedDate.toISOString().split("T")[0],
  //       },
  //     });
  //     handleChange({ target: { name: "departureDate", value: "" } });
      
  //     // Reset states
  //     setIsAvailable(false);
  //     setShowPriceDetails(false);
  //     resetAvailability();
  //   } else {
  //     // Setting end date
  //     setEndDate(selectedDate);
  //     handleChange({
  //       target: {
  //         name: "departureDate",
  //         value: selectedDate.toISOString().split("T")[0],
  //       },
  //     });
  //   }
  
  //   // Check availability if both dates are set (moved outside the if/else)
  //   const updatedStartDate = isStart ? selectedDate : startDate;
  //   const updatedEndDate = isStart ? null : selectedDate;
  
  //   if (updatedStartDate && updatedEndDate) {
  //     console.log('Both dates set, checking availability:', {
  //       start: updatedStartDate,
  //       end: updatedEndDate
  //     });
  //     handleAvailabilityCheck();
  //   }
  // };


   // Replace your existing handleDateSelect with this version
    // const handleDateSelect = (date, isStart) => {
    //   // Handle date clearing
    //   if (!date) {
    //     if (isStart) {
    //       setStartDate(null);
    //       setEndDate(null);
    //       handleChange({ target: { name: "arrivalDate", value: "" } });
    //       handleChange({ target: { name: "departureDate", value: "" } });
    //     } else {
    //       setEndDate(null);
    //       handleChange({ target: { name: "departureDate", value: "" } });
    //     }
    //     setDateError("");
    //     resetAvailability();
    //     setPriceDetails({});
    //     setShowPriceDetails(false);
    //     setIsAvailable(false);
    //     return;
    //   }

    //   // Set the selected date
    //   const selectedDate = new Date(date.setHours(12, 0, 0, 0));

    //   if (isStart) {
    //     setStartDate(selectedDate);
    //     setEndDate(null);
    //     handleChange({
    //       target: {
    //         name: "arrivalDate",
    //         value: selectedDate.toISOString().split("T")[0],
    //       },
    //     });
    //     handleChange({ target: { name: "departureDate", value: "" } });
    //   } else {
    //     setEndDate(selectedDate);
    //     handleChange({
    //       target: {
    //         name: "departureDate",
    //         value: selectedDate.toISOString().split("T")[0],
    //       },
    //     });
    //   }

    //   // Get the updated dates
    //   const updatedStartDate = isStart ? selectedDate : startDate;
    //   const updatedEndDate = isStart ? null : selectedDate;

    //   // Check availability if both dates are set
    //   if (updatedStartDate && updatedEndDate) {
    //     handleAvailabilityCheck();
    //   }
    // };

    // const handleDateSelect = async (date, isStart) => {
    //   try {
    //     // Handle date clearing
    //     if (!date) {
    //       if (isStart) {
    //         setStartDate(null);
    //         setEndDate(null);
    //         handleChange({ target: { name: "arrivalDate", value: "" } });
    //         handleChange({ target: { name: "departureDate", value: "" } });
    //         resetAvailability();
    //       } else {
    //         setEndDate(null);
    //         handleChange({ target: { name: "departureDate", value: "" } });
    //       }
    //       setDateError("");
    //       return;
    //     }
    
    //     // Set the selected date
    //     const selectedDate = new Date(date.setHours(12, 0, 0, 0));
    
    //     if (isStart) {
    //       // Setting start date
    //       setStartDate(selectedDate);
    //       setEndDate(null);
    //       handleChange({
    //         target: {
    //           name: "arrivalDate",
    //           value: selectedDate.toISOString().split("T")[0],
    //         },
    //       });
    //       handleChange({ target: { name: "departureDate", value: "" } });
          
    //       // Keep showing existing data but reset availability
    //       resetAvailability();
    //     } else {
    //       // Setting end date
    //       setEndDate(selectedDate);
    //       handleChange({
    //         target: {
    //           name: "departureDate",
    //           value: selectedDate.toISOString().split("T")[0],
    //         },
    //       });
    //     }
    
    //     // Get updated dates for availability check
    //     const updatedStartDate = isStart ? selectedDate : startDate;
    //     const updatedEndDate = isStart ? null : selectedDate;
    
    //     // Only check availability if both dates are set
    //     if (updatedStartDate && updatedEndDate) {
    //       console.log('Both dates set, checking availability:', {
    //         start: updatedStartDate,
    //         end: updatedEndDate
    //       });
    
    //       try {
    //         const availabilityData = await checkAvailability(updatedStartDate, updatedEndDate);
            
    //         if (availabilityData?.priceDetails) {
    //           setPriceDetails(availabilityData.priceDetails);
    //           setShowPriceDetails(true);
    //           setIsAvailable(true);
    
    //           // Update price if a room is already selected
    //           if (formData.apartmentId && availabilityData.priceDetails[formData.apartmentId]) {
    //             setFormData(prev => ({
    //               ...prev,
    //               price: availabilityData.priceDetails[formData.apartmentId].finalPrice
    //             }));
    //           }
    //         } else {
    //           // Even if no availability, keep showing the existing data
    //           setDateError("No rates available for selected dates");
    //         }
    //       } catch (err) {
    //         console.error("Error checking availability:", err);
    //         setError("Error checking availability");
    //         // Don't hide price details on error
    //       }
    //     } else {
    //       // Keep showing price details while user selects second date
    //       setShowPriceDetails(true);
    //     }
    //   } catch (error) {
    //     console.error("Error in handleDateSelect:", error);
    //     setError("An error occurred while processing the date selection");
    //   }
    // };

    const handleDateSelect = async (date, isStart) => {
      try {
        // Handle date clearing
        if (!date) {
          if (isStart) {
            setStartDate(null);
            setEndDate(null);
            handleChange({ target: { name: "arrivalDate", value: "" } });
            handleChange({ target: { name: "departureDate", value: "" } });
            resetAvailability();
          } else {
            setEndDate(null);
            handleChange({ target: { name: "departureDate", value: "" } });
          }
          setDateError("");
          // Keep showing price details even when clearing
          setShowPriceDetails(true);
          return;
        }
    
        // Set the selected date
        const selectedDate = new Date(date.setHours(12, 0, 0, 0));
    
        if (isStart) {
          // Setting start date
          setStartDate(selectedDate);
          setEndDate(null);
          handleChange({
            target: {
              name: "arrivalDate",
              value: selectedDate.toISOString().split("T")[0],
            },
          });
          handleChange({ target: { name: "departureDate", value: "" } });
          
          // Reset availability but keep UI visible
          resetAvailability();
          setShowPriceDetails(true);
        } else {
          // Setting end date
          setEndDate(selectedDate);
          handleChange({
            target: {
              name: "departureDate",
              value: selectedDate.toISOString().split("T")[0],
            },
          });
        }
    
        // Get updated dates for availability check
        const updatedStartDate = isStart ? selectedDate : startDate;
        const updatedEndDate = isStart ? null : selectedDate;
    
        // Only check availability if both dates are set
        if (updatedStartDate && updatedEndDate) {
          console.log('Both dates set, checking availability:', {
            start: updatedStartDate,
            end: updatedEndDate
          });
    
          try {
            const availabilityData = await checkAvailability(updatedStartDate, updatedEndDate);
            
            if (availabilityData?.priceDetails) {
              setPriceDetails(availabilityData.priceDetails);
              setShowPriceDetails(true);
              setIsAvailable(true);
    
              // Update price if a room is already selected
              if (formData.apartmentId && availabilityData.priceDetails[formData.apartmentId]) {
                setFormData(prev => ({
                  ...prev,
                  price: availabilityData.priceDetails[formData.apartmentId].finalPrice
                }));
              }
            } else {
              // Keep showing the UI with unavailability message
              setDateError("No rates available for selected dates");
              setIsAvailable(false);
              setPriceDetails(null);
              setShowPriceDetails(true); // Keep the container visible
            }
          } catch (err) {
            console.error("Error checking availability:", err);
            setError("Error checking availability");
            setIsAvailable(false);
            setPriceDetails(null);
            // Keep the container visible
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

  const searchSectionProps = {
    formData,
    handleChange,
    startDate,
    endDate,
    handleDateSelect,
    dateError,
    handleCheckAvailability: handleAvailabilityCheck,
    resetAvailability,
    setStartDate,  // Add this
    setEndDate,    // Add this
    setFormData    // Add this
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

    // Add this function to check if the selected room is available
    const isSelectedRoomAvailable = () => {
      if (!formData.apartmentId || !priceDetails) return false;
      return Boolean(priceDetails[formData.apartmentId]);
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
              {/* {formData.apartmentId && (
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
                      <h2 className="text-xl font-semibold text-[#668E73] mb-6" id="extra_top">
                        Choix des extras
                      </h2>
                      <BookingSteps currentStep={currentStep} />
                      <div className="flex-1 mt-4 overflow-y-auto">
                        {currentStep === 1 && (
                          <ExtrasSection {...extrasSectionProps} />
                        )}
                        {currentStep === 2 && (
                          <InfoSupSection {...infoSupSectionProps} />
                        )}
                        {currentStep === 3 && (
                          <ContactSection {...contactSectionProps} />
                        )}
                      </div>
                      <div className="pt-4 mt-4 border-t border-gray-200">
                        <NavigationButtons {...navigationButtonsProps} />
                      </div>
                    </div>
                  </div>
                </div>
              )} */}
              {formData.apartmentId && isSelectedRoomAvailable() && (
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
                      <h2 className="text-xl font-semibold text-[#668E73] mb-6" id="extra_top">
                        Choix des extras
                      </h2>
                      <BookingSteps currentStep={currentStep} />
                      <div className="flex-1 mt-4 overflow-y-auto">
                        {currentStep === 1 && (
                          <ExtrasSection {...extrasSectionProps} />
                        )}
                        {currentStep === 2 && (
                          <InfoSupSection {...infoSupSectionProps} />
                        )}
                        {currentStep === 3 && (
                          <ContactSection {...contactSectionProps} />
                        )}
                      </div>
                      <div className="pt-4 mt-4 border-t border-gray-200">
                        <NavigationButtons {...navigationButtonsProps} />
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {/* <div className="w-full">
                <PropertyDetails
                  {...propertyDetailsProps}
                  showOnlyUnselected={true}
                />
              </div> */}
              {/* Show this view when either no room is selected or the selected room is unavailable */}
              {(!formData.apartmentId || !isSelectedRoomAvailable()) && (
                <div className="w-full">
                  <PropertyDetails
                    {...propertyDetailsProps}
                    showOnlyUnselected={true}
                  />
                </div>
              )}
            </div>
          </form>
        ) : (
          <div className="fixed inset-0 flex items-center justify-center">
            <div className="w-full p-5 mx-auto md:w-1/2">
              <h3 className="mb-4 text-lg font-medium">
                Finaliser votre paiement
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