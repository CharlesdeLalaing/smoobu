import detente from "../assets/Packs/detente.webp";
import essentiel from "../assets/Packs/essentiel.webp";
import racletteromantique from "../assets/Packs/raclette-romantique.webp";
import raclettedetente from "../assets/Packs/raclette-detente.webp";
import barbecueromantique from "../assets/Packs/barbecue-romantique.png";
import barbecuedetente from "../assets/Packs/barbecue-detente.png";
import romantiquegourmet from "../assets/Packs/romantique-gourmet.webp";

//Les plats de Bossimé
import bouletteTomate from "../assets/repasBossimé/Boulette-de-viande-sauce-tomate-1.webp";
import bouletteLiege from "../assets/repasBossimé/Boulettes-de-viande-sauce-liegeoise-1.webp";
import waterzooi from "../assets/repasBossimé/Waterzooi-de-volaille-1.webp";
import veloute from "../assets/repasBossimé/Veloute-de-carotte-et-cumin-1-150x150.webp";
import chiliVeg from "../assets/repasBossimé/Chili-vegetarien-1-150x150.webp";

//Formule découverte
import formulespa from "../assets/Découverte/formule-spa.webp";
import formuleanniversaire from "../assets/Découverte/formule-anniversaire.webp";
import passion from "../assets/Découverte/passion.webp";
import spabouteille from "../assets/Découverte/spa-bouteille.webp";

//Formule repas
import formuledejeuner from "../assets/Repas/formule-dejeuner.webp";
import formulegourmet from "../assets/Repas/formule-gourmet.webp";
import plancheapero from "../assets/Repas/planche-apero.webp";
import raclette from "../assets/Repas/raclette.webp";
import babrecue from "../assets/Repas/barbecue.webp";

//Boissons
import ambreeCondroz from "../assets/Boissons/ambreeCondroz.webp";
import blancheCondroz from "../assets/Boissons/Blanche-du-Condroz.webp";
import bruneCondroz from "../assets/Boissons/bruneCondroz.webp";
import tripleCondroz from "../assets/Boissons/tripleCondroz.webp";
import brutBioul from "../assets/Boissons/brutBioul.webp";
import cortilBarco from "../assets/Boissons/cortilBarco.webp";
import houblondeBlonde from "../assets/Boissons/Houblonde-Blonde.webp";
import houblondeTriple from "../assets/Boissons/Houblonde-Triple.webp";
import houblondeWhite from "../assets/Boissons/Houblonde-White-IPA.webp";
import pomHappy from "../assets/Boissons/pomHappy.webp";
import ritchieCitronFramboise from "../assets/Boissons/ritchieCitronFramboise.webp";
import ritchieCola from "../assets/Boissons/ritchieCola.webp";
import ritchieColaZero from "../assets/Boissons/ritchieZero.webp";
import ritchieOrange from "../assets/Boissons/ritchieOrange.webp";
import terreCharlot from "../assets/Boissons/terreCharlot.webp";

export const extraCategories = {
  packs: {
    nameKey: "extras.categories.packs",
    items: [
      {
        id: "packEssentiel",
        name: "extras.packs.essential.name",
        descriptionKey: "extras.packs.essential.description",
        price: 85,
        extraPersonPrice: 20,
        image: essentiel,
        typeKey: "extras.types.pack",
      },
      {
        id: "packDetenteGourmet",
        name: "extras.packs.relaxGourmet.name",
        descriptionKey: "extras.packs.relaxGourmet.description",
        price: 150,
        extraPersonPrice: 40,
        image: detente,
        typeKey: "extras.types.pack",
      },
      {
        id: "packRomantiqueGourmet",
        name: "extras.packs.romanticGourmet.name",
        descriptionKey: "extras.packs.romanticGourmet.description",
        price: 170,
        extraPersonPrice: 40,
        image: romantiquegourmet,
        typeKey: "extras.types.pack",
      },
      {
        id: "packRacletteDetente",
        name: "extras.packs.racletteRelax.name",
        descriptionKey: "extras.packs.racletteRelax.description",
        price: 150,
        extraPersonPrice: 40,
        image: raclettedetente,
        typeKey: "extras.types.pack",
      },
      {
        id: "packRacletteRomantique",
        name: "extras.packs.racletteRomantic.name",
        descriptionKey: "extras.packs.racletteRomantic.description",
        price: 170,
        extraPersonPrice: 40,
        image: racletteromantique,
        typeKey: "extras.types.pack",
      },
      {
        id: "packBbqDetente",
        name: "extras.packs.bbqRelax.name",
        descriptionKey: "extras.packs.bbqRelax.description",
        price: 150,
        extraPersonPrice: 40,
        image: barbecuedetente,
        typeKey: "extras.types.pack",
      },
      {
        id: "packBbqRomantique",
        name: "extras.packs.bbqRomantic.name",
        descriptionKey: "extras.packs.bbqRomantic.description",
        price: 170,
        extraPersonPrice: 40,
        image: barbecueromantique,
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
        image: formuledejeuner,
        typeKey: "extras.types.formula",
      },
      {
        id: "formuleGourmet",
        name: "extras.formulesRepas.gourmet.name",
        descriptionKey: "extras.formulesRepas.gourmet.description",
        price: 85,
        extraPersonPrice: 20,
        image: formulegourmet,
        typeKey: "extras.types.formula",
      },
      {
        id: "formulePancheApero",
        name: "extras.formulesRepas.apero.name",
        descriptionKey: "extras.formulesRepas.apero.description",
        price: 30,
        image: plancheapero,
        typeKey: "extras.types.formula",
      },
      {
        id: "formuleRaclette",
        name: "extras.formulesRepas.raclette.name",
        descriptionKey: "extras.formulesRepas.raclette.description",
        price: 85,
        extraPersonPrice: 20,
        image: raclette,
        typeKey: "extras.types.formula",
      },
      {
        id: "formuleBarbecue",
        name: "extras.formulesRepas.barbecue.name",
        descriptionKey: "extras.formulesRepas.barbecue.description",
        price: 85,
        extraPersonPrice: 20,
        image: babrecue,
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
        image: formulespa,
        typeKey: "extras.types.formula",
      },
      {
        id: "formuleSpaBottle",
        name: "extras.spa.withBottle.name",
        descriptionKey: "extras.spa.withBottle.description",
        price: 90,
        image: spabouteille,
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
        image: passion,
        typeKey: "extras.types.pack",
      },
      {
        id: "packAnniversaire",
        name: "extras.formulesDecouverte.birthday.name",
        descriptionKey: "extras.formulesDecouverte.birthday.description",
        price: 55,
        extraPersonPrice: 5,
        image: formuleanniversaire,
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
        image: bouletteLiege,
        typeKey: "extras.types.meal",
      },
      {
        id: "meatballsTomato",
        name: "extras.meals.meatballsTomato.name",
        descriptionKey: "extras.meals.meatballsTomato.description",
        price: 15,
        image: bouletteTomate,
        typeKey: "extras.types.meal",
      },
      {
        id: "waterzooi",
        name: "extras.meals.waterzooi.name",
        descriptionKey: "extras.meals.waterzooi.description",
        price: 15,
        image: waterzooi,
        typeKey: "extras.types.meal",
      },
      {
        id: "chiliVeg",
        name: "extras.meals.chiliVeg.name",
        descriptionKey: "extras.meals.chiliVeg.description",
        price: 15,
        image: chiliVeg,
        typeKey: "extras.types.meal",
      },
      {
        id: "carrotSoup",
        name: "extras.meals.carrotSoup.name",
        descriptionKey: "extras.meals.carrotSoup.description",
        price: 5,
        image: veloute,
        typeKey: "extras.types.meal",
      },
    ],
  },
  boissons: {
    nameKey: "extras.categories.boissons",
    items: [
      // Wines
      {
        id: "brutBioul",
        name: "Brut de Bioul",
        descriptionKey: "extras.drinks.brutBioul.description",
        price: 50,
        image: brutBioul,
        typeKey: "extras.drinkTypes.bulles",
      },
      {
        id: "cortilBarco",
        name: "Cortil Barco",
        descriptionKey: "extras.drinks.cortilBarco.description",
        price: 30,
        image: cortilBarco,
        typeKey: "extras.drinkTypes.wine",
      },
      {
        id: "terreCharlot",
        name: "Terre Charlot",
        descriptionKey: "extras.drinks.terreCharlot.description",
        price: 30,
        image: terreCharlot,
        typeKey: "extras.drinkTypes.wine",
      },
      // Beers
      // {
      //   id: "houblondeTriple",
      //   name: "Houblonde Triple",
      //   descriptionKey: "extras.drinks.houblondeTriple.description",
      //   price: 4,
      //   image: houblondeTriple,
      //   typeKey: "extras.drinkTypes.beer",
      // },
      // {
      //   id: "houblondeBlonde",
      //   name: "Houblonde Blonde",
      //   descriptionKey: "extras.drinks.houblondeBlonde.description",
      //   price: 4,
      //   image: houblondeBlonde,
      //   typeKey: "extras.drinkTypes.beer",
      // },
      // {
      //   id: "houblondeWhite",
      //   name: "Houblonde White IPA",
      //   descriptionKey: "extras.drinks.houblondeWhite.description",
      //   price: 4,
      //   image: houblondeWhite,
      //   typeKey: "extras.drinkTypes.beer",
      // },
      {
        id: "bruneCondroz",
        name: "Brune du Condroz",
        descriptionKey: "extras.drinks.bruneCondroz.description",
        price: 4,
        image: bruneCondroz,
        typeKey: "extras.drinkTypes.beer",
      },
      {
        id: "ambreeCondroz",
        name: "Ambrée du Condroz",
        descriptionKey: "extras.drinks.ambreeCondroz.description",
        price: 4,
        image: ambreeCondroz,
        typeKey: "extras.drinkTypes.beer",
      },
      {
        id: "tripleCondroz",
        name: "Triple du Condroz",
        descriptionKey: "extras.drinks.tripleCondroz.description",
        price: 4,
        image: tripleCondroz,
        typeKey: "extras.drinkTypes.beer",
      },
      {
        id: "blancheCondroz",
        name: "Blanche du Condroz",
        descriptionKey: "extras.drinks.blancheCondroz.description",
        price: 4,
        image: blancheCondroz,
        typeKey: "extras.drinkTypes.beer",
      },
      // Softs
      {
        id: "appleJuice",
        name: 'Jus de pomme « Pom d"Happy »',
        descriptionKey: "extras.drinks.appleJuice.description",
        price: 3,
        image: pomHappy,
        typeKey: "extras.drinkTypes.soft",
      },
      {
        id: "ritchieLemonRasp",
        name: "Ritchie Citron/Framboise",
        descriptionKey: "extras.drinks.ritchieLemonRasp.description",
        price: 3,
        image: ritchieCitronFramboise,
        typeKey: "extras.drinkTypes.soft",
      },
      {
        id: "ritchieOrangeVan",
        name: "Ritchie Orange/Vanille",
        descriptionKey: "extras.drinks.ritchieOrangeVan.description",
        price: 3,
        image: ritchieOrange,
        typeKey: "extras.drinkTypes.soft",
      },
      {
        id: "ritchieCola",
        name: "Ritchie Cola",
        descriptionKey: "extras.drinks.ritchieCola.description",
        price: 3,
        image: ritchieCola,
        typeKey: "extras.drinkTypes.soft",
      },
      {
        id: "ritchieColaZero",
        name: "Ritchie Cola Zéro",
        descriptionKey: "extras.drinks.ritchieColaZero.description",
        price: 3,
        image: ritchieColaZero,
        typeKey: "extras.drinkTypes.soft",
      },
    ],
  },
};

export const getExtraById = (id) => {
  for (const category of Object.values(extraCategories)) {
    const item = category.items.find((item) => item.id === id);
    if (item) return item;
  }
  return null;
};

export const calculateExtrasTotal = (selectedExtras) => {
  return Object.entries(selectedExtras).reduce((total, [extraId, quantity]) => {
    const extra = getExtraById(extraId);
    return total + (extra?.price || 0) * quantity;
  }, 0);
};