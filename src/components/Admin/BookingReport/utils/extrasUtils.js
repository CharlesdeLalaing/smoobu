export function mergeAndSortExtras(extras) {
  if (!extras || !Array.isArray(extras)) return [];

  // Create a map to track extras by name for deduplication
  const mergedExtrasMap = new Map();

  // First pass: merge duplicates by combining their amounts and quantities
  extras.forEach((extra) => {
    if (!extra.name) return;

    // Clean up the name to handle slight variations
    const cleanName = extra.name.trim();

    if (mergedExtrasMap.has(cleanName)) {
      // We found a duplicate - merge it with the existing one
      const existingExtra = mergedExtrasMap.get(cleanName);

      // Add the amounts
      existingExtra.amount =
        parseFloat(existingExtra.amount || 0) + parseFloat(extra.amount || 0);

      // Add the quantities
      existingExtra.quantity =
        parseInt(existingExtra.quantity || 1) + parseInt(extra.quantity || 1);

      // Update the map
      mergedExtrasMap.set(cleanName, existingExtra);
    } else {
      // New extra - add it to the map
      mergedExtrasMap.set(cleanName, { ...extra });
    }
  });

  // Get the merged extras
  let mergedExtras = Array.from(mergedExtrasMap.values());

  // Now sort them using the same logic as before
  return sortExtras(mergedExtras);
}

/**
 * Sorts extras to keep related items together
 * @param {Array} extras - Array of extras
 * @returns {Array} - Sorted array of extras
 */
export function sortExtras(extras) {
  if (!extras || !Array.isArray(extras)) return [];

  // Create a map to group related extras
  const extrasGroups = new Map();
  const mainExtras = [];
  const personExtras = [];

  // First pass: separate main extras and person extras
  extras.forEach((extra) => {
    if (!extra.name) return;

    const isPersonExtra = extra.name.includes("Personne supplémentaire");

    if (isPersonExtra) {
      personExtras.push(extra);
    } else {
      mainExtras.push(extra);

      // Initialize the group for this main extra
      const baseName = extra.name.split(" - ")[0].trim();
      if (!extrasGroups.has(baseName)) {
        extrasGroups.set(baseName, []);
      }
    }
  });

  // Second pass: assign person extras to their parent groups
  personExtras.forEach((personExtra) => {
    // Extract the parent name from the person extra name
    let parentName = "";

    if (personExtra.name.includes(" - ")) {
      // If the name has a format like "Parent Name - Personne supplémentaire"
      parentName = personExtra.name.split(" - ")[0].trim();
    }

    // Try to find a matching parent group
    let matchedGroup = null;
    
    // First, try exact match
    if (parentName && extrasGroups.has(parentName)) {
      matchedGroup = parentName;
    } else {
      // If no exact match, try fuzzy matching by normalizing names
      const normalizedParentName = parentName.toLowerCase()
        .replace(/\s+/g, ' ')
        .replace(/\((\d+)\s*pers?\)/g, '($1pers)') // Normalize (2 pers) to (2pers)
        .trim();
      
      // Look for a similar main extra
      for (const [groupName] of extrasGroups) {
        const normalizedGroupName = groupName.toLowerCase()
          .replace(/\s+/g, ' ')
          .replace(/\((\d+)\s*pers?\)/g, '($1pers)') // Normalize (2pers) to (2pers)
          .trim();
        
        if (normalizedParentName === normalizedGroupName) {
          matchedGroup = groupName;
          break;
        }
      }
    }

    // If we found a parent and it exists in our groups, add this person extra to that group
    if (matchedGroup) {
      extrasGroups.get(matchedGroup).push(personExtra);
    } else {
      // If we can't determine the parent, handle it as an orphan
      // Create a fallback group
      if (!extrasGroups.has("Autres")) {
        extrasGroups.set("Autres", []);
      }
      extrasGroups.get("Autres").push(personExtra);
      console.log(`⚠️ Could not match person extra "${personExtra.name}" to any main extra. Available groups:`, Array.from(extrasGroups.keys()));
    }
  });

  // Sort main extras by name for consistency
  mainExtras.sort((a, b) => {
    // Special case: always put "Frais supplémentaires" at the top
    if (a.name.includes("Frais supplémentaires")) return -1;
    if (b.name.includes("Frais supplémentaires")) return 1;

    return a.name.localeCompare(b.name);
  });

  // Build the final sorted array
  const result = [];

  // Add each main extra followed by its related person extras
  mainExtras.forEach((mainExtra) => {
    result.push(mainExtra);

    const baseName = mainExtra.name.split(" - ")[0].trim();
    const relatedPersonExtras = extrasGroups.get(baseName) || [];

    // Sort related person extras by name if there are multiple
    relatedPersonExtras.sort((a, b) => a.name.localeCompare(b.name));

    // Add all related person extras
    relatedPersonExtras.forEach((personExtra) => {
      result.push(personExtra);
    });
  });

  // Add any orphaned extras from the "Autres" group
  const orphans = extrasGroups.get("Autres") || [];
  orphans.forEach((orphan) => {
    result.push(orphan);
  });

  return result;
}


export function getCleanExtrasFromPriceElements(priceElements, portalName) {
  if (!priceElements || !Array.isArray(priceElements)) return [];

  // First, identify if we have formulas with quantities > 1
  // These should NOT also have separate extra person charges
  // BUT we must exclude the extra person charges themselves from this check!
  const formulasWithMultipleQuantities = new Set();

  priceElements.forEach(el => {
    if (el && el.name && el.quantity > 1) {
      // Skip if this is already an extra person charge (it should have its own quantity)
      if (el.name.includes("Personne supplémentaire") || el.name.includes("personne supplémentaire")) {
        return; // Don't add extra person charges to the set
      }
      // Extract the base formula name
      const baseName = el.name.split(" - ")[0].trim();
      formulasWithMultipleQuantities.add(baseName.toLowerCase());
    }
  });

  // Define unwanted extras patterns
  const unwantedPatterns = [
    "cancellation",
    "Cancellation",
    "pass_through",
    "PASS_THROUGH",
    "service fee",
    "Service Fee",
    "host fee",
    "Host Fee",
    "guest fee",
    "Guest Fee",
    "cleaning fee",
    "Cleaning Fee",
    "LINEN_FEE",
    "linen_fee",
    "Base Price",
    "base_price",
    "Commission",
    "commission",
    "Tax",
    "tax",
    "VAT",
    "vat",
  ];

  // Is this an Airbnb booking?
  const isAirbnb = portalName === "Airbnb";

  // Only include relevant price elements
  const relevantElements = priceElements.filter((el) => {
    if (!el || !el.amount || !el.name) return false;

    // Check if this is an extra person charge for a formula that already has quantity > 1
    // If so, skip it to avoid duplication
    if (el.name.includes("Personne supplémentaire") || el.name.includes("personne supplémentaire")) {
      const baseName = el.name.split(" - ")[0].trim().toLowerCase();
      if (formulasWithMultipleQuantities.has(baseName)) {
        // console.log(`⚠️ Skipping duplicate extra person charge: "${el.name}" because main formula has quantity > 1`);
        return false;
      }
    }

    // console.log(`🔍 Filtering element: "${el.name}" (amount: ${el.amount})`);

    // For Airbnb, be very selective
    if (isAirbnb) {
      // Check if it's a valid drink for Airbnb
      const isValidAirbnbDrink = el.name.includes("Brut de Bioul") ||
                                el.name.includes("Cortil Barco") ||
                                el.name.includes("Terre Charlot") ||
                                el.name.includes("Brune du Condroz") ||
                                el.name.includes("Ambrée du Condroz") ||
                                el.name.includes("Triple du Condroz") ||
                                el.name.includes("Blanche du Condroz") ||
                                el.name.includes("Jus de pomme « Pom d'Happy »") ||
                                el.name.includes("Ritchie Citron/Framboise") ||
                                el.name.includes("Ritchie Orange/Vanille") ||
                                el.name.includes("Ritchie Cola") ||
                                el.name.includes("Ritchie Cola Zéro") ||
                                el.name.includes("Houblonde Triple");

      // Only allow formules, specific extras, and drinks
      return (
        el.name.toLowerCase().includes("formule") ||
        el.name.toLowerCase().includes("anniversaire") ||
        el.name.toLowerCase().includes("détente") ||
        el.name.toLowerCase().includes("gourmet") ||
        el.name.toLowerCase().includes("essentiel") ||
        el.name.toLowerCase().includes("romantique") ||
        isValidAirbnbDrink
      );
    } else {
      // For non-Airbnb, filter out unwanted patterns but include drinks and valid extras
      const isValidDrink = el.name.includes("Brut de Bioul") ||
                          el.name.includes("Cortil Barco") ||
                          el.name.includes("Terre Charlot") ||
                          el.name.includes("Brune du Condroz") ||
                          el.name.includes("Ambrée du Condroz") ||
                          el.name.includes("Triple du Condroz") ||
                          el.name.includes("Blanche du Condroz") ||
                          el.name.includes("Jus de pomme « Pom d'Happy »") ||
                          el.name.includes("Ritchie Citron/Framboise") ||
                          el.name.includes("Ritchie Orange/Vanille") ||
                          el.name.includes("Ritchie Cola") ||
                          el.name.includes("Ritchie Cola Zéro") ||
                          el.name.includes("Houblonde Triple");

      const isValidExtra = el.name.includes("formule") ||
                          el.name.includes("Formule") ||
                          el.name.includes("détente") ||
                          el.name.includes("gourmet") ||
                          el.name.includes("essentiel") ||
                          el.name.includes("romantique") ||
                          el.name.includes("barbecue") ||
                          el.name.includes("anniversaire") ||
                          el.name.includes("petit-déjeuner") ||
                          el.name.includes("raclette") ||
                          el.name.includes("spa") ||
                          el.name.includes("SPA") ||
                          el.name.includes("massage") ||
                          el.name.includes("Personne supplémentaire") ||
                          el.name.includes("Frais supplémentaires") ||
                          el.name.includes("frais supplémentaires") ||
                          el.name.includes("Frais voyageurs") ||
                          el.name.includes("frais voyageurs") ||
                          el.name.includes("Boulettes") ||
                          el.name.includes("Waterzooi") ||
                          el.name.includes("Chili") ||
                          el.name.includes("Velouté") ||
                          el.name.includes("Linguines") ||
                          el.name.includes("Risotto") ||
                          el.name.includes("Poulet");

      const shouldInclude = el.amount > 0 &&
        !el.name.includes("Prix de base") &&
        !el.name.includes("Base price") &&
        !el.name.includes("Code promo") &&
        !el.name.includes("Réduction") &&
        !el.name.includes("Frais voyageurs") &&
        !el.name.includes("Frais de personnes supplémentaires") &&
        !unwantedPatterns.some((pattern) => el.name.includes(pattern)) &&
        (isValidDrink || isValidExtra);
      
      return shouldInclude;
    }
  });

  // Use a Map for deduplication
  const uniqueExtras = new Map();

  // Process all extras
  relevantElements.forEach((el) => {
    // Create a clean key for the map
    const cleanName = el.name.trim();

    // If we already have this extra in our map
    if (uniqueExtras.has(cleanName)) {
      // For "Personne supplémentaire" extras, merge quantities and amounts
      if (cleanName.includes("Personne supplémentaire")) {
        const existingExtra = uniqueExtras.get(cleanName);

        // Calculate total quantity and amount
        const existingQuantity = parseInt(existingExtra.quantity) || 1;
        const currentQuantity = parseInt(el.quantity) || 1;
        const totalQuantity = existingQuantity + currentQuantity;

        const existingAmount = parseFloat(existingExtra.amount) || 0;
        const currentAmount = parseFloat(el.amount) || 0;
        const totalAmount = existingAmount + currentAmount;

        // Update the existing extra
        existingExtra.quantity = totalQuantity;
        existingExtra.amount = totalAmount;

        // Update the map
        uniqueExtras.set(cleanName, existingExtra);
      }
      // For other extras, only replace if this one has more data
      else if (
        parseFloat(el.amount) > parseFloat(uniqueExtras.get(cleanName).amount)
      ) {
        uniqueExtras.set(cleanName, {
          name: cleanName,
          amount: parseFloat(el.amount) || 0,
          quantity: parseInt(el.quantity) || 1,
          id: el.id,
        });
      }
    }
    // If this is a new extra, add it to the map
    else {
      uniqueExtras.set(cleanName, {
        name: cleanName,
        amount: parseFloat(el.amount) || 0,
        quantity: parseInt(el.quantity) || 1,
        id: el.id,
      });
    }
  });

  // Convert Map values to array
  const result = Array.from(uniqueExtras.values());

  // Special handling for duplicate "Frais supplémentaires"
  const fraisElements = result.filter((e) =>
    e.name.includes("Frais supplémentaires")
  );
  if (fraisElements.length > 1) {
    // Keep only the first one
    const toKeep = fraisElements[0];
    return result.filter(
      (e) => !e.name.includes("Frais supplémentaires") || e === toKeep
    );
  }

  return result;
}

export function calculateBookingTotal(booking) {
  // Check if this is an Airbnb or Booking.com booking
  const portalName =
    booking.portalName || booking.channelName || booking.portal;
  const isAirbnb = portalName === "Airbnb";
  const isBookingCom = portalName === "Booking.com";

  // Get price elements if available
  const priceElements = booking.priceDetails?.priceElements || [];

  // Calculate room price components
  let basePrice = parseFloat(
    booking.priceDetails?.basePrice || booking.basePrice || 0
  );
  let linenFee = parseFloat(
    booking.priceDetails?.linenFee || booking.linenFee || 0
  );
  let longStayDiscount = parseFloat(
    booking.priceDetails?.longStayDiscount || 0
  );
  let couponDiscount = parseFloat(
    booking.couponApplied?.discount || // 1. Check the modern, correct structure first.
      booking.priceDetails?.couponDiscount || // 2. Fallback for older data.
      booking.priceDetails?.promoCode?.amount || // 3. Fallback for other legacy data.
      0 // 4. Default to zero if no discount is found.
  );
  let taxeDeSejour = 0;

  // For Airbnb, handle different price calculation
  if (isAirbnb && priceElements.length > 0) {
    // Try to find the base price element
    const basePriceElement = priceElements.find(
      (el) =>
        el && el.name && (el.name === "Base Price" || el.name === "base_price")
    );

    if (basePriceElement) {
      basePrice = parseFloat(basePriceElement.amount) || 0;
    }

    // For Airbnb, reset other components that might not apply
    longStayDiscount = 0;
    couponDiscount = 0;
  } 
  // For Booking.com, handle taxe de séjour specially
  else if (isBookingCom) {
    // Look for taxe de séjour in priceElements
    const taxeElement = priceElements.find(
      (el) => el && el.name && el.name.toLowerCase().includes("taxe de séjour")
    );
    
    if (taxeElement) {
      taxeDeSejour = parseFloat(taxeElement.amount) || 0;
    }
  }

  // Calculate room subtotal
  let roomTotal = basePrice + linenFee - longStayDiscount - couponDiscount;
  
  // For Booking.com, include taxe de séjour in the room total
  if (isBookingCom) {
    roomTotal += taxeDeSejour;
  }

  // Get clean extras
  let displayExtras = [];

  // If we have price elements, use those for a consistent display
  if (priceElements.length > 0) {
    displayExtras = getCleanExtrasFromPriceElements(priceElements, portalName);
  }
  // Otherwise fall back to the extras array
  else if (booking.extras?.length > 0) {
    displayExtras = booking.extras;
  }

  // For Booking.com, remove TVA and taxe de séjour from extras since they're in the room price
  if (isBookingCom) {
    displayExtras = displayExtras.filter(
      (extra) => 
        !extra.name.includes("TVA") && 
        !extra.name.toLowerCase().includes("taxe de séjour")
    );
  }

  // Merge duplicate extras
  const mergedExtras = mergeAndSortExtras(displayExtras);

  // Calculate extras total
  const extrasTotal = mergedExtras.reduce(
    (sum, extra) => sum + parseFloat(extra.amount || 0),
    0
  );

  // Calculate total price
  return roomTotal + extrasTotal;
}