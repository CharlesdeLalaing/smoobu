import { extrasFrenchNames } from "../../../config/config.js";
import admin from "firebase-admin";
import { format, parseISO } from "date-fns"; // Add date-fns imports
import { fr } from "date-fns/locale";

export const prepareBookingDocument = (
  bookingData,
  paymentIntent,
  reservationId
) => {
  // Calculate nights
  const arrivalDate = new Date(bookingData.arrivalDate);
  const departureDate = new Date(bookingData.departureDate);
  const nights = Math.ceil(
    (departureDate - arrivalDate) / (1000 * 60 * 60 * 24)
  );

  // Properly format extras with extraPerson data and translate names
  const formattedExtras = (bookingData.extras || []).map((extra) => {
    // Get proper name for the extra
    let extraName = extra.name;
    if (extra.name.startsWith("extras.")) {
      extraName = extrasFrenchNames[extra.name] || extra.name;
    }

    return {
      id: Date.now() + Math.floor(Math.random() * 1000), // Generate a temporary ID
      amount: extra.amount,
      currencyCode: extra.currencyCode || "EUR",
      name: extraName,
      quantity: extra.quantity || 1,
      type: extra.type || "addon",
      extraPersonAmount:
        extra.extraPersonAmount ||
        extra.extraPersonPrice * (extra.extraPersonQuantity || 0),
      extraPersonName:
        extrasFrenchNames["extras.additionalPerson"] ||
        "Personne supplémentaire",
      extraPersonPrice: extra.extraPersonPrice || 0,
      extraPersonQuantity: extra.extraPersonQuantity || 0,
      hasExtraPerson: extra.extraPersonQuantity > 0,
    };
  });

  // Calculate extras total including extra person amounts
  const extrasTotal = formattedExtras.reduce((sum, extra) => {
    const extraAmount = parseFloat(extra.amount) || 0;
    const extraPersonAmount = parseFloat(extra.extraPersonAmount) || 0;
    return sum + extraAmount + extraPersonAmount;
  }, 0);

  // Format guest name
  const guestName = `${bookingData.firstName || ""} ${
    bookingData.lastName || ""
  }`.trim();

  // Format price elements for Smoobu consistency
  const priceElements = [
    // Base price element
    {
      id: Date.now() + Math.floor(Math.random() * 1000),
      amount: bookingData.basePrice,
      currencyCode: "EUR",
      name: "Prix de base",
      quantity: 1,
      sortOrder: null,
      tax: null,
      type: null,
      priceIncludedInId: null,
    },
  ];

  // Add guest fees if present
  if (bookingData.guestFees > 0) {
    const extraGuests = Math.max(
      0,
      parseInt(bookingData.adults) +
        parseInt(bookingData.children) -
        (bookingData.priceDetails?.settings?.startingAtGuest || 2)
    );

    priceElements.push({
      id: Date.now() + Math.floor(Math.random() * 1000) + 1,
      amount: bookingData.guestFees,
      currencyCode: "EUR",
      name: `Frais supplémentaires (${extraGuests} personne${
        extraGuests > 1 ? "s" : ""
      })`,
      quantity: 1,
      sortOrder: null,
      tax: null,
      type: null,
      priceIncludedInId: null,
    });
  }

  // Add each extra and its associated extra person as separate price elements
  formattedExtras.forEach((extra) => {
    // Add main extra
    priceElements.push({
      id: Date.now() + Math.floor(Math.random() * 1000) + 2,
      amount: extra.amount,
      currencyCode: "EUR",
      name: extra.name,
      quantity: extra.quantity,
      sortOrder: null,
      tax: null,
      type: null,
      priceIncludedInId: null,
    });

    // Add extra person if present
    if (extra.extraPersonQuantity > 0) {
      priceElements.push({
        id: Date.now() + Math.floor(Math.random() * 1000) + 3,
        amount: extra.extraPersonAmount,
        currencyCode: "EUR",
        name: `${extra.name} - ${extra.extraPersonName}`,
        quantity: extra.extraPersonQuantity,
        sortOrder: null,
        tax: null,
        type: null,
        priceIncludedInId: null,
      });
    }
  });

  // Add promo code as price element if present
  if (bookingData.couponApplied) {
    priceElements.push({
      id: Date.now() + Math.floor(Math.random() * 1000) + 4,
      amount: -bookingData.couponApplied.discount,
      currencyCode: "EUR",
      name: `Code promo: ${bookingData.couponApplied.code} (-${bookingData.couponApplied.discount}€)`,
      quantity: 1,
      sortOrder: null,
      tax: null,
      type: null,
      priceIncludedInId: null,
    });
  }

  // Return the complete booking document
  return {
    // Basic booking info
    smoobuId: reservationId.toString(),
    smoobuReservationId: Number(reservationId),
    createdAt: bookingData.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastSyncedAt: new Date().toISOString(),

    // Customer info
    firstName: bookingData.firstName || "",
    lastName: bookingData.lastName || "",
    guestName: guestName,
    email: bookingData.email || "",
    phone: bookingData.phone || "",
    address: bookingData.address || "",
    street: bookingData.street || "",
    postalCode: bookingData.postalCode || "",
    location: bookingData.location || "",
    country: bookingData.country || "",

    // Reservation details
    adults: Number(bookingData.adults) || 0,
    children: Number(bookingData.children) || 0,
    arrivalDate: bookingData.arrivalDate,
    departureDate: bookingData.departureDate,
    arrivalTime: bookingData.arrivalTime || "",
    departureTime: bookingData.departureTime || "",
    checkInTime: bookingData.arrivalTime || "18:30",
    checkOutTime: "10:00",
    nights: nights,
    notice: bookingData.notice || "",

    // Property info
    apartmentId: bookingData.apartmentId,
    property: getPropertyName(bookingData.apartmentId),
    channelId: bookingData.channelId,
    channelName: bookingData.channelId === 2323525 ? "Homepage" : "Unknown",
    portalName: bookingData.channelId === 2323525 ? "Website" : "Unknown",

    // Payment info
    price: Number(bookingData.totalPriceWithExtras) || 0,
    basePrice: Number(bookingData.basePrice) || 0,
    guestFees: Number(bookingData.guestFees) || 0,
    linenFee: Number(bookingData.linenFee) || 0,
    commission: Number(bookingData.commission) || 0,
    deposit: Number(bookingData.deposit) || 0,
    depositStatus: Number(bookingData.depositStatus) || 1,
    priceStatus: Number(bookingData.priceStatus) || 1,
    paymentIntentId: paymentIntent.id,
    stripePaymentStatus: paymentIntent.status,

    // Extras and pricing details
    extras: formattedExtras,
    priceDetails: {
      basePrice: Number(bookingData.basePrice) || 0,
      linenFee: Number(bookingData.linenFee) || 0,
      commission: Number(bookingData.commission) || 0,
      discount: Number(bookingData.priceDetails?.discount) || 0,
      longStayDiscount: Number(bookingData.priceDetails?.longStayDiscount) || 0,
      couponDiscount: Number(bookingData.couponApplied?.discount) || 0,
      extrasTotal: extrasTotal,
      finalPrice: Number(bookingData.totalPriceWithExtras) || 0,
      priceElements: priceElements,
      promoCode: bookingData.couponApplied
        ? {
            amount: Number(bookingData.couponApplied.discount) || 0,
            code: bookingData.couponApplied.code || "",
            name: bookingData.couponApplied.code || "",
            percentageValue: bookingData.couponApplied.percentageValue || null,
            type: bookingData.couponApplied.type || "fixed",
          }
        : null,
      calculatedDiscounts: {
        longStay: Number(bookingData.priceDetails?.longStayDiscount) || 0,
        coupon: Number(bookingData.couponApplied?.discount) || 0,
      },
      settings: {
        extraChildPerNight: 20,
        extraGuestsPerNight: 20,
        lengthOfStayDiscount: {
          discountPercentage:
            Number(
              bookingData.priceDetails?.settings?.lengthOfStayDiscount
                ?.discountPercentage
            ) || 0,
          minNights: 2,
        },
        maxGuests: 4,
        startingAtGuest: 2,
      },
    },

    // Coupon data
    appliedCoupon: bookingData.couponApplied || null,
    couponApplied: bookingData.couponApplied || null,

    // Required flags
    conditions: bookingData.conditions || true,
    language: bookingData.language || "en",

    spaDateTime: bookingData.spaDateTime
      ? admin.firestore.Timestamp.fromDate(parseISO(bookingData.spaDateTime))
      : null,
    spaEndDateTime: bookingData.spaEndDateTime
      ? admin.firestore.Timestamp.fromDate(parseISO(bookingData.spaEndDateTime))
      : null,
    spaSlots: bookingData.spaSlots || [],
    spaBookingPreference: bookingData.spaBookingPreference || null,

    // Optional: Add a formatted SPA info object for easier display/reporting
    spaInfo:
      bookingData.spaDateTime || bookingData.spaBookingPreference
        ? {
            hasSpaTreatment: true,
            scheduledDateTime: bookingData.spaDateTime
              ? admin.firestore.Timestamp.fromDate(
                  parseISO(bookingData.spaDateTime)
                )
              : null,
            endDateTime: bookingData.spaEndDateTime
              ? admin.firestore.Timestamp.fromDate(
                  parseISO(bookingData.spaEndDateTime)
                )
              : null,
            preference: bookingData.spaBookingPreference || null,
            formattedDateTime: bookingData.spaDateTime
              ? format(parseISO(bookingData.spaDateTime), "PPPp", {
                  locale: fr,
                })
              : null,
            slots: bookingData.spaSlots || [],
            status:
              bookingData.spaBookingPreference === "later"
                ? "to_be_scheduled"
                : bookingData.spaDateTime
                ? "scheduled"
                : null,
          }
        : null,
  };
};

// Helper function to get property name
function getPropertyName(apartmentId) {
  const propertyNames = {
    2565753: "La Cabane du Chêne",
    1946282: "Le Dôme des Libellules",
    1644643: "La Bulle du Ruisseau",
    1946279: "Le Moulin",
    1946276: "La Chambre de Blé",
    1946270: "Le Logis",
  };

  return propertyNames[apartmentId] || "Unknown Property";
}
