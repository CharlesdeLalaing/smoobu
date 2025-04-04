import { useState } from "react";
import { api } from "../utils/api";

// Helper function for checking room availability

// In roomUtils.js
export const isRoomAvailable = (roomId, startDate, endDate, availableDates, hasSearched = false) => {
  console.log('isRoomAvailable called for', {
    roomId, 
    startDate: startDate ? startDate.toLocaleDateString() : null,
    endDate: endDate ? endDate.toLocaleDateString() : null,
    hasAvailableDates: !!availableDates,
    hasSearched
  });
  
  // If no search performed, all rooms show as available
  if (!hasSearched) return true;
  
  // Early validation
  if (!availableDates || !startDate || !endDate) return false;
  
  const roomData = availableDates[roomId];
  if (!roomData) return false;
  
  // Format date to YYYY-MM-DD consistently
  const formatDate = (date) => {
    const d = new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  
  const start = formatDate(startDate);
  const end = formatDate(endDate);
  
  console.log(`Checking availability from ${start} to ${end}`);
  console.log('Room data keys:', Object.keys(roomData).slice(0, 5)); // First 5 keys
  
  // For booking systems, typically checkout date can overlap with a new check-in
  let currentDate = new Date(startDate);
  const endDateTime = new Date(endDate);
  endDateTime.setDate(endDateTime.getDate() - 1); // Exclude checkout date
  
  // Check all dates in the range
  while (currentDate <= endDateTime) {
    const dateStr = formatDate(currentDate);
    console.log(`Checking date: ${dateStr}`);
    
    // If the date isn't in our data, it's not in the range we queried
    if (!(dateStr in roomData)) {
      console.log(`Date ${dateStr} not in data range, continuing`);
      currentDate.setDate(currentDate.getDate() + 1);
      continue;
    }
    
    // Check the available property
    if (!roomData[dateStr] || roomData[dateStr].available <= 0) {
      console.log(`Date ${dateStr} is unavailable`);
      return false;
    }
    
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  console.log('All dates in range are available');
  return true;
};

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

    // Process API response
    if (response.data) {
      // First, check if we have priceDetails
      if (response.data.priceDetails) {
        // Get a copy of current available dates to preserve them
        const currentAvailableDates = { ...availableDates };

        // Create a structure for the new dates
        const newAvailableRooms = {};

        // Add price details rooms to available rooms
        Object.keys(response.data.priceDetails).forEach((roomId) => {
          // If we already have data for this room, preserve it
          if (currentAvailableDates && currentAvailableDates[roomId]) {
            newAvailableRooms[roomId] = { ...currentAvailableDates[roomId] };
          } else {
            // Create new data for this room
            newAvailableRooms[roomId] = {};
          }
        });

        // If we have new availability data, merge it
        if (response.data.data) {
          // For each room in the response data
          Object.keys(response.data.data).forEach((roomId) => {
            // If the room is in our available rooms
            if (roomId in newAvailableRooms) {
              // Get the current room data from our state
              const currentRoomData = newAvailableRooms[roomId] || {};

              // Get the new room data from the API
              const newRoomData = response.data.data[roomId];

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
        return response.data;
      }
      // If we only have data (no priceDetails)
      else if (response.data.data) {
        console.log("No price details, but we have availability data");

        // Merge with existing data instead of replacing
        const currentAvailableDates = { ...availableDates };
        const newAvailableDates = {};

        // For each room in the response
        Object.keys(response.data.data).forEach((roomId) => {
          // Preserve existing data for this room
          newAvailableDates[roomId] = {
            ...(currentAvailableDates[roomId] || {}),
            ...response.data.data[roomId],
          };
        });

        setAvailableDates(newAvailableDates);
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