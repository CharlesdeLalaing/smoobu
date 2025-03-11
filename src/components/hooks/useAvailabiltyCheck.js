import { useState } from "react";
import { api } from "../utils/api";

// Helper function for checking room availability
// Helper function for checking room availability
export const isRoomAvailable = (roomId, startDate, endDate, availableDates, hasSearched = false) => {
  // Early return if essential data is missing
  if (!availableDates || !startDate || !endDate || !hasSearched) {
    return false;
  }
  
  const roomData = availableDates[roomId];
  if (!roomData) {
    return false;
  }
  
  // Convert dates to ISO string format (YYYY-MM-DD)
  const start = new Date(startDate).toISOString().split("T")[0];
  const end = new Date(endDate).toISOString().split("T")[0];
  
  // For booking systems, we typically don't check the end date (checkout date)
  // because guests will leave in the morning and new guests can check in on the same day
  let currentDate = new Date(start);
  const endDateTime = new Date(end);
  
  // Adjust to exclude the checkout date from availability check
  endDateTime.setDate(endDateTime.getDate() - 1); 
  
  while (currentDate <= endDateTime) {
    const dateStr = currentDate.toISOString().split("T")[0];
    const dayData = roomData[dateStr];
    
    if (!dayData || dayData.available === 0) {
      return false;
    }
    
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  // Specific check for the checkout date - it only needs to be available for checkout
  // This isn't needed with most booking systems, but keeping it here in case your API handles this specifically
  const checkoutDateStr = end;
  const checkoutDayData = roomData[checkoutDateStr];
  
  // For checkout dates, we allow partial availability
  // Your API might indicate this in a special way or you may need to add additional logic 
  // based on your specific data structure
  
  return true;
}

// Main hook for availability checking
export const useAvailabilityCheck = (formData) => {
  const [availableDates, setAvailableDates] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasSearched, setHasSearched] = useState(false);

  const resetAvailability = () => {
    setAvailableDates({});
    setError(null);
    setHasSearched(false);
  };

  const checkAvailability = async (startDate, endDate) => {
    if (!startDate || !endDate) {
      return null;
    }

    // Validate date range
    if (startDate >= endDate) {
      setError("Departure date must be after arrival date");
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const apartmentIds = [
        "2565753", // La Cabane du Chêne
        "1946282", // Le Dôme des Libellules
        "1644643", // La Bulle du Ruisseau
        "1946279", // Le Moulin
        "1946276", // La Chambre de Blé
        "1946270", // Le Logis
      ];

      // Format dates as YYYY-MM-DD
      const formattedStartDate = startDate.toISOString().split("T")[0];
      const formattedEndDate = endDate.toISOString().split("T")[0];

      console.log("Checking availability for:", {
        startDate: formattedStartDate,
        endDate: formattedEndDate,
        adults: formData.adults || 1,
        children: formData.children || 0,
      });

      const response = await api.get("/rates", {
        params: {
          apartments: apartmentIds,
          start_date: formattedStartDate,
          end_date: formattedEndDate,
          adults: formData.adults || 1,
          children: formData.children || 0,
        },
      });

      console.log("API Response:", response.data);

      // Process API response
      if (response.data) {
        // First, check if we have priceDetails (which indicates availability)
        if (response.data.priceDetails) {
          // Available rooms will have price details
          const availableRooms = {};

          // Create a structure for available dates by room
          Object.keys(response.data.priceDetails).forEach((roomId) => {
            // Extract date range from start/end dates
            const dateRange = {};
            let currentDate = new Date(formattedStartDate);
            const lastDate = new Date(formattedEndDate);

            while (currentDate <= lastDate) {
              const dateKey = currentDate.toISOString().split("T")[0];
              // Mark as available
              dateRange[dateKey] = { available: 1 };
              currentDate.setDate(currentDate.getDate() + 1);
            }

            availableRooms[roomId] = dateRange;
          });

          // Use the data from API if available
          if (response.data.data) {
            // Merge with the detailed availability data
            Object.keys(response.data.data).forEach((roomId) => {
              if (availableRooms[roomId]) {
                availableRooms[roomId] = {
                  ...availableRooms[roomId],
                  ...response.data.data[roomId],
                };
              }
            });
          }

          setAvailableDates(availableRooms);
          setHasSearched(true);
          return response.data;
        }
        // If we have data but no priceDetails, we still want to process the availability data
        else if (response.data.data) {
          setAvailableDates(response.data.data);
          setHasSearched(true);
          return response.data;
        }
        // No availability data found
        else {
          setError("No availability data found");
          setHasSearched(true);
          return null;
        }
      }

      setError("Invalid response from server");
      return null;
    } catch (error) {
      console.error("Error fetching availability:", error);
      setError(
        error.response?.data?.error || "Unable to fetch availability data"
      );
      return null;
    } finally {
      setLoading(false);
    }
  };

  return {
    availableDates,
    loading,
    error,
    hasSearched,
    checkAvailability,
    resetAvailability,
    setHasSearched,
    setAvailableDates,
    setError,
  };
};