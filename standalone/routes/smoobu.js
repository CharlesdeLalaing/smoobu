const express = require('express');
const router = express.Router();
const { pricingConfig, bookings } = require('../database/repositories');
const { requireAuth } = require('../middleware/auth');

const SMOOBU_API_BASE = 'https://login.smoobu.com/api';
const SMOOBU_BOOKING_URL = 'https://login.smoobu.com/booking';

// Cache for user ID and apartment details
let userIdCache = {};
let apartmentDetailsCache = {};

// Cache for dynamic rooms (to avoid hitting Smoobu API on every request)
let dynamicRoomsCache = {
  data: null,
  timestamp: 0,
  ttl: 5 * 60 * 1000 // 5 minutes cache
};

// Helper to make Smoobu API requests with timeout and retry
async function smoobuFetch(endpoint, apiKey, options = {}) {
  const url = endpoint.startsWith('http') ? endpoint : `${SMOOBU_API_BASE}${endpoint}`;

  // Create an AbortController for timeout
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000); // 15 second timeout

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Api-Key': apiKey,
        'Content-Type': 'application/json',
        ...options.headers
      }
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Smoobu API error: ${response.status} - ${error}`);
    }

    return response.json();
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('Smoobu API request timed out after 15 seconds');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

// Get Smoobu user ID (cached)
async function getSmoobuUserId(apiKey) {
  if (userIdCache[apiKey]) return userIdCache[apiKey];

  const data = await smoobuFetch('/me', apiKey);
  if (data && data.id) {
    userIdCache[apiKey] = data.id;
    return data.id;
  }
  throw new Error('No user ID in response');
}

// Fetch apartment details (cached)
async function fetchApartmentDetails(apiKey, apartmentId) {
  const cacheKey = `${apiKey}_${apartmentId}`;
  if (apartmentDetailsCache[cacheKey] && apartmentDetailsCache[cacheKey].timestamp > Date.now() - 5 * 60 * 1000) {
    return apartmentDetailsCache[cacheKey].data;
  }

  try {
    const data = await smoobuFetch(`/apartments/${apartmentId}`, apiKey);
    apartmentDetailsCache[cacheKey] = { data, timestamp: Date.now() };
    return data;
  } catch (error) {
    console.error(`Error fetching apartment ${apartmentId}:`, error.message);
    return null;
  }
}

// Reusable handler for booking rates
async function handleBookingRates(req, res) {
  try {
    const { apartments, start_date, end_date, adults, children } = req.query;
    const apiKey = req.query.apiKey || req.headers['x-smoobu-api-key'] || process.env.SMOOBU_API_KEY;

    if (!start_date || !end_date) {
      return res.status(400).json({
        error: 'Missing dates',
        details: 'Both start_date and end_date are required'
      });
    }

    if (!apartments) {
      return res.status(400).json({
        error: 'Missing apartments',
        details: 'Apartments parameter is required'
      });
    }

    if (!apiKey) {
      return res.status(400).json({ error: 'API key is required' });
    }

    // Normalize apartments to array
    const apartmentIds = Array.isArray(apartments) ? apartments : [apartments];

    // Fetch rates from Smoobu's /api/rates endpoint with timeout
    const ratesUrl = `${SMOOBU_API_BASE}/rates?${apartmentIds.map(id => `apartments[]=${id}`).join('&')}&start_date=${start_date}&end_date=${end_date}`;

    // Create an AbortController for timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000); // 20 second timeout for rates (larger request)

    let response;
    try {
      response = await fetch(ratesUrl, {
        signal: controller.signal,
        headers: {
          'Api-Key': apiKey,
          'Content-Type': 'application/json'
        }
      });
    } catch (fetchError) {
      clearTimeout(timeout);
      if (fetchError.name === 'AbortError') {
        throw new Error('Smoobu rates API request timed out');
      }
      throw fetchError;
    }
    clearTimeout(timeout);

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Smoobu API error: ${response.status} - ${error}`);
    }

    const smoobuRates = await response.json();

    if (!smoobuRates || !smoobuRates.data) {
      return res.status(404).json({
        error: 'No rates found',
        details: 'The API returned no data'
      });
    }

    // Get SQLite bookings for the date range to mark dates as unavailable
    const sqliteBookings = bookings.getByDateRange(start_date, end_date);

    // Create a map of unavailable dates per apartment from SQLite bookings
    const sqliteUnavailableDates = {};
    sqliteBookings.forEach(booking => {
      const apartmentId = String(booking.apartment_id);
      if (!sqliteUnavailableDates[apartmentId]) {
        sqliteUnavailableDates[apartmentId] = {};
      }

      // Mark all dates from arrival to departure-1 as unavailable
      // The departure date can still be a check-in date for another booking
      const arrivalDate = new Date(booking.arrival_date);
      const departureDate = new Date(booking.departure_date);

      const currentDate = new Date(arrivalDate);
      while (currentDate < departureDate) {
        const dateStr = currentDate.toISOString().split('T')[0];
        sqliteUnavailableDates[apartmentId][dateStr] = {
          available: 0,
          bookedInSQLite: true
        };
        currentDate.setDate(currentDate.getDate() + 1);
      }

      // Mark the departure date as checkout-only (can be used for check-in)
      const departureDateStr = departureDate.toISOString().split('T')[0];
      if (!sqliteUnavailableDates[apartmentId][departureDateStr]) {
        sqliteUnavailableDates[apartmentId][departureDateStr] = {
          checkoutOnly: true,
          bookedInSQLite: true
        };
      }
    });

    // Merge SQLite unavailability into Smoobu data
    Object.keys(sqliteUnavailableDates).forEach(apartmentId => {
      if (smoobuRates.data[apartmentId]) {
        Object.keys(sqliteUnavailableDates[apartmentId]).forEach(dateStr => {
          const sqliteData = sqliteUnavailableDates[apartmentId][dateStr];
          if (!smoobuRates.data[apartmentId][dateStr]) {
            smoobuRates.data[apartmentId][dateStr] = { price: 0 };
          }
          // Merge the SQLite unavailability (unavailable dates take precedence)
          if (sqliteData.available === 0) {
            smoobuRates.data[apartmentId][dateStr].available = 0;
            smoobuRates.data[apartmentId][dateStr].bookedInSQLite = true;
          }
          if (sqliteData.checkoutOnly) {
            smoobuRates.data[apartmentId][dateStr].checkoutOnly = true;
            smoobuRates.data[apartmentId][dateStr].bookedInSQLite = true;
          }
        });
      }
    });

    // Get pricing configs from SQLite
    const configs = pricingConfig.getAllAsMap();

    // Process data
    const formattedData = {};
    const priceDetailsByApartment = {};
    let hasAvailability = false;

    const numAdults = parseInt(adults) || 1;
    const numChildren = parseInt(children) || 0;
    const totalGuests = numAdults + numChildren;

    apartmentIds.forEach(apartmentId => {
      const apartmentData = smoobuRates.data[apartmentId];
      if (!apartmentData) return;

      formattedData[apartmentId] = apartmentData;

      // Get settings from SQLite or use defaults
      const config = configs[apartmentId];
      const settings = {
        cleaningFee: config?.cleaningFeeOverride || 0,
        extraGuestsPerNight: config?.extraGuestFeePerNight || 0,
        extraChildPerNight: config?.extraChildFeePerNight || 0,
        startingAtGuest: config?.startingAtGuest || 2,
        maxGuests: config?.maxOccupancy || 10,
        lengthOfStayDiscount: { minNights: 0, discountPercentage: 0 }
      };

      // Calculate price
      let totalPrice = 0;
      let numberOfNights = 0;
      const currentDate = new Date(start_date);
      const endDateTime = new Date(end_date);

      while (currentDate <= endDateTime) {
        const dateStr = currentDate.toISOString().split('T')[0];
        if (dateStr !== endDateTime.toISOString().split('T')[0]) {
          const dayRate = apartmentData[dateStr];
          if (dayRate && dayRate.available === 1) {
            totalPrice += dayRate.price || 0;
            numberOfNights++;
          }
        }
        currentDate.setDate(currentDate.getDate() + 1);
      }

      // Skip if not available
      if (numberOfNights === 0 || totalPrice === 0) {
        return;
      }

      // Calculate long stay discount
      let discount = 0;
      if (numberOfNights >= settings.lengthOfStayDiscount.minNights && settings.lengthOfStayDiscount.minNights > 0) {
        discount = (totalPrice * settings.lengthOfStayDiscount.discountPercentage) / 100;
      }

      // Calculate guest fees
      const extraGuests = Math.max(0, totalGuests - settings.startingAtGuest);
      const guestFees = extraGuests * settings.extraGuestsPerNight;

      // Build price elements
      const priceElements = [
        { type: 'basePrice', name: 'Prix de base', amount: totalPrice, currencyCode: 'EUR' }
      ];

      if (guestFees > 0) {
        priceElements.push({
          type: 'addon',
          name: 'Frais de personnes supplémentaires',
          amount: guestFees,
          currencyCode: 'EUR'
        });
      }

      if (settings.cleaningFee > 0) {
        priceElements.push({
          type: 'cleaningFee',
          name: 'Frais de nettoyage',
          amount: settings.cleaningFee,
          currencyCode: 'EUR'
        });
      }

      if (discount > 0) {
        priceElements.push({
          type: 'longStayDiscount',
          name: `Réduction long séjour (${settings.lengthOfStayDiscount.discountPercentage}%)`,
          amount: -discount,
          currencyCode: 'EUR'
        });
      }

      const subtotal = totalPrice + guestFees + settings.cleaningFee;
      const finalPrice = subtotal - discount;

      priceDetailsByApartment[apartmentId] = {
        originalPrice: totalPrice,
        guestFees,
        cleaningFee: settings.cleaningFee,
        discount,
        finalPrice,
        numberOfNights,
        priceElements,
        isAvailable: true,
        settings: {
          maxGuests: settings.maxGuests,
          startingAtGuest: settings.startingAtGuest,
          extraGuestsPerNight: settings.extraGuestsPerNight,
          extraChildPerNight: settings.extraChildPerNight,
          lengthOfStayDiscount: settings.lengthOfStayDiscount
        }
      };
      hasAvailability = true;
    });

    if (!hasAvailability) {
      return res.status(200).json({
        data: formattedData,
        priceDetails: {},
        hasAvailability: false,
        message: 'No apartments available for the selected dates and guests'
      });
    }

    res.json({
      data: formattedData,
      priceDetails: priceDetailsByApartment,
      hasAvailability: true
    });
  } catch (error) {
    console.error('Error fetching booking rates:', error);
    res.status(500).json({
      error: 'Failed to fetch rates',
      details: error.message,
      status: 500
    });
  }
}

// POST /api/smoobu/test-connection - Test Smoobu API connection
router.post('/test-connection', async (req, res) => {
  try {
    const apiKey = req.body.apiKey || req.headers['x-smoobu-api-key'];

    if (!apiKey) {
      return res.status(400).json({ success: false, error: 'API key is required' });
    }

    const data = await smoobuFetch('/apartments', apiKey);

    res.json({
      success: true,
      message: 'Connection successful',
      apartmentCount: data.apartments?.length || 0,
      apartments: (data.apartments || []).map(apt => ({
        id: apt.id,
        name: apt.name
      }))
    });
  } catch (error) {
    console.error('Smoobu connection test error:', error);
    res.status(400).json({
      success: false,
      error: 'Failed to connect to Smoobu. Please check your API key.'
    });
  }
});

// GET /api/smoobu/test-smoobu-connection - Alias for test connection
router.get('/test-smoobu-connection', async (req, res) => {
  try {
    const apiKey = req.query.apiKey || req.headers['x-smoobu-api-key'] || process.env.SMOOBU_API_KEY;

    if (!apiKey) {
      return res.status(400).json({ success: false, error: 'API key is required' });
    }

    const data = await smoobuFetch('/apartments', apiKey);

    res.json({
      success: true,
      message: 'Connection successful!',
      apartmentCount: data.apartments?.length || 0,
      apartments: (data.apartments || []).map(apt => ({
        id: apt.id,
        name: apt.name,
        maxOccupancy: apt.maxOccupancy,
        location: apt.location?.city || 'Unknown'
      }))
    });
  } catch (error) {
    res.status(401).json({ success: false, error: 'Invalid API key' });
  }
});

// GET /api/dynamic-rooms - Fetch all rooms from Smoobu (matches frontend expectations)
// Also handles /api/rates when called with availability parameters
router.get('/', async (req, res) => {
  // Check if this is a booking rates request (has start_date and end_date params)
  const { apartments, start_date, end_date } = req.query;

  if (apartments && start_date && end_date) {
    // Call the booking rates handler directly
    return handleBookingRates(req, res);
  }

  try {
    const apiKey = req.query.apiKey || req.headers['x-smoobu-api-key'] || process.env.SMOOBU_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        success: false,
        error: 'SMOOBU_API_KEY not configured',
        message: 'Please set the SMOOBU_API_KEY environment variable'
      });
    }

    // Check if we have cached data that's still valid
    const now = Date.now();
    if (dynamicRoomsCache.data && (now - dynamicRoomsCache.timestamp) < dynamicRoomsCache.ttl) {
      console.log('Returning cached dynamic rooms data');
      return res.json(dynamicRoomsCache.data);
    }

    console.log('Fetching dynamic rooms from Smoobu...');

    // Fetch apartments from Smoobu
    const smoobuData = await smoobuFetch('/apartments', apiKey);

    if (!smoobuData || !smoobuData.apartments) {
      return res.status(404).json({
        success: false,
        error: 'No apartments found',
        message: 'Smoobu API returned no apartments'
      });
    }

    // Fetch detailed info for each apartment (to get maxOccupancy)
    const apartmentDetailsPromises = smoobuData.apartments.map(apt =>
      fetchApartmentDetails(apiKey, apt.id)
    );
    const apartmentDetails = await Promise.all(apartmentDetailsPromises);

    // Create details map
    const detailsMap = {};
    apartmentDetails.forEach((details, index) => {
      if (details) {
        detailsMap[smoobuData.apartments[index].id] = details;
      }
    });

    // Get pricing configs from SQLite
    const configs = pricingConfig.getAllAsMap();

    // Build room data
    const rooms = smoobuData.apartments.map((apartment) => {
      const details = detailsMap[apartment.id];
      const config = configs[apartment.id];

      // Get maxOccupancy from details
      let maxOccupancy = null;
      if (details) {
        if (details.rooms && details.rooms.maxOccupancy) {
          maxOccupancy = details.rooms.maxOccupancy;
        } else if (details.maxOccupancy) {
          maxOccupancy = details.maxOccupancy;
        }
      }

      // Use pricing config from SQLite if available
      const extraGuestFee = config?.extraGuestFeePerNight || 0;
      const extraChildFee = config?.extraChildFeePerNight || 0;
      const cleaningFeeValue = config?.cleaningFeeOverride || 0;
      const startingAtGuest = config?.startingAtGuest || 1;

      return {
        id: apartment.id,
        smoobuId: apartment.id,
        name: apartment.name,
        location: apartment.location || {},
        timeZone: apartment.timeZone,
        currency: apartment.currency || 'EUR',
        maxOccupancy: maxOccupancy,
        cleaningFee: cleaningFeeValue,
        extraGuestsPerNight: extraGuestFee,
        extraChildPerNight: extraChildFee,
        startingAtGuest: startingAtGuest,
        allFees: [],
        hasSmoobuAddons: false,
        hasPricingConfig: !!config,
        pricingConfig: config || null,
        type: 'standard',
        description: '',
        images: [],
        features: [],
        isActive: true,
        sortOrder: 0,
        isConfigured: !!config,
        lastSynced: new Date().toISOString()
      };
    });

    // Sort by name
    rooms.sort((a, b) => a.name.localeCompare(b.name));

    console.log(`Returning ${rooms.length} rooms`);

    // Build the response
    const responseData = {
      success: true,
      rooms: rooms,
      total: rooms.length,
      totalFromSmoobu: smoobuData.apartments.length,
      configuredCount: Object.keys(configs).length
    };

    // Cache the response for future requests
    dynamicRoomsCache.data = responseData;
    dynamicRoomsCache.timestamp = Date.now();

    res.json(responseData);
  } catch (error) {
    console.error('Error fetching dynamic rooms:', error);

    if (error.message?.includes('401')) {
      return res.status(401).json({
        success: false,
        error: 'Invalid API key',
        message: 'The Smoobu API key is invalid or expired'
      });
    }

    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Failed to fetch dynamic rooms'
    });
  }
});

// GET /api/rates - Fetch rates for booking form (compatible with old backend format)
// This endpoint calls Smoobu's /api/rates to get daily availability data
router.get('/booking-rates', handleBookingRates);

// GET /api/dynamic-rates - Fetch rates and availability
router.get('/rates', async (req, res) => {
  try {
    const { start_date, end_date, adults, children, apiKey: queryApiKey } = req.query;
    const apiKey = queryApiKey || req.headers['x-smoobu-api-key'] || process.env.SMOOBU_API_KEY;

    if (!start_date || !end_date) {
      return res.status(400).json({
        success: false,
        error: 'Missing dates',
        message: 'Both start_date and end_date are required'
      });
    }

    if (!apiKey) {
      return res.status(400).json({ success: false, error: 'API key is required' });
    }

    // Get user ID and apartments
    const customerId = await getSmoobuUserId(apiKey);
    const smoobuData = await smoobuFetch('/apartments', apiKey);
    const apartmentIds = smoobuData.apartments.map(apt => apt.id);

    // Calculate nights
    const startDateObj = new Date(start_date);
    const endDateObj = new Date(end_date);
    const nights = Math.ceil((endDateObj - startDateObj) / (1000 * 60 * 60 * 24));

    // Guest counts
    const numAdults = parseInt(adults) || 2;
    const numChildren = parseInt(children) || 0;
    const totalGuests = numAdults + numChildren;

    console.log(`Checking availability for ${apartmentIds.length} apartments...`);

    // Fetch availability from Smoobu
    const availabilityResponse = await fetch(`${SMOOBU_BOOKING_URL}/checkApartmentAvailability`, {
      method: 'POST',
      headers: {
        'Api-Key': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        arrivalDate: start_date,
        departureDate: end_date,
        apartments: apartmentIds,
        customerId: customerId,
        guests: totalGuests
      })
    });

    const availabilityData = await availabilityResponse.json();
    const { availableApartments, prices, errorMessages } = availabilityData;

    // Get pricing configs from SQLite
    const configs = pricingConfig.getAllAsMap();

    // Process results
    const ratesData = {};
    let hasAvailability = false;

    for (const apartment of smoobuData.apartments) {
      const apartmentId = apartment.id;
      const isAvailable = availableApartments?.includes(apartmentId);
      const priceData = prices?.[apartmentId];
      const errorMsg = errorMessages?.[apartmentId];
      const config = configs[apartmentId];

      const finalPrice = priceData?.price || 0;
      const currency = priceData?.currency || apartment.currency || 'EUR';
      const priceElements = priceData?.priceElements || [];

      // Extract breakdown from priceElements
      let basePriceWithGuests = 0;
      let smoobuCleaningFee = 0;
      let discount = 0;

      priceElements.forEach(el => {
        switch (el.type) {
          case 'basePrice':
            basePriceWithGuests = el.amount;
            break;
          case 'cleaningFee':
            smoobuCleaningFee = el.amount;
            break;
          case 'longStayDiscount':
          case 'discount':
            discount = el.amount;
            break;
        }
      });

      // Calculate guest fees using SQLite config
      let trueBasePrice = basePriceWithGuests;
      let adultGuestFees = 0;
      let childGuestFees = 0;
      let totalGuestFees = 0;
      let cleaningFee = smoobuCleaningFee;
      let usingConfig = false;

      if (config) {
        usingConfig = true;
        const startingAt = config.startingAtGuest || 1;
        const extraGuestFeePerNight = config.extraGuestFeePerNight || 0;
        const extraChildFeePerNight = config.extraChildFeePerNight || 0;

        let extraAdultsCount = 0;
        let extraChildrenCount = 0;

        if (totalGuests > startingAt) {
          if (numAdults >= startingAt) {
            extraAdultsCount = numAdults - startingAt;
            extraChildrenCount = numChildren;
          } else {
            extraAdultsCount = 0;
            const childrenIncludedInBase = startingAt - numAdults;
            extraChildrenCount = Math.max(0, numChildren - childrenIncludedInBase);
          }
        }

        adultGuestFees = extraAdultsCount * extraGuestFeePerNight * nights;
        childGuestFees = extraChildrenCount * extraChildFeePerNight * nights;
        totalGuestFees = adultGuestFees + childGuestFees;

        if (config.cleaningFeeOverride !== null && config.cleaningFeeOverride !== undefined) {
          cleaningFee = config.cleaningFeeOverride;
        }
      }

      // Build breakdown
      const breakdown = [];
      breakdown.push({ type: 'basePrice', name: 'Base price (nightly rate)', amount: trueBasePrice });

      if (adultGuestFees > 0) {
        const startingAt = config?.startingAtGuest || 1;
        const extraAdults = numAdults >= startingAt ? numAdults - startingAt : 0;
        breakdown.push({
          type: 'adultGuestFee',
          name: `Extra adult fees (${extraAdults} adult${extraAdults !== 1 ? 's' : ''} × ${nights} night${nights !== 1 ? 's' : ''})`,
          amount: adultGuestFees
        });
      }

      if (childGuestFees > 0) {
        const startingAt = config?.startingAtGuest || 1;
        let extraChildren = numChildren;
        if (numAdults < startingAt) {
          extraChildren = Math.max(0, numChildren - (startingAt - numAdults));
        }
        breakdown.push({
          type: 'childGuestFee',
          name: `Child fees (${extraChildren} child${extraChildren !== 1 ? 'ren' : ''} × ${nights} night${nights !== 1 ? 's' : ''})`,
          amount: childGuestFees
        });
      }

      if (discount !== 0) {
        breakdown.push({ type: 'discount', name: 'Long stay discount', amount: discount });
      }

      if (cleaningFee > 0) {
        breakdown.push({ type: 'cleaningFee', name: 'Cleaning fee', amount: cleaningFee });
      }

      if (isAvailable && finalPrice > 0) {
        hasAvailability = true;
      }

      const calculatedFinalPrice = usingConfig
        ? trueBasePrice + totalGuestFees + cleaningFee + discount
        : finalPrice;

      ratesData[apartmentId] = {
        apartmentId,
        apartmentName: apartment.name,
        isAvailable: isAvailable && finalPrice > 0,
        nights,
        currency,
        pricing: {
          basePrice: trueBasePrice,
          adultGuestFees,
          childGuestFees,
          totalGuestFees,
          cleaningFee,
          discount,
          finalPrice: calculatedFinalPrice,
          smoobuFinalPrice: finalPrice
        },
        guestInfo: {
          adults: numAdults,
          children: numChildren,
          total: totalGuests,
          startingAtGuest: config?.startingAtGuest || 1
        },
        priceElements: breakdown,
        hasPricingConfig: usingConfig,
        pricingConfig: config ? {
          extraGuestFeePerNight: config.extraGuestFeePerNight,
          extraChildFeePerNight: config.extraChildFeePerNight,
          startingAtGuest: config.startingAtGuest,
          cleaningFeeOverride: config.cleaningFeeOverride
        } : null,
        ...(errorMsg && {
          unavailableReason: errorMsg.message,
          errorCode: errorMsg.errorCode,
          details: errorMsg
        }),
        ...(!priceData && isAvailable && {
          message: 'Room available but no price configured in Smoobu'
        })
      };
    }

    res.json({
      success: true,
      hasAvailability,
      dateRange: { start_date, end_date },
      nights,
      rates: ratesData
    });
  } catch (error) {
    console.error('Error fetching dynamic rates:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Failed to fetch dynamic rates'
    });
  }
});

module.exports = router;
