import React, { useEffect } from 'react';

const LocalStorageDebugger = () => {
  useEffect(() => {
    const storedBookingData = localStorage.getItem("bookingData");
    
    console.log("Raw localStorage bookingData:", storedBookingData);
    
    if (storedBookingData) {
      try {
        const parsedData = JSON.parse(storedBookingData);
        console.log("Parsed bookingData:", parsedData);
        
        // Specifically log price-related fields
        console.log("Price Details Breakdown:", {
          totalPrice: parsedData.price,
          basePrice: parsedData?.priceBreakdown?.basePrice,
          extras: parsedData?.extras,
          priceDetails: parsedData?.priceDetails,
          couponApplied: parsedData?.couponApplied
        });
      } catch (error) {
        console.error("Error parsing localStorage data:", error);
      }
    } else {
      console.log("No bookingData found in localStorage");
    }
  }, []);

  return null;
};

export default LocalStorageDebugger;