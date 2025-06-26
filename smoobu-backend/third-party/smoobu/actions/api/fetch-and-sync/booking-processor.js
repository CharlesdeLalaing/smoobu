import { normalizeBookingId } from "../../../../../helpers/normalize-booking-id.js";
import { extractPricingInfo } from "../../../../../helpers/pricing/extract-pricing-info.js";
import { processExtrasWithPersons } from "../../../../../third-party/smoobu/process-extras-with-persons.js";
import { roomNames, portalNames } from "../../../../../config/config.js";
import { mergeExtras, calculateExtrasTotal } from "./extras-merger.js";

const getPortalName = (portal) => {
  if (!portal) return "Website";
  if (portalNames[portal]) return portalNames[portal];
  if (["2323525", 2323525].includes(portal)) return "Website";
  if (["2323543", 2323543].includes(portal)) return "Airbnb";
  if (["Homepage", "Direct", "Direct booking"].includes(portal)) return "Website";
  return portal || "Website";
};

function cleanObject(obj) {
  const cleanedObj = {};
  Object.entries(obj).forEach(([key, value]) => {
    if (value !== undefined) {
      if (value !== null && typeof value === "object" && !Array.isArray(value)) {
        cleanedObj[key] = cleanObject(value);
      } else {
        cleanedObj[key] = value;
      }
    }
  });
  return cleanedObj;
}

function mergeDuplicatePriceElements(priceElements) {
    if (!priceElements || !Array.isArray(priceElements)) {
        return priceElements || [];
    }
    const elementsMap = new Map();
    priceElements.forEach((element) => {
        if (!element.name) return;
        const elementName = element.name.trim();
        if (elementsMap.has(elementName)) {
            const existingElement = elementsMap.get(elementName);
            if (elementName.includes("Personne supplémentaire") || elementName.includes("Formule") || elementName.includes("essentiel") || elementName.includes("détente") || elementName.includes("gourmet") || elementName.includes("romantique") || elementName.includes("barbecue") || elementName.includes("anniversaire") || elementName.includes("petit-déjeuner") || elementName.includes("raclette") || elementName.includes("bouteille") || elementName.includes("champagne") || elementName.includes("spa") || elementName.includes("massage")) {
                const existingQuantity = parseInt(existingElement.quantity) || 1;
                const newQuantity = parseInt(element.quantity) || 1;
                const totalQuantity = existingQuantity + newQuantity;
                const existingAmount = parseFloat(existingElement.amount) || 0;
                const newAmount = parseFloat(element.amount) || 0;
                const totalAmount = existingAmount + newAmount;
                existingElement.quantity = totalQuantity;
                existingElement.amount = totalAmount;
                elementsMap.set(elementName, existingElement);
            } else if (element.id > existingElement.id) {
                elementsMap.set(elementName, element);
            }
        } else {
            elementsMap.set(elementName, { ...element });
        }
    });
    return Array.from(elementsMap.values());
}

/**
 * Processes a booking from Smoobu API
 */
export class BookingProcessor {
  constructor(smoobuClient, repository) {
    this.smoobuClient = smoobuClient;
    this.repository = repository;
  }

  /**
   * Processes a single booking
   * @param {Object} booking - Booking data from Smoobu API
   * @param {Map} existingBookingMap - Map of existing bookings
   * @param {Object} stats - Statistics object to update
   * @returns {Promise<Object>} - Updated stats
   */
  async processBooking(booking, existingBookingMap, stats) {
    try {
      const smoobuId = normalizeBookingId(booking.id);
      
      // *** THE CORE FIX IS HERE: We now expect a single object, not an array ***
      const existingBooking = existingBookingMap.get(smoobuId);

      const channelName = booking.channel?.name || "Website";
      const portalName = getPortalName(channelName);
      const priceElements = await this.smoobuClient.fetchPriceElements(smoobuId);
      const mergedPriceElements = mergeDuplicatePriceElements(priceElements);
      const pricingInfo = extractPricingInfo(mergedPriceElements);
      const extrasData = processExtrasWithPersons(mergedPriceElements);

      if (booking.channel?.name === "Airbnb" || portalName === "Airbnb") {
        this._handleAirbnbExtras(extrasData);
      }

      const bookingDoc = this._createBookingDocument(booking, smoobuId, portalName, pricingInfo, extrasData, mergedPriceElements);
      const cleanBookingDoc = cleanObject(bookingDoc);

      // --- THIS IS THE UPDATED LOGIC ---
      if (!existingBooking) {
        // Booking does not exist, so we create it.
        await this.repository.createBooking(cleanBookingDoc);
        stats.added++;
      } else {
        // Booking exists, so we update it using the _updateSingleBooking method.
        // This avoids any logic with `.length` or `.sort()`
        await this._updateSingleBooking(
          existingBooking, // Pass the single object
          cleanBookingDoc,
          portalName,
          extrasData
        );
        stats.updated++;
      }
      // --- END OF UPDATED LOGIC ---

      return stats;
    } catch (error) {
      console.error(`🟥 Error processing booking ${booking.id}:`, error.message, error.stack);
      stats.errors++;
      return stats;
    }
  }

  /**
   * Handles special processing for Airbnb extras
   * @param {Object} extrasData - Extras data object
   * @private
   */
  _handleAirbnbExtras(extrasData) {
    const filteredExtras = extrasData.extras.filter(
      (extra) => extra.name && extra.name.includes("anniversaire")
    );
    extrasData.extras = filteredExtras;
    extrasData.extrasTotal = filteredExtras.reduce(
      (sum, extra) => sum + Math.abs(parseFloat(extra.amount) || 0), 0);
  }

  /**
   * Creates a booking document from raw data
   * @private
   */
  _createBookingDocument(booking, smoobuId, portalName, pricingInfo, extrasData, priceElements) {
    const guestName = booking["guest-name"] || `${booking.firstName || ""} ${booking.lastName || ""}`.trim() || "Unknown Guest";
    const checkIn = new Date(booking.arrival);
    const checkOut = new Date(booking.departure);
    const nights = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24)) || 1;
    const linenFee = priceElements.find((el) => el.name?.toLowerCase().includes("linen") || el.name?.toLowerCase().includes("linge") || el.name?.toLowerCase().includes("cleaning"))?.amount || 0;
    const commission = priceElements.find((el) => el.name?.toLowerCase().includes("commission"))?.amount || 0;
    const mergedPriceElements = mergeDuplicatePriceElements(priceElements);
    const mergedExtrasTotal = extrasData.extras.reduce((sum, extra) => {
        const mergedElement = mergedPriceElements.find((el) => el.name === extra.name);
        const amount = mergedElement ? Math.abs(parseFloat(mergedElement.amount) || 0) : Math.abs(parseFloat(extra.amount) || 0);
        return sum + amount;
    }, 0);

    return {
      smoobuId: smoobuId,
      smoobuReservationId: Number(smoobuId),
      createdAt: booking["created-at"] || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      type: booking.type || "reservation",
      firstName: booking.firstName || guestName.split(" ")[0] || "",
      lastName: booking.lastName || (guestName.split(" ").length > 1 ? guestName.split(" ").slice(1).join(" ") : ""),
      guestName: guestName,
      email: booking.email || "",
      phone: booking.phone || "",
      address: booking.address || "",
      adults: parseInt(booking.adults) || 0,
      children: parseInt(booking.children) || 0,
      arrivalDate: booking.arrival,
      departureDate: booking.departure,
      checkInTime: booking["check-in"] || "17:00",
      checkOutTime: booking["check-out"] || "10:00",
      apartmentId: String(booking.apartment?.id), // Ensure string for comparison
      property: roomNames[booking.apartment?.id] || booking.apartment?.name || "",
      channelId: booking.channel?.id,
      channelName: booking.channel?.name || "",
      portalName: portalName,
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
        extrasTotal: mergedExtrasTotal,
        priceElements: mergedPriceElements,
        promoCode: pricingInfo.promoCode,
        calculatedDiscounts: { longStay: pricingInfo.longStayDiscount, coupon: pricingInfo.couponDiscount },
        settings: {
            extraChildPerNight: 20,
            extraGuestsPerNight: 20,
            lengthOfStayDiscount: { discountPercentage: pricingInfo.longStayDiscount > 0 ? 40 : 0, minNights: 2 },
            maxGuests: 4,
            startingAtGuest: 2
        },
      },
      lastSyncedAt: new Date().toISOString(),
    };
  }

  /**
   * Updates a single existing booking
   * @private
   */
  async _updateSingleBooking(existingBooking, newBookingData, portalName, extrasData) {
    // *** THE CORE FIX IS HERE: We use `firebaseDocId` from the single object ***
    const docId = existingBooking.firebaseDocId; 
    
    // Ensure docId exists before proceeding
    if (!docId) {
        console.error(`🟥 Cannot update booking ${newBookingData.smoobuId}, firebaseDocId is missing from existing booking object.`);
        // Optionally, throw an error or handle it as needed
        return;
    }

    const mergedExtras = mergeExtras(existingBooking, extrasData.extras, portalName);
    const mergedExtrasTotal = calculateExtrasTotal(mergedExtras);
    const updatedBookingDoc = {
      ...existingBooking,
      ...newBookingData,
      type: newBookingData.type || existingBooking.type || "reservation",
      extras: mergedExtras,
      createdAt: existingBooking.createdAt || newBookingData.createdAt,
      paymentIntentId: existingBooking.paymentIntentId || null,
      stripePaymentStatus: existingBooking.stripePaymentStatus || null,
      updatedAt: new Date().toISOString(),
      priceDetails: {
        ...newBookingData.priceDetails,
        extrasTotal: mergedExtrasTotal,
      },
    };

    const cleanUpdatedDoc = cleanObject(updatedBookingDoc);
    await this.repository.updateBooking(docId, cleanUpdatedDoc);
  }

  /**
   * NOTE: This method is now OBSOLETE with the new repository logic,
   * but we can leave it here for reference or future needs. It won't be called.
   * @private
   */
  async _handleDuplicateBookings(existingBookings, newBookingData, portalName, extrasData) {
    console.warn(`[Sync] _handleDuplicateBookings was called for ${newBookingData.smoobuId}, but this path should be obsolete.`);
    // Fallback to updating the first item if this ever gets called unexpectedly.
    const mostRecent = existingBookings[0];
    await this._updateSingleBooking(mostRecent, newBookingData, portalName, extrasData);
  }
}