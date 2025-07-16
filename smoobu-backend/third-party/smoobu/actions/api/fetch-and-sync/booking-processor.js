import { normalizeBookingId } from "../../../../../helpers/normalize-booking-id.js";
import { extractPricingInfo } from "../../../../../helpers/pricing/extract-pricing-info.js";
import { processExtrasWithPersons } from "../../../../../third-party/smoobu/process-extras-with-persons.js";
import { roomNames } from "../../../../../config/config.js";
import { mergeExtras, calculateExtrasTotal } from "./extras-merger.js";
import { portalNames } from "../../../../../config/config.js";

const getPortalName = (portal) => {
  // Handle null/undefined
  if (!portal) return "Website";

  // Check if it's already a mapped portal
  if (portalNames[portal]) return portalNames[portal];

  // Handle channel IDs that should map to Website
  if (portal === "2323525" || portal === 2323525) return "Website";

  // Handle channel IDs that should map to Airbnb
  if (portal === "2323543" || portal === 2323543) return "Airbnb";

  // Special case for unknown channels from Smoobu that should be Website
  if (
    portal.includes("Homepage") ||
    portal === "Direct" ||
    portal === "Direct booking"
  ) {
    return "Website";
  }

  // Return the original portal name or default to Website
  return portal || "Website";
};

/**
 * Cleans an object by removing undefined values
 * @param {Object} obj - Object to clean
 * @returns {Object} - Cleaned object
 */
function cleanObject(obj) {
  const cleanedObj = {};
  Object.entries(obj).forEach(([key, value]) => {
    if (value !== undefined) {
      if (
        value !== null &&
        typeof value === "object" &&
        !Array.isArray(value)
      ) {
        cleanedObj[key] = cleanObject(value);
      } else {
        cleanedObj[key] = value;
      }
    }
  });
  return cleanedObj;
}

/**
 * Merges duplicate items in priceElements array
 * @param {Array} priceElements - Raw price elements array from API
 * @returns {Array} - Price elements with duplicates merged
 */
/**
 * Merges duplicate items in priceElements array
 * @param {Array} priceElements - Raw price elements array from API
 * @returns {Array} - Price elements with duplicates merged
 */
function mergeDuplicatePriceElements(priceElements) {
  if (!priceElements || !Array.isArray(priceElements)) {
    return priceElements || [];
  }

  // Create a map to track elements by name
  const elementsMap = new Map();

  // Process each price element
  priceElements.forEach((element) => {
    if (!element.name) return;

    const elementName = element.name.trim();

    // If we already have this element in our map
    if (elementsMap.has(elementName)) {
      // Get the existing element
      const existingElement = elementsMap.get(elementName);

      // For extras/packages, merge them
      if (
        elementName.includes("Personne supplémentaire") ||
        elementName.includes("Formule") ||
        elementName.includes("essentiel") ||
        elementName.includes("détente") ||
        elementName.includes("gourmet") ||
        elementName.includes("romantique") ||
        elementName.includes("barbecue") ||
        elementName.includes("anniversaire") ||
        elementName.includes("petit-déjeuner") ||
        elementName.includes("raclette") ||
        elementName.includes("bouteille") ||
        elementName.includes("champagne") ||
        elementName.includes("spa") ||
        elementName.includes("massage")
      ) {
        // Calculate merged quantity and amount
        const existingQuantity = parseInt(existingElement.quantity) || 1;
        const newQuantity = parseInt(element.quantity) || 1;
        const totalQuantity = existingQuantity + newQuantity;

        const existingAmount = parseFloat(existingElement.amount) || 0;
        const newAmount = parseFloat(element.amount) || 0;
        const totalAmount = existingAmount + newAmount;

        // Update the existing element
        existingElement.quantity = totalQuantity;
        existingElement.amount = totalAmount;

        // Update the map
        elementsMap.set(elementName, existingElement);
      }
      // For all other items, keep the most recent one
      else if (element.id > existingElement.id) {
        // New element has higher ID (likely more recent), so replace
        elementsMap.set(elementName, element);
      }
    }
    // This is a new element, add it to the map
    else {
      elementsMap.set(elementName, { ...element });
    }
  });

  // Convert map back to array
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
  /**
   * Processes a single booking
   * @param {Object} booking - Booking data from Smoobu API
   * @param {Map} existingBookingMap - Map of existing bookings
   * @param {Object} stats - Statistics object to update
   * @returns {Promise<Object>} - Updated stats
   */
  async processBooking(booking, existingBookingMap, stats) {
    try {
      // Normalize booking ID
      const smoobuId = normalizeBookingId(booking.id);

      // Check for existing booking
      const existingBookings = existingBookingMap.get(smoobuId) || [];

      // Get channel/portal name
      const channelName = booking.channel?.name || "Website";
      const portalName = getPortalName(channelName);

      // Fetch and process price elements
      const priceElements = await this.smoobuClient.fetchPriceElements(
        smoobuId
      );

      // Merge duplicate price elements first
      const mergedPriceElements = mergeDuplicatePriceElements(priceElements);

      // Extract pricing info and extras (using merged price elements)
      const pricingInfo = extractPricingInfo(mergedPriceElements);
      const extrasData = processExtrasWithPersons(mergedPriceElements);

      // Generate missing extra person entries in priceElements if needed
      const enhancedPriceElements = this._addMissingExtraPersonEntries(
        mergedPriceElements,
        extrasData
      );

      // Special handling for Airbnb bookings
      if (booking.channel?.name === "Airbnb" || portalName === "Airbnb") {
        this._handleAirbnbExtras(extrasData);
      }

      // Create booking document
      const bookingDoc = this._createBookingDocument(
        booking,
        smoobuId,
        portalName,
        pricingInfo,
        extrasData,
        enhancedPriceElements // Use enhanced price elements here
      );

      // Clean the document
      const cleanBookingDoc = cleanObject(bookingDoc);

      // Add or update in Firebase
      if (existingBookings.length === 0) {
        // Add new booking
        await this.repository.createBooking(cleanBookingDoc);

        stats.added++;
      } else if (existingBookings.length === 1) {
        // Update single existing booking
        await this._updateSingleBooking(
          existingBookings[0],
          cleanBookingDoc,
          portalName,
          extrasData
        );
        stats.updated++;
      } else {
        // Handle duplicate bookings
        await this._handleDuplicateBookings(
          existingBookings,
          cleanBookingDoc,
          portalName,
          extrasData
        );
        stats.updated++;
      }

      return stats;
    } catch (error) {
      console.error(
        `🟥 Error processing booking ${booking.id}:`,
        error.message
      );
      stats.errors++;
      return stats;
    }
  }

  /**
   * Adds missing extra person entries to priceElements based on processed extras
   * @param {Array} priceElements - Original price elements
   * @param {Object} extrasData - Processed extras data
   * @returns {Array} - Enhanced price elements with missing extra person entries
   * @private
   */
  _addMissingExtraPersonEntries(priceElements, extrasData) {
    const enhancedPriceElements = [...priceElements];

    // Find extras that have extra person data but no corresponding price element
    extrasData.extras.forEach((extra) => {
      if (extra.hasExtraPerson && extra.extraPersonAmount > 0) {
        const expectedPersonneName = `${extra.name} - Personne supplémentaire`;

        // Check if this extra person entry already exists in price elements
        const existingEntry = enhancedPriceElements.find(
          (el) => el.name === expectedPersonneName
        );

        if (!existingEntry) {
          // Create the missing extra person entry
          const syntheticPersonElement = {
            name: expectedPersonneName,
            amount: extra.extraPersonAmount,
            quantity: extra.extraPersonQuantity,
            type: "addon",
            id: extra.id + 1000000, // Generate a unique ID
            currencyCode: extra.currencyCode || "EUR",
            priceIncludedInId: null,
            sortOrder: 100,
            tax: 0,
          };

          enhancedPriceElements.push(syntheticPersonElement);
          console.log(
            `✅ Added missing extra person entry to priceElements: "${expectedPersonneName}" (${extra.extraPersonQuantity}x ${extra.extraPersonPrice}€)`
          );
        }
      }
    });

    return enhancedPriceElements;
  }

  /**
   * Handles special processing for Airbnb extras
   * @param {Object} extrasData - Extras data object
   * @private
   */
  _handleAirbnbExtras(extrasData) {
    // Only keep anniversary-related extras for Airbnb bookings
    const filteredExtras = extrasData.extras.filter(
      (extra) => extra.name && extra.name.includes("anniversaire")
    );

    // Replace the extras in extrasData
    extrasData.extras = filteredExtras;
    extrasData.extrasTotal = filteredExtras.reduce(
      (sum, extra) => sum + Math.abs(parseFloat(extra.amount) || 0),
      0
    );
  }

  /**
   * Creates a booking document from raw data
   * @param {Object} booking - Raw booking data from API
   * @param {string} smoobuId - Normalized booking ID
   * @param {string} portalName - Portal name
   * @param {Object} pricingInfo - Extracted pricing info
   * @param {Object} extrasData - Extracted extras data
   * @param {Array} priceElements - Price elements array
   * @returns {Object} - Formatted booking document
   * @private
   */
  /**
   * Creates a booking document from raw data
   * @param {Object} booking - Raw booking data from API
   * @param {string} smoobuId - Normalized booking ID
   * @param {string} portalName - Portal name
   * @param {Object} pricingInfo - Extracted pricing info
   * @param {Object} extrasData - Extracted extras data
   * @param {Array} priceElements - Price elements array
   * @returns {Object} - Formatted booking document
   * @private
   */
  _createBookingDocument(
    booking,
    smoobuId,
    portalName,
    pricingInfo,
    extrasData,
    priceElements
  ) {
    // Format guest name
    const guestName =
      booking["guest-name"] ||
      `${booking.firstName || ""} ${booking.lastName || ""}`.trim() ||
      "Unknown Guest";

    // Calculate nights
    const checkIn = new Date(booking.arrival);
    const checkOut = new Date(booking.departure);
    const nights = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));

    // Extract linen fee and commission
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

    // Recalculate extras total based on enhanced price elements
    // This ensures the extras total reflects the corrected quantities and includes extra person entries
    const enhancedExtrasTotal = priceElements
      .filter((el) => el.type === "addon" && el.amount > 0)
      .reduce((sum, el) => sum + Math.abs(parseFloat(el.amount) || 0), 0);

    return {
      smoobuId: smoobuId,
      smoobuReservationId: Number(smoobuId),
      createdAt: booking["created-at"] || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      type: booking.type || "reservation",
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
        extrasTotal: enhancedExtrasTotal, // Use the recalculated total
        priceElements: enhancedPriceElements,
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
    };
  }

  /**
   * Updates a single existing booking
   * @param {Object} existingBooking - Existing booking data
   * @param {Object} newBookingData - New booking data
   * @param {string} portalName - Portal name
   * @param {Object} extrasData - Extras data
   * @private
   */
  async _updateSingleBooking(
    existingBooking,
    newBookingData,
    portalName,
    extrasData
  ) {
    const docId = existingBooking.id;
    const existingData = existingBooking;

    // Merge extras
    const mergedExtras = mergeExtras(
      existingData,
      extrasData.extras,
      portalName
    );

    // Calculate extras total
    const mergedExtrasTotal = calculateExtrasTotal(mergedExtras);

    // Create updated booking doc
    const updatedBookingDoc = {
      ...existingData, // Start with existing data
      ...newBookingData, // Add/overwrite with new data

      type: newBookingData.type || existingData.type || "reservation",
      extras: mergedExtras,

      // Preserve critical fields
      createdAt: existingData.createdAt || newBookingData.createdAt,
      paymentIntentId: existingData.paymentIntentId || null,
      stripePaymentStatus: existingData.stripePaymentStatus || null,
      updatedAt: new Date().toISOString(),

      // Update price details with merged extras
      priceDetails: {
        ...newBookingData.priceDetails,
        extrasTotal: mergedExtrasTotal,
      },
    };

    // Clean and update
    const cleanUpdatedDoc = cleanObject(updatedBookingDoc);
    await this.repository.updateBooking(docId, cleanUpdatedDoc);
  }

  /**
   * Handles updating when multiple bookings exist with same ID
   * @param {Array} existingBookings - Array of existing bookings
   * @param {Object} newBookingData - New booking data
   * @param {string} portalName - Portal name
   * @param {Object} extrasData - Extras data
   * @private
   */
  async _handleDuplicateBookings(
    existingBookings,
    newBookingData,
    portalName,
    extrasData
  ) {
    // Sort by updatedAt (newest first)
    existingBookings.sort((a, b) => {
      const dateA = new Date(a.updatedAt || a.createdAt || 0);
      const dateB = new Date(b.updatedAt || b.createdAt || 0);
      return dateB - dateA;
    });

    // Update the most recent booking
    const mostRecent = existingBookings[0];
    await this._updateSingleBooking(
      mostRecent,
      newBookingData,
      portalName,
      extrasData
    );
  }
}
