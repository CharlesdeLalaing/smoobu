import {
  extraCategoriesRaw,
  ALL_DRINK_ITEMS_MAP_RAW,
  DRINK_OFFER_CONFIG_RAW,
  getExtraByIdRaw,
  calculateExtrasTotalRaw, // Using the raw calculator here for simplicity
} from "./extraCategoriesData.js"; // Path to your RAW shared data
import { getProcessedImage } from "../imageImports"; // Path to your FRONTEND image loader

// Helper function to hydrate a single item (from the raw data) with its processed image
const hydrateItemWithImage = (rawItem) => {
  if (!rawItem) return null;
  return {
    ...rawItem,
    // Replace/add the 'image' property with the actual processed image asset
    // The backend will see 'imageIdentifier', frontend components will see 'image'
    image: getProcessedImage(rawItem.imageIdentifier),
  };
};

// Create the frontend-specific extraCategories with processed images
export const extraCategories = Object.fromEntries(
  Object.entries(extraCategoriesRaw).map(([categoryKey, categoryValue]) => [
    categoryKey,
    {
      ...categoryValue,
      items: categoryValue.items.map(hydrateItemWithImage),
    },
  ])
);

// Create the frontend-specific ALL_DRINK_ITEMS_MAP with processed images
export const ALL_DRINK_ITEMS_MAP = Object.fromEntries(
  Object.entries(ALL_DRINK_ITEMS_MAP_RAW).map(([drinkId, drinkItem]) => [
    drinkId,
    hydrateItemWithImage(drinkItem),
  ])
);

// DRINK_OFFER_CONFIG usually doesn't contain images directly in its structure,
// it refers to item IDs which are then looked up in ALL_DRINK_ITEMS_MAP.
// So, the raw config is usually fine here.
export const DRINK_OFFER_CONFIG = DRINK_OFFER_CONFIG_RAW;

// Frontend might want a getExtraById that returns items with processed images
export const getExtraById = (id) => {
  for (const category of Object.values(extraCategories)) {
    // Uses hydrated extraCategories
    if (category.items && Array.isArray(category.items)) {
      const item = category.items.find((item) => item.id === id);
      if (item) return item;
    }
  }
  return null;
};

// For calculating totals, the image doesn't matter, so using the raw calculator is fine
// and avoids circular dependencies if this file were to be imported by a shared helper.
export const calculateExtrasTotal = calculateExtrasTotalRaw;
