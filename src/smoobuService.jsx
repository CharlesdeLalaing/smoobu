import axios from "axios";

const API_URL =
  import.meta.env.VITE_API_URL || "https://booking-9u8u.onrender.com";

export const fetchAvailability = async (apartmentId, startDate, endDate) => {
  try {
    const response = await axios.get(`${API_URL}/api/rates`, {
      params: {
        apartments: [apartmentId],
        start_date: startDate,
        end_date: endDate,
      },
      headers: {
        "Content-Type": "application/json",
      },
      withCredentials: true,
    });
    return response.data;
  } catch (error) {
    console.error("Error fetching availability:", error);
    throw error;
  }
};
