// src/imageImports.js

// --- Packs ---
import essentiel from "./assets/Packs/essentiel.webp";
import detente from "./assets/Packs/detente.webp";
import racletteromantique from "./assets/Packs/raclette-romantique.webp";
import raclettedetente from "./assets/Packs/raclette-detente.webp";
import barbecueromantique from "./assets/Packs/barbecue-romantique.png";
import barbecuedetente from "./assets/Packs/barbecue-detente.png";
import romantiquegourmet from "./assets/Packs/romantique-gourmet.webp";

// --- Repas Gourmart ---
import poulettikkamasala from "./assets/repasGourmart/poulettikkamasala.jpg";
import boulettesaucetomates from "./assets/repasGourmart/boulettesaucetomates.jpg";
import linguineausaumons from "./assets/repasGourmart/linguineausaumons.jpg";
import risottoalatruffe from "./assets/repasGourmart/risottoalatruffe.jpg";

// --- Formule découverte ---
import formulespa from "./assets/Découverte/formule-spa.webp";
import formuleanniversaire from "./assets/Découverte/formule-anniversaire.webp";
import passion from "./assets/Découverte/passion.webp";
import spabouteille from "./assets/Découverte/spa-bouteille.webp";

// --- Formule repas ---
import formuledejeuner from "./assets/Repas/formule-dejeuner.webp";
import formulegourmet from "./assets/Repas/formule-gourmet.webp";
import plancheapero from "./assets/Repas/planche-apero.webp";
import raclette from "./assets/Repas/raclette.webp";
import babrecue from "./assets/Repas/barbecue.webp"; // Assuming this is barbecue.webp

// --- Boissons ---
import ambreeCondroz from "./assets/Boissons/ambree.webp";
import blancheCondroz from "./assets/Boissons/bergamote.webp";
import bruneCondroz from "./assets/Boissons/brune.webp";
import tripleCondroz from "./assets/Boissons/triple leignon.webp";
import blondeCereales from "./assets/Boissons/4Cereales.webp";
import brutBioul from "./assets/Boissons/brutBioul.webp";
import cortilBarco from "./assets/Boissons/cortilBarco.webp";
import pomHappy from "./assets/Boissons/pomHappy.webp";
import ritchieCitronFramboise from "./assets/Boissons/ritchieCitronFramboise.webp";
import ritchieCola from "./assets/Boissons/ritchieCola.webp";
import ritchieColaZero from "./assets/Boissons/ritchieZero.webp";
import ritchieOrange from "./assets/Boissons/ritchieOrange.webp";
import terreCharlot from "./assets/Boissons/terreCharlot.webp";

// This map uses the 'imageIdentifier' strings as keys
const imageAssetMap = {
  essentiel,
  detente,
  racletteromantique,
  raclettedetente,
  barbecueromantique,
  barbecuedetente,
  romantiquegourmet,
  poulettikkamasala,
  boulettesaucetomates,
  linguineausaumons,
  risottoalatruffe,
  formulespa,
  formuleanniversaire,
  passion,
  spabouteille,
  formuledejeuner,
  formulegourmet,
  plancheapero,
  raclette,
  babrecue, // or 'barbecue' if you change the import variable name above
  ambreeCondroz,
  blancheCondroz,
  bruneCondroz,
  tripleCondroz,
  blondeCereales,
  brutBioul,
  cortilBarco,
  pomHappy,
  ritchieCitronFramboise,
  ritchieCola,
  ritchieColaZero, // maps to the variable 'ritchieColaZero'
  ritchieOrange, // maps to the variable 'ritchieOrange'
  terreCharlot,
};

export const getProcessedImage = (identifier) => {
  if (identifier === undefined || identifier === null) {
    // console.warn('getProcessedImage called with undefined or null identifier.');
    return "/default-placeholder.png"; // Or some other default/null behavior
  }
  const asset = imageAssetMap[identifier];
  if (!asset) {
    console.warn(
      `Image asset not found for identifier: "${identifier}". Check imageIdentifier in extraCategoriesData.js and imageAssetMap in imageImports.js.`
    );
    return "/default-placeholder.png"; // Fallback image
  }
  return asset;
};
