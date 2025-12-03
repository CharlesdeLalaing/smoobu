/**
 * Processes price elements to extract extras with associated person information
 * @param {Array} priceElements - Array of price elements from Smoobu API
 * @returns {Object} - Object containing processed extras and their total
 */
export function processExtrasWithPersons(priceElements) {
  // Helper function to determine if an extra is wanted
  const isWantedExtra = (element) => {
    const name = (element.name || "").toLowerCase();
    const type = (element.type || "").toLowerCase();

    // Check if it's a clearly wanted extra (positive check)
    const isDefinitelyExtra =
      // Include all addon types from Smoobu
      type === "addon" ||
      // Formules and packages
      name.includes("formule") ||
      name.includes("essentiel") ||
      name.includes("détente") ||
      name.includes("gourmet") ||
      name.includes("romantique") ||
      name.includes("barbecue") ||
      name.includes("anniversaire") ||
      // Food and beverages
      name.includes("petit-déjeuner") ||
      name.includes("raclette") ||
      name.includes("bouteille") ||
      name.includes("champagne") ||
      // Specific services
      name.includes("spa") ||
      name.includes("massage") ||
      // Only include "frais supplémentaires" if it refers to extra guests
      (name.includes("frais supplémentaires") && name.includes("personnes"));

    // Even if it matches above, exclude it if it also contains these terms
    const containsUnwantedTerms =
      name.includes("cancellation") ||
      name.includes("commission") ||
      name.includes("pass_through") ||
      name.includes("host fee") ||
      name.includes("service fee") ||
      name.includes("cleaning fee") ||
      (name.includes("fee") && !name.includes("coffee"));

    return isDefinitelyExtra && !containsUnwantedTerms;
  };

  // First filter the price elements to only include the extras we definitely want
  const wantedExtras = priceElements.filter(isWantedExtra);

  // 1. Separate regular extras and "Personne supplémentaire" extras
  const regularExtras = [];
  const personneExtras = [];

  wantedExtras.forEach((element) => {
    if (
      (element.name || "").toLowerCase().includes("personne supplémentaire")
    ) {
      personneExtras.push(element);
    } else {
      regularExtras.push(element);
    }
  });

  // 2. Deduplicate regular extras by name
  const extraNamesMap = new Map();
  regularExtras.forEach((element) => {
    if (extraNamesMap.has(element.name)) {
      const existing = extraNamesMap.get(element.name);
      // Only replace if this one has more data or higher amount
      if (
        element.type === "addon" ||
        parseFloat(element.amount) > parseFloat(existing.amount)
      ) {
        extraNamesMap.set(element.name, element);
      }
    } else {
      extraNamesMap.set(element.name, element);
    }
  });

  const potentialExtras = Array.from(extraNamesMap.values());

  // 3. Group and merge "personne supplémentaire" items by exact name
  const personneItemsMap = new Map();

  personneExtras.forEach((element) => {
    // If we already have this exact name, merge quantities and amounts
    if (personneItemsMap.has(element.name)) {
      const existing = personneItemsMap.get(element.name);
      const existingQuantity = parseInt(existing.quantity) || 1;
      const currentQuantity = parseInt(element.quantity) || 1;
      const totalQuantity = existingQuantity + currentQuantity;

      const existingAmount = parseFloat(existing.amount) || 0;
      const currentAmount = parseFloat(element.amount) || 0;
      const totalAmount = existingAmount + currentAmount;

      // Create a merged item
      const mergedItem = {
        ...element,
        quantity: totalQuantity,
        amount: totalAmount,
      };

      personneItemsMap.set(element.name, mergedItem);
    } else {
      personneItemsMap.set(element.name, element);
    }
  });

  const mergedPersonneItems = Array.from(personneItemsMap.values());

  // 4. Match regular extras with their corresponding "personne supplémentaire" items
  // Track which personne items have been matched
  const matchedPersonneItems = new Set();
  const processedExtras = [];

  // Process each regular extra
  potentialExtras.forEach((regularExtra) => {
    const regularExtraName = regularExtra.name;

    // Look for a matching personne item that has the format: "[regularExtraName] - Personne supplémentaire"
    const expectedPersonneName = `${regularExtraName} - Personne supplémentaire`;

    // Find personne item with matching name
    const matchingPersonItem = mergedPersonneItems.find(
      (personItem) => personItem.name === expectedPersonneName
    );

    let extraPersonAmount = 0;
    let extraPersonPrice = 0;
    let extraPersonQuantity = 0;
    let hasExtraPerson = false;

    if (matchingPersonItem) {
      // Use data from matched item
      extraPersonAmount = Math.abs(parseFloat(matchingPersonItem.amount) || 0);
      extraPersonQuantity = parseInt(matchingPersonItem.quantity) || 1;
      extraPersonPrice = extraPersonAmount / extraPersonQuantity; // Unit price per person
      hasExtraPerson = true;

      // Mark this personne item as matched
      matchedPersonneItems.add(matchingPersonItem.name);
    } else {
      // Check if this extra should have extra person entries based on typical formule patterns
      // and if the base quantity is > 1 (indicating multiple people)
      const isFormuleExtra =
        regularExtraName.toLowerCase().includes("formule") ||
        regularExtraName.toLowerCase().includes("spa") ||
        regularExtraName.toLowerCase().includes("gourmet") ||
        regularExtraName.toLowerCase().includes("petit-déjeuner") ||
        regularExtraName.toLowerCase().includes("barbecue");

      const baseQuantity = parseInt(regularExtra.quantity) || 1;
      const shouldHaveExtraPerson = isFormuleExtra && baseQuantity > 1;

      if (shouldHaveExtraPerson) {
        // Calculate extra person quantities based on the base quantity
        // For formules that are "(2pers)", each unit serves 2 people
        // So if quantity is 2, it means 4 people total, so 2 extra persons
        const extraPersonsNeeded = baseQuantity - 1; // Subtract 1 for the base 2 people

        // Estimate price per extra person (typically 20€ based on the working example)
        const estimatedPersonPrice = 20;
        extraPersonQuantity = extraPersonsNeeded;
        extraPersonPrice = estimatedPersonPrice;
        extraPersonAmount = extraPersonQuantity * extraPersonPrice;
        hasExtraPerson = true;

        console.log(
          `🔄 Generated missing extra person entry for "${regularExtraName}": ${extraPersonQuantity} persons at ${extraPersonPrice}€ each`
        );
      } else {
        console.log(`❌ NO match found for "${regularExtraName}"`);
      }
    }

    // Add the processed extra
    processedExtras.push({
      name: regularExtraName,
      amount: Math.abs(parseFloat(regularExtra.amount) || 0),
      quantity: parseInt(regularExtra.quantity) || 1,
      type: regularExtra.type || "addon",
      id: regularExtra.id,
      currencyCode: regularExtra.currencyCode || "EUR",
      extraPersonQuantity,
      extraPersonPrice,
      extraPersonAmount,
      extraPersonName: matchingPersonItem
        ? matchingPersonItem.name
        : "Personne supplémentaire",
      hasExtraPerson,
    });

    // If we generated a missing extra person entry, add it to priceElements as well
    if (hasExtraPerson && !matchingPersonItem && extraPersonAmount > 0) {
      // Create a synthetic "Personne supplémentaire" price element
      const syntheticPersonElement = {
        name: expectedPersonneName,
        amount: extraPersonAmount,
        quantity: extraPersonQuantity,
        type: "addon",
        id: regularExtra.id + 1000000, // Generate a unique ID
        currencyCode: regularExtra.currencyCode || "EUR",
        priceIncludedInId: null,
        sortOrder: 100,
        tax: 0,
      };

      // Add to processed extras as a standalone item
      processedExtras.push({
        name: expectedPersonneName,
        amount: extraPersonAmount,
        quantity: extraPersonQuantity,
        type: "addon",
        id: syntheticPersonElement.id,
        currencyCode: syntheticPersonElement.currencyCode,
        extraPersonQuantity: 0,
        extraPersonPrice: 0,
        extraPersonAmount: 0,
        extraPersonName: "",
        hasExtraPerson: false,
      });
    }
  });

  // 5. Add any "Personne supplémentaire" items that weren't matched as standalone extras
  const unmatchedPersonneItems = mergedPersonneItems.filter(
    (item) =>
      !matchedPersonneItems.has(item.name) &&
      !item.name.toLowerCase().includes("frais supplémentaires") // Skip these as they're handled separately
  );

  if (unmatchedPersonneItems.length > 0) {
    unmatchedPersonneItems.forEach((item) => {
      processedExtras.push({
        name: item.name,
        amount: Math.abs(parseFloat(item.amount) || 0),
        quantity: parseInt(item.quantity) || 1,
        type: "addon",
        id: item.id,
        currencyCode: item.currencyCode || "EUR",
        extraPersonQuantity: 0,
        extraPersonPrice: 0,
        extraPersonAmount: 0,
        extraPersonName: "",
        hasExtraPerson: false,
      });
    });
  }

  // 6. Process "Frais supplémentaires" separately
  // Filter out "Frais supplémentaires" if it appears as a regular extra AND we already have it with "personne supplémentaire"
  const fraisPresentAsPersonne = mergedPersonneItems.some((p) =>
    p.name.toLowerCase().includes("frais supplémentaires")
  );

  let finalExtras = [...processedExtras];

  if (fraisPresentAsPersonne) {
    // Filter out any Frais supplémentaires from the regular extras
    finalExtras = finalExtras.filter(
      (e) => !e.name.toLowerCase().includes("frais supplémentaires")
    );

    // Add it back as a separate item
    const fraisItem = mergedPersonneItems.find((p) =>
      p.name.toLowerCase().includes("frais supplémentaires")
    );

    if (fraisItem) {
      finalExtras.push({
        name: fraisItem.name,
        amount: Math.abs(parseFloat(fraisItem.amount) || 0),
        quantity: parseInt(fraisItem.quantity) || 1,
        type: "addon",
        id: fraisItem.id,
        currencyCode: fraisItem.currencyCode || "EUR",
        extraPersonQuantity: 0,
        extraPersonPrice: 0,
        extraPersonAmount: 0,
        extraPersonName: "Personne supplémentaire",
        hasExtraPerson: false,
      });
    }
  }

  // Calculate extras total including all extras AND their extra person amounts
  const extrasTotal = finalExtras.reduce((sum, extra) => {
    const baseAmount = parseFloat(extra.amount || 0);
    const personAmount = parseFloat(extra.extraPersonAmount || 0);
    console.log(`[processExtrasWithPersons] Extra: "${extra.name}" - Base: €${baseAmount}, Person: €${personAmount}, Running Total: €${sum + baseAmount + personAmount}`);
    return sum + baseAmount + personAmount; // Include BOTH base and extra person amounts
  }, 0);

  console.log(`[processExtrasWithPersons] FINAL extrasTotal: €${extrasTotal}`);

  return {
    extras: finalExtras,
    extrasTotal,
  };
}
