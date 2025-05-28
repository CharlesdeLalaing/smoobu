import { transporter } from "../../config/nodemailer.js";
import { format as formatFn, addMinutes } from "date-fns";
import { fr, enUS, nl } from "date-fns/locale";

// Helper to get date-fns locale for email
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

// Robust date conversion for Firestore Timestamps or ISO strings
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
    return formatFn(date, "d MMMM yyyy", {
      locale: getEmailDateFnLocale(lang),
    });
  } catch (e) {
    return "N/A";
  }
};

// Simple Email Text Translation Store (Expand this as needed)
// ADD new keys for free drinks and non-alcoholic choice.
const emailTexts = {
  fr: {
    subject: "Confirmation de réservation - Ferme de Basseilles",
    greeting: "Cher/Chère {{guestName}},",
    confirmationMessage:
      "Merci pour votre réservation ! Voici les détails de votre séjour :",
    stayDetails: "Détails du séjour",
    arrival: "Arrivée",
    departure: "Départ",
    travelers: "Voyageurs",
    adults: "adultes",
    children: "enfants",
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
    basePrice: "Prix de base",
    guestFees: "Frais pour {{persons}} personnes supplémentaires",
    longStayDiscount: "Réduction long séjour ({{percentage}}%)",
    promoCode: "Code promo ({{code}})",
    extras: "Extras Payants", // Changed from "Extras" to be specific
    freeDrinksTitle: "Boissons Offertes", // NEW
    nonAlcoholicChoiceTitle: "Choix de Boisson Non-Alcoolisée", // NEW
    nonAlcoholicChoiceInstruction:
      "Pour votre offre '{{grantor}}', vous avez choisi de sélectionner une boisson non-alcoolisée ultérieurement. Veuillez nous contacter pour préciser votre choix :", // NEW
    nonAlcoholicChoiceContact: "Contactez-nous pour votre choix", // NEW
    total: "Total",
    contactInfo: "Vos coordonnées",
    phone: "Téléphone",
    closing: "Nous avons hâte de vous accueillir !",
    team: "L'équipe de la Ferme de Basseilles",
    addressTitle: "Adresse de la propriété",
    propertyAddress: "Route de Basseilles 1, 5340 Mozet (Gesves), Belgique",
    viewOnMap: "Voir sur la carte",
    included: "Inclus", // NEW - For free drinks price column
  },
  en: {
    subject: "Booking Confirmation - Ferme de Basseilles",
    greeting: "Dear {{guestName}},",
    confirmationMessage:
      "Thank you for your booking! Here are your stay details:",
    stayDetails: "Stay Details",
    arrival: "Arrival",
    departure: "Departure",
    travelers: "Travelers",
    adults: "adults",
    children: "children",
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
    basePrice: "Base Price",
    guestFees: "Fee for {{persons}} extra persons",
    longStayDiscount: "Long stay discount ({{percentage}}%)",
    promoCode: "Promo code ({{code}})",
    extras: "Paid Extras", // Changed
    freeDrinksTitle: "Complimentary Drinks", // NEW
    nonAlcoholicChoiceTitle: "Non-Alcoholic Drink Choice", // NEW
    nonAlcoholicChoiceInstruction:
      "For your '{{grantor}}' offer, you've chosen to select a non-alcoholic beverage later. Please contact us to specify your choice:", // NEW
    nonAlcoholicChoiceContact: "Contact us for your choice", // NEW
    total: "Total",
    contactInfo: "Your Contact Information",
    phone: "Phone",
    closing: "We look forward to welcoming you!",
    team: "The Ferme de Basseilles Team",
    addressTitle: "Property Address",
    propertyAddress: "Route de Basseilles 1, 5340 Mozet (Gesves), Belgium",
    viewOnMap: "View on Map",
    included: "Included", // NEW
  },
  nl: {
    subject: "Boekingsbevestiging - Ferme de Basseilles",
    greeting: "Beste {{guestName}},",
    confirmationMessage:
      "Bedankt voor uw boeking! Hier zijn de details van uw verblijf:",
    stayDetails: "Verblijfsdetails",
    arrival: "Aankomst",
    departure: "Vertrek",
    travelers: "Reizigers",
    adults: "volwassenen",
    children: "kinderen",
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
    basePrice: "Basisprijs",
    guestFees: "Kosten voor {{persons}} extra personen",
    longStayDiscount: "Korting voor lang verblijf ({{percentage}}%)",
    promoCode: "Promotiecode({{code}})",
    extras: "Betaalde Extra's", // Changed
    freeDrinksTitle: "Gratis Dranken", // NEW
    nonAlcoholicChoiceTitle: "Keuze Niet-Alcoholische Drank", // NEW
    nonAlcoholicChoiceInstruction:
      "Voor uw '{{grantor}}' aanbod heeft u gekozen om later een niet-alcoholische drank te selecteren. Neem contact met ons op om uw keuze door te geven:", // NEW
    nonAlcoholicChoiceContact: "Neem contact op voor uw keuze", // NEW
    total: "Totaal",
    contactInfo: "Uw contactgegevens",
    phone: "Telefoon",
    closing: "We kijken ernaar uit u te mogen verwelkomen!",
    team: "Het team van Ferme de Basseilles",
    addressTitle: "Adres van de accommodatie",
    propertyAddress: "Route de Basseilles 1, 5340 Mozet (Gesves), België",
    viewOnMap: "Bekijk op kaart",
    included: "Inbegrepen", // NEW
  },
};

// You'll need your SPA_ITEM_IDS constant here or imported
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

const renderEmailExtraName = (extraName, lang, T_override = null) => {
  // `extraName` is assumed to be the final display string from bookingDoc.
  // No complex translation logic needed here if prepareBookingDocument did its job.
  return (
    extraName ||
    (T_override || emailTexts[lang] || emailTexts.fr).extras ||
    "Extra"
  );
};

export const sendBookingConfirmation = async (bookingData) => {
  const lang = bookingData.language?.split("-")[0] || "fr";
  const T = emailTexts[lang] || emailTexts.fr;
  const brandColor = "#668E73"; // Your brand green

  let spaSectionHtml = "";
  // ... (existing spaSectionHtml logic - this seems fine) ...
  const hasSpaExtra = bookingData.extras?.some((extra) =>
    SPA_ITEM_IDS.includes(extra.id || extra.smoobuId)
  ); // Check extra.id OR extra.smoobuId if that's what you have
  const isSpaPreferenceSet =
    bookingData.spaBookingPreference &&
    bookingData.spaBookingPreference !== "none";
  const displaySpaInfoInEmail = hasSpaExtra || isSpaPreferenceSet;

  if (displaySpaInfoInEmail) {
    if (
      bookingData.spaBookingPreference === "scheduled" &&
      bookingData.spaInfo?.scheduledDateTime
    ) {
      const spaStartJsDate = getJsDateForEmail(
        bookingData.spaInfo.scheduledDateTime
      );
      let spaEndJsDate = getJsDateForEmail(bookingData.spaInfo.endDateTime);

      // Fallback for spaEndJsDate if not directly available but calculable
      if (
        !spaEndJsDate &&
        spaStartJsDate &&
        bookingData.spaInfo?.slots?.length > 0 &&
        bookingData.priceDetailsSnapshot?.spaSettings?.slotDurationMinutes
      ) {
        // Using priceDetailsSnapshot.spaSettings as per one of your earlier files. Adjust if spaSettings is elsewhere in bookingDoc.
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
        // Fallback if spaSlotDuration is directly on bookingData
        spaEndJsDate = addMinutes(spaStartJsDate, bookingData.spaSlotDuration);
      }

      if (spaStartJsDate && spaEndJsDate) {
        const emailLocale = getEmailDateFnLocale(lang);
        const datePart = formatFn(spaStartJsDate, "PPPP", {
          locale: emailLocale,
        });
        const startTimePart = formatFn(spaStartJsDate, "HH:mm", {
          locale: emailLocale,
        });
        const endTimePart = formatFn(spaEndJsDate, "HH:mm", {
          locale: emailLocale,
        });
        const spaTimeText = T.spaScheduledFormat
          .replace("{{date}}", `<strong>${datePart}</strong>`)
          .replace("{{startTime}}", `<strong>${startTimePart}</strong>`)
          .replace("{{endTime}}", `<strong>${endTimePart}</strong>`);
        spaSectionHtml = `
          <div style="margin-top: 20px; padding: 15px; border: 1px solid #e0e0e0; border-radius: 8px; background-color: #f9f9f9;">
            <h3 style="margin-top:0; color: ${brandColor}; font-size: 1.1em; border-bottom: 1px solid #eee; padding-bottom: 8px; margin-bottom: 12px;">${T.spaScheduledTitle}</h3>
            <p style="margin: 0; font-size: 0.95em; color: #333;">${spaTimeText}</p>
          </div>`;
      } else if (spaStartJsDate) {
        // Only start time available
        const emailLocale = getEmailDateFnLocale(lang);
        const datePart = formatFn(spaStartJsDate, "PPPP", {
          locale: emailLocale,
        });
        const startTimePart = formatFn(spaStartJsDate, "HH:mm", {
          locale: emailLocale,
        });
        spaSectionHtml = `
          <div style="margin-top: 20px; padding: 15px; border: 1px solid #e0e0e0; border-radius: 8px; background-color: #f9f9f9;">
            <h3 style="margin-top:0; color: ${brandColor}; font-size: 1.1em; border-bottom: 1px solid #eee; padding-bottom: 8px; margin-bottom: 12px;">${T.spaScheduledTitle}</h3>
            <p style="margin: 0; font-size: 0.95em; color: #333;">Date: <strong>${datePart}</strong>, Heure: <strong>${startTimePart}</strong> (Fin non spécifiée)</p>
          </div>`;
      }
    } else if (bookingData.spaBookingPreference === "later") {
      spaSectionHtml = `
        <div style="margin-top: 20px; padding: 15px; border: 1px solid #e0e0e0; border-radius: 8px; background-color: #f9f9f9;">
          <h3 style="margin-top:0; color: ${brandColor}; font-size: 1.1em; border-bottom: 1px solid #eee; padding-bottom: 8px; margin-bottom: 12px;">${
        T.spaScheduleLaterTitle
      }</h3>
          <p style="margin: 5px 0; font-size: 0.95em; color: #333;">${
            T.spaScheduleLaterInstruction
          }</p>
          <p style="margin: 5px 0; font-size: 0.95em;">
            <a href="mailto:${
              T.spaContactEmail
            }" style="color: ${brandColor}; text-decoration: none;">${
        T.spaContactEmail
      }</a>
            ${T.spaContactPhone ? ` / ${T.spaContactPhone}` : ""}
          </p>
          <p style="margin-top: 10px; font-size: 0.85em; color: #555;">${
            T.spaScheduleLaterPriority
          }</p>
        </div>`;
    }
  }

  // --- NEW: Generate HTML for Free Drinks ---
  let freeDrinksHtml = "";
  if (
    bookingData.processedFreeDrinks &&
    bookingData.processedFreeDrinks.length > 0
  ) {
    freeDrinksHtml += `<h3 style="font-size: 1em; color: #4A5568; margin-top:15px; margin-bottom:5px;">${T.freeDrinksTitle}</h3>`;
    bookingData.processedFreeDrinks.forEach((drink) => {
      // drink.name is already prepared by prepareBookingDocument (e.g., "Package: Drink Name")
      freeDrinksHtml += `
        <p class="extra-item" style="color: #228B22;">${drink.name} (x${
        drink.quantity || 1
      })
          <span style="float:right;">${T.included}</span>
        </p>`;
    });
  }

  // --- NEW: Generate HTML for Non-Alcoholic Choice Later ---
  let nonAlcoholicChoiceHtml = "";
  if (
    bookingData.freeDrinkInfo?.needsNonAlcoholicChoice &&
    bookingData.freeDrinkInfo.nonAlcoholicChoiceGrantors?.length > 0
  ) {
    nonAlcoholicChoiceHtml = `
      <div style="margin-top: 20px; padding: 15px; border: 1px solid #e0e0e0; border-radius: 8px; background-color: #fff9e6;">
        <h3 style="margin-top:0; color: ${brandColor}; font-size: 1.1em; border-bottom: 1px solid #eee; padding-bottom: 8px; margin-bottom: 12px;">${T.nonAlcoholicChoiceTitle}</h3>`;

    // Loop through grantors to display individual instructions if needed, or a general one
    bookingData.freeDrinkInfo.nonAlcoholicChoiceGrantors.forEach((grantor) => {
      nonAlcoholicChoiceHtml += `<p style="margin: 5px 0; font-size: 0.95em; color: #333;">${T.nonAlcoholicChoiceInstruction.replace(
        "{{grantor}}",
        `<strong>${grantor}</strong>` // This line correctly personalizes the instruction per grantor
      )}</p>`;
    });

    // Prepare variables for the mailto link to keep it cleaner
    const guestNameForMailto = encodeURIComponent(
      bookingData.guestName ||
        `${bookingData.firstName} ${bookingData.lastName}`
    );
    const bookingIdForMailto = encodeURIComponent(
      bookingData.smoobuId || bookingData.id || ""
    ); // Use Smoobu ID if available, else Firestore ID
    const arrivalDateForMailto = encodeURIComponent(
      formatDateForEmail(bookingData.arrivalDate, lang)
    );
    const departureDateForMailto = encodeURIComponent(
      formatDateForEmail(bookingData.departureDate, lang)
    );
    const grantorsStringForMailto = encodeURIComponent(
      bookingData.freeDrinkInfo.nonAlcoholicChoiceGrantors.join(" et ")
    ); // "Package A et Package B"

    const emailSubjectNonAlcoholic = encodeURIComponent(
      // Use a generic subject or one from T if you add it
      `Choix boisson non-alcoolisée - Réservation ${bookingIdForMailto}`
    );
    const emailBodyNonAlcoholic = encodeURIComponent(
      `Bonjour,\n\nConcernant ma réservation (Réf: ${bookingIdForMailto}) du ${arrivalDateForMailto} au ${departureDateForMailto} pour ${guestNameForMailto}.\n\n` +
        `Pour l'offre de boisson incluse avec ${grantorsStringForMailto}, je souhaiterais une option non-alcoolisée.\n\n` +
        `Merci de me faire savoir les options disponibles. \n\nCordialement,\n${guestNameForMailto}`
    );

    // Add the contact information line with mailto and tel links
    nonAlcoholicChoiceHtml += `
        <p style="margin: 10px 0 5px 0; font-size: 0.95em;">
          ${T.nonAlcoholicChoiceContact}: <a href="mailto:${
      T.spaContactEmail
    }?subject=${emailSubjectNonAlcoholic}&body=${emailBodyNonAlcoholic}" style="color: ${brandColor}; text-decoration: none;">${
      T.spaContactEmail
    }</a>
          ${
            T.spaContactPhone
              ? ` / <a href="tel:${T.spaContactPhone.replace(
                  /\s/g,
                  ""
                )}" style="color: ${brandColor}; text-decoration: none;">${
                  T.spaContactPhone
                }</a>`
              : ""
          }
        </p>
      </div>`; // Close the main div for this section
  }

  const googleMapsLink = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    T.propertyAddress
  )}`;
  const finalPrice =
    bookingData.priceBreakdown?.finalPayableAmount || bookingData.price || 0;
  const basePriceForEmail =
    bookingData.priceBreakdown?.roomBasePrice || bookingData.basePrice || 0;
  const guestFeesForEmail =
    bookingData.priceBreakdown?.calculatedGuestFees ||
    bookingData.guestFees ||
    0;
  const longStayDiscountForEmail =
    bookingData.priceBreakdown?.appliedLongStayDiscount || 0;
  const couponDiscountForEmail = bookingData.couponApplied?.discount || 0;

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
                  ? `<h3 style="font-size: 1em; color: #4A5568; margin-top:15px; margin-bottom:5px;">${T.extras}</h3>`
                  : ""
              }
              ${(bookingData.extras || [])
                .map(
                  (extra) => `
                <p class="extra-item">${renderEmailExtraName(
                  extra.name,
                  lang,
                  T
                )} (x${extra.quantity || 1}): ${(extra.amount || 0).toFixed(
                    2
                  )} EUR</p>
                ${
                  extra.hasExtraPerson && extra.extraPersonAmount > 0
                    ? `<p class="extra-person-item">${renderEmailExtraName(
                        extra.extraPersonName,
                        lang,
                        T
                      )} (x${extra.extraPersonQuantity || 1}): ${(
                        extra.extraPersonAmount || 0
                      ).toFixed(2)} EUR</p>`
                    : ""
                }
              `
                )
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
                <h2>${T.addressTitle}</h2>
                <p>${T.propertyAddress}</p>
                <p><a href="${googleMapsLink}" target="_blank" style="color: ${brandColor}; text-decoration:none;">${
      T.viewOnMap
    }</a></p>
            </div>

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
      from: `Ferme de Basseilles <${process.env.EMAIL_USER}>`, // Ensure EMAIL_USER is set
      to: bookingData.email,
      subject: T.subject,
      html: emailContent,
    });

    console.log(
      "🟩 Email: Modern confirmation email sent successfully to:",
      bookingData.email
    );
  } catch (error) {
    console.error("🟥 Email: Error sending modern confirmation email:", error);
    // Rethrow or handle as per your application's error strategy
    // throw error; // if you want the caller (storeBookingInFirebase) to know about it
  }
};
