
// Portal name mapping
const portalNames = {
  Homepage: "Website",
  "Direct booking": "Direct booking",
  "Homepage direct": "Website",
  Direct: "Direct booking",
  Airbnb: "Airbnb",
  airbnb: "Airbnb",
  "Booking.com": "Booking.com",
  "booking.com": "Booking.com",
  Expedia: "Expedia",
  blocked: "Blocked",
  Blocked: "Blocked",
  Partenariat: "Partenariat",
  partenariat: "Partenariat",
};

// Format a date string to local date format
export const formatDate = (dateString) => {
  return new Date(dateString).toLocaleDateString("fr-FR");
};

// Format a price to EUR format
export const formatPrice = (price) => {
  return `€${Number(price).toFixed(2)}`;
};

// Get the standardized portal name
export const getPortalName = (portal) => {
  // Handle null/undefined
  if (!portal) return "Website";

  // Check if it's already a mapped portal
  if (portalNames[portal]) return portalNames[portal];

  // Check channel IDs
  if (portal === "2323525" || portal === 2323525) return "Website";
  if (portal === "2323543" || portal === 2323543) return "Airbnb";

  // Special case for unknown channels from Smoobu that should be Website
  if (
    portal.includes("Homepage") ||
    portal === "Direct" ||
    portal === "Direct booking"
  ) {
    return "Website";
  }

  // Return the original or default to Website
  return portal || "Website";
};

// Room name mapping
export const roomNames = {
  1946282: "Le dôme de libellules",
  2565753: "La Cabane du Chêne",
  1644643: "La Bulle du Ruisseau",
  1946279: "Le Moulin",
  1946276: "La Chambre de Blé",
  1946270: "Le Logis",
};
