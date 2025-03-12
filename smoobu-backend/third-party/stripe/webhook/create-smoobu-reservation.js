import axios from "axios";

export const createSmoobuReservation = async (bookingData) => {
  try {
    const response = await axios.post(
      "https://login.smoobu.com/api/reservations",
      {
        arrivalDate: bookingData.arrivalDate,
        departureDate: bookingData.departureDate,
        arrivalTime: bookingData.arrivalTime,
        channelId: bookingData.channelId,
        apartmentId: bookingData.apartmentId,
        firstName: bookingData.firstName,
        lastName: bookingData.lastName,
        email: bookingData.email,
        phone: bookingData.phone,
        notice: bookingData.notice,
        adults: Number(bookingData.adults),
        children: Number(bookingData.children),
        price: Number(bookingData.totalPriceWithExtras),
        priceStatus: 1,
        deposit: Number(bookingData.deposit),
        depositStatus: 1,
        language: "en",
      },
      {
        headers: {
          "Api-Key": process.env.SMOOBU_API_KEY,
          "Content-Type": "application/json",
        },
      }
    );

    return {
      success: true,
      reservationId: response.data.id,
    };
  } catch (error) {
    console.error("🟥 Error creating Smoobu reservation:", {
      error: error.message,
      details: error.response?.data,
    });
    return {
      success: false,
      error: error.message,
      details: error.response?.data,
    };
  }
};
