import { useState } from "react";
import { api } from "../utils/api";

// Helper function for checking room availability
export const isRoomAvailable = (roomId, startDate, endDate, availableDates, hasSearched = false) => {
  console.log("isRoomAvailable check:", {
    roomId,
    startDate,
    endDate,
    hasAvailableDates: !!availableDates,
    hasSearched
  });

  if (!availableDates || !startDate || !endDate) {
    return false;
  }

  const roomData = availableDates[roomId];
  if (!roomData) {
    return false;
  }

  const start = new Date(startDate).toISOString().split("T")[0];
  const end = new Date(endDate).toISOString().split("T")[0];
  let currentDate = new Date(start);
  const endDateTime = new Date(end);

  while (currentDate <= endDateTime) {
    const dateStr = currentDate.toISOString().split("T")[0];
    const dayData = roomData[dateStr];
    if (!dayData || dayData.available === 0) {
      return false;
    }
    currentDate.setDate(currentDate.getDate() + 1);
  }

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
  };

  const checkAvailability = async (startDate, endDate) => {
    if (!startDate || !endDate) {
      return null;
    }
    
    setLoading(true);
    setError(null);

    try {
      const apartmentIds = ["1644643", "1946282", "1946279", "1946276", "1946270"];
      
      console.log("Checking availability for:", {
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        adults: formData.adults,
        children: formData.children
      });

      const response = await api.get("/rates", {
        params: {
          apartments: apartmentIds,
          start_date: startDate.toISOString().split('T')[0],
          end_date: endDate.toISOString().split('T')[0],
          adults: formData.adults || 1,
          children: formData.children || 0,
        },
      });

      console.log("API Response:", response.data);
      
      if (response.data && response.data.data) {
        setAvailableDates(response.data.data);
        setHasSearched(true);
        return response.data;
      }

      setError("No availability data found");
      return null;
    } catch (error) {
      console.error("Error fetching availability:", error);
      setError(error.response?.data?.error || "Unable to fetch availability data");
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
    setError
  };
};