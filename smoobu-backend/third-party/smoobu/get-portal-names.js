// third-party/smoobu/helpers/get-portal-name.js
import { portalNames } from "../../../config/config.js";

/**
 * Maps a portal identifier (name or ID) to a standardized portal name
 * @param {string|number} portal - The portal identifier
 * @returns {string} - Standardized portal name
 */
export const getPortalName = (portal) => {
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
    typeof portal === "string" &&
    (portal.includes("Homepage") ||
      portal === "Direct" ||
      portal === "Direct booking")
  ) {
    return "Website";
  }

  // Return the original portal name or default to Website
  return portal || "Website";
};
