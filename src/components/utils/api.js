import axios from "axios";

const API_URL =
  import.meta.env.VITE_API_URL || "https://booking-9u8u.onrender.com";

export const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    "Content-Type": "application/json",
  },

  withCredentials: true, // Add this line
});
