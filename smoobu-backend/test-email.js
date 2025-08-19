// In test-email.js

// 1. IMPORT YOUR FUNCTION
//    Adjust this path to where your function is 
import { sendBookingConfirmation } from "./third-party/smoobu/sendBookingConfirmation.js";
// 2. DEFINE SAMPLE BOOKING DATA
//    This object mimics the data your function expects.
const sampleBookingData = {
  // === CRITICAL: Change this to your email address! ===
  email: "pmihai31@gmail.com",

  // --- Guest and Booking Details ---
  guestName: "Alex Smith",
  language: "en", // Try 'fr' or 'nl' to test other languages
  property: "Le Rêve Étoilé (Glamping)",
  arrivalDate: new Date(), // Today's date for simplicity
  departureDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days from now
  adults: 2,
  children: 1,
  smoobuId: "TEST-987654",
  apartmentId: "2565753", // An ID that triggers the special "glamping info" text
  phone: "+1 555-123-4567",

  // --- Extras & Price ---
  extras: [
    {
      id: "packRomantiqueGourmet",
      nameKeyForClient: "extras.packs.romanticGourmet.name",
      name: "Le romantique gourmet (pour 2)",
      quantity: 1,
      amount: 150.0,
    },
    {
      id: "formuleSpa",
      nameKeyForClient: "extras.spa.basic.name",
      name: "Formule SPA (2 pers)",
      quantity: 1,
      amount: 85.0,
    },
  ],
  basePrice: 450.0,
  guestFees: 25.0,
  couponApplied: {
    code: "TESTCODE",
    discount: 45.0,
    type: "fixed",
  },
  priceBreakdown: {
    appliedLongStayDiscount: 0,
  },

  // --- SPA Info ---
  // Scenario 1: SPA is scheduled
  spaBookingPreference: "scheduled",
  spaInfo: {
    scheduledDateTime: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000), // Tomorrow
    endDateTime: new Date(
      Date.now() + 1 * 24 * 60 * 60 * 1000 + 90 * 60 * 1000
    ), // Tomorrow + 90 mins
  },
  // Scenario 2: User wants to schedule later (uncomment to test)
  // spaBookingPreference: 'later',
};

// 3. CALL THE FUNCTION AND LOG THE RESULT
async function sendTestEmail() {
  console.log(
    `🚀 Attempting to send a test email to: ${sampleBookingData.email}`
  );
  try {
    await sendBookingConfirmation(sampleBookingData);
    console.log(
      "✅ Success! The test email has been sent. Please check your inbox."
    );
  } catch (error) {
    console.error("🟥 Error sending the test email:", error);
  }
}

// Run the function
sendTestEmail();
