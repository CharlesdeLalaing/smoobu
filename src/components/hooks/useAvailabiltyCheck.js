// useAvailabilityCheck.js
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

      const enhancedResponse = enhanceAvailabilityData(response.data);

      if (enhancedResponse) {
        // ---- START: Handling preserveExistingData ----
        if (preserveExistingData) {
          const mergedAvailableDates = { ...currentAvailableDates };

          // Ensure room keys from priceDetails exist in the merged object
          if (enhancedResponse.priceDetails) {
            Object.keys(enhancedResponse.priceDetails).forEach((roomId) => {
              if (!mergedAvailableDates[roomId]) {
                mergedAvailableDates[roomId] = {};
              }
            });
          }

          // Process the availability data (if present)
          if (enhancedResponse.data) {
            Object.keys(enhancedResponse.data).forEach((roomId) => {
              // Get the existing map of dates for this room (or empty object)
              const existingRoomDataMap = mergedAvailableDates[roomId] || {};
              // Get the new map of dates for this room (only dates in the new fetch)
              const newRoomDataMap = enhancedResponse.data[roomId] || {};

              // Iterate through ONLY the dates present in the NEW data map
              for (const dateKey in newRoomDataMap) {
                // Get the existing data for this specific date (if any)
                const existingDateInfo = existingRoomDataMap[dateKey] || {};
                // Get the new data for this specific date
                const newDateInfo = newRoomDataMap[dateKey];

                // *** DETAILED MERGE LOGIC FOR EACH DATE ***
                existingRoomDataMap[dateKey] = {
                  ...existingDateInfo, // Start with existing data (includes old flags)
                  ...newDateInfo, // Overwrite with new data (price, availability etc.)

                  // --- Explicitly preserve crucial flags ---
                  // Keep checkoutOnly if it was true before AND the new data doesn't set it to false
                  checkoutOnly:
                    existingDateInfo.checkoutOnly === true &&
                    newDateInfo.checkoutOnly !== false
                      ? true
                      : newDateInfo.checkoutOnly, // Otherwise use the new value (or undefined)

                  // Keep checkinOnly if it was true before AND the new data doesn't set it to false
                  checkinOnly:
                    existingDateInfo.checkinOnly === true &&
                    newDateInfo.checkinOnly !== false
                      ? true
                      : newDateInfo.checkinOnly, // Otherwise use the new value (or undefined)
                  // Add any other flags you need to preserve in the same way here
                };
                // *** END OF DETAILED MERGE LOGIC ***
              }
              // Update the room's data map in the main merged object
              mergedAvailableDates[roomId] = existingRoomDataMap;
            });
          }
          // Update state with the carefully merged data
          setAvailableDates(mergedAvailableDates);
        } else {
          // ---- START: Handling !preserveExistingData (Original logic - Replace state) ----
          let newAvailableData = {};
          // If we have priceDetails, use its keys to structure the data
          if (enhancedResponse.priceDetails) {
            newAvailableData = {};
            Object.keys(enhancedResponse.priceDetails).forEach((roomId) => {
              // Initialize room, potentially populate with data if available
              newAvailableData[roomId] = enhancedResponse.data?.[roomId] || {};
            });
          } else if (enhancedResponse.data) {
            // If no priceDetails, just use the data structure
            newAvailableData = enhancedResponse.data;
          }
          setAvailableDates(newAvailableData);
          // ---- END: Handling !preserveExistingData ----
        }

        setHasSearched(true);
        return enhancedResponse; // Return the full response including priceDetails
      } else {
        // Handle case where enhancedResponse is null/undefined
        setError("Invalid response structure after enhancement");
        setHasSearched(true); // Still mark as searched even if error
        return null;
      }
    } catch (error) {
      console.error("Error fetching availability:", error);
      setError(
        error.response?.data?.error || "Unable to fetch availability data"
      );
      // Potentially clear dates if error is critical? Or leave as is?
      // setAvailableDates({}); // Optional: clear dates on error
      return null;
    } finally {
      setLoading(false);
    }
  };

  // Function to load initial availability data (no change needed here)
  const loadInitialAvailability = async () => {
    try {
      const today = new Date();
      const startOfRange = new Date(today.getFullYear(), today.getMonth(), 1);
      const endOfRange = new Date(
        today.getFullYear(),
        today.getMonth() + 12,
        0
      );
      // Use checkAvailability WITHOUT preserveExistingData flag
      await checkAvailability(startOfRange, endOfRange);
    } catch (error) {
      console.error("Error loading full year availability data:", error);
      // Handle error appropriately, maybe set an error state
    }
  };

  return {
    availableDates,
    loading,
    error,
    hasSearched,
    checkAvailability,
    resetAvailability,
    loadInitialAvailability, // You might not need to export this if only used internally
    // Export setters only if needed by other components, often not necessary
    setHasSearched,
    setAvailableDates,
    setError,
  };
};
