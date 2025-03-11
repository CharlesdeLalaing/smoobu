// config/config.js
import * as dotenv from "dotenv";
dotenv.config();

export const roomNames = {
  1946282: "Le Dôme des Libellules",
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
};

export const extrasFrenchNames = {
  // Packs
  "extras.packs.essential.name": "L'essentiel (pour 2)",
  "extras.packs.relaxGourmet.name": "Le détente gourmet (pour 2)",
  "extras.packs.racletteRelax.name": "La raclette en détente (pour 2)",
  "extras.packs.romanticGourmet.name": "Le romantique gourmet (pour 2)",
  "extras.packs.racletteRomantic.name": "La raclette romantique (pour 2)",
  "extras.packs.bbqRelax.name": "Le barbecue détente (pour 2)",
  "extras.packs.bbqRomantic.name": "Le romantique barbecue (pour 2)",
  "extras.formulesDecouverte.passion.name": "Formule passion (pour 2)",
  "extras.formulesDecouverte.birthday.name": "Formule anniversaire (pour 2)",

  // Spa
  "extras.spa.basic.name": "Formule SPA (2 pers)",
  "extras.spa.withBottle.name": "Formule SPA + bouteille (2 pers)",

  // Meals
  "extras.meals.meatballsLiege.name": "Boulettes de viande sauce liégeoise",
  "extras.meals.meatballsTomato.name": "Boulette de viande sauce tomate",
  "extras.meals.waterzooi.name": "Waterzooi de volaille",
  "extras.meals.chiliVeg.name": "Chili végétarien",
  "extras.meals.carrotSoup.name": "Velouté de carotte et cumin",

  // Meal Formulas
  "extras.formulesRepas.breakfast.name": "Formule petit-déjeuner (2 pers)",
  "extras.formulesRepas.gourmet.name": "Formule gourmet (2 pers)",
  "extras.formulesRepas.raclette.name": "Formule raclette (2 pers)",
  "extras.formulesRepas.bbq.name": "Formule barbecue (2 pers)",
  "extras.formulesRepas.apero.name": "Formule planche apéro (2 pers)",

  // Additional Person translation
  "extras.additionalPerson": "Personne supplémentaire",
};
