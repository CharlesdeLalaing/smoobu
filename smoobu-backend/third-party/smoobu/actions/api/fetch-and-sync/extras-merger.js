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
 * Merges existing extras with new extras, preserving person data
 * @param {Object} existingData - Existing booking data
 * @param {Array} newExtras - New extras from API
 * @param {string} portalName - Portal name for special handling
 * @returns {Array} - Merged extras
 */
export function mergeExtras(existingData, newExtras, portalName) {
  let mergedExtras = [];

  // Process each new extra
  newExtras.forEach((newExtra) => {
    // Skip unwanted extras
    if (isUnwantedExtra(newExtra.name)) {
      console.log(`⛔ Skipping unwanted extra from API: ${newExtra.name}`);
      return;
    }

    // Check if this extra exists in the existing data
    const existingExtra = existingData.extras?.find(
      (e) => e.name === newExtra.name
    );

    if (
      existingExtra &&
      (existingExtra.hasExtraPerson ||
        existingExtra.extraPersonQuantity > 0 ||
        existingExtra.extraPersonPrice > 0 ||
        existingExtra.extraPersonAmount > 0)
    ) {
      // Use the existing extra person data
      console.log(`Preserving extra person data for ${existingExtra.name}`);
      mergedExtras.push({
        ...newExtra,
        extraPersonQuantity: existingExtra.extraPersonQuantity,
        extraPersonPrice: existingExtra.extraPersonPrice,
        extraPersonAmount: existingExtra.extraPersonAmount,
        extraPersonName:
          existingExtra.extraPersonName || "Personne supplémentaire",
        hasExtraPerson: true,
      });
    } else {
      // Use the new extra as is
      mergedExtras.push(newExtra);
    }
  });

  // Add existing extras not in new data
  if (existingData.extras && Array.isArray(existingData.extras)) {
    const newExtraNames = new Set(mergedExtras.map((e) => e.name));

    existingData.extras.forEach((existingExtra) => {
      // Skip if already in list or unwanted
      if (
        newExtraNames.has(existingExtra.name) ||
        isUnwantedExtra(existingExtra.name)
      ) {
        if (isUnwantedExtra(existingExtra.name)) {
          console.log(
            `⛔ Skipping unwanted extra from existing data: ${existingExtra.name}`
          );
        }
        return;
      }

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
        (name.includes("frais supplémentaires") && name.includes("personnes"));

      if (isWantedExtra) {
        console.log(
          `✅ Adding wanted extra from existing data: ${existingExtra.name}`
        );
        mergedExtras.push(existingExtra);
      } else {
        console.log(
          `⛔ Skipping extra from existing data (not in whitelist): ${existingExtra.name}`
        );
      }
    });
  }

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
        console.log(`🔴 Removing unwanted Airbnb extra: ${extra.name}`);
        return false;
      }
      return true;
    });

    console.log(
      "Filtered mergedExtras from:",
      mergedExtras.length,
      "to:",
      filteredMergedExtras.length
    );
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
