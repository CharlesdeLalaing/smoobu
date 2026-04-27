// config/config.js
import * as dotenv from "dotenv";
dotenv.config();

export const roomNames = {
  1946282: "Le Dôme des Libellules",
  2565753: "La Cabane du Chêne",
  1644643: "La Bulle du Ruisseau",
  1946279: "Le Moulin",
  1946276: "La Chambre de Blé",
  1946270: "Le Logis",
};

export const portalNames = {
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

export const discountSettings = {
  1946282: {
    cleaningFee: 0,
    prepayment: 0,
    minDaysBetweenBookingAndArrival: 1,
    extraGuestsPerNight: 20,
    startingAtGuest: 2,
    maxGuests: 4,
    extraChildPerNight: 20,
    lengthOfStayDiscount: { minNights: 0, discountPercentage: 0 },
  },
  1644643: {
    cleaningFee: 0,
    prepayment: 0,
    minDaysBetweenBookingAndArrival: 1,
    extraGuestsPerNight: 0,
    startingAtGuest: 2,
    maxGuests: 2,
    extraChildPerNight: 0,
    lengthOfStayDiscount: { minNights: 0, discountPercentage: 0 },
  },
  1946279: {
    cleaningFee: 0,
    prepayment: 0,
    minDaysBetweenBookingAndArrival: 1,
    extraGuestsPerNight: 20,
    startingAtGuest: 2,
    maxGuests: 4,
    extraChildPerNight: 20,
    lengthOfStayDiscount: { minNights: 2, discountPercentage: 40 },
  },
  1946276: {
    cleaningFee: 0,
    prepayment: 0,
    minDaysBetweenBookingAndArrival: 1,
    extraGuestsPerNight: 20,
    startingAtGuest: 2,
    maxGuests: 4,
    extraChildPerNight: 20,
    lengthOfStayDiscount: { minNights: 2, discountPercentage: 40 },
  },
  1946270: {
    cleaningFee: 0,
    prepayment: 0,
    minDaysBetweenBookingAndArrival: 1,
    extraGuestsPerNight: 20,
    startingAtGuest: 4,
    maxGuests: 8,
    extraChildPerNight: 20,
    lengthOfStayDiscount: { minNights: 3, discountPercentage: 30 },
  },
  2565753: {
    // Cabane du chêne
    cleaningFee: 0,
    prepayment: 0,
    minDaysBetweenBookingAndArrival: 1,
    extraGuestsPerNight: 0, // No extra fees
    startingAtGuest: 2,
    maxGuests: 2,
    extraChildPerNight: 0,
    lengthOfStayDiscount: {
      minNights: 0,
      discountPercentage: 0,
    },
  },
};

export const extrasFrenchNames = {
  // Category Titles (from nameKey in extraCategoriesRaw)
  "extras.categories.packs": "Nos Paquets Thématiques",
  "extras.categories.formulesRepas": "Nos Formules Repas",
  "extras.categories.spa": "Notre Espace Bien-être",
  "extras.categories.formulesDecouverte": "Nos Formules Découverte",
  "extras.categories.meals": "Plats Traiteur de la Ferme de Bossimé",
  "extras.categories.boissons": "Notre Sélection de Boissons",

  // Pack Names
  "extras.packs.essential.name": "L'essentiel (pour 2)",
  "extras.packs.relaxGourmet.name": "Le détente gourmet (pour 2)",
  "extras.packs.racletteRelax.name": "La raclette en détente (pour 2)",
  "extras.packs.romanticGourmet.name": "Le romantique gourmet (pour 2)",
  "extras.packs.racletteRomantic.name": "La raclette romantique (pour 2)",
  "extras.packs.bbqRelax.name": "Le barbecue détente (pour 2)",
  "extras.packs.bbqRomantic.name": "Le romantique barbecue (pour 2)",

  // Formule Découverte Names
  "extras.formulesDecouverte.passion.name": "Formule passion (pour 2)",
  "extras.formulesDecouverte.birthday.name": "Formule anniversaire (pour 2)",

  // SPA Names
  "extras.spa.basic.name": "Formule SPA (2 pers)",
  "extras.spa.withBottle.name": "Formule SPA + bouteille (2 pers)",

  // Meal Names (Repas Gourmart)
  "extras.meals.pouletTikkaMasala.name": "Poulet Tikka Massala",
  "extras.meals.boulettesSauceTomate.name": "Boulettes sauce tomate",
  "extras.meals.linguinesAuSaumon.name": "Linguines au saumon fumé",
  "extras.meals.risottoALaTartufata.name": "Risotto à la tartufata",

  // Meal Formula Names
  "extras.formulesRepas.breakfast.name": "Formule petit-déjeuner (2 pers)",
  "extras.formulesRepas.gourmet.name": "Formule gourmet (2 pers)",
  "extras.formulesRepas.raclette.name": "Formule raclette (2 pers)",
  "extras.formulesRepas.bbq.name": "Formule barbecue (2 pers)",
  "extras.formulesRepas.apero.name": "Formule planche apéro (2 pers)",

  // Drink Item Names (using the "drinkNames." prefix as an example convention)
  "drinkNames.brutBioul": "Brut de Bioul",
  "drinkNames.cortilBarco": "Cortil Barco (rouge)",
  "drinkNames.terreCharlot": "Terre Charlot (blanc)",
  "drinkNames.bruneCondroz": "Brune de Leignion",
  "drinkNames.ambreeCondroz": "Ambrée à la Cardamome",
  "drinkNames.tripleCondroz": "Triple de Leignion",
  "drinkNames.blancheCondroz": "Blanche à la Bergamote",
  "drinkNames.blondeCereales": "Blonde aux 4 Céréales",
  "drinkNames.appleJuice": "Jus de pomme « Pom d'Happy »",
  "drinkNames.ritchieLemonRasp": "Ritchie Citron/Framboise",
  "drinkNames.ritchieOrangeVan": "Ritchie Orange/Vanille",
  "drinkNames.ritchieCola": "Ritchie Cola",
  "drinkNames.ritchieColaZero": "Ritchie Cola Zéro",

  // Drink Offer Titles (from DRINK_OFFER_CONFIG_RAW.titleKey)
  "extras.drinks.wineOfferTitle": "Choix de Vin Inclus (1 bouteille)",
  "extras.drinks.softBeerOfferTitle": "Choix de Boissons Incluses",

  // Specific drink labels for choices (from DRINK_OFFER_CONFIG_RAW.drinks[].nameKey)
  // These might overlap with drinkNames.* if you use the same key, which is fine.
  "extras.drinks.cortilBarcoLabel": "Cortil Barco (rouge)", // Often same as drinkNames.cortilBarco
  "extras.drinks.terreCharlotLabel": "Terre Charlot (blanc)", // Often same as drinkNames.terreCharlot

  // Other drink-related texts
  "priceDetails.nonAlcoholicChosenLater":
    "Option non-alcoolisée (choix ultérieur avec l'hôte)",
  "extras.drinks.chooseNonAlcoholicLater":
    "Préfère une boisson non-alcoolisée (à voir avec l'hôte)",

  // General / UI
  "extras.additionalPerson": "Personne supplémentaire",
  "priceDetails.promoCode.generic": "Code Promo",
  "priceDetails.giftVoucher": "Chèque Cadeau",
  "priceDetails.longStayDiscount": "Réduction long séjour",
};