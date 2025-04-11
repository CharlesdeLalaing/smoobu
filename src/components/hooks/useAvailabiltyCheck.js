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

  const checkAvailability = async (
    startDate,
    endDate,
    roomId = null,
    preserveExistingData = false
  ) => {
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

    // Store current data if we need to preserve it
    const currentAvailableDates = preserveExistingData
      ? { ...availableDates }
      : {};

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



      const response = await api.get("/rates", {
        params: {
          apartments: apartmentIds,
          start_date: formattedStartDate,
          end_date: formattedEndDate,
          adults: formData.adults || 1,
          children: formData.children || 0,
        },
      });

      // Transform the API response to identify check-in and checkout days
      const enhancedResponse = enhanceAvailabilityData(response.data);


      // Process the enhanced API response
      if (enhancedResponse) {
        // First, check if we have priceDetails
        if (enhancedResponse.priceDetails) {
          // CRITICAL CHANGE: Handle data preservation differently
          if (preserveExistingData) {
            // Create a merged structure from current and new data
            const mergedAvailableDates = { ...currentAvailableDates };

            // Add price details rooms to available rooms
            Object.keys(enhancedResponse.priceDetails).forEach((roomId) => {
              // Ensure the room exists in our merged data
              if (!mergedAvailableDates[roomId]) {
                mergedAvailableDates[roomId] = {};
              }
            });

            // If we have new availability data, merge it (don't replace)
            if (enhancedResponse.data) {
              // For each room in the response data
              Object.keys(enhancedResponse.data).forEach((roomId) => {
                // Ensure the room exists in our merged data
                if (!mergedAvailableDates[roomId]) {
                  mergedAvailableDates[roomId] = {};
                }

                // Get the new room data
                const newRoomData = enhancedResponse.data[roomId];

                // Merge the new data with existing data (don't replace)
                mergedAvailableDates[roomId] = {
                  ...mergedAvailableDates[roomId],
                  ...newRoomData,
                };
              });
            }


            setAvailableDates(mergedAvailableDates);
          } else {
            // Original behavior - getting complete new data
            const newAvailableRooms = {};

            // Add price details rooms to available rooms
            Object.keys(enhancedResponse.priceDetails).forEach((roomId) => {
              newAvailableRooms[roomId] = {};
            });

            // If we have new availability data, add it
            if (enhancedResponse.data) {
              Object.keys(enhancedResponse.data).forEach((roomId) => {
                if (roomId in newAvailableRooms) {
                  newAvailableRooms[roomId] = enhancedResponse.data[roomId];
                }
              });
            }


            setAvailableDates(newAvailableRooms);
          }

          setHasSearched(true);
          return enhancedResponse;
        }
        // If we only have data (no priceDetails)
        else if (enhancedResponse.data) {
  

          if (preserveExistingData) {
            // Merge with existing data instead of replacing
            const mergedAvailableDates = { ...currentAvailableDates };

            // For each room in the response
            Object.keys(enhancedResponse.data).forEach((roomId) => {
              // Ensure the room exists in our merged data
              if (!mergedAvailableDates[roomId]) {
                mergedAvailableDates[roomId] = {};
              }

              // Merge the new data
              mergedAvailableDates[roomId] = {
                ...mergedAvailableDates[roomId],
                ...enhancedResponse.data[roomId],
              };
            });

            setAvailableDates(mergedAvailableDates);
          } else {
            // Original behavior
            const newAvailableDates = {};

            Object.keys(enhancedResponse.data).forEach((roomId) => {
              newAvailableDates[roomId] = enhancedResponse.data[roomId];
            });

            setAvailableDates(newAvailableDates);
          }

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
    // Create date range for current month plus next 12 months
    const today = new Date();
    const startOfRange = new Date(today.getFullYear(), today.getMonth(), 1);

    // End range is 12 months from start
    const endOfRange = new Date(today.getFullYear(), today.getMonth() + 12, 0);

    console.log("Loading availability data for full year:", {
      start: startOfRange.toISOString().split("T")[0],
      end: endOfRange.toISOString().split("T")[0],
    });

    // Use the existing checkAvailability function
    await checkAvailability(startOfRange, endOfRange);
  } catch (error) {
    console.error("Error loading full year availability data:", error);
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
