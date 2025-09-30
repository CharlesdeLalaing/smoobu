import { transporter } from "../../config/nodemailer.js";
import { format as formatFn, addMinutes } from "date-fns";
import { fr, enUS, nl } from "date-fns/locale";
// NEW: Import the timezone-aware formatting function
import { formatInTimeZone } from "date-fns-tz";

// Helper to get date-fns locale for email
const emailTexts = {
  fr: {
    subject: "Confirmation de réservation - Ferme de Basseilles",
    greeting: "Cher/Chère {{guestName}},",
    confirmationMessage:
      "Merci pour votre réservation ! Voici les détails de votre séjour :",
    stayDetails: "Détails du séjour",
    bookedAccommodation: "Hébergement",
    arrival: "Arrivée",
    departure: "Départ",
    travelers: "Voyageurs",
    adults: "adultes",
    children: "enfants",
    smoobuBookingId: "ID de Réservation",
    spaScheduledTitle: "Votre séance SPA",
    spaScheduledFormat: "{{date}} de {{startTime}} à {{endTime}}",
    spaScheduleLaterTitle: "Programmation de votre séance SPA",
    spaScheduleLaterInstruction:
      "Pour planifier votre séance SPA, veuillez nous contacter par email ou téléphone.",
    spaContactEmail: "fermedebasseilles@gmail.com",
    spaContactPhone: "+32 475 20 16 19",
    spaScheduleLaterPriority:
      "Note : Les créneaux sont attribués selon le principe du premier arrivé, premier servi.",
    priceDetails: "Détails des prix",
    addExtrasText:
      'Si vous souhaitez ajouter des suppléments à votre réservation, il est possible de le faire via ce lien : <a href="https://fermedebasseilles.be/reservation-extras-supplementaires/" target="_blank" style="color: #668E73; text-decoration:none;">https://fermedebasseilles.be/reservation-extras-supplementaires/</a>',
    basePrice: "Prix de base",
    guestFees: "Frais pour {{persons}} personnes supplémentaires",
    longStayDiscount: "Réduction long séjour ({{percentage}}%)",
    promoCode: "Code promo ({{code}})",
    paidExtrasTitle: "Extras Payants",
    freeDrinksTitle: "Boissons Incluses",
    nonAlcoholicChoiceTitle: "Choix de Boisson Non-Alcoolisée",
    nonAlcoholicChoiceInstruction:
      "Pour votre offre '{{grantor}}', vous avez choisi de sélectionner une boisson non-alcoolisée ultérieurement. Veuillez nous contacter pour préciser votre choix :",
    nonAlcoholicChoiceContact: "Contactez-nous pour votre choix",
    total: "Total",
    contactInfo: "Vos coordonnées",
    phone: "Téléphone",
    closing: "Nous avons hâte de vous accueillir !",
    team: "L'équipe de la Ferme de Basseilles",
    addressTitle: "Adresse de la propriété",
    propertyAddress: "Route de Basseilles 1, 5340 Mozet (Gesves), Belgique",
    viewOnMap: "Voir sur la carte",
    arrivalInstructionsTitle: "Instructions d'arrivée à la Ferme",
    arrivalInstructionsText:
      "Lorsque vous arrivez à la Ferme de Basseilles, située « Route de Basseilles 1, 5340 Mozet », nous vous invitons à vous rendre avec votre véhicule jusqu'à l'entrée de la ferme. Vous découvrirez alors un grand parking où vous pourrez vous garer tout en consultant les informations disponibles à l'accueil. Vous pourrez alors parcourir la fiche explicative concernant les modalités pratiques de votre séjour, telles que l'emplacement du parking, l'hébergement et les services complémentaires.",
    glampingInfoTitle: "Informations importantes pour votre séjour Glamping",
    glampingInfoText:
      "Il est important de savoir que, l'insolite étant du Glamping, c'est-à-dire du camping plus luxueux en pleine nature. Ceci implique que par temps humide/temps de pluie, nous vous conseillons vivement de ne pas sortir vos plus beaux souliers pour réaliser les trajets de votre véhicule au logement et inversement. Le chemin peut être humide et parfois un peu boueux. Le chauffage à disposition prend quelques minutes pour préchauffer.\n\nUne douche extérieure est accessible à l'espace \"Spa\", sans supplément. Nous demandons juste de prévenir de l'heure pour éviter toute réservation simultanée du Spa. Le Spa est situé au sein de la ferme, à environ 100m du logement insolite.",
    terraceBbqInfoTitle: "Votre espace extérieur",
    terraceBbqInfoText:
      "Pour finir, nous sommes ravis de vous informer qu'une petite terrasse avec du mobilier de jardin ainsi qu'un barbecue se trouvent juste derrière votre logement. Pour y accéder, il vous suffit de prendre la direction du Spa.",
    included: "Inclus",
    extrasCatalog: {
      "extras.categories.packs": "Nos Paquets Thématiques",
      "extras.categories.formulesRepas": "Nos Formules Repas",
      "extras.categories.spa": "Notre Espace Bien-être",
      "extras.categories.formulesDecouverte": "Nos Formules Découverte",
      "extras.categories.meals": "Plats Traiteur de la Ferme de Bossimé",
      "extras.categories.boissons": "Notre Sélection de Boissons",
      "extras.packs.essential.name": "L'essentiel (pour 2)",
      "extras.packs.relaxGourmet.name": "Le détente gourmet (pour 2)",
      "extras.packs.racletteRelax.name": "La raclette en détente (pour 2)",
      "extras.packs.romanticGourmet.name": "Le romantique gourmet (pour 2)",
      "extras.packs.racletteRomantic.name": "La raclette romantique (pour 2)",
      "extras.packs.bbqRelax.name": "Le barbecue détente (pour 2)",
      "extras.packs.bbqRomantic.name": "Le romantique barbecue (pour 2)",
      "extras.formulesDecouverte.passion.name": "Formule passion (pour 2)",
      "extras.formulesDecouverte.birthday.name":
        "Formule anniversaire (pour 2)",
      "extras.spa.basic.name": "Formule SPA (2 pers)",
      "extras.spa.withBottle.name": "Formule SPA + bouteille (2 pers)",
      "extras.meals.pouletTikkaMasala.name": "Poulet Tikka Massala",
      "extras.meals.boulettesSauceTomate.name": "Boulettes sauce tomate",
      "extras.meals.linguinesAuSaumon.name": "Linguines au saumon fumé",
      "extras.meals.risottoALaTartufata.name": "Risotto à la tartufata",
      "extras.formulesRepas.breakfast.name": "Formule petit-déjeuner (2 pers)",
      "extras.formulesRepas.gourmet.name": "Formule gourmet (2 pers)",
      "extras.formulesRepas.raclette.name": "Formule raclette (2 pers)",
      "extras.formulesRepas.barbecue.name": "Formule barbecue (2 pers)",
      "extras.formulesRepas.apero.name": "Formule planche apéro (2 pers)",
      "drinkNames.brutBioul": "Brut de Bioul",
      "drinkNames.cortilBarco": "Cortil Barco (rouge)",
      "drinkNames.terreCharlot": "Terre Charlot (blanc)",
      "drinkNames.bruneCondroz": "Brune du Condroz",
      "drinkNames.ambreeCondroz": "Ambrée du Condroz",
      "drinkNames.tripleCondroz": "Triple du Condroz",
      "drinkNames.blancheCondroz": "Blanche du Condroz",
      "drinkNames.appleJuice": "Jus de pomme « Pom d'Happy »",
      "drinkNames.ritchieLemonRasp": "Ritchie Citron/Framboise",
      "drinkNames.ritchieOrangeVan": "Ritchie Orange/Vanille",
      "drinkNames.ritchieCola": "Ritchie Cola",
      "drinkNames.ritchieColaZero": "Ritchie Cola Zéro",
      "extras.drinks.wineOfferTitle": "Choix de Vin Inclus (1 bouteille)",
      "extras.drinks.softBeerOfferTitle": "Choix de Boissons Incluses",
      "priceDetails.nonAlcoholicChosenLater":
        "Option non-alcoolisée (choix ultérieur avec l'hôte)",
      "extras.drinks.chooseNonAlcoholicLater":
        "Préfère une boisson non-alcoolisée (à voir avec l'hôte)",
      "extras.additionalPerson": "Personne supplémentaire",
      "priceDetails.promoCode.generic": "Code Promo",
      "priceDetails.giftVoucher": "Chèque Cadeau",
      "priceDetails.longStayDiscount": "Réduction long séjour",
    },
  },
  en: {
    subject: "Booking Confirmation - Ferme de Basseilles",
    greeting: "Dear {{guestName}},",
    confirmationMessage:
      "Thank you for your booking! Here are your stay details:",
    stayDetails: "Stay Details",
    bookedAccommodation: "Accommodation",
    arrival: "Arrival",
    departure: "Departure",
    travelers: "Travelers",
    adults: "adults",
    children: "children",
    smoobuBookingId: "Booking ID",
    spaScheduledTitle: "Your SPA Session",
    spaScheduledFormat: "{{date}} from {{startTime}} to {{endTime}}",
    spaScheduleLaterTitle: "SPA Session Scheduling",
    spaScheduleLaterInstruction:
      "To schedule your SPA session, please contact us by email or phone:",
    spaContactEmail: "fermedebasseilles@gmail.com",
    spaContactPhone: "+32 475 20 16 19",
    spaScheduleLaterPriority:
      "Note: Slots are assigned on a first-come, first-served basis.",
    priceDetails: "Price Details",
    addExtrasText:
      'If you wish to add extras to your reservation, it is possible to do so via this link: <a href="https://fermedebasseilles.be/en/booking-additional-extras/" target="_blank" style="color: #668E73; text-decoration:none;">https://fermedebasseilles.be/en/booking-additional-extras/</a>',
    basePrice: "Base Price",
    guestFees: "Fee for {{persons}} extra persons",
    longStayDiscount: "Long stay discount ({{percentage}}%)",
    promoCode: "Promo code ({{code}})",
    paidExtrasTitle: "Paid Extras",
    freeDrinksTitle: "Complimentary Drinks",
    nonAlcoholicChoiceTitle: "Non-Alcoholic Drink Choice",
    nonAlcoholicChoiceInstruction:
      "For your '{{grantor}}' offer, you've chosen to select a non-alcoholic beverage later. Please contact us to specify your choice:",
    nonAlcoholicChoiceContact: "Contact us for your choice",
    total: "Total",
    contactInfo: "Your Contact Information",
    phone: "Phone",
    closing: "We look forward to welcoming you!",
    team: "The Ferme de Basseilles Team",
    addressTitle: "Property Address",
    propertyAddress: "Route de Basseilles 1, 5340 Mozet (Gesves), Belgium",
    viewOnMap: "View on Map",
    arrivalInstructionsTitle: "Arrival Instructions at the Farm",
    arrivalInstructionsText:
      'When you arrive at La Ferme de Basseilles, located at "Route de Basseilles 1, 5340 Mozet", we invite you to drive to the farm entrance with your vehicle. You will then discover a large parking lot where you can park while consulting the information available at the reception. You can then go through the explanatory sheet regarding the practical arrangements for your stay, such as the location of the parking, the accommodation, and the additional services.',
    glampingInfoTitle: "Important Information for Your Glamping Stay",
    glampingInfoText:
      'It is important to know that, being Glamping, this is more luxurious camping in nature. This means that in wet/rainy weather, we strongly advise you not to wear your best shoes for the trips from your vehicle to the accommodation and vice versa. The path can be wet and sometimes a bit muddy. The heating available takes a few minutes to warm up.\n\nAn outdoor shower is available at the "Spa" area, at no extra cost. We just ask that you inform us of the time to avoid any simultaneous bookings of the Spa. The Spa is located within the farm, about 100m from the glamping accommodation.',
    terraceBbqInfoTitle: "Your Outdoor Space",
    terraceBbqInfoText:
      "Finally, we are pleased to inform you that a small terrace with garden furniture and a barbecue is located just behind your accommodation. To access it, simply head towards the Spa.",
    included: "Included",
    extrasCatalog: {
      "extras.categories.packs": "Our Thematic Packs",
      "extras.categories.formulesRepas": "Our Meal Formulas",
      "extras.categories.spa": "Our Wellness Area",
      "extras.categories.formulesDecouverte": "Our Discovery Formulas",
      "extras.categories.meals": "Catered Dishes from Ferme de Bossimé",
      "extras.categories.boissons": "Our Drink Selection",
      "extras.packs.essential.name": "The Essential (for 2)",
      "extras.packs.relaxGourmet.name": "Gourmet Relaxation (for 2)",
      "extras.packs.racletteRelax.name": "Raclette Relaxation (for 2)",
      "extras.packs.romanticGourmet.name": "Romantic Gourmet (for 2)",
      "extras.packs.racletteRomantic.name": "Romantic Raclette (for 2)",
      "extras.packs.bbqRelax.name": "BBQ Relaxation (for 2)",
      "extras.packs.bbqRomantic.name": "Romantic BBQ (for 2)",
      "extras.formulesDecouverte.passion.name": "Passion Formula (for 2)",
      "extras.formulesDecouverte.birthday.name": "Birthday Formula (2 ppl)",
      "extras.spa.basic.name": "SPA Formula (2 ppl)",
      "extras.spa.withBottle.name": "SPA Formula + Bottle (2 ppl)",
      "extras.meals.pouletTikkaMasala.name": "Chicken Tikka Masala",
      "extras.meals.boulettesSauceTomate.name": "Meatballs in tomato sauce",
      "extras.meals.linguinesAuSaumon.name": "Linguine with smoked salmon",
      "extras.meals.risottoALaTartufata.name": "Risotto with tartufata",
      "extras.formulesRepas.breakfast.name": "Breakfast Formula (2 ppl)",
      "extras.formulesRepas.gourmet.name": "Gourmet Formula (2 ppl)",
      "extras.formulesRepas.raclette.name": "Raclette Formula (2 ppl)",
      "extras.formulesRepas.barbecue.name": "Barbecue Formula (2 ppl)",
      "extras.formulesRepas.apero.name": "Aperitif Platter Formula (2 ppl)",
      "drinkNames.brutBioul": "Brut de Bioul (Sparkling)",
      "drinkNames.cortilBarco": "Cortil Barco (Red Wine)",
      "drinkNames.terreCharlot": "Terre Charlot (White Wine)",
      "drinkNames.bruneCondroz": "Brune du Condroz (Beer)",
      "drinkNames.ambreeCondroz": "Ambrée du Condroz (Beer)",
      "drinkNames.tripleCondroz": "Triple du Condroz (Beer)",
      "drinkNames.blancheCondroz": "Blanche du Condroz (Beer)",
      "drinkNames.appleJuice": 'Apple Juice "Pom d\'Happy"',
      "drinkNames.ritchieLemonRasp": "Ritchie Lemon/Raspberry",
      "drinkNames.ritchieOrangeVan": "Ritchie Orange/Vanilla",
      "drinkNames.ritchieCola": "Ritchie Cola",
      "drinkNames.ritchieColaZero": "Ritchie Cola Zero",
      "extras.drinks.wineOfferTitle": "Included Wine Choice (1 bottle)",
      "extras.drinks.softBeerOfferTitle": "Included Drinks Choice",
      "priceDetails.nonAlcoholicChosenLater": "Non-alcoholic option",
      "extras.drinks.chooseNonAlcoholicLater": "Prefers a non-alcoholic drink",
      "extras.additionalPerson": "Additional Person",
      "priceDetails.promoCode.generic": "Promo Code",
      "priceDetails.giftVoucher": "Gift Voucher",
      "priceDetails.longStayDiscount": "Long Stay Discount",
    },
  },
  nl: {
    subject: "Boekingsbevestiging - Ferme de Basseilles",
    greeting: "Beste {{guestName}},",
    confirmationMessage:
      "Bedankt voor uw boeking! Hier zijn de details van uw verblijf:",
    stayDetails: "Verblijfsdetails",
    bookedAccommodation: "Accommodatie",
    arrival: "Aankomst",
    departure: "Vertrek",
    travelers: "Reizigers",
    adults: "volwassenen",
    children: "kinderen",
    smoobuBookingId: "Boekings-ID",
    spaScheduledTitle: "Uw SPA-sessie",
    spaScheduledFormat: "{{date}} van {{startTime}} tot {{endTime}}",
    spaScheduleLaterTitle: "Planning SPA-sessie",
    spaScheduleLaterInstruction:
      "Om uw SPA-sessie te plannen, neem contact met ons op via e-mail of telefoon:",
    spaContactEmail: "fermedebasseilles@gmail.com",
    spaContactPhone: "+32 475 20 16 19",
    spaScheduleLaterPriority:
      "Let op: Tijdsloten worden toegewezen op basis van wie het eerst komt, het eerst maalt.",
    priceDetails: "Prijsdetails",
    addExtrasText:
      'Als u extra\'s wilt toevoegen aan uw reservering, kunt u dit doen via deze link: <a href="https://fermedebasseilles.be/nl/extra-toeslagen-boeken/" target="_blank" style="color: #668E73; text-decoration:none;">https://fermedebasseilles.be/nl/extra-toeslagen-boeken/</a>',
    basePrice: "Basisprijs",
    guestFees: "Kosten voor {{persons}} extra personen",
    longStayDiscount: "Korting voor lang verblijf ({{percentage}}%)",
    promoCode: "Promotiecode({{code}})",
    paidExtrasTitle: "Betaalde Extra's",
    freeDrinksTitle: "Gratis Dranken",
    nonAlcoholicChoiceTitle: "Keuze Niet-Alcoholische Drank",
    nonAlcoholicChoiceInstruction:
      "Voor uw '{{grantor}}' aanbod heeft u gekozen om later een niet-alcoholische drank te selecteren. Neem contact met ons op om uw keuze door te geven:",
    nonAlcoholicChoiceContact: "Neem contact op voor uw keuze",
    total: "Totaal",
    contactInfo: "Uw contactgegevens",
    phone: "Telefoon",
    closing: "We kijken ernaar uit u te mogen verwelkomen!",
    team: "Het team van Ferme de Basseilles",
    addressTitle: "Adres van de accommodatie",
    propertyAddress: "Route de Basseilles 1, 5340 Mozet (Gesves), België",
    viewOnMap: "Bekijk op kaart",
    arrivalInstructionsTitle: "Aankomstinstructies bij de Boerderij",
    arrivalInstructionsText:
      "Wanneer je aankomt bij La Ferme de Basseilles, gelegen aan “Route de Basseilles 1, 5340 Mozet”, nodigen we je uit om met je voertuig naar de ingang van de boerderij te rijden. U zult dan een grote parkeerplaats ontdekken waar u kunt parkeren terwijl u de informatie raadpleegt die beschikbaar is bij de receptie. Je kunt dan de uitleg doornemen over de praktische regelingen voor je verblijf, zoals de locatie van de parkeerplaats, de accommodatie en de aanvullende diensten.",
    glampingInfoTitle: "Belangrijke Informatie voor uw Glamping Verblijf",
    glampingInfoText:
      'Het is belangrijk om te weten dat, omdat het glamping is, dit luxueus kamperen in de natuur is. Dit betekent dat we bij vochtig/regenachtig weer ten zeerste aanraden om niet uw mooiste schoenen te dragen voor de ritjes van uw voertuig naar de accommodatie en vice versa. Het pad kan vochtig en soms een beetje modderig zijn. De verwarming heeft een paar minuten nodig om op te warmen.\n\nEen buitendouche is beschikbaar bij het "Spa" gebied, zonder extra kosten. We vragen alleen om ons op de hoogte te stellen van het tijdstip om gelijktijdige boekingen van de Spa te voorkomen. De Spa bevindt zich binnen de boerderij, ongeveer 100m van de glamping accommodatie.',
    terraceBbqInfoTitle: "Uw Buitenruimte",
    terraceBbqInfoText:
      "Tot slot zijn we verheugd u te kunnen meedelen dat er een klein terras met tuinmeubilair en een barbecue direct achter uw accommodatie te vinden is. Om hier toegang toe te krijgen, hoeft u alleen maar richting de Spa te gaan.",
    included: "Inbegrepen",
    extrasCatalog: {
      "extras.categories.packs": "Onze Thematische Pakketten",
      "extras.categories.formulesRepas": "Onze Maaltijdformules",
      "extras.categories.spa": "Onze Wellnessruimte",
      "extras.categories.formulesDecouverte": "Onze Ontdekkingsformules",
      "extras.categories.meals": "Traiteurmaaltijden van Ferme de Bossimé",
      "extras.categories.boissons": "Onze Drankselectie",
      "extras.packs.essential.name": "Het Essentiële (voor 2)",
      "extras.packs.relaxGourmet.name": "Gourmet Ontspanning (voor 2)",
      "extras.packs.racletteRelax.name": "Raclette Ontspanning (voor 2)",
      "extras.packs.romanticGourmet.name": "Romantisch Gourmet (voor 2)",
      "extras.packs.racletteRomantic.name": "Romantische Raclette (voor 2)",
      "extras.packs.bbqRelax.name": "BBQ Ontspanning (voor 2)",
      "extras.packs.bbqRomantic.name": "Romantische BBQ (voor 2)",
      "extras.formulesDecouverte.passion.name": "Passie Formule (voor 2)",
      "extras.formulesDecouverte.birthday.name": "Verjaardagsformule (2 pers.)",
      "extras.spa.basic.name": "SPA Formule (2 pers.)",
      "extras.spa.withBottle.name": "SPA Formule + fles (2 pers.)",
      "extras.meals.pouletTikkaMasala.name": "Kip Tikka Masala",
      "extras.meals.boulettesSauceTomate.name": "Balletjes in tomatensaus",
      "extras.meals.linguinesAuSaumon.name": "Linguine met gerookte zalm",
      "extras.meals.risottoALaTartufata.name": "Risotto met tartufata",
      "extras.formulesRepas.breakfast.name": "Ontbijtformule (2 pers.)",
      "extras.formulesRepas.gourmet.name": "Gourmet Formule (2 pers.)",
      "extras.formulesRepas.raclette.name": "Raclette Formule (2 pers.)",
      "extras.formulesRepas.barbecue.name": "Barbecue Formule (2 pers.)",
      "extras.formulesRepas.apero.name": "Aperitiefplank Formule (2 pers.)",
      "drinkNames.brutBioul": "Brut de Bioul (Mousserend)",
      "drinkNames.cortilBarco": "Cortil Barco (Rode Wijn)",
      "drinkNames.terreCharlot": "Terre Charlot (Witte Wijn)",
      "drinkNames.bruneCondroz": "Brune du Condroz (Bier)",
      "drinkNames.ambreeCondroz": "Ambrée du Condroz (Bier)",
      "drinkNames.tripleCondroz": "Triple du Condroz (Bier)",
      "drinkNames.blancheCondroz": "Blanche du Condroz (Bier)",
      "drinkNames.appleJuice": 'Appelsap "Pom d\'Happy"',
      "drinkNames.ritchieLemonRasp": "Ritchie Citroen/Framboos",
      "drinkNames.ritchieOrangeVan": "Ritchie Sinaasappel/Vanille",
      "drinkNames.ritchieCola": "Ritchie Cola",
      "drinkNames.ritchieColaZero": "Ritchie Cola Zero",
      "extras.drinks.wineOfferTitle": "Inbegrepen Wijnkeuze (1 fles)",
      "extras.drinks.softBeerOfferTitle": "Inbegrepen Drankkeuze",
      "priceDetails.nonAlcoholicChosenLater": "Niet-alcoholische optie",
      "extras.drinks.chooseNonAlcoholicLater":
        "Verkiest een niet-alcoholische drank",
      "extras.additionalPerson": "Extra Persoon",
      "priceDetails.promoCode.generic": "Promocode",
      "priceDetails.giftVoucher": "Cadeaubon",
      "priceDetails.longStayDiscount": "Korting Lang Verblijf",
    },
  },
};

const getEmailDateFnLocale = (lang = "fr") => {
  const baseLang = lang.split("-")[0];
  switch (baseLang) {
    case "fr":
      return fr;
    case "en":
      return enUS;
    case "nl":
      return nl;
    default:
      return fr;
  }
};

const getJsDateForEmail = (dateValue) => {
  if (!dateValue) return null;
  try {
    if (dateValue instanceof Date && !isNaN(dateValue.getTime()))
      return dateValue;
    if (dateValue && typeof dateValue.toDate === "function") {
      const d = dateValue.toDate();
      if (!isNaN(d.getTime())) return d;
    }
    if (
      dateValue &&
      typeof dateValue === "object" &&
      dateValue._seconds !== undefined
    ) {
      const d = new Date(
        dateValue._seconds * 1000 + (dateValue._nanoseconds || 0) / 1000000
      );
      if (!isNaN(d.getTime())) return d;
    }
    const d = new Date(dateValue);
    if (!isNaN(d.getTime())) return d;
    console.warn("[EmailUtil] Could not parse date:", dateValue);
    return null;
  } catch (e) {
    console.error("[EmailUtil] Error parsing date:", dateValue, e);
    return null;
  }
};

const formatDateForEmail = (dateInput, lang = "fr") => {
  const date = getJsDateForEmail(dateInput);
  if (!date) return "N/A";
  try {
    // This function is fine as is, because it only handles the date part.
    return formatFn(date, "d MMMM yyyy", {
      locale: getEmailDateFnLocale(lang),
    });
  } catch (e) {
    return "N/A";
  }
};

const getTranslatedName = (key, lang, fallbackNameIfKeyMissing = null) => {
  const currentLang = lang?.split("-")[0] || "fr";
  const T_static = emailTexts[currentLang] || emailTexts.fr;
  const catalog = T_static.extrasCatalog || emailTexts.fr.extrasCatalog || {};

  if (key === null || typeof key === "undefined") {
    return fallbackNameIfKeyMissing || "";
  }
  return catalog[key] || fallbackNameIfKeyMissing || key;
};

const SPA_ITEM_IDS = [
  "formuleSpa",
  "formuleSpaBottle",
  "packEssentiel",
  "packDetenteGourmet",
  "packRomantiqueGourmet",
  "packRacletteDetente",
  "packRacletteRomantique",
  "packBbqDetente",
  "packBbqRomantique",
];

export const sendBookingConfirmation = async (bookingData) => {
  const lang = bookingData.language?.split("-")[0] || "fr";
  const T = emailTexts[lang] || emailTexts.fr;
  const brandColor = "#668E73";
  // NEW: Define the target timezone. IANA format handles DST automatically.
  const timeZone = "Europe/Brussels";

  let spaSectionHtml = "";
  const hasSpaExtra = bookingData.extras?.some((extra) =>
    SPA_ITEM_IDS.includes(extra.id)
  );
  const isSpaPreferenceSet =
    bookingData.spaBookingPreference &&
    bookingData.spaBookingPreference !== "none";
  const displaySpaInfoInEmail = hasSpaExtra || isSpaPreferenceSet;

  if (displaySpaInfoInEmail) {
    if (
      bookingData.spaBookingPreference === "scheduled" &&
      (bookingData.spaDateTime || bookingData.spaInfo?.scheduledDateTime)
    ) {
      // Prioritize spaDateTime over spaInfo.scheduledDateTime for the most current date
      const spaStartJsDate = getJsDateForEmail(
        bookingData.spaDateTime || bookingData.spaInfo.scheduledDateTime
      );
      let spaEndJsDate = getJsDateForEmail(
        bookingData.spaEndDateTime || bookingData.spaInfo.endDateTime
      );
      if (
        !spaEndJsDate &&
        spaStartJsDate &&
        bookingData.spaInfo?.slots?.length > 0 &&
        bookingData.priceDetailsSnapshot?.spaSettings?.slotDurationMinutes
      ) {
        const totalDuration =
          bookingData.spaInfo.slots.length *
          bookingData.priceDetailsSnapshot.spaSettings.slotDurationMinutes;
        if (totalDuration > 0)
          spaEndJsDate = addMinutes(spaStartJsDate, totalDuration);
      } else if (
        !spaEndJsDate &&
        spaStartJsDate &&
        bookingData.spaSlotDuration &&
        typeof bookingData.spaSlotDuration === "number" &&
        bookingData.spaSlotDuration > 0
      ) {
        spaEndJsDate = addMinutes(spaStartJsDate, bookingData.spaSlotDuration);
      }

      if (spaStartJsDate && spaEndJsDate) {
        const emailLocale = getEmailDateFnLocale(lang);

        // CHANGED: Use formatInTimeZone to ensure the time is correct for the client
        const datePart = formatInTimeZone(spaStartJsDate, timeZone, "PPPP", {
          locale: emailLocale,
        });
        const startTimePart = formatInTimeZone(
          spaStartJsDate,
          timeZone,
          "HH:mm",
          {
            locale: emailLocale,
          }
        );
        const endTimePart = formatInTimeZone(spaEndJsDate, timeZone, "HH:mm", {
          locale: emailLocale,
        });

        const spaTimeText = T.spaScheduledFormat
          .replace("{{date}}", `<strong>${datePart}</strong>`)
          .replace("{{startTime}}", `<strong>${startTimePart}</strong>`)
          .replace("{{endTime}}", `<strong>${endTimePart}</strong>`);
        spaSectionHtml = `<div style="margin-top: 20px; padding: 15px; border: 1px solid #e0e0e0; border-radius: 8px; background-color: #f9f9f9;"><h3 style="margin-top:0; color: ${brandColor}; font-size: 1.1em; border-bottom: 1px solid #eee; padding-bottom: 8px; margin-bottom: 12px;">${T.spaScheduledTitle}</h3><p style="margin: 0; font-size: 0.95em; color: #333;">${spaTimeText}</p></div>`;
      } else if (spaStartJsDate) {
        // CHANGED: Also apply timezone-aware formatting to the fallback case
        const emailLocale = getEmailDateFnLocale(lang);
        const datePart = formatInTimeZone(spaStartJsDate, timeZone, "PPPP", {
          locale: emailLocale,
        });
        const startTimePart = formatInTimeZone(
          spaStartJsDate,
          timeZone,
          "HH:mm",
          {
            locale: emailLocale,
          }
        );
        spaSectionHtml = `<div style="margin-top: 20px; padding: 15px; border: 1px solid #e0e0e0; border-radius: 8px; background-color: #f9f9f9;"><h3 style="margin-top:0; color: ${brandColor}; font-size: 1.1em; border-bottom: 1px solid #eee; padding-bottom: 8px; margin-bottom: 12px;">${T.spaScheduledTitle}</h3><p style="margin: 0; font-size: 0.95em; color: #333;">Date: <strong>${datePart}</strong>, Heure: <strong>${startTimePart}</strong> (Fin non spécifiée)</p></div>`;
      }
    } else if (bookingData.spaBookingPreference === "later") {
      spaSectionHtml = `<div style="margin-top: 20px; padding: 15px; border: 1px solid #e0e0e0; border-radius: 8px; background-color: #f9f9f9;"><h3 style="margin-top:0; color: ${brandColor}; font-size: 1.1em; border-bottom: 1px solid #eee; padding-bottom: 8px; margin-bottom: 12px;">${
        T.spaScheduleLaterTitle
      }</h3><p style="margin: 5px 0; font-size: 0.95em; color: #333;">${
        T.spaScheduleLaterInstruction
      }</p><p style="margin: 5px 0; font-size: 0.95em;"><a href="mailto:${
        T.spaContactEmail
      }" style="color: ${brandColor}; text-decoration: none;">${
        T.spaContactEmail
      }</a>${
        T.spaContactPhone ? ` / ${T.spaContactPhone}` : ""
      }</p><p style="margin-top: 10px; font-size: 0.85em; color: #555;">${
        T.spaScheduleLaterPriority
      }</p></div>`;
    }
  }

  let freeDrinksHtml = "";
  if (
    bookingData.processedFreeDrinks &&
    bookingData.processedFreeDrinks.length > 0
  ) {
    freeDrinksHtml += `<h3 style="font-size: 1em; color: #4A5568; margin-top:15px; margin-bottom:5px;">${T.freeDrinksTitle}</h3>`;
    bookingData.processedFreeDrinks.forEach((drink) => {
      const translatedGrantorName = getTranslatedName(
        drink.grantorNameKeyForClient,
        lang,
        drink.paidExtraGrantor
      );
      let translatedDrinkOrChoiceName;
      if (drink.chooseNonAlcoholicLater) {
        translatedDrinkOrChoiceName = getTranslatedName(
          drink.choiceNameKeyForClient,
          lang,
          drink.drinkDetails
        );
      } else {
        translatedDrinkOrChoiceName = getTranslatedName(
          drink.drinkNameKeyForClient,
          lang,
          drink.drinkDetails
        );
      }
      const displayDrinkName = `${translatedGrantorName}: ${translatedDrinkOrChoiceName}`;
      freeDrinksHtml += `<p class="extra-item" style="color: #228B22;">${displayDrinkName} (x${
        drink.quantity || 1
      }) <span style="float:right;">${T.included}</span></p>`;
    });
  }

  let nonAlcoholicChoiceHtml = "";
  if (
    bookingData.freeDrinkInfo?.needsNonAlcoholicChoice &&
    bookingData.freeDrinkInfo.nonAlcoholicChoiceGrantors?.length > 0
  ) {
    nonAlcoholicChoiceHtml = `<div style="margin-top: 20px; padding: 15px; border: 1px solid #e0e0e0; border-radius: 8px; background-color: #fff9e6;"><h3 style="margin-top:0; color: ${brandColor}; font-size: 1.1em; border-bottom: 1px solid #eee; padding-bottom: 8px; margin-bottom: 12px;">${T.nonAlcoholicChoiceTitle}</h3>`;
    const translatedGrantorsForInstruction =
      bookingData.freeDrinkInfo.nonAlcoholicChoiceGrantors.map((grantorKey) =>
        getTranslatedName(grantorKey, lang, grantorKey)
      );
    translatedGrantorsForInstruction.forEach((translatedGrantor) => {
      nonAlcoholicChoiceHtml += `<p style="margin: 5px 0; font-size: 0.95em; color: #333;">${T.nonAlcoholicChoiceInstruction.replace(
        "{{grantor}}",
        `<strong>${translatedGrantor}</strong>`
      )}</p>`;
    });
    const guestNameForMailto = encodeURIComponent(
      bookingData.guestName ||
        `${bookingData.firstName} ${bookingData.lastName}`
    );
    const bookingIdForMailto = encodeURIComponent(
      bookingData.smoobuId || bookingData.id || ""
    );
    const arrivalDateForMailto = encodeURIComponent(
      formatDateForEmail(bookingData.arrivalDate, lang)
    );
    const departureDateForMailto = encodeURIComponent(
      formatDateForEmail(bookingData.departureDate, lang)
    );
    const joinerWord =
      lang === "fr" ? " et " : lang === "nl" ? " en " : " and ";
    const grantorsStringForMailto = encodeURIComponent(
      translatedGrantorsForInstruction.join(joinerWord)
    );
    const emailSubjectNonAlcoholic = encodeURIComponent(
      `Non-alcoholic choice - Booking ${bookingIdForMailto}`
    );
    const emailBodyNonAlcoholic = encodeURIComponent(
      `Hello,\n\nRegarding my booking (Ref: ${bookingIdForMailto}) from ${arrivalDateForMailto} to ${departureDateForMailto} for ${guestNameForMailto}.\n\n` +
        `For the included drink offer with ${grantorsStringForMailto}, I would like a non-alcoholic option.\n\n` +
        `Please let me know the available options.\n\nRegards,\n${guestNameForMailto}`
    );
    nonAlcoholicChoiceHtml += `<p style="margin: 10px 0 5px 0; font-size: 0.95em;">${
      T.nonAlcoholicChoiceContact
    }: <a href="mailto:${
      T.spaContactEmail
    }?subject=${emailSubjectNonAlcoholic}&body=${emailBodyNonAlcoholic}" style="color: ${brandColor}; text-decoration: none;">${
      T.spaContactEmail
    }</a>${
      T.spaContactPhone
        ? ` / <a href="tel:${T.spaContactPhone.replace(
            /\s/g,
            ""
          )}" style="color: ${brandColor}; text-decoration: none;">${
            T.spaContactPhone
          }</a>`
        : ""
    }</p></div>`;
  }

  const googleMapsLink = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    T.propertyAddress
  )}`;

  // Calculate final price manually to ensure all components are included
  const basePriceForEmail =
    bookingData.priceBreakdown?.roomBasePrice || bookingData.basePrice || 0;
  const guestFeesForEmail =
    bookingData.priceBreakdown?.calculatedGuestFees ||
    bookingData.guestFees ||
    0;
  const longStayDiscountForEmail =
    bookingData.priceBreakdown?.appliedLongStayDiscount || 0;
  const couponDiscountForEmail = bookingData.couponApplied?.discount || 0;

  // Calculate extras total
  let extrasTotal = 0;
  if (bookingData.extras && Array.isArray(bookingData.extras)) {
    extrasTotal = bookingData.extras.reduce((sum, extra) => {
      const extraAmount = parseFloat(extra.amount || 0);
      const extraPersonAmount =
        extra.extraPersonQuantity > 0 && extra.extraPersonAmount !== undefined
          ? parseFloat(extra.extraPersonAmount)
          : 0;
      return sum + extraAmount + extraPersonAmount;
    }, 0);
  }

  const finalPrice =
    basePriceForEmail +
    guestFeesForEmail +
    extrasTotal -
    longStayDiscountForEmail -
    couponDiscountForEmail;

  let glampingInfoHtml = "";
  const glampingIds = ["2565753", "1644643", "1946282"];
  if (glampingIds.includes(String(bookingData.apartmentId))) {
    glampingInfoHtml = `
      <div class="section additional-info">
        <h2>${T.glampingInfoTitle}</h2>
        <p>${T.glampingInfoText}</p>
      </div>
    `;
  }

  let terraceBbqInfoHtml = "";
  const terraceBbqIds = ["1946270", "1946276", "1946279"];
  if (terraceBbqIds.includes(String(bookingData.apartmentId))) {
    terraceBbqInfoHtml = `
      <div class="section additional-info">
        <h2>${T.terraceBbqInfoTitle}</h2>
        <p>${T.terraceBbqInfoText}</p>
      </div>
    `;
  }

  try {
    const emailContent = `
      <!DOCTYPE html>
      <html lang="${lang}">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${T.subject}</title>
        <style>
          body { margin: 0; padding: 0; background-color: #f4f4f4; }
          .email-container { font-family: Arial, Helvetica, sans-serif; max-width: 600px; margin: 20px auto; background-color: #ffffff; border: 1px solid #dddddd; border-radius: 8px; overflow: hidden; }
          .header { background-color: ${brandColor}; padding: 30px 20px; text-align: center; }
          .header img { max-width: 180px; margin-bottom: 10px; }
          .header h1 { color: #ffffff; margin: 0; font-size: 1.8em; }
          .content { padding: 25px; color: #333333; line-height: 1.6; }
          .content h2 { color: ${brandColor}; font-size: 1.3em; margin-top: 0; border-bottom: 2px solid #f0f0f0; padding-bottom: 10px; margin-bottom: 15px;}
          .content p { margin: 5px 0 10px 0; font-size: 0.95em;}
          .content strong { color: #444; }
          .section { margin-bottom: 25px; padding-bottom: 15px; border-bottom: 1px solid #eeeeee; }
          .section:last-child { border-bottom: none; margin-bottom: 0; padding-bottom: 0;}
          .price-details p { margin: 3px 0; }
          .total-price { font-weight: bold; font-size: 1.1em; margin-top: 15px; color: ${brandColor}; }
          .footer { background-color: #f9f9f9; padding: 20px; text-align: center; font-size: 0.85em; color: #777777; border-top: 1px solid #dddddd;}
          .footer a { color: ${brandColor}; text-decoration: none; }
          .extra-item { margin-left: 15px; font-size: 0.9em; }
          .extra-person-item { margin-left: 30px; font-size: 0.8em; color: #555; }
          .additional-info p { white-space: pre-wrap; }
        </style>
      </head>
      <body>
        <div class="email-container">
          <div class="header">
            <img src="https://i.imgur.com/NK1aEq3.png" alt="Logo Ferme de Basseilles">
            <h1>${T.subject}</h1>
          </div>
          <div class="content">
            <p>${T.greeting.replace(
              "{{guestName}}",
              bookingData.guestName || ""
            )}</p>
            <p>${T.confirmationMessage}</p>

            <div class="section">
              <h2>${T.stayDetails}</h2>
              <p><strong>${T.bookedAccommodation}:</strong> ${
      bookingData.property || "N/A"
    }</p>
              <p><strong>${T.arrival}:</strong> ${formatDateForEmail(
      bookingData.arrivalDate,
      lang
    )} ${bookingData.arrivalTime ? `à ${bookingData.arrivalTime}` : ""}</p>
              <p><strong>${T.departure}:</strong> ${formatDateForEmail(
      bookingData.departureDate,
      lang
    )} ${bookingData.departureTime ? `à ${bookingData.departureTime}` : ""}</p>
              <p><strong>${T.travelers}:</strong> ${bookingData.adults} ${
      T.adults
    }${
      bookingData.children > 0 ? `, ${bookingData.children} ${T.children}` : ""
    }</p>
              <p><strong>${T.smoobuBookingId}:</strong> ${
      bookingData.smoobuId || "N/A"
    }</p>
            </div>

            ${spaSectionHtml}
            ${nonAlcoholicChoiceHtml} 

            <div class="section price-details">
              <h2>${T.priceDetails}</h2>
              <p><strong>${T.basePrice}:</strong> ${basePriceForEmail.toFixed(
      2
    )} EUR</p>
              ${
                guestFeesForEmail > 0
                  ? `<p><strong>${T.guestFees.replace(
                      "{{persons}}",
                      String(
                        Math.max(
                          0,
                          (Number(bookingData.adults) || 0) +
                            (Number(bookingData.children) || 0) -
                            Number(
                              bookingData.priceDetailsSnapshot?.settings
                                ?.startingAtGuest ||
                                bookingData.priceBreakdown?.settings
                                  ?.startingAtGuest ||
                                2
                            )
                        )
                      )
                    )}:</strong> ${guestFeesForEmail.toFixed(2)} EUR</p>`
                  : ""
              }
              
              ${
                bookingData.extras && bookingData.extras.length > 0
                  ? `<h3 style="font-size: 1em; color: #4A5568; margin-top:15px; margin-bottom:5px;">${T.paidExtrasTitle}</h3>`
                  : ""
              }
              ${(bookingData.extras || [])
                .map((extra) => {
                  const translatedExtraName = getTranslatedName(
                    extra.nameKeyForClient,
                    lang,
                    extra.name
                  );
                  const translatedExtraPersonName = extra.extraPersonName
                    ? getTranslatedName(
                        "extras.additionalPerson",
                        lang,
                        extra.extraPersonName
                      )
                    : "";
                  return `
                  <p class="extra-item">${translatedExtraName} (x${
                    extra.quantity || 1
                  }): ${(extra.amount || 0).toFixed(2)} EUR</p>
                  ${
                    extra.hasExtraPerson && extra.extraPersonAmount > 0
                      ? `<p class="extra-person-item">${translatedExtraPersonName} (x${
                          extra.extraPersonQuantity || 1
                        }): ${(extra.extraPersonAmount || 0).toFixed(
                          2
                        )} EUR</p>`
                      : ""
                  }
                `;
                })
                .join("")}
              
              ${freeDrinksHtml} 

              ${
                longStayDiscountForEmail > 0
                  ? `<p style="color: #228B22;">${T.longStayDiscount.replace(
                      "{{percentage}}",
                      String(
                        bookingData.priceDetailsSnapshot?.settings
                          ?.lengthOfStayDiscount?.discountPercentage ||
                          bookingData.priceBreakdown?.settings
                            ?.lengthOfStayDiscount?.discountPercentage ||
                          ""
                      )
                    )}: -${longStayDiscountForEmail.toFixed(2)} EUR</p>`
                  : ""
              }
              ${
                bookingData.couponApplied && couponDiscountForEmail > 0
                  ? `<p style="color: #228B22;">${T.promoCode.replace(
                      "{{code}}",
                      bookingData.couponApplied.code
                    )} ${
                      bookingData.couponApplied.type === "percentage"
                        ? `(${bookingData.couponApplied.percentageValue}%)`
                        : ""
                    }: -${couponDiscountForEmail.toFixed(2)} EUR</p>`
                  : ""
              }
              
              <p class="total-price">${T.total}: ${finalPrice.toFixed(
      2
    )} EUR</p>
            </div>

            <div class="section">
                <p>${T.addExtrasText}</p>
            </div>

            <div class="section">
                <h2>${T.addressTitle}</h2>
                <p>${T.propertyAddress}</p>
                <p><a href="${googleMapsLink}" target="_blank" style="color: ${brandColor}; text-decoration:none;">${
      T.viewOnMap
    }</a></p>
            </div>

            <div class="section additional-info">
                <h2>${T.arrivalInstructionsTitle}</h2>
                <p>${T.arrivalInstructionsText}</p>
            </div>

            ${glampingInfoHtml}
            ${terraceBbqInfoHtml}

            <div class="section">
              <h2>${T.contactInfo}</h2>
              <p>${bookingData.guestName}</p>
              <p>Email: ${bookingData.email}</p>
              ${
                bookingData.phone
                  ? `<p><strong>${T.phone}:</strong> ${bookingData.phone}</p>`
                  : ""
              }
            </div>

            <p style="text-align:center; margin-top: 25px;">${T.closing}</p>
          </div>
          <div class="footer">
            <p>${T.team}</p>
            <p><a href="https://www.fermedebasseilles.be" style="color: ${brandColor};">www.fermedebasseilles.be</a></p>
          </div>
        </div>
      </body>
      </html>
    `;

    await transporter.sendMail({
      from: `Ferme de Basseilles <${process.env.EMAIL_USER}>`,
      to: bookingData.email,
      cc: "bookingconfirmation@fermedebasseilles.be",
      subject: T.subject,
      html: emailContent,
    });
  } catch (error) {
    console.error("🟥 Email: Error sending modern confirmation email:", error);
  }
};
