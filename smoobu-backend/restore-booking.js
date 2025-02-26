// Save this as restore-booking.js
import axios from "axios";
import * as dotenv from "dotenv";
import { db } from "./firebase-config.js"; // Use your existing Admin SDK setup

dotenv.config();

console.log("🔍 Script starting - restore-booking.js");
console.log("🔍 Imported db object from firebase-config.js:", !!db);

// Helper functions
function normalizeBookingId(id) {
  if (!id) return null;
  return String(id).trim();
}

function extractPricingInfo(priceElements) {
  // Base price elements - look for either "base" type or "Prix de base" name
  const basePriceElement = priceElements.find(
    (el) =>
      el.type === "base" ||
      (el.name && el.name.toLowerCase().includes("prix de base"))
  );
  const basePrice = basePriceElement
    ? parseFloat(basePriceElement.amount) || 0
    : 0;

  // Find discounts
  const longStayElement = priceElements.find(
    (el) => el.name && el.name.toLowerCase().includes("réduction long séjour")
  );
  const longStayDiscount = longStayElement
    ? Math.abs(parseFloat(longStayElement.amount) || 0)
    : 0;

  const couponElement = priceElements.find(
    (el) => el.name && el.name.toLowerCase().includes("code promo")
  );
  const couponDiscount = couponElement
    ? Math.abs(parseFloat(couponElement.amount) || 0)
    : 0;

  // Create promoCode object if coupon exists
  let promoCode = null;
  if (couponElement && couponElement.name) {
    const couponMatch = couponElement.name.match(/POTES|[A-Z0-9]+/i);
    const couponName = couponMatch ? couponMatch[0] : "CODE";

    promoCode = {
      code: couponName,
      name: couponName,
      amount: couponDiscount,
      type: "fixed",
      percentageValue: null,
    };
  }

  return {
    basePrice,
    longStayDiscount,
    couponDiscount,
    promoCode,
    discountElements: {
      longStay: longStayElement,
      coupon: couponElement,
    },
  };
}

function processExtrasWithPersons(priceElements) {
  // Get all extras (excluding base price, discounts, etc.)
  const potentialExtras = priceElements.filter((element) => {
    const name = (element.name || "").toLowerCase();
    const type = (element.type || "").toLowerCase();

    if (
      name.includes("prix de base") ||
      name.includes("base price") ||
      name.includes("réduction") ||
      name.includes("code promo") ||
      type === "base" ||
      type === "discount"
    ) {
      return false;
    }
    return true;
  });

  // Get personne supplémentaire items
  const personneItems = priceElements.filter((element) => {
    const name = (element.name || "").toLowerCase();
    return name.includes("personne supplémentaire");
  });

  // Process each extra and match with personne supplémentaire items if possible
  const processedExtras = potentialExtras.map((extra) => {
    const extraName = (extra.name || "").toLowerCase();
    const baseExtraName = extraName
      .replace(" (pour 2)", "")
      .replace(" (2 pers)", "")
      .replace(" (pour 2 personnes)", "");

    // Try to find matching personne supplémentaire item
    const matchingPersonItem = personneItems.find((person) => {
      const personName = (person.name || "").toLowerCase();
      // Check if person item refers to this extra
      return personName.includes(baseExtraName);
    });

    let extraPersonAmount = 0;
    let extraPersonPrice = 0;
    let extraPersonQuantity = 0;
    let hasExtraPerson = false;

    if (matchingPersonItem) {
      extraPersonAmount = Math.abs(parseFloat(matchingPersonItem.amount) || 0);
      extraPersonQuantity = parseInt(matchingPersonItem.quantity) || 1;
      extraPersonPrice = extraPersonAmount / extraPersonQuantity;
      hasExtraPerson = true;
    }


    return {
      name: extra.name || "Extra",
      amount: Math.abs(parseFloat(extra.amount) || 0),
      quantity: parseInt(extra.quantity) || 1,
      type: extra.type || "addon",
      id: extra.id,
      currencyCode: extra.currencyCode || "EUR",
      extraPersonQuantity,
      extraPersonPrice,
      extraPersonAmount,
      extraPersonName: matchingPersonItem
        ? matchingPersonItem.name
        : "Personne supplémentaire",
      hasExtraPerson,
    };
  });

  // Calculate extras total including extra person amounts
  const extrasTotal = processedExtras.reduce((sum, extra) => {
    return (
      sum +
      parseFloat(extra.amount || 0) +
      parseFloat(extra.extraPersonAmount || 0)
    );
  }, 0);

  return {
    extras: processedExtras,
    extrasTotal,
  };
}

// Map of room names
const roomNames = {
  1946282: "Le dôme de libellules",
  2565753: "La Cabane du Chêne",
  1644643: "La Bulle du Ruisseau",
  1946279: "Le Moulin",
  1946276: "La Chambre de Blé",
  1946270: "Le Logis",
};

// Function to get portal name
function getPortalName(portal) {
  const portalNames = {
    Homepage: "Website",
    "Direct booking": "Website",
    "Homepage direct": "Website",
    Direct: "Website",
    Airbnb: "Airbnb",
    airbnb: "Airbnb",
    "booking.com": "Booking.com",
    "Booking.com": "Booking.com",
    Blocked: "Blocked",
    2323525: "Website", // Channel IDs
    2323543: "Airbnb",
  };

  if (!portal) return "Website";
  return portalNames[portal] || portal;
}

// Main function to restore the booking
async function restoreBooking() {
  console.log("🔄 Starting restoreBooking function");
  const bookingId = "88649503";

  try {
    console.log(`Starting restoration of booking ${bookingId}...`);

    // 1. First check if the booking already exists
    console.log("Checking if booking exists in Firebase...");
    const existingBookingsSnapshot = await db
      .collection("bookings")
      .where("smoobuId", "==", bookingId)
      .get();

    console.log(
      `Found ${existingBookingsSnapshot.size} existing bookings with ID ${bookingId}`
    );

    if (!existingBookingsSnapshot.empty) {
      console.log(
        `Booking ${bookingId} already exists in the database. No need to restore.`
      );
      return;
    }

    // 2. Fetch booking from Smoobu
    console.log(`Fetching booking ${bookingId} from Smoobu...`);
    const bookingResponse = await axios.get(
      `https://login.smoobu.com/api/reservations/${bookingId}`,
      {
        headers: {
          "Api-Key": "UZFV5QRY0ExHUfJi3c1DIG8Bpwet1X4knWa8rMkj6o",
          "Cache-Control": "no-cache",
        },
      }
    );

    if (!bookingResponse.data) {
      throw new Error(`Could not find booking ${bookingId} in Smoobu.`);
    }

    const booking = bookingResponse.data;
    console.log(`Successfully fetched booking details for ${bookingId}`);
    console.log(
      `Booking data: ${JSON.stringify(booking, null, 2).substring(0, 500)}...`
    );

    // 3. Fetch price elements
    console.log(`Fetching price elements for booking ${bookingId}...`);
    const priceElementsResponse = await axios.get(
      `https://login.smoobu.com/api/reservations/${bookingId}/price-elements`,
      {
        headers: {
          "Api-Key": "UZFV5QRY0ExHUfJi3c1DIG8Bpwet1X4knWa8rMkj6o",
          "Cache-Control": "no-cache",
        },
      }
    );

    const priceElements = priceElementsResponse.data.priceElements || [];
    console.log(
      `Found ${priceElements.length} price elements for booking ${bookingId}`
    );

    // 4. Process booking data
    console.log("Processing booking data...");
    const pricingInfo = extractPricingInfo(priceElements);
    const extrasData = processExtrasWithPersons(priceElements);

    // Get additional fields
    const linenFee =
      priceElements.find(
        (el) =>
          el.name?.toLowerCase().includes("linen") ||
          el.name?.toLowerCase().includes("linge") ||
          el.name?.toLowerCase().includes("cleaning")
      )?.amount || 0;

    const commission =
      priceElements.find((el) => el.name?.toLowerCase().includes("commission"))
        ?.amount || 0;

    // Calculate nights
    const checkIn = new Date(booking.arrival);
    const checkOut = new Date(booking.departure);
    const nights = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));

    // Format guest name
    const guestName =
      booking["guest-name"] ||
      `${booking.firstName || ""} ${booking.lastName || ""}`.trim() ||
      "Unknown Guest";

    // 5. Create booking document
    console.log("Creating booking document...");
    const bookingDoc = {
      smoobuId: bookingId,
      smoobuReservationId: Number(bookingId),
      createdAt: booking["created-at"] || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      firstName: booking.firstName || guestName.split(" ")[0] || "",
      lastName:
        booking.lastName ||
        (guestName.split(" ").length > 1
          ? guestName.split(" ").slice(1).join(" ")
          : ""),
      guestName: guestName,
      email: booking.email || "",
      phone: booking.phone || "",
      address: booking.address || "",
      adults: parseInt(booking.adults) || 0,
      children: parseInt(booking.children) || 0,
      arrivalDate: booking.arrival,
      departureDate: booking.departure,
      checkInTime: booking["check-in"] || "",
      checkOutTime: booking["check-out"] || "",
      apartmentId: booking.apartment?.id,
      property:
        roomNames[booking.apartment?.id] || booking.apartment?.name || "",
      channelId: booking.channel?.id,
      channelName: booking.channel?.name || "",
      portalName: getPortalName(booking.channel?.name) || "Website",
      price: parseFloat(booking.price) || 0,
      basePrice: pricingInfo.basePrice,
      linenFee: parseFloat(linenFee),
      commission: parseFloat(commission),
      extras: extrasData.extras,
      nights: nights,
      priceDetails: {
        basePrice: pricingInfo.basePrice,
        linenFee: parseFloat(linenFee),
        commission: parseFloat(commission),
        longStayDiscount: pricingInfo.longStayDiscount,
        couponDiscount: pricingInfo.couponDiscount,
        discount: pricingInfo.longStayDiscount,
        extrasTotal: extrasData.extrasTotal,
        priceElements: priceElements,
        promoCode: pricingInfo.promoCode,
        calculatedDiscounts: {
          longStay: pricingInfo.longStayDiscount,
          coupon: pricingInfo.couponDiscount,
        },
        settings: {
          extraChildPerNight: 20,
          extraGuestsPerNight: 20,
          lengthOfStayDiscount: {
            discountPercentage: pricingInfo.longStayDiscount > 0 ? 40 : 0,
            minNights: 2,
          },
          maxGuests: 4,
          startingAtGuest: 2,
        },
      },
      lastSyncedAt: new Date().toISOString(),
      // Add payment info if available in the original data
      paymentIntentId: "pi_3QwghpIhkftuEy3n0b52ryHu", // From your example data
      stripePaymentStatus: "succeeded", // From your example data
    };

    console.log("Booking document created");

    // 6. Add to Firebase
    console.log("Adding booking to Firebase...");
    const docRef = await db.collection("bookings").add(bookingDoc);

    console.log(
      `✅ Successfully restored booking ${bookingId} with document ID: ${docRef.id}`
    );

    // 7. Verify the booking was added
    const verifyBookingSnap = await db
      .collection("bookings")
      .doc(docRef.id)
      .get();
    if (verifyBookingSnap.exists) {
      console.log(
        "Verification completed: Booking successfully added to Firebase."
      );

      // Log key details for verification
      const data = verifyBookingSnap.data();
      console.log("Restored booking details:");
      console.log(`Guest: ${data.guestName}`);
      console.log(`Arrival: ${data.arrivalDate}`);
      console.log(`Departure: ${data.departureDate}`);
      console.log(`Base Price: €${data.basePrice}`);
      console.log(`Extras: ${data.extras.map((e) => e.name).join(", ")}`);
    } else {
      console.error("❌ Verification failed: Booking was not added correctly.");
    }
  } catch (error) {
    console.error("Error restoring booking:", error.message);
    if (error.response) {
      console.error("API response error:", error.response.data);
    } else {
      console.error("Full error:", error);
    }
  }
}

// Export the function for use in other files
export { restoreBooking };

// Run the restoration function
console.log("🔄 Attempting to run restoreBooking function directly...");

// If running directly (not imported)
restoreBooking()
  .then(() => {
    console.log("✅ Restoration process completed successfully!");
    // Don't exit - let the process end naturally
  })
  .catch((error) => {
    console.error("🔥 Fatal error:", error);
    // Don't exit - let the process end naturally
  });
