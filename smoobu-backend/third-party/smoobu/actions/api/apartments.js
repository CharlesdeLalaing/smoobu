import axios from "axios";

export async function fetchApartments(req, res) {
  try {
    const response = await axios.get(
      "https://login.smoobu.com/api/apartments",
      {
        headers: {
          "Api-Key": process.env.SMOOBU_API_KEY,
          "Cache-Control": "no-cache",
          "Content-Type": "application/json",
        },
      }
    );
    res.json(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).json({
      status: error.response?.status,
      title: error.response?.data?.title || "Error",
      detail: error.response?.data?.detail || "Failed to fetch apartments",
    });
  }
}
