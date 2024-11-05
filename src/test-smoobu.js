import axios from "axios";

const SMOOBU_API_KEY = "3QrCCtDgMURVQn1DslPKbUu69DReBzWRY0DOe2SIVB";
const APARTMENT_ID = "2402388"; // Your apartment ID

const testSmoobuAPI = async () => {
  // First test: Get apartments (verify API key works)
  try {
    console.log("Testing Smoobu API connection...");
    const apartmentsResponse = await axios.get(
      "https://login.smoobu.com/api/apartments",
      {
        headers: {
          "Api-Key": SMOOBU_API_KEY,
          "Content-Type": "application/json",
        },
      }
    );
    console.log(
      "Successfully connected to Smoobu. Apartments:",
      apartmentsResponse.data
    );

    // Second test: Create a test booking
    const testBooking = {
      arrivalDate: "2024-11-10",
      departureDate: "2024-11-12",
      channelId: 2323525,
      apartmentId: APARTMENT_ID,
      firstName: "Test",
      lastName: "Booking",
      email: "test@example.com",
      phone: "1234567890",
      adults: 1,
      children: 0,
      price: 100,
      priceStatus: 1,
      deposit: 0,
      depositStatus: 1,
      language: "en",
    };

    console.log("\nAttempting to create test booking...");
    console.log("Booking data:", testBooking);

    const bookingResponse = await axios.post(
      "https://login.smoobu.com/api/reservations",
      testBooking,
      {
        headers: {
          "Api-Key": SMOOBU_API_KEY,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("\nBooking created successfully!");
    console.log("Booking response:", bookingResponse.data);
  } catch (error) {
    console.error("Error:", {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
    });
  }
};

// Run the test
testSmoobuAPI();
