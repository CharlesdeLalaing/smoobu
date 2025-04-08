import { useState } from "react";
import { api } from "../utils/api";
import { enhanceAvailabilityData } from "./availabilityTransformer"; // Import the transformer

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

      // Format dates for API
      const formatDate = (date) => {
        const d = new Date(date);
        return `${d.getFullYear()}-${(d.getMonth() + 1)
          .toString()
          .padStart(2, "0")}-${d.getDate().toString().padStart(2, "0")}`;
      };

      const formattedStartDate = formatDate(startDate);
      const formattedEndDate = formatDate(endDate);

      console.log("Checking availability for:", {
        startDate: formattedStartDate,
        endDate: formattedEndDate,
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

      console.log("API Response structure:", {
        hasData: !!response.data,
        hasPriceDetails: response.data && !!response.data.priceDetails,
        hasDetailedData: response.data && !!response.data.data,
      });

      // Debug raw API data for April for each apartment
      if (response.data && response.data.data) {
        apartmentIds.forEach((roomId) => {
          if (response.data.data[roomId]) {
            console.log(
              `Raw April data for room ${roomId}:`,
              Object.keys(response.data.data[roomId])
                .filter((date) => date.startsWith("2025-04"))
                .reduce((obj, key) => {
                  obj[key] = response.data.data[roomId][key];
                  return obj;
                }, {})
            );
          }
        });
      }

      // Transform the API response to identify check-in and checkout days
      const enhancedResponse = enhanceAvailabilityData(response.data);

      // Debug the transformed data
      console.log("Enhanced API response:", enhancedResponse);

      // Process the enhanced API response
      if (enhancedResponse) {
        // First, check if we have priceDetails
        if (enhancedResponse.priceDetails) {
          // Get a copy of current available dates to preserve them
          const currentAvailableDates = { ...availableDates };

          // Create a structure for the new dates
          const newAvailableRooms = {};

          // Add price details rooms to available rooms
          Object.keys(enhancedResponse.priceDetails).forEach((roomId) => {
            // If we already have data for this room, preserve it
            if (currentAvailableDates && currentAvailableDates[roomId]) {
              newAvailableRooms[roomId] = { ...currentAvailableDates[roomId] };
            } else {
              // Create new data for this room
              newAvailableRooms[roomId] = {};
            }
          });

          // If we have new availability data, merge it
          if (enhancedResponse.data) {
            // For each room in the response data
            Object.keys(enhancedResponse.data).forEach((roomId) => {
              // If the room is in our available rooms
              if (roomId in newAvailableRooms) {
                // Get the current room data from our state
                const currentRoomData = newAvailableRooms[roomId] || {};

                // Get the new room data from the API
                const newRoomData = enhancedResponse.data[roomId];

                // Merge the new data with existing data
                // This ensures we don't lose existing availability info
                newAvailableRooms[roomId] = {
                  ...currentRoomData,
                  ...newRoomData,
                };
              }
            });
          }

          console.log("Updated availableDates structure:", newAvailableRooms);


          setAvailableDates(newAvailableRooms);
          setHasSearched(true);
          return enhancedResponse;
        }
        // If we only have data (no priceDetails)
        else if (enhancedResponse.data) {
          console.log("No price details, but we have availability data");

          // Merge with existing data instead of replacing
          const currentAvailableDates = { ...availableDates };
          const newAvailableDates = {};

          // For each room in the response
          Object.keys(enhancedResponse.data).forEach((roomId) => {
            // Preserve existing data for this room
            newAvailableDates[roomId] = {
              ...(currentAvailableDates[roomId] || {}),
              ...enhancedResponse.data[roomId],
            };

          });

          setAvailableDates(newAvailableDates);
          setHasSearched(true);
          return enhancedResponse;
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

  // Function to load initial availability data
  const loadInitialAvailability = async () => {
    try {
      // Create date range for current month plus next month
      const today = new Date();
      const startOfRange = new Date(today.getFullYear(), today.getMonth(), 1);
      const endOfRange = new Date(today.getFullYear(), today.getMonth() + 2, 0);

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

  return {
    availableDates,
    loading,
    error,
    hasSearched,
    checkAvailability,
    resetAvailability,
    loadInitialAvailability,
    setHasSearched,
    setAvailableDates,
    setError,
  };
};
