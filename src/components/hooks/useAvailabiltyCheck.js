// hooks/useAvailabilityCheck.js
import { useState } from "react";
import { api } from "../utils/api";

// hooks/useAvailabilityCheck.js
export const useAvailabilityCheck = (formData) => {
  const [availableDates, setAvailableDates] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const checkAvailability = async (startDate, endDate) => {
    if (!startDate || !endDate) {
      return null;
    }

    setLoading(true);
    setError(null);
    
    try {
      const apartmentIds = ["2428698", "2428703", "2432648"];
      
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
        return response.data; // Return both data and priceDetails
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
    checkAvailability,
  };
};
