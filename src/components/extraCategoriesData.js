// src/config/extraCategoriesData.js

// NO ACTUAL IMAGE IMPORTS HERE (e.g., import essentiel from '...')

export const extraCategoriesRaw = {
  packs: {
    nameKey: "extras.categories.packs",
    items: [
      {
        id: "packEssentiel",
        name: "extras.packs.essential.name",
        descriptionKey: "extras.packs.essential.description",
        price: 85,
        extraPersonPrice: 20,
        imageIdentifier: "essentiel", // Use identifier
        typeKey: "extras.types.pack",
      },
      {
        id: "packDetenteGourmet",
        name: "extras.packs.relaxGourmet.name",
        descriptionKey: "extras.packs.relaxGourmet.description",
        price: 150,
        extraPersonPrice: 40,
        imageIdentifier: "detente",
        typeKey: "extras.types.pack",
      },
      {
        id: "packRomantiqueGourmet",
        name: "extras.packs.romanticGourmet.name",
        descriptionKey: "extras.packs.romanticGourmet.description",
        price: 170,
        extraPersonPrice: 40,
        imageIdentifier: "romantiquegourmet",
        typeKey: "extras.types.pack",
      },
      {
        id: "packRacletteDetente",
        name: "extras.packs.racletteRelax.name",
        descriptionKey: "extras.packs.racletteRelax.description",
        price: 150,
        extraPersonPrice: 40,
        imageIdentifier: "raclettedetente",
        typeKey: "extras.types.pack",
      },
      {
        id: "packRacletteRomantique",
        name: "extras.packs.racletteRomantic.name",
        descriptionKey: "extras.packs.racletteRomantic.description",
        price: 170,
        extraPersonPrice: 40,
        imageIdentifier: "racletteromantique",
        typeKey: "extras.types.pack",
      },
      {
        id: "packBbqDetente",
        name: "extras.packs.bbqRelax.name",
        descriptionKey: "extras.packs.bbqRelax.description",
        price: 150,
        extraPersonPrice: 40,
        imageIdentifier: "barbecuedetente",
        typeKey: "extras.types.pack",
      },
      {
        id: "packBbqRomantique",
        name: "extras.packs.bbqRomantic.name",
        descriptionKey: "extras.packs.bbqRomantic.description",
        price: 170,
        extraPersonPrice: 40,
        imageIdentifier: "barbecueromantique",
        typeKey: "extras.types.pack",
      },
    ],
  },
  formulesRepas: {
    nameKey: "extras.categories.formulesRepas",
    items: [
      {
        id: "formulePetitDej",
        name: "extras.formulesRepas.breakfast.name",
        descriptionKey: "extras.formulesRepas.breakfast.description",
        price: 35,
        extraPersonPrice: 10,
        imageIdentifier: "formuledejeuner",
        typeKey: "extras.types.formula",
      },
      {
        id: "formuleGourmet",
        name: "extras.formulesRepas.gourmet.name",
        descriptionKey: "extras.formulesRepas.gourmet.description",
        price: 85,
        extraPersonPrice: 20,
        imageIdentifier: "formulegourmet",
        typeKey: "extras.types.formula",
      },
      {
        id: "formulePancheApero",
        name: "extras.formulesRepas.apero.name",
        descriptionKey: "extras.formulesRepas.apero.description",
        price: 30,
        imageIdentifier: "plancheapero",
        typeKey: "extras.types.formula",
      },
      {
        id: "formuleRaclette",
        name: "extras.formulesRepas.raclette.name",
        descriptionKey: "extras.formulesRepas.raclette.description",
        price: 85,
        extraPersonPrice: 20,
        imageIdentifier: "raclette",
        typeKey: "extras.types.formula",
      },
      {
        id: "formuleBarbecue",
        name: "extras.formulesRepas.barbecue.name",
        descriptionKey: "extras.formulesRepas.barbecue.description",
        price: 85,
        extraPersonPrice: 20,
        imageIdentifier: "babrecue", // or "barbecue" if you change identifier
        typeKey: "extras.types.formula",
      },
    ],
  },
  spa: {
    nameKey: "extras.categories.spa",
    items: [
      {
        id: "formuleSpa",
        name: "extras.spa.basic.name",
        descriptionKey: "extras.spa.basic.description",
        price: 50,
        extraPersonPrice: 10,
        imageIdentifier: "formulespa",
        typeKey: "extras.types.formula",
      },
      {
        id: "formuleSpaBottle",
        name: "extras.spa.withBottle.name",
        descriptionKey: "extras.spa.withBottle.description",
        price: 90,
        imageIdentifier: "spabouteille",
        typeKey: "extras.types.formula",
      },
    ],
  },
  formulesDécouvertes: {
    nameKey: "extras.categories.formulesDecouverte",
    items: [
      {
        id: "packPassion",
        name: "extras.formulesDecouverte.passion.name",
        descriptionKey: "extras.formulesDecouverte.passion.description",
        price: 50,
        imageIdentifier: "passion",
        typeKey: "extras.types.pack",
      },
      {
        id: "packAnniversaire",
        name: "extras.formulesDecouverte.birthday.name",
        descriptionKey: "extras.formulesDecouverte.birthday.description",
        price: 55,
        extraPersonPrice: 5,
        imageIdentifier: "formuleanniversaire",
        typeKey: "extras.types.pack",
      },
    ],
  },
  meals: {
    nameKey: "extras.categories.meals",
    items: [
      {
        id: "meatballsLiege",
        name: "extras.meals.meatballsLiege.name",
        descriptionKey: "extras.meals.meatballsLiege.description",
        price: 15,
        imageIdentifier: "bouletteLiege",
        typeKey: "extras.types.meal",
      },
      {
        id: "meatballsTomato",
        name: "extras.meals.meatballsTomato.name",
        descriptionKey: "extras.meals.meatballsTomato.description",
        price: 15,
        imageIdentifier: "bouletteTomate",
        typeKey: "extras.types.meal",
      },
      {
        id: "waterzooi",
        name: "extras.meals.waterzooi.name",
        descriptionKey: "extras.meals.waterzooi.description",
        price: 15,
        imageIdentifier: "waterzooi",
        typeKey: "extras.types.meal",
      },
      {
        id: "chiliVeg",
        name: "extras.meals.chiliVeg.name",
        descriptionKey: "extras.meals.chiliVeg.description",
        price: 15,
        imageIdentifier: "chiliVeg",
        typeKey: "extras.types.meal",
      },
      {
        id: "carrotSoup",
        name: "extras.meals.carrotSoup.name",
        descriptionKey: "extras.meals.carrotSoup.description",
        price: 5,
        imageIdentifier: "veloute",
        typeKey: "extras.types.meal",
      },
    ],
  },
  boissons: {
    nameKey: "extras.categories.boissons",
    items: [
      {
        id: "brutBioul",
        name: "Brut de Bioul",
        descriptionKey: "extras.drinks.brutBioul.description",
        price: 50,
        imageIdentifier: "brutBioul",
        typeKey: "extras.drinkTypes.bulles",
      },
      {
        id: "cortilBarco",
        name: "Cortil Barco",
        descriptionKey: "extras.drinks.cortilBarco.description",
        price: 30,
        imageIdentifier: "cortilBarco",
        typeKey: "extras.drinkTypes.wine",
      },
      {
        id: "terreCharlot",
        name: "Terre Charlot",
        descriptionKey: "extras.drinks.terreCharlot.description",
        price: 30,
        imageIdentifier: "terreCharlot",
        typeKey: "extras.drinkTypes.wine",
      },
      {
        id: "bruneCondroz",
        name: "Brune du Condroz",
        descriptionKey: "extras.drinks.bruneCondroz.description",
        price: 4,
        imageIdentifier: "bruneCondroz",
        typeKey: "extras.drinkTypes.beer",
      },
      {
        id: "ambreeCondroz",
        name: "Ambrée du Condroz",
        descriptionKey: "extras.drinks.ambreeCondroz.description",
        price: 4,
        imageIdentifier: "ambreeCondroz",
        typeKey: "extras.drinkTypes.beer",
      },
      {
        id: "tripleCondroz",
        name: "Triple du Condroz",
        descriptionKey: "extras.drinks.tripleCondroz.description",
        price: 4,
        imageIdentifier: "tripleCondroz",
        typeKey: "extras.drinkTypes.beer",
      },
      {
        id: "blancheCondroz",
        name: "Blanche du Condroz",
        descriptionKey: "extras.drinks.blancheCondroz.description",
        price: 4,
        imageIdentifier: "blancheCondroz",
        typeKey: "extras.drinkTypes.beer",
      },
      {
        id: "appleJuice",
        name: 'Jus de pomme « Pom d"Happy »',
        descriptionKey: "extras.drinks.appleJuice.description",
        price: 3,
        imageIdentifier: "pomHappy",
        typeKey: "extras.drinkTypes.soft",
      },
      {
        id: "ritchieLemonRasp",
        name: "Ritchie Citron/Framboise",
        descriptionKey: "extras.drinks.ritchieLemonRasp.description",
        price: 3,
        imageIdentifier: "ritchieCitronFramboise",
        typeKey: "extras.drinkTypes.soft",
      },
      {
        id: "ritchieOrangeVan",
        name: "Ritchie Orange/Vanille",
        descriptionKey: "extras.drinks.ritchieOrangeVan.description",
        price: 3,
        imageIdentifier: "ritchieOrange", // Assuming identifier is 'ritchieOrange'
        typeKey: "extras.drinkTypes.soft",
      },
      {
        id: "ritchieCola",
        name: "Ritchie Cola",
        descriptionKey: "extras.drinks.ritchieCola.description",
        price: 3,
        imageIdentifier: "ritchieCola",
        typeKey: "extras.drinkTypes.soft",
      },
      {
        id: "ritchieColaZero",
        name: "Ritchie Cola Zéro",
        descriptionKey: "extras.drinks.ritchieColaZero.description",
        price: 3,
        imageIdentifier: "ritchieColaZero", // Assuming identifier is 'ritchieColaZero'
        typeKey: "extras.drinkTypes.soft",
      },
    ],
  },
};

export const ALL_DRINK_ITEMS_MAP_RAW = extraCategoriesRaw.boissons.items.reduce(
  (acc, item) => {
    acc[item.id] = item;
    return acc;
  },
  {}
);

export const DRINK_OFFER_CONFIG_RAW = {
  WINE_OFFER_1: {
    key: "WINE_OFFER_1",
    titleKey: "extras.drinks.wineOfferTitle",
    defaultTitle: "Choix de Vin Inclus (1 bouteille)",
    triggeringExtras: [
      "formuleGourmet",
      "formuleRaclette",
      "formuleBarbecue",
      "packDetenteGourmet",
      "packRacletteDetente",
      "packBbqRomantique",
      "packBbqDetente",
    ],
    drinks: [
      {
        id: "cortilBarco",
        nameKey: "extras.drinks.cortilBarcoLabel",
        defaultName: "Cortil Barco (rouge)",
      },
      {
        id: "terreCharlot",
        nameKey: "extras.drinks.terreCharlotLabel",
        defaultName: "Terre Charlot (blanc)",
      },
    ],
    maxSelection: 1,
    type: "wine_choice",
  },
  SOFTS_BEERS_OFFER_1: {
    key: "SOFTS_BEERS_OFFER_1",
    titleKey: "extras.drinks.softBeerOfferTitle",
    defaultTitle: "Choix de Boissons",
    triggeringExtras: ["formulePancheApero"],
    categories: {
      softs: extraCategoriesRaw.boissons.items
        .filter((item) => item.typeKey === "extras.drinkTypes.soft")
        .map((item) => item.id),
      beers: extraCategoriesRaw.boissons.items
        .filter((item) => item.typeKey === "extras.drinkTypes.beer")
        .map((item) => item.id),
    },
    itemsPerUnit: 2,
    itemsPerSupplementaryPerson: 1,
    type: "soft_beer_choice",
  },
};

export const getExtraByIdRaw = (id) => {
  for (const category of Object.values(extraCategoriesRaw)) {
    if (category.items && Array.isArray(category.items)) {
      const item = category.items.find((item) => item.id === id);
      if (item) return item;
    }
  }
  return null;
};

// This helper can still use getExtraByIdRaw as price is not image dependent
export const calculateExtrasTotalRaw = (selectedExtras) => {
  if (!selectedExtras || typeof selectedExtras !== "object") return 0;
  return Object.entries(selectedExtras).reduce((total, [extraId, quantity]) => {
    const extra = getExtraByIdRaw(extraId);
    const numQuantity = Number(quantity) || 0;
    return total + (extra?.price || 0) * numQuantity;
  }, 0);
};
