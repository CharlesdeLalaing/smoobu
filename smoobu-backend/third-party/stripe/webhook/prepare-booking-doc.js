import { extrasFrenchNames } from "../../../config/config.js";
import admin from "firebase-admin";
import { format, parseISO } from "date-fns"; // Add date-fns imports
import { DRINK_OFFER_CONFIG_RAW, ALL_DRINK_ITEMS_MAP_RAW, extraCategoriesRaw } from "../../../../src/components/extraCategoriesData.js";
import { fr } from "date-fns/locale";


export const prepareBookingDocument = (
  bookingData,
  paymentIntent,
  reservationId
) => {
  // Calculate nights
  const arrivalDateObj = new Date(bookingData.arrivalDate);
  const departureDateObj = new Date(bookingData.departureDate);
  const nights = Math.ceil(
    (departureDateObj - arrivalDateObj) / (1000 * 60 * 60 * 24)
  );

  // Properly format PAID extras
  const formattedExtras = (bookingData.extras || []).map((extra) => {
    let extraName = extra.name;
    if (extra.name && extra.name.startsWith("extras.")) {
      extraName = extrasFrenchNames[extra.name] || extra.name;
    }
    const extraPersonQty = Number(extra.extraPersonQuantity || 0);
    const extraPersonPr = Number(extra.extraPersonPrice || 0);
    const calculatedExtraPersonAmount = extraPersonQty * extraPersonPr;
    return {
      id: extra.id || Date.now() + Math.floor(Math.random() * 10000) + '-paidExtra',
      amount: Number(extra.amount || 0),
      currencyCode: extra.currencyCode || "EUR",
      name: extraName,
      quantity: Number(extra.quantity || 1),
      type: extra.type || "addon",
      extraPersonPrice: extraPersonPr,
      extraPersonQuantity: extraPersonQty,
      extraPersonAmount: calculatedExtraPersonAmount,
      extraPersonName: extra.extraPersonName || extrasFrenchNames["extras.additionalPerson"] || "Personne supplémentaire",
      hasExtraPerson: extraPersonQty > 0,
    };
  });

  const paidExtrasTotal = formattedExtras.reduce((sum, extra) => {
    return sum + (parseFloat(extra.amount) || 0) + (parseFloat(extra.extraPersonAmount) || 0);
  }, 0);

  const guestName = `${bookingData.firstName || ""} ${bookingData.lastName || ""}`.trim();

  // --- Process Selected Free Drinks for Firebase Storage ---
  const processedFreeDrinks = []; // This array IS important for Firebase and your reports
  if (
    bookingData.selectedFreeDrinks &&
    typeof DRINK_OFFER_CONFIG_RAW === "object" &&
    typeof ALL_DRINK_ITEMS_MAP_RAW === "object" &&
    typeof extraCategoriesRaw === "object"
  ) {
    Object.entries(bookingData.selectedFreeDrinks).forEach(
      ([instanceId, instanceSpecificData]) => {
        const parts = instanceId.split("-");
        if (parts.length < 2) { return; }
        const offerConfigKey = parts.pop();
        const paidExtraId = parts.join("-");
        const offerConfig = DRINK_OFFER_CONFIG_RAW[offerConfigKey];

        if (!offerConfig || !instanceSpecificData) { return; }

        let grantingPaidExtraDisplayName = paidExtraId;
        for (const categoryKey in extraCategoriesRaw) {
          const category = extraCategoriesRaw[categoryKey];
          if (category && category.items && Array.isArray(category.items)) {
            const item = category.items.find((i) => i.id === paidExtraId);
            if (item) {
              grantingPaidExtraDisplayName = (item.name && extrasFrenchNames[item.name]) || item.name || paidExtraId;
              break;
            }
          }
        }

        if (offerConfig.type === "wine_choice") {
          const isChoosingLater = instanceSpecificData.chooseNonAlcoholicLater || false;
          if (isChoosingLater) {
            processedFreeDrinks.push({
              id: `${instanceId}-later`,
              name: `${grantingPaidExtraDisplayName}: Option non-alcoolisée (choix ultérieur)`,
              quantity: 1, isFree: true, paidExtraGrantor: grantingPaidExtraDisplayName,
              offerKey: offerConfigKey, offerType: offerConfig.type,
              chooseNonAlcoholicLater: true, drinkDetails: "Choix ultérieur non-alcoolisé", drinkId: null,
            });
          } else if (instanceSpecificData.selection) {
            const wineId = instanceSpecificData.selection;
            const drinkItem = ALL_DRINK_ITEMS_MAP_RAW[wineId];
            if (drinkItem) {
              const drinkName = (drinkItem.name && extrasFrenchNames[drinkItem.name]) || drinkItem.name || wineId;
              processedFreeDrinks.push({
                id: `${instanceId}-${wineId}`, name: `${grantingPaidExtraDisplayName}: ${drinkName}`,
                quantity: 1, isFree: true, paidExtraGrantor: grantingPaidExtraDisplayName,
                offerKey: offerConfigKey, offerType: offerConfig.type,
                chooseNonAlcoholicLater: false, drinkDetails: drinkName, drinkId: wineId,
              });
            }
          }
        } else if (offerConfig.type === "soft_beer_choice") {
          Object.entries(instanceSpecificData).forEach(
            ([drinkId, quantity]) => {
              if (Number(quantity) > 0) {
                const drinkItem = ALL_DRINK_ITEMS_MAP_RAW[drinkId];
                if (drinkItem) {
                  const drinkName = (drinkItem.name && extrasFrenchNames[drinkItem.name]) || drinkItem.name || drinkId;
                  processedFreeDrinks.push({
                    id: `${instanceId}-${drinkId}-${Number(quantity)}`,
                    name: `${grantingPaidExtraDisplayName}: ${drinkName}`,
                    quantity: Number(quantity), isFree: true, paidExtraGrantor: grantingPaidExtraDisplayName,
                    offerKey: offerConfigKey, offerType: offerConfig.type,
                    drinkDetails: drinkName, drinkId: drinkId,
                  });
                }
              }
            }
          );
        }
      }
    );
  }

  // --- REMOVED: `freeDrinksNoticeText` generation block ---
  // We are no longer creating this text if we are not updating Smoobu's notice.

  // Format price elements for Smoobu (PAID items for Smoobu's /price-elements endpoint)
  const priceElementsForSmoobu = []; // Initialize as empty
    priceElementsForSmoobu.push({
      id: Date.now() + Math.floor(Math.random() * 1000) + "-base",
      amount: Number(bookingData.priceBreakdown?.roomBasePrice || bookingData.basePrice || 0),
      currencyCode: "EUR", name: "Prix de base", quantity: 1,
      sortOrder: null, tax: null, type: "base", priceIncludedInId: null,
    });

  const guestFees = Number(bookingData.priceBreakdown?.calculatedGuestFees || bookingData.guestFees || 0);
  if (guestFees > 0) {
    const totalGuests = (Number(bookingData.adults) || 0) + (Number(bookingData.children) || 0);
    const startingAtGuestConfig = bookingData.priceDetailsSnapshot?.settings?.startingAtGuest || bookingData.priceBreakdown?.settings?.startingAtGuest;
    const startingAtGuest = startingAtGuestConfig !== undefined ? Number(startingAtGuestConfig) : 2;
    const extraGuests = Math.max(0, totalGuests - startingAtGuest);
    const guestFeeName = extraGuests > 0 ? `Frais voyageurs suppl. (${extraGuests} personne${extraGuests > 1 ? "s" : ""})` : "Frais voyageurs";
    priceElementsForSmoobu.push({
      id: Date.now() + Math.floor(Math.random() * 1000) + "-guests",
      amount: guestFees, currencyCode: "EUR", name: guestFeeName, quantity: 1,
      sortOrder: null, tax: null, type: "addon", priceIncludedInId: null,
    });
  }

  formattedExtras.forEach((extra) => {
    if (extra.amount > 0 || (extra.amount === 0 && extra.quantity > 0)) {
      priceElementsForSmoobu.push({
        id: extra.id + "-mainItem" || Date.now() + Math.floor(Math.random() * 1000) + '-extraMain',
        amount: extra.amount, currencyCode: "EUR", name: extra.name,
        quantity: extra.quantity, sortOrder: null, tax: null, type: "addon", priceIncludedInId: null,
      });
    }
    if (extra.hasExtraPerson && extra.extraPersonAmount > 0) {
      priceElementsForSmoobu.push({
        id: extra.id + "-supItem" || Date.now() + Math.floor(Math.random() * 1000) + '-extraSup',
        amount: extra.extraPersonAmount, currencyCode: "EUR",
        name: `${extra.name} - ${extra.extraPersonName}`,
        quantity: 1, sortOrder: null, tax: null, type: "addon", priceIncludedInId: null,
      });
    }
  });

  const couponDiscount = Number(bookingData.priceBreakdown?.appliedCouponDiscount || bookingData.couponApplied?.discount || 0);
  if (couponDiscount > 0 && bookingData.couponApplied) {
    let couponName = `${extrasFrenchNames["priceDetails.promoCode.generic"] || "Code Promo"}: ${bookingData.couponApplied.code}`;
    if (bookingData.couponApplied.isGiftVoucher) {
        couponName = `${extrasFrenchNames["priceDetails.giftVoucher"] || "Chèque Cadeau"}: ${bookingData.couponApplied.code} (-${couponDiscount.toFixed(2)}€)`;
    } else if (bookingData.couponApplied.type === 'percentage' && bookingData.couponApplied.percentageValue) {
      couponName += ` (-${bookingData.couponApplied.percentageValue}%)`;
    } else {
      couponName += ` (-${couponDiscount.toFixed(2)}€)`;
    }
    priceElementsForSmoobu.push({
      id: Date.now() + Math.floor(Math.random() * 1000) + "-coupon",
      amount: -couponDiscount, currencyCode: "EUR", name: couponName, quantity: 1,
      sortOrder: null, tax: null, type: "discount", priceIncludedInId: null,
    });
  }

  const longStayDiscount = Number(bookingData.priceBreakdown?.appliedLongStayDiscount || 0);
  if (longStayDiscount > 0) {
    let longStayName = extrasFrenchNames["priceDetails.longStayDiscount"] || "Réduction long séjour";
    const discountSettings = bookingData.priceDetailsSnapshot?.settings?.lengthOfStayDiscount || bookingData.priceBreakdown?.settings?.lengthOfStayDiscount;
    if (discountSettings?.discountPercentage) {
        longStayName += ` (${discountSettings.discountPercentage}%)`;
    }
    priceElementsForSmoobu.push({
      id: Date.now() + Math.floor(Math.random() * 1000) + "-longstay",
      amount: -longStayDiscount, currencyCode: "EUR", name: longStayName, quantity: 1,
      sortOrder: null, tax: null, type: "discount", priceIncludedInId: null,
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
    arrivalDate: bookingData.arrivalDate,
    departureDate: bookingData.departureDate,
    arrivalTime: bookingData.arrivalTime || "18:30",
    departureTime: bookingData.departureTime || "10:00",
    checkInTime: bookingData.arrivalTime || "18:30",
    checkOutTime: bookingData.departureTime || "10:00",
    nights: nights,
    notice: bookingData.notice || "", // Original guest notice

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
    guestFees: guestFees,
    deposit: Number(bookingData.deposit || 0),
    depositStatus: Number(bookingData.depositStatus || 1),
    priceStatus: Number(bookingData.priceStatus || 1),
    paymentIntentId: paymentIntent.id,
    stripePaymentStatus: paymentIntent.status,

    extras: formattedExtras, // PAID extras (enhanced)
    processedFreeDrinks: processedFreeDrinks, // Formatted FREE drinks - THIS IS KEY FOR FIREBASE

    priceBreakdown: {
      roomBasePrice: Number(
        bookingData.priceBreakdown?.roomBasePrice || bookingData.basePrice || 0
      ),
      calculatedExtrasTotal: paidExtrasTotal,
      calculatedGuestFees: guestFees,
      subtotal: Number(
        bookingData.priceBreakdown?.subtotal ||
          Number(bookingData.basePrice || 0) + paidExtrasTotal + guestFees
      ),
      appliedLongStayDiscount: longStayDiscount,
      totalAfterLongStayDiscount: Number(
        bookingData.priceBreakdown?.totalAfterLongStayDiscount || 0
      ),
      appliedCouponDiscount: couponDiscount,
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
    language: bookingData.language || "fr",

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

    // Updated freeDrinkInfo: `asTextForNotice` is removed as we are not using it for Smoobu notice.
    // The `items`, `needsNonAlcoholicChoice`, etc., are still useful for Firebase data and potentially emails.
    freeDrinkInfo:
      processedFreeDrinks.length > 0
        ? {
            hasFreeDrinks: true,
            items: processedFreeDrinks.map((d) => ({
              name: d.name,
              quantity: d.quantity,
              grantor: d.paidExtraGrantor,
              details: d.drinkDetails,
              drinkId: d.drinkId,
              offerKey: d.offerKey,
            })),
            needsNonAlcoholicChoice: processedFreeDrinks.some(
              (d) => d.chooseNonAlcoholicLater === true
            ),
            nonAlcoholicChoiceGrantors: processedFreeDrinks
              .filter((d) => d.chooseNonAlcoholicLater === true)
              .map((d) => d.paidExtraGrantor),
          }
        : null,
  };

  return bookingDocument;
};

function getPropertyName(apartmentId) {
  const propertyNames = {
    "2565753": "La Cabane du Chêne", "1946282": "Le Dôme des Libellules",
    "1644643": "La Bulle du Ruisseau", "1946279": "Le Moulin",
    "1946276": "La Chambre de Blé", "1946270": "Le Logis",
  };
  return propertyNames[String(apartmentId)] || "Unknown Property";
}

