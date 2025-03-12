import axios from "axios";


export async function fetchApartmentsId (req, res) {
  try {
    const response = await axios.get(
      `https://login.smoobu.com/api/apartments/${req.params.id}`,
      {
        headers: {
          "Api-Key": process.env.SMOOBU_API_KEY,
          "Content-Type": "application/json",
        },
      }
    );

    // Smoobu API returns images in the response
    const images = response.data.images || [];
    res.json({ images });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch apartment images" });
  }
}
