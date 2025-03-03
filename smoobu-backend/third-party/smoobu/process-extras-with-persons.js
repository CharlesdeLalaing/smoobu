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

  console.log(
    "Filtered to only wanted extras:",
    wantedExtras.map((e) => e.name)
  );

  // 1. Deduplicate by name
  const extraNamesMap = new Map();
  wantedExtras.forEach((element) => {
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
  console.log(
    "Deduplicated extras:",
    potentialExtras.map((e) => e.name)
  );

  // 2. Identify "personne supplémentaire" items
  const personneItems = priceElements.filter((element) => {
    const name = (element.name || "").toLowerCase();
    return name.includes("personne supplémentaire");
  });

  console.log(
    "Personne supplémentaire items:",
    personneItems.map((e) => e.name)
  );

  // 3. Process each extra and try to match with personne supplémentaire items
  const processedExtras = potentialExtras.map((extra) => {
    const extraName = (extra.name || "").toLowerCase();

    // Try to find a matching personne supplémentaire item for this extra
    const matchingPersonItem = personneItems.find((person) => {
      const personName = (person.name || "").toLowerCase();

      // Check if the person item references this extra
      // First strip out qualifiers from the extra name
      const baseExtraName = extraName
        .replace(" (pour 2)", "")
        .replace(" (2 pers)", "")
        .replace(" (pour 2 personnes)", "");

      // More aggressive matching - look for significant words in both names
      const extraWords = baseExtraName.split(" ");
      const significantExtraWords = extraWords.filter(
        (word) =>
          word.length > 3 &&
          !["pour", "avec", "sans", "dans", "les"].includes(word)
      );

      // Check if personne item contains these significant words
      const hasMatch = significantExtraWords.some((word) =>
        personName.includes(word)
      );

      return hasMatch;
    });

    let extraPersonAmount = 0;
    let extraPersonPrice = 0;
    let extraPersonQuantity = 0;
    let hasExtraPerson = false;

    if (matchingPersonItem) {
      // Use data from matched item
      extraPersonAmount = Math.abs(parseFloat(matchingPersonItem.amount) || 0);
      extraPersonQuantity = parseInt(matchingPersonItem.quantity) || 1;
      extraPersonPrice = extraPersonAmount / extraPersonQuantity;
      hasExtraPerson = true;

      console.log(
        `Found match for "${extra.name}": "${matchingPersonItem.name}" (${extraPersonAmount}€)`
      );
    }

    return {
      name: extra.name || "Extra",
      amount: Math.abs(parseFloat(extra.amount) || 0),
      quantity: parseInt(extra.quantity) || 1,
      type: extra.type || "addon",
      id: extra.id,
      currencyCode: extra.currencyCode || "EUR",
      extraPersonQuantity,
      extraPersonPrice,
      extraPersonAmount,
      extraPersonName: matchingPersonItem
        ? matchingPersonItem.name
        : "Personne supplémentaire",
      hasExtraPerson,
    };
  });

  // Filter out "Frais supplémentaires" if it appears as a regular extra AND we already have it with "personne supplémentaire"
  const fraisPresentAsPersonne = personneItems.some((p) =>
    p.name.toLowerCase().includes("frais supplémentaires")
  );

  const finalExtras = fraisPresentAsPersonne
    ? processedExtras.filter(
        (e) => !e.name.toLowerCase().includes("frais supplémentaires")
      )
    : processedExtras;

  // If we filtered out "Frais supplémentaires", add it back as a separate item
  if (fraisPresentAsPersonne) {
    const fraisItem = personneItems.find((p) =>
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

      console.log(
        `Added "Frais supplémentaires" as a separate item (${fraisItem.amount}€)`
      );
    }
  }

  // Calculate extras total using only the base amount
  const extrasTotal = finalExtras.reduce((sum, extra) => {
    return sum + parseFloat(extra.amount || 0); // Only use base amount, not extraPersonAmount
  }, 0);

  return {
    extras: finalExtras,
    extrasTotal,
  };
}
