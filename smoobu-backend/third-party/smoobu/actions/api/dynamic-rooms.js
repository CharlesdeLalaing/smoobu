import axios from "axios";
import { db } from "../../../../firebase-config.js";
import { dynamicDb } from "../../../../dynamic-firebase-config.js";

const SMOOBU_API_URL = "https://login.smoobu.com/api";
const SMOOBU_BOOKING_URL = "https://login.smoobu.com/booking";

// Cache for user ID, addons, and apartment details to avoid repeated API calls
let userIdCache = {};
let addonsCache = {};
let apartmentDetailsCache = {};
let pricingConfigCache = {};

const PRICING_CONFIG_COLLECTION = "roomPricingConfig";

/**
 * Clear pricing config cache (call after saving a config)
 */
function clearPricingConfigCache() {
  pricingConfigCache = {};
}

/**
 * Fetch pricing configurations from Firebase
 * @returns {Object} Map of smoobuId -> pricing config
 */
async function fetchPricingConfigs() {
  // Check cache first (cache for 30 seconds for faster updates)
  const cacheKey = "all";
  if (pricingConfigCache[cacheKey] && pricingConfigCache[cacheKey].timestamp > Date.now() - 30 * 1000) {
    return pricingConfigCache[cacheKey].data;
  }

  try {
    // Simple query - get all configs
    const snapshot = await dynamicDb.collection(PRICING_CONFIG_COLLECTION).get();
    const configs = {};

    snapshot.forEach((doc) => {
      const data = doc.data();
      configs[data.smoobuId] = data;
    });

    console.log(`📋 Fetched ${Object.keys(configs).length} pricing configs from Firebase`);

    // Cache the result
    pricingConfigCache[cacheKey] = {
      data: configs,
      timestamp: Date.now(),
    };

    return configs;
  } catch (error) {
    console.error("🟥 Error fetching pricing configs from Firebase:", error.message);
    return {};
  }
}

/**
 * Fetch all addons from Smoobu API
 * Addons include cleaning fees, extra guest fees, etc.
 */
async function fetchSmoobuAddons(apiKey) {
  // Check cache first (cache for 5 minutes)
  const cacheKey = apiKey;
  if (addonsCache[cacheKey] && addonsCache[cacheKey].timestamp > Date.now() - 5 * 60 * 1000) {
    return addonsCache[cacheKey].data;
  }

  try {
    const response = await axios.get(`${SMOOBU_API_URL}/addons`, {
      headers: {
        "Api-Key": apiKey,
        "Content-Type": "application/json",
      },
    });

    const addons = response.data.addons || [];
    console.log(`📦 Fetched ${addons.length} addons from Smoobu`);

    // Cache the result
    addonsCache[cacheKey] = {
      data: addons,
      timestamp: Date.now(),
    };

    return addons;
  } catch (error) {
    console.error("🟥 Error fetching Smoobu addons:", error.message);
    return [];
  }
}

/**
 * Fetch detailed info for a single apartment (includes maxOccupancy)
 * @param {string} apiKey - Smoobu API key
 * @param {number} apartmentId - The apartment ID
 */
async function fetchApartmentDetails(apiKey, apartmentId) {
  // Check cache first (cache for 5 minutes)
  const cacheKey = `${apiKey}_${apartmentId}`;
  if (apartmentDetailsCache[cacheKey] && apartmentDetailsCache[cacheKey].timestamp > Date.now() - 5 * 60 * 1000) {
    return apartmentDetailsCache[cacheKey].data;
  }

  try {
    const response = await axios.get(`${SMOOBU_API_URL}/apartments/${apartmentId}`, {
      headers: {
        "Api-Key": apiKey,
        "Content-Type": "application/json",
      },
    });

    const details = response.data;

    // Cache the result
    apartmentDetailsCache[cacheKey] = {
      data: details,
      timestamp: Date.now(),
    };

    return details;
  } catch (error) {
    console.error(`🟥 Error fetching apartment details for ${apartmentId}:`, error.message);
    return null;
  }
}

/**
 * Get addons for a specific apartment
 * @param {Array} allAddons - All addons from Smoobu
 * @param {number} apartmentId - The apartment ID to filter for
 * @returns {Object} Categorized addons (cleaningFee, extraGuestFee, etc.)
 */
function getAddonsForApartment(allAddons, apartmentId) {
  // Filter addons that apply to this apartment
  const apartmentAddons = allAddons.filter(addon => {
    // If apartments array is empty, addon applies to all apartments
    if (!addon.apartments || addon.apartments.length === 0) {
      return true;
    }
    return addon.apartments.includes(apartmentId);
  });

  // Categorize addons by calculation type
  // calculationType: 0 = per booking, 1 = per person, 2 = per night, 3 = per person/night
  const result = {
    perBooking: [], // Cleaning fee typically
    perPerson: [],  // Per-person fees
    perNight: [],   // Per-night fees
    perPersonNight: [], // Extra guest per night
    all: apartmentAddons,
  };

  apartmentAddons.forEach(addon => {
    // Skip optional addons for base price calculation
    if (addon.optional) return;

    switch (addon.calculationType) {
      case 0:
        result.perBooking.push(addon);
        break;
      case 1:
        result.perPerson.push(addon);
        break;
      case 2:
        result.perNight.push(addon);
        break;
      case 3:
        result.perPersonNight.push(addon);
        break;
    }
  });

  return result;
}

/**
 * Calculate addon fees for a booking
 * @param {Object} addons - Categorized addons from getAddonsForApartment
 * @param {number} nights - Number of nights
 * @param {number} guests - Total number of guests
 * @returns {Object} Calculated fees breakdown
 */
function calculateAddonFees(addons, nights, guests) {
  let cleaningFee = 0;
  let perPersonFees = 0;
  let perNightFees = 0;
  let perPersonNightFees = 0;
  const breakdown = [];

  // Per booking fees (usually cleaning fee)
  addons.perBooking.forEach(addon => {
    const fee = addon.usePercentage ? 0 : addon.amount; // Skip percentage-based for now
    cleaningFee += fee;
    if (fee > 0) {
      breakdown.push({ name: addon.name, amount: fee, type: 'per booking' });
    }
  });

  // Per person fees
  addons.perPerson.forEach(addon => {
    const fee = addon.usePercentage ? 0 : addon.amount * guests;
    perPersonFees += fee;
    if (fee > 0) {
      breakdown.push({ name: addon.name, amount: fee, type: `per person (${guests} guests)` });
    }
  });

  // Per night fees
  addons.perNight.forEach(addon => {
    const fee = addon.usePercentage ? 0 : addon.amount * nights;
    perNightFees += fee;
    if (fee > 0) {
      breakdown.push({ name: addon.name, amount: fee, type: `per night (${nights} nights)` });
    }
  });

  // Per person per night fees (extra guest fees)
  addons.perPersonNight.forEach(addon => {
    const fee = addon.usePercentage ? 0 : addon.amount * guests * nights;
    perPersonNightFees += fee;
    if (fee > 0) {
      breakdown.push({ name: addon.name, amount: fee, type: `per person/night (${guests}×${nights})` });
    }
  });

  const total = cleaningFee + perPersonFees + perNightFees + perPersonNightFees;

  return {
    cleaningFee,
    perPersonFees,
    perNightFees,
    perPersonNightFees,
    total,
    breakdown,
  };
}

/**
 * Extract fee summary from addons for display purposes
 * Returns simplified fee info for room cards
 */
function extractFeeSummary(categorizedAddons) {
  let cleaningFee = 0;
  let extraGuestFee = 0;
  let extraChildFee = 0;
  const allFees = [];

  // Per booking fees (usually cleaning fee)
  categorizedAddons.perBooking.forEach(addon => {
    if (!addon.usePercentage) {
      cleaningFee += addon.amount;
      allFees.push({
        name: addon.name,
        amount: addon.amount,
        type: "per_booking",
        description: "Per booking"
      });
    }
  });

  // Per person per night (extra guest fees)
  categorizedAddons.perPersonNight.forEach(addon => {
    if (!addon.usePercentage) {
      extraGuestFee += addon.amount;
      allFees.push({
        name: addon.name,
        amount: addon.amount,
        type: "per_person_night",
        description: "Per person/night"
      });
    }
  });

  // Per person fees
  categorizedAddons.perPerson.forEach(addon => {
    if (!addon.usePercentage) {
      allFees.push({
        name: addon.name,
        amount: addon.amount,
        type: "per_person",
        description: "Per person"
      });
    }
  });

  // Per night fees
  categorizedAddons.perNight.forEach(addon => {
    if (!addon.usePercentage) {
      allFees.push({
        name: addon.name,
        amount: addon.amount,
        type: "per_night",
        description: "Per night"
      });
    }
  });

  return {
    cleaningFee,
    extraGuestFee,
    extraChildFee, // Would need specific addon type detection
    allFees,
    hasAddons: allFees.length > 0
  };
}

/**
 * Get the Smoobu user/customer ID from /api/me
 * This is required for the checkApartmentAvailability endpoint
 */
async function getSmoobuUserId(apiKey) {
  // Check cache first
  if (userIdCache[apiKey]) {
    return userIdCache[apiKey];
  }

  try {
    const response = await axios.get(`${SMOOBU_API_URL}/me`, {
      headers: {
        "Api-Key": apiKey,
        "Content-Type": "application/json",
      },
    });

    if (response.data && response.data.id) {
      userIdCache[apiKey] = response.data.id;
      console.log(`📋 Got Smoobu user ID: ${response.data.id}`);
      return response.data.id;
    }

    throw new Error("No user ID in response");
  } catch (error) {
    console.error("🟥 Error fetching Smoobu user ID:", error.message);
    throw error;
  }
}

/**
 * Fetch all apartments/rooms from Smoobu API
 * This is the core function for dynamic room fetching
 */
async function fetchSmoobuApartments(apiKey) {
  const response = await axios.get(`${SMOOBU_API_URL}/apartments`, {
    headers: {
      "Api-Key": apiKey,
      "Cache-Control": "no-cache",
      "Content-Type": "application/json",
    },
  });
  return response.data;
}

// Note: getRoomConfigFromFirebase removed - fees now come from Smoobu Addons

/**
 * Get all room configurations from Firebase
 */
async function getAllRoomConfigs() {
  try {
    const snapshot = await db.collection("roomConfigs").get();
    const configs = {};
    snapshot.forEach((doc) => {
      configs[doc.id] = doc.data();
    });
    return configs;
  } catch (error) {
    console.error("Error fetching room configs:", error);
    return {};
  }
}

/**
 * Create default room config based on Smoobu apartment data
 */
function createDefaultRoomConfig(apartment) {
  return {
    smoobuId: apartment.id,
    name: apartment.name,
    maxGuests: apartment.maxOccupancy || 2,
    // Default pricing rules
    cleaningFee: 0,
    prepayment: 0,
    minDaysBetweenBookingAndArrival: 1,
    extraGuestsPerNight: 0,
    startingAtGuest: 2,
    extraChildPerNight: 0,
    lengthOfStayDiscount: {
      minNights: 0,
      discountPercentage: 0,
    },
    // Default display settings
    type: "standard",
    isActive: true,
    sortOrder: 0,
  };
}

/**
 * Merge Smoobu apartment data with Firebase config
 */
function mergeApartmentWithConfig(apartment, config) {
  const defaultConfig = createDefaultRoomConfig(apartment);

  return {
    // Smoobu data (always fresh)
    id: apartment.id,
    smoobuId: apartment.id,
    name: config?.name || apartment.name,
    location: apartment.location || {},
    timeZone: apartment.timeZone,
    currency: apartment.currency,

    // Occupancy from Smoobu
    maxOccupancy: apartment.maxOccupancy,

    // Config from Firebase (or defaults)
    maxGuests: config?.maxGuests || defaultConfig.maxGuests,
    cleaningFee: config?.cleaningFee ?? defaultConfig.cleaningFee,
    prepayment: config?.prepayment ?? defaultConfig.prepayment,
    minDaysBetweenBookingAndArrival: config?.minDaysBetweenBookingAndArrival ?? defaultConfig.minDaysBetweenBookingAndArrival,
    extraGuestsPerNight: config?.extraGuestsPerNight ?? defaultConfig.extraGuestsPerNight,
    startingAtGuest: config?.startingAtGuest ?? defaultConfig.startingAtGuest,
    extraChildPerNight: config?.extraChildPerNight ?? defaultConfig.extraChildPerNight,
    lengthOfStayDiscount: config?.lengthOfStayDiscount ?? defaultConfig.lengthOfStayDiscount,

    // Display settings
    type: config?.type || defaultConfig.type,
    description: config?.description || "",
    images: config?.images || [],
    features: config?.features || [],
    isActive: config?.isActive ?? defaultConfig.isActive,
    sortOrder: config?.sortOrder ?? defaultConfig.sortOrder,

    // Metadata
    isConfigured: !!config,
    lastSynced: new Date().toISOString(),
  };
}

/**
 * Main endpoint: GET /api/dynamic-rooms
 * Fetches all rooms from Smoobu with detailed info and addons
 */
export async function fetchDynamicRooms(req, res) {
  try {
    // Allow passing API key in query for testing, otherwise use env
    const apiKey = req.query.apiKey || process.env.SMOOBU_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        success: false,
        error: "SMOOBU_API_KEY not configured",
        message: "Please set the SMOOBU_API_KEY environment variable",
      });
    }

    console.log("🏠 Fetching dynamic rooms from Smoobu...");

    // Fetch apartments list and addons in parallel
    const [smoobuData, allAddons] = await Promise.all([
      fetchSmoobuApartments(apiKey),
      fetchSmoobuAddons(apiKey)
    ]);

    if (!smoobuData || !smoobuData.apartments) {
      return res.status(404).json({
        success: false,
        error: "No apartments found",
        message: "Smoobu API returned no apartments",
      });
    }

    console.log(`📦 Found ${smoobuData.apartments.length} apartments from Smoobu`);
    console.log(`💰 Found ${allAddons.length} addons from Smoobu`);

    // Fetch detailed info for each apartment (to get maxOccupancy)
    // Run in parallel for better performance
    const apartmentDetailsPromises = smoobuData.apartments.map(apt =>
      fetchApartmentDetails(apiKey, apt.id)
    );
    const apartmentDetails = await Promise.all(apartmentDetailsPromises);

    // Create a map for quick lookup
    const detailsMap = {};
    apartmentDetails.forEach((details, index) => {
      if (details) {
        detailsMap[smoobuData.apartments[index].id] = details;
      }
    });

    // Fetch room configs and pricing configs from Firebase in parallel
    const [roomConfigs, pricingConfigs] = await Promise.all([
      getAllRoomConfigs(),
      fetchPricingConfigs()
    ]);
    console.log(`⚙️ Found ${Object.keys(roomConfigs).length} room configs in Firebase`);
    console.log(`💰 Found ${Object.keys(pricingConfigs).length} pricing configs in Firebase`);

    // Build room data with Smoobu details and addons
    const rooms = smoobuData.apartments.map((apartment) => {
      const config = roomConfigs[apartment.id.toString()];
      const details = detailsMap[apartment.id];
      const pricingConfig = pricingConfigs[apartment.id];

      // Get addons for this apartment
      const apartmentAddons = getAddonsForApartment(allAddons, apartment.id);
      const feeSummary = extractFeeSummary(apartmentAddons);

      // Get maxOccupancy from detailed response or rooms object
      let maxOccupancy = null;
      if (details) {
        // Try to get from rooms object (contains beds info)
        if (details.rooms && details.rooms.maxOccupancy) {
          maxOccupancy = details.rooms.maxOccupancy;
        } else if (details.maxOccupancy) {
          maxOccupancy = details.maxOccupancy;
        }
      }

      // Use pricing config from Firebase if available, otherwise fall back to Smoobu addons
      const extraGuestFee = pricingConfig?.extraGuestFeePerNight ?? feeSummary.extraGuestFee;
      const extraChildFee = pricingConfig?.extraChildFeePerNight ?? feeSummary.extraChildFee;
      const cleaningFeeValue = pricingConfig?.cleaningFeeOverride ?? feeSummary.cleaningFee;
      const startingAtGuest = pricingConfig?.startingAtGuest ?? 1;

      return {
        // Smoobu data (always fresh)
        id: apartment.id,
        smoobuId: apartment.id,
        name: config?.name || apartment.name,
        location: apartment.location || {},
        timeZone: apartment.timeZone,
        currency: apartment.currency || "EUR",

        // Occupancy from Smoobu details
        maxOccupancy: maxOccupancy,

        // Fees - prioritize Firebase pricing config, fall back to Smoobu addons
        cleaningFee: cleaningFeeValue,
        extraGuestsPerNight: extraGuestFee,
        extraChildPerNight: extraChildFee,
        startingAtGuest: startingAtGuest,
        allFees: feeSummary.allFees,
        hasSmoobuAddons: feeSummary.hasAddons,
        hasPricingConfig: !!pricingConfig,
        pricingConfig: pricingConfig || null,

        // Display settings from Firebase config (optional)
        type: config?.type || "standard",
        description: config?.description || "",
        images: config?.images || [],
        features: config?.features || [],
        isActive: config?.isActive ?? true,
        sortOrder: config?.sortOrder ?? 0,

        // Metadata
        isConfigured: !!config,
        lastSynced: new Date().toISOString(),
      };
    });

    // Sort by sortOrder, then by name
    rooms.sort((a, b) => {
      if (a.sortOrder !== b.sortOrder) {
        return a.sortOrder - b.sortOrder;
      }
      return a.name.localeCompare(b.name);
    });

    // Filter to only active rooms if requested
    const includeInactive = req.query.includeInactive === "true";
    const filteredRooms = includeInactive
      ? rooms
      : rooms.filter((room) => room.isActive);

    console.log(`✅ Returning ${filteredRooms.length} rooms`);

    res.json({
      success: true,
      rooms: filteredRooms,
      total: filteredRooms.length,
      totalFromSmoobu: smoobuData.apartments.length,
      configuredCount: Object.keys(roomConfigs).length,
    });
  } catch (error) {
    console.error("🟥 Error fetching dynamic rooms:", error);

    // Handle specific Smoobu API errors
    if (error.response?.status === 401) {
      return res.status(401).json({
        success: false,
        error: "Invalid API key",
        message: "The Smoobu API key is invalid or expired",
      });
    }

    res.status(error.response?.status || 500).json({
      success: false,
      error: error.message,
      message: "Failed to fetch dynamic rooms",
      details: error.response?.data || null,
    });
  }
}

/**
 * Test Smoobu API connection
 * GET /api/test-smoobu-connection
 */
export async function testSmoobuConnection(req, res) {
  try {
    // Allow passing API key in query for testing, otherwise use env
    const apiKey = req.query.apiKey || process.env.SMOOBU_API_KEY;

    if (!apiKey) {
      return res.status(400).json({
        success: false,
        error: "No API key provided",
        message: "Please provide an API key via query parameter or SMOOBU_API_KEY env variable",
      });
    }

    console.log("🔌 Testing Smoobu API connection...");

    const smoobuData = await fetchSmoobuApartments(apiKey);

    res.json({
      success: true,
      message: "Connection successful!",
      apartmentCount: smoobuData.apartments?.length || 0,
      apartments: smoobuData.apartments?.map((apt) => ({
        id: apt.id,
        name: apt.name,
        maxOccupancy: apt.maxOccupancy,
        location: apt.location?.city || "Unknown",
      })) || [],
    });
  } catch (error) {
    console.error("🟥 Smoobu connection test failed:", error);

    if (error.response?.status === 401) {
      return res.status(401).json({
        success: false,
        error: "Invalid API key",
        message: "The provided Smoobu API key is invalid",
      });
    }

    res.status(error.response?.status || 500).json({
      success: false,
      error: error.message,
      message: "Connection test failed",
    });
  }
}

/**
 * Save room configuration to Firebase
 * POST /api/room-config/:roomId
 */
export async function saveRoomConfig(req, res) {
  try {
    const { roomId } = req.params;
    const config = req.body;

    if (!roomId) {
      return res.status(400).json({
        success: false,
        error: "Room ID required",
      });
    }

    console.log(`💾 Saving config for room ${roomId}...`);

    // Validate required fields
    const validatedConfig = {
      smoobuId: parseInt(roomId),
      name: config.name,
      maxGuests: parseInt(config.maxGuests) || 2,
      cleaningFee: parseFloat(config.cleaningFee) || 0,
      prepayment: parseFloat(config.prepayment) || 0,
      minDaysBetweenBookingAndArrival: parseInt(config.minDaysBetweenBookingAndArrival) || 1,
      extraGuestsPerNight: parseFloat(config.extraGuestsPerNight) || 0,
      startingAtGuest: parseInt(config.startingAtGuest) || 2,
      extraChildPerNight: parseFloat(config.extraChildPerNight) || 0,
      lengthOfStayDiscount: {
        minNights: parseInt(config.lengthOfStayDiscount?.minNights) || 0,
        discountPercentage: parseFloat(config.lengthOfStayDiscount?.discountPercentage) || 0,
      },
      type: config.type || "standard",
      description: config.description || "",
      images: config.images || [],
      features: config.features || [],
      isActive: config.isActive !== false,
      sortOrder: parseInt(config.sortOrder) || 0,
      updatedAt: new Date().toISOString(),
    };

    await db.collection("roomConfigs").doc(roomId.toString()).set(validatedConfig, { merge: true });

    console.log(`✅ Config saved for room ${roomId}`);

    res.json({
      success: true,
      message: "Room configuration saved",
      config: validatedConfig,
    });
  } catch (error) {
    console.error("🟥 Error saving room config:", error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: "Failed to save room configuration",
    });
  }
}

/**
 * Fetch availability/rates for dynamic rooms
 * Uses the checkApartmentAvailability endpoint + Smoobu addons for accurate pricing
 * GET /api/dynamic-rates
 */
export async function fetchDynamicRates(req, res) {
  try {
    const { start_date, end_date, adults, children, apiKey: queryApiKey } = req.query;
    const apiKey = queryApiKey || process.env.SMOOBU_API_KEY;

    if (!start_date || !end_date) {
      return res.status(400).json({
        success: false,
        error: "Missing dates",
        message: "Both start_date and end_date are required",
      });
    }

    // Get the user ID (required for checkApartmentAvailability)
    const customerId = await getSmoobuUserId(apiKey);

    // Fetch apartments, addons, and pricing configs in parallel
    const [smoobuData, allAddons, pricingConfigs] = await Promise.all([
      fetchSmoobuApartments(apiKey),
      fetchSmoobuAddons(apiKey),
      fetchPricingConfigs()
    ]);
    const apartmentIds = smoobuData.apartments.map((apt) => apt.id);

    console.log(`📅 Checking availability for ${apartmentIds.length} apartments (user ID: ${customerId})...`);
    console.log(`💰 Using ${allAddons.length} addons for fee calculation`);
    console.log(`⚙️ Found ${Object.keys(pricingConfigs).length} pricing configs from Firebase`);

    // Calculate number of nights
    const startDateObj = new Date(start_date);
    const endDateObj = new Date(end_date);
    const nights = Math.ceil((endDateObj - startDateObj) / (1000 * 60 * 60 * 24));

    // Guest counts
    const numAdults = parseInt(adults) || 1;
    const numChildren = parseInt(children) || 0;
    const totalGuests = numAdults + numChildren;
    const baseGuestCount = 1; // Minimum guests to get "true" base rate

    // Make TWO availability calls:
    // 1. With requested guests (to get final price with guest fees)
    // 2. With 1 guest (to get base rate without guest fees)
    const [availabilityResponse, baseRateResponse] = await Promise.all([
      axios.post(
        `${SMOOBU_BOOKING_URL}/checkApartmentAvailability`,
        {
          arrivalDate: start_date,
          departureDate: end_date,
          apartments: apartmentIds,
          customerId: customerId,
          guests: totalGuests,
        },
        { headers: { "Api-Key": apiKey, "Content-Type": "application/json" } }
      ),
      // Only fetch base rate if we have extra guests
      totalGuests > baseGuestCount
        ? axios.post(
            `${SMOOBU_BOOKING_URL}/checkApartmentAvailability`,
            {
              arrivalDate: start_date,
              departureDate: end_date,
              apartments: apartmentIds,
              customerId: customerId,
              guests: baseGuestCount,
            },
            { headers: { "Api-Key": apiKey, "Content-Type": "application/json" } }
          )
        : Promise.resolve(null),
    ]);

    // Log raw response for debugging
    console.log(`📊 Availability response:`, JSON.stringify(availabilityResponse.data, null, 2).substring(0, 1000));

    const { availableApartments, prices, errorMessages } = availabilityResponse.data;
    const basePrices = baseRateResponse?.data?.prices || {};

    // Process results for each apartment
    const ratesData = {};
    let hasAvailability = false;

    for (const apartment of smoobuData.apartments) {
      const apartmentId = apartment.id;
      const isAvailable = availableApartments?.includes(apartmentId);
      const priceData = prices?.[apartmentId];
      const basePriceData = basePrices[apartmentId];
      const errorMsg = errorMessages?.[apartmentId];
      const pricingConfig = pricingConfigs[apartmentId];

      // The checkApartmentAvailability endpoint returns:
      // - price: Final calculated price (already includes all fees, discounts)
      // - priceElements: Breakdown of the price calculation
      const finalPrice = priceData?.price || 0;
      const currency = priceData?.currency || apartment.currency || "EUR";
      const priceElements = priceData?.priceElements || [];

      // Extract breakdown from priceElements (from Smoobu API)
      let basePriceWithGuests = 0; // This includes guest fees bundled in by Smoobu
      let smoobuCleaningFee = 0;
      let discount = 0;
      const breakdown = [];

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
            discount = el.amount; // This is negative
            break;
        }
      });

      // Calculate guest fees using Firebase pricing config (if available)
      // Otherwise fall back to the old calculation method
      let trueBasePrice = basePriceWithGuests;
      let adultGuestFees = 0;
      let childGuestFees = 0;
      let totalGuestFees = 0;
      let cleaningFee = smoobuCleaningFee;
      let usingFirebaseConfig = false;

      if (pricingConfig) {
        // Use Firebase pricing config for guest fee calculation
        usingFirebaseConfig = true;
        const startingAt = pricingConfig.startingAtGuest || 1;
        const extraGuestFeePerNight = pricingConfig.extraGuestFeePerNight || 0;
        const extraChildFeePerNight = pricingConfig.extraChildFeePerNight || 0;

        // Calculate extra guests above the starting threshold
        // Logic: Adults fill base spots first, then children
        let extraAdultsCount = 0;
        let extraChildrenCount = 0;

        if (totalGuests > startingAt) {
          // Some guests exceed the base occupancy
          if (numAdults >= startingAt) {
            // All base spots filled by adults, so extra adults and all children are extra
            extraAdultsCount = numAdults - startingAt;
            extraChildrenCount = numChildren;
          } else {
            // Adults don't fill all base spots, some children fit in base
            extraAdultsCount = 0;
            const childrenIncludedInBase = startingAt - numAdults;
            extraChildrenCount = Math.max(0, numChildren - childrenIncludedInBase);
          }
        }
        // If totalGuests <= startingAt, no extra fees (both stay 0)

        // Calculate fees for the stay
        adultGuestFees = extraAdultsCount * extraGuestFeePerNight * nights;
        childGuestFees = extraChildrenCount * extraChildFeePerNight * nights;
        totalGuestFees = adultGuestFees + childGuestFees;

        // Get true base price by subtracting the bundled guest fees from Smoobu's basePrice
        // Since Smoobu bundles guest fees, we estimate the true base price
        if (basePriceData && totalGuests > startingAt) {
          const basePriceMin = basePriceData.priceElements?.find(e => e.type === 'basePrice')?.amount || basePriceWithGuests;
          trueBasePrice = basePriceMin;
        }

        // Override cleaning fee if configured
        if (pricingConfig.cleaningFeeOverride !== null && pricingConfig.cleaningFeeOverride !== undefined) {
          cleaningFee = pricingConfig.cleaningFeeOverride;
        }

        console.log(`     💰 Firebase config: startingAt=${startingAt}, extraGuestFee=${extraGuestFeePerNight}€, extraChildFee=${extraChildFeePerNight}€`);
        console.log(`     💰 Guests: ${numAdults} adults + ${numChildren} children = ${totalGuests} total (base: ${startingAt})`);
        console.log(`     💰 Calculated: ${extraAdultsCount} extra adults × ${extraGuestFeePerNight}€ × ${nights} nights = ${adultGuestFees}€`);
        console.log(`     💰 Calculated: ${extraChildrenCount} extra children × ${extraChildFeePerNight}€ × ${nights} nights = ${childGuestFees}€`);
      } else if (basePriceData && totalGuests > 1) {
        // Fallback: Calculate guest fees by comparing base price with/without extra guests
        // Smoobu bundles guest fees into "basePrice", so we need to extract them
        const basePriceMin = basePriceData.priceElements?.find(e => e.type === 'basePrice')?.amount || 0;

        // Total guest fees = difference between prices
        totalGuestFees = basePriceWithGuests - basePriceMin;
        trueBasePrice = basePriceMin;

        // Calculate per-guest rate and split proportionally
        const extraGuests = totalGuests - 1;
        const perGuestTotal = extraGuests > 0 ? totalGuestFees / extraGuests : 0;
        const extraAdults = Math.max(0, numAdults - 1);
        const extraChildren = numChildren;

        if (extraAdults + extraChildren > 0) {
          adultGuestFees = extraAdults * perGuestTotal;
          childGuestFees = extraChildren * perGuestTotal;
        }

        console.log(`     💰 Fallback calc: base=${basePriceMin}, withGuests=${basePriceWithGuests}, fees=${totalGuestFees}`);
      }

      // Build the breakdown for display
      breakdown.push({ type: 'basePrice', name: 'Base price (nightly rate)', amount: trueBasePrice });

      // Calculate display counts for breakdown using same logic as fee calculation
      const startingAt = pricingConfig?.startingAtGuest || 1;
      let displayExtraAdults = 0;
      let displayExtraChildren = 0;

      if (pricingConfig && totalGuests > startingAt) {
        if (numAdults >= startingAt) {
          displayExtraAdults = numAdults - startingAt;
          displayExtraChildren = numChildren;
        } else {
          displayExtraAdults = 0;
          const childrenIncludedInBase = startingAt - numAdults;
          displayExtraChildren = Math.max(0, numChildren - childrenIncludedInBase);
        }
      }

      if (adultGuestFees > 0) {
        breakdown.push({
          type: 'adultGuestFee',
          name: `Extra adult fees (${displayExtraAdults} adult${displayExtraAdults !== 1 ? 's' : ''} × ${nights} night${nights !== 1 ? 's' : ''})`,
          amount: adultGuestFees
        });
      }
      if (childGuestFees > 0) {
        breakdown.push({
          type: 'childGuestFee',
          name: `Child fees (${displayExtraChildren} child${displayExtraChildren !== 1 ? 'ren' : ''} × ${nights} night${nights !== 1 ? 's' : ''})`,
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

      console.log(`  🏠 ${apartment.name}: available=${isAvailable}, finalPrice=${finalPrice}`);
      if (breakdown.length > 0) {
        console.log(`     📋 Price breakdown:`, breakdown.map(b => `${b.name}: ${b.amount}€`).join(', '));
      }

      // Calculate our own final price if using Firebase config (for accurate display)
      const calculatedFinalPrice = usingFirebaseConfig
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
          smoobuFinalPrice: finalPrice, // Keep original Smoobu price for reference
        },
        guestInfo: {
          adults: numAdults,
          children: numChildren,
          total: totalGuests,
          startingAtGuest: pricingConfig?.startingAtGuest || 1,
        },
        priceElements: breakdown,
        // Pricing config info
        hasPricingConfig: usingFirebaseConfig,
        pricingConfig: pricingConfig ? {
          extraGuestFeePerNight: pricingConfig.extraGuestFeePerNight,
          extraChildFeePerNight: pricingConfig.extraChildFeePerNight,
          startingAtGuest: pricingConfig.startingAtGuest,
          cleaningFeeOverride: pricingConfig.cleaningFeeOverride,
        } : null,
        // Include error message if not available
        ...(errorMsg && {
          unavailableReason: errorMsg.message,
          errorCode: errorMsg.errorCode,
          details: errorMsg,
        }),
        // Include message if no price
        ...(!priceData && isAvailable && {
          message: "Room available but no price configured in Smoobu",
        }),
      };
    }

    res.json({
      success: true,
      hasAvailability,
      dateRange: { start_date, end_date },
      nights,
      rates: ratesData,
    });
  } catch (error) {
    console.error("🟥 Error fetching dynamic rates:", error);
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.message,
      message: "Failed to fetch dynamic rates",
      details: error.response?.data || null,
    });
  }
}

/**
 * Debug endpoint to see raw Smoobu API responses
 * GET /api/debug-smoobu
 */
export async function debugSmoobu(req, res) {
  try {
    const apiKey = req.query.apiKey || process.env.SMOOBU_API_KEY;
    const { start_date, end_date } = req.query;

    if (!apiKey) {
      return res.status(400).json({ error: "No API key" });
    }

    console.log("🔍 Debug: Fetching raw Smoobu data...");

    // Fetch addons
    const addonsResponse = await axios.get(`${SMOOBU_API_URL}/addons`, {
      headers: { "Api-Key": apiKey, "Content-Type": "application/json" },
    });
    console.log("📦 Raw addons response:", JSON.stringify(addonsResponse.data, null, 2));

    // Fetch apartments
    const apartmentsResponse = await axios.get(`${SMOOBU_API_URL}/apartments`, {
      headers: { "Api-Key": apiKey, "Content-Type": "application/json" },
    });

    // Fetch rates if dates provided
    let ratesData = null;
    let availabilityData = null;
    if (start_date && end_date) {
      const apartmentIds = apartmentsResponse.data.apartments?.map(a => a.id) || [];

      // Fetch rates
      const ratesResponse = await axios.get(`${SMOOBU_API_URL}/rates`, {
        params: {
          apartments: apartmentIds,
          start_date,
          end_date,
        },
        headers: { "Api-Key": apiKey, "Content-Type": "application/json" },
      });
      ratesData = ratesResponse.data;
      console.log("💰 Raw rates response:", JSON.stringify(ratesData, null, 2).substring(0, 2000));

      // Fetch availability
      const customerId = await getSmoobuUserId(apiKey);
      const availResponse = await axios.post(
        `${SMOOBU_BOOKING_URL}/checkApartmentAvailability`,
        {
          arrivalDate: start_date,
          departureDate: end_date,
          apartments: apartmentIds,
          customerId: customerId,
          guests: 2,
        },
        { headers: { "Api-Key": apiKey, "Content-Type": "application/json" } }
      );
      availabilityData = availResponse.data;
      console.log("📅 Raw availability response:", JSON.stringify(availabilityData, null, 2));
    }

    res.json({
      success: true,
      debug: {
        addons: {
          count: addonsResponse.data.addons?.length || 0,
          raw: addonsResponse.data,
        },
        apartments: {
          count: apartmentsResponse.data.apartments?.length || 0,
          list: apartmentsResponse.data.apartments?.map(a => ({
            id: a.id,
            name: a.name,
            maxOccupancy: a.maxOccupancy,
            currency: a.currency,
          })),
        },
        rates: ratesData,
        availability: availabilityData,
      },
    });
  } catch (error) {
    console.error("🟥 Debug error:", error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      details: error.response?.data || null,
    });
  }
}
