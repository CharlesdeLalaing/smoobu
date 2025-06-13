// src/api/webhook/prepare-booking-doc.js
import { extrasFrenchNames } from "../../../config/config.js"; // Your French translations for keys
import admin from "firebase-admin";
import { format, parseISO, isValid as isDateValid } from "date-fns"; // Renamed isValid to avoid conflict
import { fr } from "date-fns/locale";

import {
  DRINK_OFFER_CONFIG_RAW,
  ALL_DRINK_ITEMS_MAP_RAW,
  extraCategoriesRaw,
  getExtraByIdRaw, // Helper from extraCategoriesData.js
} from "../../../../src/components/extraCategoriesData.js"; // Path to your backend-specific config

export const prepareBookingDocument = (
  bookingData,
  paymentIntent,
  reservationId
) => {
  // Ensure bookingData.arrivalDate and bookingData.departureDate are valid for Date constructor
  // Default to today and tomorrow if they are invalid, to prevent 'Invalid Date' for nights calculation
  let arrivalDateForCalc, departureDateForCalc;
  try {
    arrivalDateForCalc = bookingData.arrivalDate
      ? new Date(bookingData.arrivalDate)
      : new Date();
    if (!isDateValid(arrivalDateForCalc)) arrivalDateForCalc = new Date();
  } catch (e) {
    arrivalDateForCalc = new Date();
  }
  try {
    departureDateForCalc = bookingData.departureDate
      ? new Date(bookingData.departureDate)
      : new Date(arrivalDateForCalc.getTime() + 86400000);
    if (!isDateValid(departureDateForCalc))
      departureDateForCalc = new Date(arrivalDateForCalc.getTime() + 86400000);
  } catch (e) {
    departureDateForCalc = new Date(arrivalDateForCalc.getTime() + 86400000);
  }

  const nights =
    Math.max(
      1,
      Math.ceil(
        (departureDateForCalc.getTime() - arrivalDateForCalc.getTime()) /
          (1000 * 60 * 60 * 24)
      )
    ) || 1;
  const guestName = `${bookingData.firstName || ""} ${
    bookingData.lastName || ""
  }`.trim();

  // --- PAID EXTRAS ---
  const formattedExtras = (bookingData.extras || []).map((clientExtra) => {
    let frenchName = clientExtra.name || "Extra payant inconnu"; // Default French name
    let nameKeyForClient = clientExtra.name || ""; // Fallback to client-provided name
    let originalConfigNameKey = null; // The i18n key from extraCategoriesRaw

    // clientExtra.id should be the canonical ID like 'packEssentiel'
    const extraDefinition = getExtraByIdRaw(clientExtra.id);

    if (extraDefinition && extraDefinition.name) {
      // extraDefinition.name is the i18n key
      originalConfigNameKey = extraDefinition.name;
      nameKeyForClient = extraDefinition.name;
      frenchName =
        extrasFrenchNames[extraDefinition.name] ||
        extraDefinition.defaultFrenchName ||
        extraDefinition.defaultName ||
        clientExtra.name ||
        "Extra payant";
    } else if (clientExtra.name && clientExtra.name.startsWith("extras.")) {
      // If client sent the key
      originalConfigNameKey = clientExtra.name;
      nameKeyForClient = clientExtra.name;
      frenchName = extrasFrenchNames[clientExtra.name] || clientExtra.name;
    }

    const extraPersonQty = Number(clientExtra.extraPersonQuantity || 0);
    const extraPersonPr = Number(clientExtra.extraPersonPrice || 0);
    return {
      id:
        clientExtra.id ||
        Date.now() + Math.floor(Math.random() * 10000) + "-paidExtra",
      name: frenchName,
      nameKeyForClient: nameKeyForClient,
      originalConfigNameKey: originalConfigNameKey,
      quantity: Number(clientExtra.quantity || 1),
      amount: Number(clientExtra.amount || 0),
      currencyCode: clientExtra.currencyCode || "EUR",
      type: clientExtra.type || "addon",
      extraPersonPrice: extraPersonPr,
      extraPersonQuantity: extraPersonQty,
      extraPersonAmount: extraPersonQty * extraPersonPr,
      extraPersonName:
        extrasFrenchNames["extras.additionalPerson"] ||
        "Personne supplémentaire",
      hasExtraPerson: extraPersonQty > 0,
    };
  });
  const paidExtrasTotal = formattedExtras.reduce(
    (sum, extra) =>
      sum +
      (parseFloat(extra.amount) || 0) +
      (parseFloat(extra.extraPersonAmount) || 0),
    0
  );

  // --- FREE DRINKS ---
  const processedFreeDrinks = [];
  if (
    bookingData.selectedFreeDrinks &&
    DRINK_OFFER_CONFIG_RAW &&
    ALL_DRINK_ITEMS_MAP_RAW &&
    extraCategoriesRaw
  ) {
    Object.entries(bookingData.selectedFreeDrinks).forEach(
      ([instanceId, instanceSpecificData]) => {
        const parts = instanceId.split("-");
        if (parts.length < 2) {
          console.warn(`[PBD] Malformed free drink instanceId: ${instanceId}`);
          return;
        }
        const offerConfigKey = parts.pop();
        const paidExtraId = parts.join("-");
        const offerConfig = DRINK_OFFER_CONFIG_RAW[offerConfigKey];
        if (!offerConfig || !instanceSpecificData) {
          console.warn(`[PBD] No offerConfig/data for ${instanceId}`);
          return;
        }

        const grantingExtraDefinition = getExtraByIdRaw(paidExtraId);
        const frenchGrantorName =
          (grantingExtraDefinition?.name &&
            extrasFrenchNames[grantingExtraDefinition.name]) ||
          grantingExtraDefinition?.defaultFrenchName ||
          grantingExtraDefinition?.defaultName ||
          paidExtraId;
        const grantorNameKeyForClient =
          grantingExtraDefinition?.name || paidExtraId;

        if (offerConfig.type === "wine_choice") {
          const isChoosingLater =
            instanceSpecificData.chooseNonAlcoholicLater || false;
          if (isChoosingLater) {
            const frenchChoiceLaterText =
              extrasFrenchNames["priceDetails.nonAlcoholicChosenLater"] ||
              "Option non-alcoolisée (choix ultérieur)";
            processedFreeDrinks.push({
              id: `${instanceId}-later`,
              name: `${frenchGrantorName}: ${frenchChoiceLaterText}`,
              grantorNameKeyForClient: grantorNameKeyForClient,
              choiceNameKeyForClient: "priceDetails.nonAlcoholicChosenLater",
              drinkNameKeyForClient: null,
              quantity: 1,
              isFree: true,
              paidExtraGrantor: frenchGrantorName,
              offerKey: offerConfigKey,
              offerType: offerConfig.type,
              chooseNonAlcoholicLater: true,
              drinkDetails: frenchChoiceLaterText,
              drinkId: null,
            });
          } else if (instanceSpecificData.selection) {
            const wineId = instanceSpecificData.selection;
            const drinkItemDefinition = ALL_DRINK_ITEMS_MAP_RAW[wineId];
            if (drinkItemDefinition) {
              const frenchDrinkName =
                (drinkItemDefinition.name &&
                  extrasFrenchNames[drinkItemDefinition.name]) ||
                drinkItemDefinition.defaultFrenchName ||
                drinkItemDefinition.defaultName ||
                drinkItemDefinition.name ||
                wineId;
              processedFreeDrinks.push({
                id: `${instanceId}-${wineId}`,
                name: `${frenchGrantorName}: ${frenchDrinkName}`,
                grantorNameKeyForClient: grantorNameKeyForClient,
                drinkNameKeyForClient:
                  drinkItemDefinition.name || drinkItemDefinition.id, // Use item's 'name' (key) from config or 'id'
                choiceNameKeyForClient: null,
                quantity: 1,
                isFree: true,
                paidExtraGrantor: frenchGrantorName,
                offerKey: offerConfigKey,
                offerType: offerConfig.type,
                chooseNonAlcoholicLater: false,
                drinkDetails: frenchDrinkName,
                drinkId: wineId,
              });
            } else {
              console.warn(
                `[PBD] Wine ID "${wineId}" not found for instance ${instanceId}.`
              );
              processedFreeDrinks.push({
                id: `${instanceId}-${wineId}-unknown`,
                name: `${frenchGrantorName}: Vin sélectionné inconnu (${wineId})`,
                grantorNameKeyForClient: grantorNameKeyForClient,
                drinkNameKeyForClient: `unknown_drink_${wineId}`,
                choiceNameKeyForClient: null,
                quantity: 1,
                isFree: true,
                paidExtraGrantor: frenchGrantorName,
                offerKey: offerConfigKey,
                offerType: offerConfig.type,
                chooseNonAlcoholicLater: false,
                drinkDetails: `Vin inconnu (${wineId})`,
                drinkId: wineId,
              });
            }
          }
        } else if (offerConfig.type === "soft_beer_choice") {
          Object.entries(instanceSpecificData).forEach(
            ([drinkId, quantity]) => {
              if (Number(quantity) > 0) {
                const drinkItemDefinition = ALL_DRINK_ITEMS_MAP_RAW[drinkId];
                if (drinkItemDefinition) {
                  const frenchDrinkName =
                    (drinkItemDefinition.name &&
                      extrasFrenchNames[drinkItemDefinition.name]) ||
                    drinkItemDefinition.defaultFrenchName ||
                    drinkItemDefinition.defaultName ||
                    drinkItemDefinition.name ||
                    drinkId;
                  processedFreeDrinks.push({
                    id: `${instanceId}-${drinkId}-${Number(quantity)}`,
                    name: `${frenchGrantorName}: ${frenchDrinkName}`,
                    grantorNameKeyForClient: grantorNameKeyForClient,
                    drinkNameKeyForClient:
                      drinkItemDefinition.name || drinkItemDefinition.id, // Use item's 'name' (key) or 'id'
                    choiceNameKeyForClient: null,
                    quantity: Number(quantity),
                    isFree: true,
                    paidExtraGrantor: frenchGrantorName,
                    offerKey: offerConfigKey,
                    offerType: offerConfig.type,
                    drinkDetails: frenchDrinkName,
                    drinkId: drinkId,
                    chooseNonAlcoholicLater: false,
                  });
                } else {
                  console.warn(
                    `[PBD] Drink ID "${drinkId}" not found for instance ${instanceId}.`
                  );
                  processedFreeDrinks.push({
                    id: `${instanceId}-${drinkId}-unknown`,
                    name: `${frenchGrantorName}: Boisson sélectionnée inconnue (${drinkId})`,
                    grantorNameKeyForClient: grantorNameKeyForClient,
                    drinkNameKeyForClient: `unknown_drink_${drinkId}`,
                    choiceNameKeyForClient: null,
                    quantity: Number(quantity),
                    isFree: true,
                    paidExtraGrantor: frenchGrantorName,
                    offerKey: offerConfigKey,
                    offerType: offerConfig.type,
                    drinkDetails: `Boisson inconnue (${drinkId})`,
                    drinkId: drinkId,
                    chooseNonAlcoholicLater: false,
                  });
                }
              }
            }
          );
        }
      }
    );
  }

  // Price elements for Smoobu (using French names)
  const priceElementsForSmoobu = [];
  const basePriceForSmoobu = Number(
    bookingData.priceBreakdown?.roomBasePrice || bookingData.basePrice || 0
  );
  if (basePriceForSmoobu >= 0) {
    priceElementsForSmoobu.push({
      id: Date.now() + Math.floor(Math.random() * 1000) + "-base",
      amount: basePriceForSmoobu,
      currencyCode: "EUR",
      name: "Prix de base",
      quantity: 1,
      sortOrder: null,
      tax: null,
      type: "base",
      priceIncludedInId: null,
    });
  }
  const guestFeesValue = Number(
    bookingData.priceBreakdown?.calculatedGuestFees ||
      bookingData.guestFees ||
      0
  );
  if (guestFeesValue > 0) {
    const totalGuests =
      (Number(bookingData.adults) || 0) + (Number(bookingData.children) || 0);
    const startingAtGuestConfig =
      bookingData.priceDetailsSnapshot?.settings?.startingAtGuest ||
      bookingData.priceBreakdown?.settings?.startingAtGuest;
    const startingAtGuest =
      startingAtGuestConfig !== undefined ? Number(startingAtGuestConfig) : 2;
    const extraGuests = Math.max(0, totalGuests - startingAtGuest);
    const guestFeeName =
      extraGuests > 0
        ? `Frais voyageurs suppl. (${extraGuests} personne${
            extraGuests > 1 ? "s" : ""
          })`
        : "Frais voyageurs";
    priceElementsForSmoobu.push({
      id: Date.now() + Math.floor(Math.random() * 1000) + "-guests",
      amount: guestFeesValue,
      currencyCode: "EUR",
      name: guestFeeName,
      quantity: 1,
      sortOrder: null,
      tax: null,
      type: "addon",
      priceIncludedInId: null,
    });
  }
  formattedExtras.forEach((extra) => {
    // `extra.name` is already French here
    if (extra.amount > 0 || (extra.amount === 0 && extra.quantity > 0)) {
      priceElementsForSmoobu.push({
        id: extra.id + "-mainItemSmoobu",
        amount: extra.amount,
        currencyCode: "EUR",
        name: extra.name,
        quantity: extra.quantity,
        sortOrder: null,
        tax: null,
        type: "addon",
        priceIncludedInId: null,
      });
    }
    if (extra.hasExtraPerson && extra.extraPersonAmount > 0) {
      priceElementsForSmoobu.push({
        id: extra.id + "-supItemSmoobu",
        amount: extra.extraPersonAmount,
        currencyCode: "EUR",
        name: `${extra.name} - ${extra.extraPersonName}`,
        quantity: 1,
        sortOrder: null,
        tax: null,
        type: "addon",
        priceIncludedInId: null,
      });
    }
  });
  const couponDiscountValue = Number(
    bookingData.priceBreakdown?.appliedCouponDiscount ||
      bookingData.couponApplied?.discount ||
      0
  );
  if (couponDiscountValue > 0 && bookingData.couponApplied) {
    let couponName = `${
      extrasFrenchNames["priceDetails.promoCode.generic"] || "Code Promo"
    }: ${bookingData.couponApplied.code}`;
    if (bookingData.couponApplied.isGiftVoucher) {
      couponName = `${
        extrasFrenchNames["priceDetails.giftVoucher"] || "Chèque Cadeau"
      }: ${bookingData.couponApplied.code} (-${couponDiscountValue.toFixed(
        2
      )}€)`;
    } else if (
      bookingData.couponApplied.type === "percentage" &&
      bookingData.couponApplied.percentageValue
    ) {
      couponName += ` (-${bookingData.couponApplied.percentageValue}%)`;
    } else {
      couponName += ` (-${couponDiscountValue.toFixed(2)}€)`;
    }
    priceElementsForSmoobu.push({
      id: Date.now() + Math.floor(Math.random() * 1000) + "-coupon",
      amount: -couponDiscountValue,
      currencyCode: "EUR",
      name: couponName,
      quantity: 1,
      sortOrder: null,
      tax: null,
      type: "discount",
      priceIncludedInId: null,
    });
  }
  const longStayDiscountValue = Number(
    bookingData.priceBreakdown?.appliedLongStayDiscount || 0
  );
  if (longStayDiscountValue > 0) {
    let longStayName =
      extrasFrenchNames["priceDetails.longStayDiscount"] ||
      "Réduction long séjour";
    const discountSettings =
      bookingData.priceDetailsSnapshot?.settings?.lengthOfStayDiscount ||
      bookingData.priceBreakdown?.settings?.lengthOfStayDiscount;
    if (discountSettings?.discountPercentage) {
      longStayName += ` (${discountSettings.discountPercentage}%)`;
    }
    priceElementsForSmoobu.push({
      id: Date.now() + Math.floor(Math.random() * 1000) + "-longstay",
      amount: -longStayDiscountValue,
      currencyCode: "EUR",
      name: longStayName,
      quantity: 1,
      sortOrder: null,
      tax: null,
      type: "discount",
      priceIncludedInId: null,
    });
  }

  const bookingDocument = {
    smoobuId: reservationId.toString(),
    smoobuReservationId: Number(reservationId),
    createdAt: bookingData.createdAt
      ? admin.firestore.Timestamp.fromDate(new Date(bookingData.createdAt))
      : admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    lastSyncedAt: admin.firestore.FieldValue.serverTimestamp(),
    firstName: bookingData.firstName || "",
    lastName: bookingData.lastName || "",
    guestName: guestName,
    email: bookingData.email || "",
    phone: bookingData.phone || "",
    street: bookingData.street || "",
    postalCode: bookingData.postalCode || "",
    location: bookingData.location || "",
    country: bookingData.country || "",
    adults: Number(bookingData.adults) || 1,
    children: Number(bookingData.children) || 0,
    arrivalDate: bookingData.arrivalDate, // Storing as "YYYY-MM-DD" string
    departureDate: bookingData.departureDate, // Storing as "YYYY-MM-DD" string
    arrivalTime: bookingData.arrivalTime || "18:30",
    departureTime: bookingData.departureTime || "10:00",
    checkInTime: bookingData.arrivalTime || "18:30",
    checkOutTime: bookingData.departureTime || "10:00",
    nights: nights,
    notice: bookingData.notice || "",
    apartmentId: String(bookingData.apartmentId || ""),
    property: getPropertyName(bookingData.apartmentId),
    channelId: bookingData.channelId || 0,
    channelName: bookingData.channelId === 2323525 ? "Homepage" : "Unknown",
    portalName: bookingData.channelId === 2323525 ? "Website" : "Unknown",
    price: Number(
      bookingData.priceBreakdown?.finalPayableAmount || bookingData.price || 0
    ),
    basePrice: Number(
      bookingData.priceBreakdown?.roomBasePrice || bookingData.basePrice || 0
    ),
    guestFees: guestFeesValue,
    deposit: Number(bookingData.deposit || 0),
    depositStatus: Number(bookingData.depositStatus || 1),
    priceStatus: Number(bookingData.priceStatus || 1),
    paymentIntentId: paymentIntent.id,
    stripePaymentStatus: paymentIntent.status,
    extras: formattedExtras, // Contains .name (French) and .nameKeyForClient
    processedFreeDrinks: processedFreeDrinks, // Contains .name (French) and relevant *NameKeyForClient
    priceBreakdown: {
      roomBasePrice: Number(
        bookingData.priceBreakdown?.roomBasePrice || bookingData.basePrice || 0
      ),
      calculatedExtrasTotal: paidExtrasTotal,
      calculatedGuestFees: guestFeesValue,
      subtotal: Number(
        bookingData.priceBreakdown?.subtotal ||
          Number(bookingData.basePrice || 0) + paidExtrasTotal + guestFeesValue
      ),
      appliedLongStayDiscount: longStayDiscountValue,
      totalAfterLongStayDiscount: Number(
        bookingData.priceBreakdown?.totalAfterLongStayDiscount || 0
      ),
      appliedCouponDiscount: couponDiscountValue,
      finalPayableAmount: Number(
        bookingData.priceBreakdown?.finalPayableAmount || bookingData.price || 0
      ),
      priceElementsForSmoobu: priceElementsForSmoobu,
    },
    priceDetailsSnapshot: bookingData.priceDetailsSnapshot || null,
    couponApplied: bookingData.couponApplied
      ? {
          code: bookingData.couponApplied.code,
          discount: Number(bookingData.couponApplied.discount || 0),
          type: bookingData.couponApplied.type,
          isGiftVoucher: bookingData.couponApplied.isGiftVoucher || false,
          originalAmount: Number(bookingData.couponApplied.originalAmount || 0),
          percentageValue: Number(
            bookingData.couponApplied.percentageValue || 0
          ),
        }
      : null,
    conditions: bookingData.conditions || true,
    language: bookingData.language || "fr", // Store client's language
    spaDateString: bookingData.spaDateString || null,
    spaDateTime: bookingData.spaDateTime
      ? admin.firestore.Timestamp.fromDate(parseISO(bookingData.spaDateTime))
      : null,
    spaEndDateTime: bookingData.spaEndDateTime
      ? admin.firestore.Timestamp.fromDate(parseISO(bookingData.spaEndDateTime))
      : null,
    spaSlots: bookingData.spaSlots || [],
    spaBookingPreference: bookingData.spaBookingPreference || null,
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
    freeDrinkInfo:
      processedFreeDrinks.length > 0
        ? {
            hasFreeDrinks: true,
            items: processedFreeDrinks.map((d) => ({
              name: d.name || "", // French display name for report/internal
              grantorNameKeyForClient: d.grantorNameKeyForClient || null,
              choiceNameKeyForClient: d.choiceNameKeyForClient || null,
              drinkNameKeyForClient: d.drinkNameKeyForClient || null,
              quantity: d.quantity || 0,
              isFree: d.isFree === true,
              offerKey: d.offerKey || null,
              offerType: d.offerType || null,
              chooseNonAlcoholicLater: d.chooseNonAlcoholicLater === true,
              drinkId: d.drinkId || null,
            })),
            needsNonAlcoholicChoice: processedFreeDrinks.some(
              (d) => d.chooseNonAlcoholicLater === true
            ),
            nonAlcoholicChoiceGrantors: processedFreeDrinks
              .filter((d) => d.chooseNonAlcoholicLater === true)
              .map(
                (d) =>
                  d.grantorNameKeyForClient ||
                  d.paidExtraGrantor ||
                  "Offre Inconnue"
              ), // Store keys
          }
        : null,
  };

  return bookingDocument;
};

function getPropertyName(apartmentId) {
  const propertyNames = {
    2565753: "La Cabane du Chêne",
    1946282: "Le Dôme des Libellules",
    1644643: "La Bulle du Ruisseau",
    1946279: "Le Moulin",
    1946276: "La Chambre de Blé",
    1946270: "Le Logis",
  };
  return propertyNames[String(apartmentId)] || "Unknown Property";
}
