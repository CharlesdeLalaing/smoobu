// pricing-config.js
// API endpoints for managing room pricing configuration in Firebase
import { dynamicDb } from "../../../../dynamic-firebase-config.js";

const COLLECTION_NAME = "roomPricingConfig";

/**
 * Data structure for room pricing configuration:
 * {
 *   smoobuId: number,           // Smoobu apartment ID
 *   name: string,               // Room name (from Smoobu)
 *
 *   // Guest fee configuration
 *   extraGuestFeePerNight: number,  // Fee per extra adult per night (e.g., 20)
 *   extraChildFeePerNight: number,  // Fee per child per night (e.g., 15)
 *   startingAtGuest: number,        // Guest fees apply after this guest (e.g., 2)
 *
 *   // Optional overrides (if not using Smoobu values)
 *   cleaningFeeOverride: number | null,
 *
 *   // Metadata
 *   updatedAt: timestamp,
 *   createdAt: timestamp
 * }
 */

/**
 * Get pricing configuration for a specific room
 * GET /api/pricing-config/:smoobuId
 */
export async function getPricingConfig(req, res) {
  try {
    const { smoobuId } = req.params;

    if (!smoobuId) {
      return res.status(400).json({
        success: false,
        error: "Missing smoobuId parameter",
      });
    }

    const docId = smoobuId.toString();
    const doc = await dynamicDb.collection(COLLECTION_NAME).doc(docId).get();

    if (!doc.exists) {
      return res.json({
        success: true,
        config: null,
        isDefault: true,
        message: "No custom configuration found, using defaults",
      });
    }

    res.json({
      success: true,
      config: doc.data(),
      isDefault: false,
    });
  } catch (error) {
    console.error("🟥 Error getting pricing config:", error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: "Failed to get pricing configuration",
    });
  }
}

/**
 * Save pricing configuration for a room
 * POST /api/pricing-config/:smoobuId
 */
export async function savePricingConfig(req, res) {
  try {
    const { smoobuId } = req.params;
    const config = req.body;

    if (!smoobuId) {
      return res.status(400).json({
        success: false,
        error: "Missing smoobuId parameter",
      });
    }

    console.log(`💾 Saving pricing config for room ${smoobuId}...`);

    // Validate and sanitize input (no API key stored)
    const validatedConfig = {
      smoobuId: parseInt(smoobuId),
      name: config.name || "",

      // Guest fee configuration
      extraGuestFeePerNight: parseFloat(config.extraGuestFeePerNight) || 0,
      extraChildFeePerNight: parseFloat(config.extraChildFeePerNight) || 0,
      startingAtGuest: parseInt(config.startingAtGuest) || 1,

      // Optional overrides
      cleaningFeeOverride: config.cleaningFeeOverride !== "" && config.cleaningFeeOverride !== undefined
        ? parseFloat(config.cleaningFeeOverride)
        : null,

      // Metadata
      updatedAt: new Date().toISOString(),
    };

    const docId = smoobuId.toString();

    // Check if document exists to preserve createdAt
    const existingDoc = await dynamicDb.collection(COLLECTION_NAME).doc(docId).get();
    if (!existingDoc.exists) {
      validatedConfig.createdAt = new Date().toISOString();
    }

    await dynamicDb.collection(COLLECTION_NAME).doc(docId).set(validatedConfig, { merge: true });

    console.log(`✅ Pricing config saved for room ${smoobuId}`);

    res.json({
      success: true,
      message: "Pricing configuration saved successfully",
      config: validatedConfig,
    });
  } catch (error) {
    console.error("🟥 Error saving pricing config:", error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: "Failed to save pricing configuration",
    });
  }
}

/**
 * Get all pricing configurations
 * GET /api/pricing-configs
 */
export async function getAllPricingConfigs(req, res) {
  try {
    const snapshot = await dynamicDb.collection(COLLECTION_NAME).get();

    const configs = {};
    snapshot.forEach((doc) => {
      const data = doc.data();
      configs[data.smoobuId] = data;
    });

    res.json({
      success: true,
      configs,
      count: Object.keys(configs).length,
    });
  } catch (error) {
    console.error("🟥 Error getting all pricing configs:", error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: "Failed to get pricing configurations",
    });
  }
}

/**
 * Delete pricing configuration for a room
 * DELETE /api/pricing-config/:smoobuId
 */
export async function deletePricingConfig(req, res) {
  try {
    const { smoobuId } = req.params;

    if (!smoobuId) {
      return res.status(400).json({
        success: false,
        error: "Missing smoobuId parameter",
      });
    }

    const docId = smoobuId.toString();
    await dynamicDb.collection(COLLECTION_NAME).doc(docId).delete();

    console.log(`🗑️ Pricing config deleted for room ${smoobuId}`);

    res.json({
      success: true,
      message: "Pricing configuration deleted successfully",
    });
  } catch (error) {
    console.error("🟥 Error deleting pricing config:", error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: "Failed to delete pricing configuration",
    });
  }
}

/**
 * Batch save pricing configurations for multiple rooms
 * POST /api/pricing-configs/batch
 */
export async function batchSavePricingConfigs(req, res) {
  try {
    const { configs } = req.body;

    if (!configs || !Array.isArray(configs)) {
      return res.status(400).json({
        success: false,
        error: "Missing or invalid configs array",
      });
    }

    console.log(`💾 Batch saving ${configs.length} pricing configs...`);

    const batch = dynamicDb.batch();
    const timestamp = new Date().toISOString();

    for (const config of configs) {
      const docId = config.smoobuId.toString();
      const docRef = dynamicDb.collection(COLLECTION_NAME).doc(docId);

      const validatedConfig = {
        smoobuId: parseInt(config.smoobuId),
        name: config.name || "",
        extraGuestFeePerNight: parseFloat(config.extraGuestFeePerNight) || 0,
        extraChildFeePerNight: parseFloat(config.extraChildFeePerNight) || 0,
        startingAtGuest: parseInt(config.startingAtGuest) || 1,
        cleaningFeeOverride: config.cleaningFeeOverride !== "" && config.cleaningFeeOverride !== undefined
          ? parseFloat(config.cleaningFeeOverride)
          : null,
        updatedAt: timestamp,
      };

      batch.set(docRef, validatedConfig, { merge: true });
    }

    await batch.commit();

    console.log(`✅ Batch saved ${configs.length} pricing configs`);

    res.json({
      success: true,
      message: `Successfully saved ${configs.length} pricing configurations`,
      count: configs.length,
    });
  } catch (error) {
    console.error("🟥 Error batch saving pricing configs:", error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: "Failed to batch save pricing configurations",
    });
  }
}
