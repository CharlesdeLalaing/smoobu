
import axios from "axios";

export async function fetchDirectBookings(req, res) {
  try {
    const { startDate, endDate, showCancellation, excludeBlocked } = req.query;

    const response = await axios.get(
      "https://login.smoobu.com/api/reservations",
      {
        headers: {
          "Api-Key": process.env.SMOOBU_API_KEY,
          "Cache-Control": "no-cache",
        },
        params: {
          arrivalFrom: startDate,
          arrivalTo: endDate,
          showCancellation: showCancellation === "true",
          excludeBlocked: excludeBlocked === "true",
          pageSize: 100,
        },
      }
    );

    console.log(
      "All channels:",
      response.data.bookings?.map((b) => ({
        id: b.id,
        channelId: b.channel?.id,
        channelName: b.channel?.name,
        arrival: b.arrival,
      }))
    );

    res.json(response.data);
  } catch (error) {
    console.error("Error fetching direct bookings:", error);
    res.status(500).json({
      error: "Failed to fetch bookings",
      message: error.message,
    });
  }
}
