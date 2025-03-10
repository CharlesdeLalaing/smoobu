/**
 * Helper function to check if an extra is unwanted
 * @param {string} extraName - Name of the extra to check
 * @returns {boolean} - True if extra is unwanted, false otherwise
 */
export function isUnwantedExtra(extraName) {
  if (!extraName) return true;

  const name = extraName.toLowerCase();
  return (
    name.includes("cancellation") ||
    name.includes("commission") ||
    name.includes("pass_through") ||
    name.includes("host fee") ||
    name.includes("service fee") ||
    name.includes("cleaning fee") ||
    name.includes("vat") ||
    name.includes("tax") ||
    name.includes("linen_fee") ||
    (name.includes("fee") && !name.includes("coffee"))
  );
}

/**
 * Merges existing extras with new extras, preserving person data and combining duplicates
 * @param {Object} existingData - Existing booking data
 * @param {Array} newExtras - New extras from API
 * @param {string} portalName - Portal name for special handling
 * @returns {Array} - Merged extras
 */
export function mergeExtras(existingData, newExtras, portalName) {
  // Create a map to hold extras by name for easier merging
  const extrasMap = new Map();

  // Process each new extra first
  newExtras.forEach((newExtra) => {
    // Skip unwanted extras
    if (isUnwantedExtra(newExtra.name)) {

      return;
    }

    // Add the new extra to our map (will be overwritten/updated later if needed)
    extrasMap.set(newExtra.name, { ...newExtra });
  });

  // Process existing extras and merge with new ones
  if (existingData.extras && Array.isArray(existingData.extras)) {
    existingData.extras.forEach((existingExtra) => {
      // Skip unwanted extras
      if (isUnwantedExtra(existingExtra.name)) {

        return;
      }

      const existingName = existingExtra.name;

      // Check if this is a "Personne supplémentaire" extra
      const isPersonneExtra =
        existingName && existingName.includes("Personne supplémentaire");

      // If we already have this extra in our map (from newExtras)
      if (extrasMap.has(existingName)) {
        const mappedExtra = extrasMap.get(existingName);

        if (isPersonneExtra) {
          // Special handling for "Personne supplémentaire" extras - merge quantities and amounts


          // Calculate total quantity and amount
          const newQuantity = parseInt(mappedExtra.quantity) || 1;
          const existingQuantity = parseInt(existingExtra.quantity) || 1;
          const totalQuantity = newQuantity + existingQuantity;

          const newAmount = parseFloat(mappedExtra.amount) || 0;
          const existingAmount = parseFloat(existingExtra.amount) || 0;
          const totalAmount = newAmount + existingAmount;

          // Update the extra in our map
          mappedExtra.quantity = totalQuantity;
          mappedExtra.amount = totalAmount;



          // Preserve existing person data if available
          if (
            existingExtra.hasExtraPerson ||
            existingExtra.extraPersonQuantity > 0 ||
            existingExtra.extraPersonPrice > 0 ||
            existingExtra.extraPersonAmount > 0
          ) {

            mappedExtra.extraPersonQuantity = existingExtra.extraPersonQuantity;
            mappedExtra.extraPersonPrice = existingExtra.extraPersonPrice;
            mappedExtra.extraPersonAmount = existingExtra.extraPersonAmount;
            mappedExtra.extraPersonName =
              existingExtra.extraPersonName || "Personne supplémentaire";
            mappedExtra.hasExtraPerson = true;
          }

          // Update the map
          extrasMap.set(existingName, mappedExtra);
        } else {
          // For regular extras, preserve extra person data
          if (
            existingExtra.hasExtraPerson ||
            existingExtra.extraPersonQuantity > 0 ||
            existingExtra.extraPersonPrice > 0 ||
            existingExtra.extraPersonAmount > 0
          ) {


            // Copy person data
            mappedExtra.extraPersonQuantity = existingExtra.extraPersonQuantity;
            mappedExtra.extraPersonPrice = existingExtra.extraPersonPrice;
            mappedExtra.extraPersonAmount = existingExtra.extraPersonAmount;
            mappedExtra.extraPersonName =
              existingExtra.extraPersonName || "Personne supplémentaire";
            mappedExtra.hasExtraPerson = true;

            // Update the map
            extrasMap.set(existingName, mappedExtra);
          }
        }
      }
      // If this extra is not in our map yet, check if we should add it
      else {
        // Only include extras that are definitely wanted
        const name = (existingExtra.name || "").toLowerCase();
        const isWantedExtra =
          name.includes("formule") ||
          name.includes("essentiel") ||
          name.includes("détente") ||
          name.includes("gourmet") ||
          name.includes("romantique") ||
          name.includes("barbecue") ||
          name.includes("anniversaire") ||
          name.includes("petit-déjeuner") ||
          name.includes("raclette") ||
          name.includes("bouteille") ||
          name.includes("champagne") ||
          name.includes("spa") ||
          name.includes("massage") ||
          (name.includes("frais supplémentaires") &&
            name.includes("personnes"));

        if (isWantedExtra) {

          extrasMap.set(existingName, { ...existingExtra });
        } else {
          console.log(
            `⛔ Skipping extra from existing data (not in whitelist): ${existingName}`
          );
        }
      }
    });
  }

  // Convert the map to an array
  let mergedExtras = Array.from(extrasMap.values());

  // Special handling for Airbnb bookings
  if (portalName === "Airbnb") {
    // Special filtering for Airbnb bookings
    const filteredMergedExtras = mergedExtras.filter((extra) => {
      const name = (extra.name || "").toLowerCase();

      if (
        name.includes("cancellation") ||
        name.includes("commission") ||
        name.includes("pass_through") ||
        name.includes("linen_fee")
      ) {

        return false;
      }
      return true;
    });

    mergedExtras = filteredMergedExtras;
  }

  return mergedExtras;
}

/**
 * Calculates the total amount for extras
 * @param {Array} extras - Array of extras
 * @returns {number} - Total amount
 */
export function calculateExtrasTotal(extras) {
  return extras.reduce(
    (sum, extra) => sum + Math.abs(parseFloat(extra.amount) || 0),
    0
  );
}
