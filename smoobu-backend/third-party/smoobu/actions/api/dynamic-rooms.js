import axios from "axios";
import { db } from "../../../../firebase-config.js";

const SMOOBU_API_URL = "https://login.smoobu.com/api";

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

/**
 * Get room configuration from Firebase (if exists)
 * Falls back to defaults if not configured
 */
async function getRoomConfigFromFirebase(smoobuId) {
  try {
    const doc = await db.collection("roomConfigs").doc(smoobuId.toString()).get();
    if (doc.exists) {
      return doc.data();
    }
    return null;
  } catch (error) {
    console.error(`Error fetching room config for ${smoobuId}:`, error);
    return null;
  }
}

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
 * Fetches all rooms from Smoobu and merges with Firebase config
 */
export async function fetchDynamicRooms(req, res) {
  try {
    const apiKey = process.env.SMOOBU_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        success: false,
        error: "SMOOBU_API_KEY not configured",
        message: "Please set the SMOOBU_API_KEY environment variable",
      });
    }

    console.log("🏠 Fetching dynamic rooms from Smoobu...");

    // Fetch apartments from Smoobu
    const smoobuData = await fetchSmoobuApartments(apiKey);

    if (!smoobuData || !smoobuData.apartments) {
      return res.status(404).json({
        success: false,
        error: "No apartments found",
        message: "Smoobu API returned no apartments",
      });
    }

    console.log(`📦 Found ${smoobuData.apartments.length} apartments from Smoobu`);

    // Fetch all room configs from Firebase
    const roomConfigs = await getAllRoomConfigs();
    console.log(`⚙️ Found ${Object.keys(roomConfigs).length} room configs in Firebase`);

    // Merge Smoobu data with Firebase configs
    const rooms = smoobuData.apartments.map((apartment) => {
      const config = roomConfigs[apartment.id.toString()];
      return mergeApartmentWithConfig(apartment, config);
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
 * GET /api/dynamic-rates
 */
export async function fetchDynamicRates(req, res) {
  try {
    const { start_date, end_date, adults, children } = req.query;

    if (!start_date || !end_date) {
      return res.status(400).json({
        success: false,
        error: "Missing dates",
        message: "Both start_date and end_date are required",
      });
    }

    const apiKey = process.env.SMOOBU_API_KEY;

    // First, get all apartments from Smoobu
    const smoobuData = await fetchSmoobuApartments(apiKey);
    const apartmentIds = smoobuData.apartments.map((apt) => apt.id);

    console.log(`📅 Fetching rates for ${apartmentIds.length} apartments...`);

    // Fetch rates from Smoobu
    const ratesResponse = await axios.get(`${SMOOBU_API_URL}/rates`, {
      headers: {
        "Api-Key": apiKey,
        "Content-Type": "application/json",
      },
      params: {
        apartments: apartmentIds,
        start_date,
        end_date,
      },
    });

    if (!ratesResponse.data || !ratesResponse.data.data) {
      return res.status(404).json({
        success: false,
        error: "No rates found",
        message: "Smoobu API returned no rate data",
      });
    }

    // Get room configs for pricing rules
    const roomConfigs = await getAllRoomConfigs();

    // Process rates for each apartment
    const ratesData = {};
    let hasAvailability = false;

    for (const apartment of smoobuData.apartments) {
      const apartmentRates = ratesResponse.data.data[apartment.id];
      if (!apartmentRates) continue;

      const config = roomConfigs[apartment.id.toString()];

      // Check availability
      let isAvailable = true;
      let totalBasePrice = 0;
      const dailyRates = [];

      for (const [date, rateInfo] of Object.entries(apartmentRates)) {
        if (rateInfo.available === 0) {
          isAvailable = false;
        }
        if (rateInfo.price) {
          totalBasePrice += parseFloat(rateInfo.price);
          dailyRates.push({
            date,
            price: rateInfo.price,
            minStay: rateInfo.min_length_of_stay,
            available: rateInfo.available > 0,
          });
        }
      }

      // Calculate final price with guest fees
      const numAdults = parseInt(adults) || 1;
      const numChildren = parseInt(children) || 0;
      const totalGuests = numAdults + numChildren;
      const nights = dailyRates.length;

      let guestFees = 0;
      const startingAtGuest = config?.startingAtGuest || 2;
      const extraGuestsPerNight = config?.extraGuestsPerNight || 0;
      const extraChildPerNight = config?.extraChildPerNight || 0;

      // Calculate extra guest fees
      if (numAdults > startingAtGuest && extraGuestsPerNight > 0) {
        guestFees += (numAdults - startingAtGuest) * extraGuestsPerNight * nights;
      }
      if (numChildren > 0 && extraChildPerNight > 0) {
        guestFees += numChildren * extraChildPerNight * nights;
      }

      // Apply length of stay discount
      let discount = 0;
      const lengthDiscount = config?.lengthOfStayDiscount;
      if (lengthDiscount && nights >= lengthDiscount.minNights && lengthDiscount.discountPercentage > 0) {
        discount = (totalBasePrice + guestFees) * (lengthDiscount.discountPercentage / 100);
      }

      const finalPrice = totalBasePrice + guestFees - discount;

      if (isAvailable && finalPrice > 0) {
        hasAvailability = true;
      }

      ratesData[apartment.id] = {
        apartmentId: apartment.id,
        apartmentName: config?.name || apartment.name,
        isAvailable,
        nights,
        dailyRates,
        pricing: {
          basePrice: totalBasePrice,
          guestFees,
          discount,
          finalPrice,
        },
        guestInfo: {
          adults: numAdults,
          children: numChildren,
          total: totalGuests,
        },
        settings: config ? {
          maxGuests: config.maxGuests,
          startingAtGuest: config.startingAtGuest,
          extraGuestsPerNight: config.extraGuestsPerNight,
          extraChildPerNight: config.extraChildPerNight,
          lengthOfStayDiscount: config.lengthOfStayDiscount,
        } : null,
      };
    }

    res.json({
      success: true,
      hasAvailability,
      dateRange: { start_date, end_date },
      rates: ratesData,
    });
  } catch (error) {
    console.error("🟥 Error fetching dynamic rates:", error);
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.message,
      message: "Failed to fetch dynamic rates",
    });
  }
}
