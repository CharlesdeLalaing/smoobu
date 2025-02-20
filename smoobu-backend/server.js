import express from "express";
import cors from "cors";
import axios from "axios";
import Stripe from "stripe";
import nodemailer from "nodemailer";
import * as dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname } from "path";
import cron from "node-cron";

import {
  doc,
  updateDoc,
  increment,
  arrayUnion,
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";

import { Timestamp } from "firebase/firestore";

import { db, FieldValue } from "./firebase-config.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const roomNames = {
  1946282: "Le Dôme des Libellules",
  1644643: "La Bulle du Ruisseau",
  1946279: "Le Moulin",
  1946276: "La Chambre de Blé",
  1946270: "Le Logis",
};




dotenv.config();

async function syncReservations() {
  try {
    console.log("🟦 Starting reservation sync...", new Date().toISOString());

    const channelMapping = {
      // Channel IDs
      2323525: "Website",
      2323516: "Blocked",
      2323543: "Airbnb",

      // Channel Names
      Homepage: "Website",
      "Direct booking": "Website",
      "Homepage direct": "Website",
      Direct: "Website",
      Airbnb: "Airbnb",
      airbnb: "Airbnb",
      "booking.com": "Booking.com",
      "Booking.com": "Booking.com",
      "Blocked channel": "Blocked",
      Blocked: "Blocked",
    };

    const endDate = new Date().toISOString().split("T")[0];
    const startDate = new Date(Date.now() - 730 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];

    const response = await axios.get(
      "https://login.smoobu.com/api/reservations",
      {
        headers: {
          "Api-Key": "UZFV5QRY0ExHUfJi3c1DIG8Bpwet1X4knWa8rMkj6o",
          "Cache-Control": "no-cache",
        },
        params: {
          arrivalFrom: startDate,
          arrivalTo: endDate,
          showCancellation: true,
          excludeBlocked: false,
          pageSize: 100,
        },
      }
    );

    console.log(
      "Full booking details:",
      response.data.bookings?.map((booking) => ({
        id: booking.id,
        channel: booking.channel,
        channelId: booking.channel?.id,
        channelName: booking.channel?.name,
        arrival: booking.arrival,
        guest: booking["guest-name"],
      }))
    );



    const reservations = response.data.bookings || [];
    console.log(`🟦 Found ${reservations.length} reservations to process`);
    

    let successCount = 0;
    let errorCount = 0;

    for (const reservation of reservations) {
      try {
         console.log(
           `🟦 Processing reservation ${reservation.id} from channel:`,
           {
             rawChannelName: reservation.channel?.name,
             mappedChannelName:
               channelMapping[reservation.channel?.name] || "Website",
           }
         );


        // Get price elements
        const priceElementsResponse = await axios.get(
          `https://login.smoobu.com/api/reservations/${reservation.id}/price-elements`,
          {
            headers: {
              "Api-Key": "UZFV5QRY0ExHUfJi3c1DIG8Bpwet1X4knWa8rMkj6o",
              "Cache-Control": "no-cache",
            },
          }
        );

        const priceElements = priceElementsResponse.data.priceElements || [];

        // Calculate all the necessary price details...
        const basePrice =
          priceElements.find(
            (el) =>
              el.type === "base" ||
              el.name?.toLowerCase().includes("prix de base")
          )?.amount || 0;

        const extras = priceElements.filter((element) => {
          const name = element.name?.toLowerCase() || "";
          return (
            element.type === "addon" &&
            !name.includes("commission") &&
            !name.includes("cleaning fee")
          );
        });

        // Map the channel correctly
        const channelName = reservation.channel?.name || "Website";
        const mappedChannel = channelMapping[channelName] || channelName;

  console.log("Channel mapping for reservation " + reservation.id, {
    rawChannelName: reservation.channel?.name,
    rawChannelId: reservation.channel?.id,
    mappedChannel: reservation.channel
      ? channelMapping[reservation.channel.name] ||
        channelMapping[reservation.channel.id] ||
        reservation.channel.name ||
        "Unknown"
      : "Unknown",
  });

        // Prepare document with correct channel mapping
        const bookingDoc = {
          smoobuId: reservation.id,
          firstName: reservation.firstName || "",
          lastName: reservation.lastName || "",
          guestName:
            reservation["guest-name"] ||
            `${reservation.firstName || ""} ${
              reservation.lastName || ""
            }`.trim() ||
            "Sans nom",
          email: reservation.email || "",
          phone: reservation.phone || "",
          address: reservation.address || "",
          adults: parseInt(reservation.adults) || 0,
          children: parseInt(reservation.children) || 0,
          arrivalDate: reservation.arrival,
          departureDate: reservation.departure,
          checkInTime: reservation["check-in"] || "",
          checkOutTime: reservation["check-out"] || "",
          apartmentId: reservation.apartment?.id,
          apartmentName:
            roomNames[reservation.apartment?.id] || reservation.apartment?.name,
          channelObject: reservation.channel,
          channelId: reservation.channel?.id,
          channelName: reservation.channel?.name,
          notice: reservation.notice || "",
          status:
            reservation.type === "cancellation" ? "cancelled" : "confirmed",
          basePrice: parseFloat(basePrice),
          price: parseFloat(reservation.price),
          priceDetails: {
            basePrice: parseFloat(basePrice),
            extrasTotal: extras.reduce((sum, extra) => sum + extra.amount, 0),
            extras: extras.map((extra) => ({
              name: extra.name,
              amount: parseFloat(extra.amount),
              quantity: parseInt(extra.quantity) || 1,
            })),
          },
          portalName: reservation.channel
            ? channelMapping[reservation.channel.id] ||
              channelMapping[reservation.channel.name] ||
              reservation.channel.name
            : "Website",
          createdAt: reservation["created-at"] || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          lastSyncedAt: new Date().toISOString(),
        };

        // Save to the "bookings" collection (not "reservations")
        await db
          .collection("bookings")
          .doc(reservation.id.toString())
          .set(bookingDoc, { merge: true });

        console.log(
          `🟩 Successfully processed ${mappedChannel} booking ${reservation.id}`
        );
        successCount++;

        // Add delay between requests
        await new Promise((resolve) => setTimeout(resolve, 500));
      } catch (reservationError) {
        console.error(
          `🟥 Error processing reservation ${reservation.id}:`,
          reservationError
        );
        errorCount++;
        continue;
      }
    }

    console.log("🟦 Sync Summary:", {
      totalReservations: reservations.length,
      successfullyProcessed: successCount,
      errors: errorCount,
      completedAt: new Date().toISOString(),
    });

    return {
      success: true,
      message: "Sync completed successfully",
      stats: {
        total: reservations.length,
        successful: successCount,
        failed: errorCount,
      },
    };
  } catch (error) {
    console.error("🟥 Error in syncReservations:", error);
    throw error;
  }
}


const app = express();


app.use((req, res, next) => {
  // console.log('Incoming Origin:', req.headers.origin);
  next();
});

app.options("/webhook", cors());

const verifyWordPressAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing authorization header" });
  }

  const token = authHeader.split(" ")[1];

  if (token !== process.env.WP_API_TOKEN) {
    return res.status(401).json({ error: "Invalid token" });
  }

  next();
};

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const pendingBookings = new Map();

// After imports, with other configurations
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

// Add this function near the top with other helpers
const formatDate = (dateString) => {
  return new Date(dateString).toLocaleDateString("fr-BE", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
};



const sendBookingConfirmation = async (bookingData) => {
  try {
    const emailContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1>Confirmation de réservation - Ferme de Basseilles</h1>
        
        <div style="margin: 20px 0;">
          <h2>Détails du séjour</h2>
          <p>Arrivée: ${formatDate(bookingData.arrivalDate)} à ${
      bookingData.arrivalTime
    }</p>
          <p>Départ: ${formatDate(bookingData.departureDate)}</p>
          <p>Voyageurs: ${bookingData.adults} adultes${
      bookingData.children ? `, ${bookingData.children} enfants` : ""
    }</p>
        </div>

        <div style="margin: 20px 0;">
          <h2>Détails des prix</h2>
          <p>Prix de base: ${bookingData.basePrice.toFixed(2)} EUR</p>
          ${bookingData.extras
            ?.map(
              (extra) => `
            <p>${extra.name} (x${extra.quantity}): ${extra.amount.toFixed(
                2
              )} EUR</p>
            ${
              extra.extraPersonQuantity
                ? `<p>Personne supplémentaire (x${
                    extra.extraPersonQuantity
                  }): ${extra.extraPersonAmount.toFixed(2)} EUR</p>`
                : ""
            }
          `
            )
            .join("")}
          ${
            bookingData.priceDetails?.discount
              ? `<p style="color: #22c55e;">Réduction long séjour (${
                  bookingData.priceDetails.settings.lengthOfStayDiscount
                    .discountPercentage
                }%): -${bookingData.priceDetails.discount.toFixed(2)} EUR</p>`
              : ""
          }
          ${
            bookingData.couponApplied
              ? `<p style="color: #22c55e;">
              ${
                bookingData.couponApplied.type === "percentage"
                  ? `Code promo (${bookingData.couponApplied.code} - ${
                      bookingData.couponApplied.percentageValue
                    }%): -${(bookingData.couponApplied.discount || 0).toFixed(
                      2
                    )} EUR`
                  : `Code promo (${bookingData.couponApplied.code}): -${(
                      bookingData.couponApplied.discount || 0
                    ).toFixed(2)} EUR`
              }
            </p>`
              : ""
          }
          <p style="font-weight: bold; margin-top: 10px;">Total: ${bookingData.price.toFixed(
            2
          )} EUR</p>
        </div>

        <div style="margin: 20px 0;">
          <h2>Coordonnées</h2>
          <p>${bookingData.firstName} ${bookingData.lastName}</p>
          <p>Email: ${bookingData.email}</p>
          ${bookingData.phone ? `<p>Téléphone: ${bookingData.phone}</p>` : ""}
        </div>

        <div style="margin-top: 30px;">
          <p>À bientôt!</p>
          <p>L'équipe de la Ferme de Basseilles</p>
        </div>
      </div>
    `;

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: bookingData.email,
      subject: "Confirmation de réservation - Ferme de Basseilles",
      html: emailContent,
    });

    console.log("Confirmation email sent to:", bookingData.email);
  } catch (error) {
    console.error("Error sending confirmation email:", error);
  }
};

const discountSettings = {
  1946282: {
    // Le dôme de libellules
    cleaningFee: 0,
    prepayment: 0,
    minDaysBetweenBookingAndArrival: 1,
    extraGuestsPerNight: 20,
    startingAtGuest: 2, // Extra fee starts from 3rd guest
    maxGuests: 4,
    extraChildPerNight: 20,
    lengthOfStayDiscount: {
      minNights: 0,
      discountPercentage: 0,
    },
  },
  1644643: {
    // La Bulle du Ruisseau
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
  1946279: {
    // Le Moulin
    cleaningFee: 0,
    prepayment: 0,
    minDaysBetweenBookingAndArrival: 1,
    extraGuestsPerNight: 20,
    startingAtGuest: 2, // Extra fee starts from 3rd guest
    maxGuests: 4, // This was correct but other settings need adjustment
    extraChildPerNight: 20,
    lengthOfStayDiscount: {
      minNights: 2,
      discountPercentage: 40,
    },
  },
  1946276: {
    // La chambre de blé
    cleaningFee: 0,
    prepayment: 0,
    minDaysBetweenBookingAndArrival: 1,
    extraGuestsPerNight: 20,
    startingAtGuest: 2, // Extra fee starts from 3rd guest
    maxGuests: 4, // This was correct but other settings need adjustment
    extraChildPerNight: 20,
    lengthOfStayDiscount: {
      minNights: 2,
      discountPercentage: 40,
    },
  },
  1946270: {
    // Le Logis
    cleaningFee: 0,
    prepayment: 0,
    minDaysBetweenBookingAndArrival: 1,
    extraGuestsPerNight: 20,
    startingAtGuest: 4, // Extra fee starts from 5th guest
    maxGuests: 8,
    extraChildPerNight: 20,
    lengthOfStayDiscount: {
      minNights: 3,
      discountPercentage: 30,
    },
  },
};

// Create a mapping of translation keys to French names
const extrasFrenchNames = {
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

// Add this near your other constants at the top of server.js


// Modified processExtraName function
const processExtraName = (extra) => {
  // If the name is a translation key (starts with "extras.")
  if (extra.name && extra.name.startsWith("extras.")) {
    return {
      nameKey: extra.name, // Store the original translation key for frontend
      name: extrasFrenchNames[extra.name] || extra.name, // Use French name for Smoobu
    };
  }
  // For direct names (like drinks that don't need translation)
  return {
    name: extra.name,
    nameKey: null,
  };
};

// Calculate price with settings
const calculatePriceWithSettings = (
  rates,
  startDate,
  endDate,
  numberOfGuests,
  numberOfChildren,
  settings
) => {
  let totalPrice = 0;
  let numberOfNights = 0;
  const currentDate = new Date(startDate);
  const endDateTime = new Date(endDate);

  // Calculate base room price
  while (currentDate <= endDateTime) {
    const dateStr = currentDate.toISOString().split("T")[0];
    if (dateStr !== endDateTime.toISOString().split("T")[0]) {
      const dayRate = rates[dateStr];
      if (dayRate && dayRate.available === 1) {
        totalPrice += dayRate.price;
        numberOfNights++;
      }
    }
    currentDate.setDate(currentDate.getDate() + 1);
  }

  // Calculate long stay discount only on the base room price
  let discount = 0;
  if (numberOfNights >= settings.lengthOfStayDiscount.minNights) {
    discount =
      (totalPrice * settings.lengthOfStayDiscount.discountPercentage) / 100;
  }

  // Calculate flat guest fees (not per night)
  const totalGuests = numberOfGuests + numberOfChildren;
  const extraGuests = Math.max(0, totalGuests - settings.startingAtGuest);
  const guestFees = extraGuests * settings.extraGuestsPerNight; // Now treated as a flat fee

  // Build price elements array
  const priceElements = [
    {
      type: "basePrice",
      name: "Prix de base",
      amount: totalPrice,
      currencyCode: "EUR",
    },
  ];

  if (guestFees > 0) {
    priceElements.push({
      type: "addon",
      name: "Frais de personnes supplémentaires",
      amount: guestFees,
      currencyCode: "EUR",
    });
  }

  if (settings.cleaningFee > 0) {
    priceElements.push({
      type: "cleaningFee",
      name: "Frais de nettoyage",
      amount: settings.cleaningFee,
      currencyCode: "EUR",
    });
  }

  if (discount > 0) {
    priceElements.push({
      type: "longStayDiscount",
      name: `Réduction long séjour (${settings.lengthOfStayDiscount.discountPercentage}%)`,
      amount: -discount,
      currencyCode: "EUR",
    });
  }

  // Calculate final price including flat guest fees
  const subtotal = totalPrice + guestFees + settings.cleaningFee;
  const finalPrice = subtotal - discount;

  return {
    originalPrice: totalPrice,
    guestFees, // Added this to make it explicit in the return
    cleaningFee: settings.cleaningFee,
    discount,
    finalPrice,
    numberOfNights,
    priceElements,
    settings,
  };
};

// Webhook endpoint must come before JSON middleware
// Helper function for delays
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));





app.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    console.log("🟦 Webhook received:", new Date().toISOString());
    const sig = req.headers["stripe-signature"];
    let event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        "whsec_d9b86273072de6b319134fbc08752e2b4e66bae72aaa2cf4cb7db1411974c20a"
      );

      if (event.type === "payment_intent.succeeded") {
        const paymentIntent = event.data.object;
        console.log("🟦 Payment Intent metadata:", paymentIntent.metadata);

        const bookingReference = paymentIntent.metadata.bookingReference;
        console.log("🟦 Booking Reference:", bookingReference);

        const bookingData = pendingBookings.get(bookingReference);
        console.log("🟦 Retrieved booking data:", {
          hasBookingData: !!bookingData,
          couponData: bookingData?.couponApplied,
          bookingReference,
        });

        if (!bookingData) {
          console.error(
            "No booking data found for reference:",
            bookingReference
          );
          return;
        }

        try {
          // Create the main booking in Smoobu
          const smoobuResponse = await axios.post(
            "https://login.smoobu.com/api/reservations",
            {
              arrivalDate: bookingData.arrivalDate,
              departureDate: bookingData.departureDate,
              arrivalTime: bookingData.arrivalTime,
              channelId: bookingData.channelId,
              apartmentId: bookingData.apartmentId,
              firstName: bookingData.firstName,
              lastName: bookingData.lastName,
              email: bookingData.email,
              phone: bookingData.phone,
              notice: bookingData.notice,
              adults: Number(bookingData.adults),
              children: Number(bookingData.children),
              price: Number(bookingData.price),
              priceStatus: 1,
              deposit: Number(bookingData.deposit),
              depositStatus: 1,
              language: "en",
            },
            {
              headers: {
                "Api-Key": "UZFV5QRY0ExHUfJi3c1DIG8Bpwet1X4knWa8rMkj6o",
                "Content-Type": "application/json",
              },
            }
          );

          const bookingDoc = {
            ...bookingData,
            smoobuReservationId: smoobuResponse.data.id,
            paymentIntentId: paymentIntent.id,
            stripePaymentStatus: paymentIntent.status,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            price: Number(bookingData.price),
            basePrice: Number(bookingData.basePrice),
            priceDetails: {
              basePrice: Number(bookingData.basePrice),
              finalPrice:
                Number(bookingData.basePrice) -
                Number(bookingData.priceDetails?.discount || 0) -
                (bookingData.couponApplied
                  ? Number(bookingData.couponApplied.discount)
                  : 0),
              extrasTotal:
                bookingData.extras?.reduce((sum, extra) => {
                  const extraAmount = Number(extra.amount);
                  const extraPersonAmount =
                    extra.extraPersonQuantity > 0
                      ? Number(extra.extraPersonPrice) *
                        Number(extra.extraPersonQuantity)
                      : 0;
                  return sum + extraAmount + extraPersonAmount;
                }, 0) || 0,
              discount: Number(bookingData.priceDetails?.discount || 0),
              calculatedDiscounts: {
                longStay: Number(bookingData.priceDetails?.discount || 0),
                coupon: bookingData.couponApplied
                  ? Number(bookingData.couponApplied.discount)
                  : 0,
              },
              settings: bookingData.priceDetails?.settings || {},
            },
            extras: bookingData.extras
              ? bookingData.extras.map((extra) => {
                  const translatedExtra = {
                    ...extra,
                    amount: Number(extra.amount),
                    quantity: Number(extra.quantity),
                    extraPersonAmount:
                      extra.extraPersonQuantity > 0
                        ? Number(extra.extraPersonPrice) *
                          Number(extra.extraPersonQuantity)
                        : 0,
                    extraPersonQuantity: Number(extra.extraPersonQuantity || 0),
                    extraPersonPrice: Number(extra.extraPersonPrice || 0),
                    name: extra.name.startsWith("extras.")
                      ? extrasFrenchNames[extra.name] || extra.name
                      : extra.name,
                  };

                  if (extra.extraPersonQuantity > 0) {
                    translatedExtra.extraPersonName =
                      extrasFrenchNames["extras.additionalPerson"];
                  }

                  return translatedExtra;
                })
              : [],
            appliedCoupon: bookingData.couponApplied
              ? {
                  code: bookingData.couponApplied.code,
                  type: bookingData.couponApplied.type,
                  discount: Number(bookingData.couponApplied.discount) || 0,
                  percentageValue:
                    bookingData.couponApplied.type === "percentage"
                      ? Number(bookingData.couponApplied.percentageValue) ||
                        null
                      : null,
                }
              : null,
          };
          try {
            const docRef = await db.collection("bookings").add(bookingDoc);
            console.log("🟩 Booking stored in Firebase with ID:", docRef.id);

            await sendBookingConfirmation(bookingDoc);
          } catch (firebaseError) {
            console.error("🟥 Error storing in Firebase:", firebaseError);
          }

          const reservationId = smoobuResponse.data.id;
          await wait(2000);

          // First add base price
          try {
            await axios.post(
              `https://login.smoobu.com/api/reservations/${reservationId}/price-elements`,
              {
                type: "base",
                name: "Prix de base",
                amount: bookingData.basePrice,
                quantity: 1,
                currencyCode: "EUR",
              },
              {
                headers: {
                  "Api-Key": "UZFV5QRY0ExHUfJi3c1DIG8Bpwet1X4knWa8rMkj6o",
                  "Content-Type": "application/json",
                },
              }
            );
            await wait(1000);
          } catch (error) {
            console.error("🟥 Failed to add base price:", error);
          }

          // Add guest fees if they exist
          if (bookingData.guestFees > 0) {
            try {
              await axios.post(
                `https://login.smoobu.com/api/reservations/${reservationId}/price-elements`,
                {
                  type: "addon",
                  name: "Frais de personnes supplémentaires",
                  amount: bookingData.guestFees,
                  quantity: 1,
                  currencyCode: "EUR",
                },
                {
                  headers: {
                    "Api-Key": "UZFV5QRY0ExHUfJi3c1DIG8Bpwet1X4knWa8rMkj6o",
                    "Content-Type": "application/json",
                  },
                }
              );
              await wait(1000);
            } catch (error) {
              console.error("🟥 Failed to add guest fees:", error);
            }
          }

          // Process extras if they exist
          if (bookingData.extras && bookingData.extras.length > 0) {
            for (const extra of bookingData.extras) {
              let retryCount = 0;
              const maxRetries = 3;

              while (retryCount < maxRetries) {
                try {
                  const processedName = {
                    nameKey: extra.name.startsWith("extras.")
                      ? extra.name
                      : null,
                    name: extra.name.startsWith("extras.")
                      ? extrasFrenchNames[extra.name]
                      : extra.name,
                  };

                  if (
                    processedName.name &&
                    !processedName.name
                      .toLowerCase()
                      .includes("personne supplémentaire".toLowerCase())
                  ) {
                    await axios.post(
                      `https://login.smoobu.com/api/reservations/${reservationId}/price-elements`,
                      {
                        type: "addon",
                        name: processedName.name,
                        nameKey: processedName.nameKey,
                        amount: extra.amount,
                        quantity: extra.quantity,
                        currencyCode: "EUR",
                      },
                      {
                        headers: {
                          "Api-Key":
                            "UZFV5QRY0ExHUfJi3c1DIG8Bpwet1X4knWa8rMkj6o",
                          "Content-Type": "application/json",
                        },
                      }
                    );
                    await wait(1000);
                  }

                  if (extra.extraPersonQuantity > 0 && extra.extraPersonPrice) {
                    await axios.post(
                      `https://login.smoobu.com/api/reservations/${reservationId}/price-elements`,
                      {
                        type: "addon",
                        name: `${processedName.name} - ${extrasFrenchNames["extras.additionalPerson"]}`,
                        nameKey: "extras.additionalPerson",
                        amount:
                          extra.extraPersonPrice * extra.extraPersonQuantity,
                        quantity: extra.extraPersonQuantity,
                        currencyCode: "EUR",
                      },
                      {
                        headers: {
                          "Api-Key":
                            "UZFV5QRY0ExHUfJi3c1DIG8Bpwet1X4knWa8rMkj6o",
                          "Content-Type": "application/json",
                        },
                      }
                    );
                    await wait(1000);
                  }

                  break;
                } catch (extraError) {
                  retryCount++;
                  if (retryCount === maxRetries) {
                    console.error("🟥 Failed to add extra:", extraError);
                  } else {
                    await wait(2000 * retryCount);
                    continue;
                  }
                }
              }
            }
          }

          // Add coupon discount if exists
          if (bookingData.couponApplied) {
            let retryCount = 0;
            const maxRetries = 3;

            while (retryCount < maxRetries) {
              try {
                const couponName =
                  bookingData.couponApplied.type === "percentage"
                    ? `Code promo: ${bookingData.couponApplied.code} (-${bookingData.couponApplied.percentageValue}%)`
                    : `Code promo: ${bookingData.couponApplied.code} (-${bookingData.couponApplied.discount}€)`;

                await axios.post(
                  `https://login.smoobu.com/api/reservations/${reservationId}/price-elements`,
                  {
                    type: "discount",
                    name: couponName,
                    amount: -bookingData.couponApplied.discount,
                    quantity: 1,
                    currencyCode: "EUR",
                  },
                  {
                    headers: {
                      "Api-Key": "UZFV5QRY0ExHUfJi3c1DIG8Bpwet1X4knWa8rMkj6o",
                      "Content-Type": "application/json",
                    },
                  }
                );
                await wait(1000);
                break;
              } catch (couponError) {
                retryCount++;
                if (retryCount === maxRetries) {
                  console.error(
                    "🟥 Failed to add coupon discount:",
                    couponError
                  );
                } else {
                  await wait(2000 * retryCount);
                  continue;
                }
              }
            }
          }

          // Add long stay discount if applicable
          if (bookingData.priceDetails?.discount > 0) {
            let retryCount = 0;
            const maxRetries = 3;

            while (retryCount < maxRetries) {
              try {
                await axios.post(
                  `https://login.smoobu.com/api/reservations/${reservationId}/price-elements`,
                  {
                    type: "discount",
                    name: `Réduction long séjour (${bookingData.priceDetails.settings.lengthOfStayDiscount.discountPercentage}%)`,
                    amount: -bookingData.priceDetails.discount,
                    quantity: 1,
                    currencyCode: "EUR",
                  },
                  {
                    headers: {
                      "Api-Key": "UZFV5QRY0ExHUfJi3c1DIG8Bpwet1X4knWa8rMkj6o",
                      "Content-Type": "application/json",
                    },
                  }
                );
                break;
              } catch (discountError) {
                retryCount++;
                if (retryCount === maxRetries) {
                  console.error(
                    "🟥 Failed to add long stay discount:",
                    discountError
                  );
                } else {
                  await wait(2000 * retryCount);
                  continue;
                }
              }
            }
          }

          // Update coupon usage in Firebase if applicable
          if (bookingData.couponApplied?.code) {
            console.log("🟨 Starting coupon update process:", {
              couponCode: bookingData.couponApplied.code,
              couponData: bookingData.couponApplied,
            });

            try {
              const couponsRef = db.collection("coupons");
              const couponQuery = await couponsRef
                .where("code", "==", bookingData.couponApplied.code)
                .get();

              if (!couponQuery.empty) {
                const couponDoc = couponQuery.docs[0];
                console.log("🟨 Found coupon document:", couponDoc.id);

                const usageRecord = {
                  email: bookingData.email,
                  name: `${bookingData.firstName} ${bookingData.lastName}`,
                  bookingAmount: bookingData.price,
                  usageDate: new Date().toISOString(),
                  discountApplied: bookingData.couponApplied.discount,
                };

                const newStatus =
                  bookingData.couponApplied.code === "POTES"
                    ? "active"
                    : "inactive";

                if (bookingData.couponApplied.code === "POTES") {
                  await couponDoc.ref.update({
                    usageHistory: FieldValue.arrayUnion(usageRecord),
                  });

                  console.log("🟩 POTES coupon usage recorded:", {
                    couponId: couponDoc.id,
                    code: bookingData.couponApplied.code,
                  });
                } else {
                  await couponDoc.ref.update({
                    status: newStatus,
                    usedCount: FieldValue.increment(1),
                    lastUsedDate: new Date().toISOString(),
                    lastUsedBy: bookingData.email,
                    usageHistory: FieldValue.arrayUnion(usageRecord),
                    updatedAt: new Date().toISOString(),
                  });

                  console.log("🟩 Coupon update successful:", {
                    couponId: couponDoc.id,
                    code: bookingData.couponApplied.code,
                    newStatus: newStatus,
                  });
                }
              } else {
                console.error(
                  "🟥 Coupon document not found for code:",
                  bookingData.couponApplied.code
                );
              }
            } catch (error) {
              console.error("🟥 Error updating coupon:", {
                error: error.message,
                stack: error.stack,
                couponData: bookingData.couponApplied,
              });
            }
          }

          pendingBookings.delete(bookingReference);
          console.log("🟩 Booking process completed successfully");
        } catch (error) {
          console.error("🟥 Error in booking creation:", {
            error: error.message,
            details: error.response?.data,
          });
          return res.status(500).json({
            error: "Failed to create booking in Smoobu",
            details: error.response?.data || error.message,
          });
        }
      }

      res.json({ received: true });
    } catch (err) {
      console.error("🟥 Webhook Error:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }
  }
);

// Use JSON parsing and CORS for all other routes
app.use(express.json());
app.use(
  cors({
    origin: [
      "https://reservation.fermedebasseilles.be",
      "https://smoobu-test.vercel.app",
      "http://localhost:5173",
      "http://localhost:3000",
    ],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "Accept",
      "Origin",
    ],
  })
);



app.get("/sync-reservations", async (req, res) => {
  try {
    console.log("Starting reservation sync...");
    const result = await syncReservations();
    console.log("Sync completed:", result);
    res.json(result);
  } catch (error) {
    console.error("Error in sync endpoint:", error);
    res.status(500).json({
      error: "Failed to sync reservations",
      details: error.message,
    });
  }
});


// In your server.js
// Add or update this endpoint in your server.js
app.get("/api/fetch-and-sync", async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: "Missing date parameters"
      });
    }

    console.log("🟦 Starting fetch and sync process...", { startDate, endDate });
    
    // 1. Fetch bookings from Smoobu API
    const response = await axios.get(
      "https://login.smoobu.com/api/reservations",
      {
        headers: {
          "Api-Key": "UZFV5QRY0ExHUfJi3c1DIG8Bpwet1X4knWa8rMkj6o",
          "Cache-Control": "no-cache",
        },
        params: {
          arrivalFrom: startDate,
          arrivalTo: endDate,
          showCancellation: true,
          excludeBlocked: false,
          pageSize: 100,
        },
      }
    );

    const bookings = response.data.bookings || [];
    console.log(`🟦 Fetched ${bookings.length} bookings from Smoobu`);
    
    // Track statistics
    let stats = {
      fetched: bookings.length,
      added: 0,
      updated: 0,
      skipped: 0,
      errors: 0
    };

    // 2. Process each booking
    for (const booking of bookings) {
      try {
        const smoobuId = booking.id.toString();
        
        // Check if booking already exists in Firebase
        const bookingsRef = db.collection("bookings");
        const existingBookingSnapshot = await bookingsRef
          .where("smoobuId", "==", smoobuId)
          .get();
        
        // Get channel/portal name
        const channelName = booking.channel?.name || 'Website';
        const portalName = getPortalName(channelName) || 'Website';
        
        // Fetch price elements
        let priceElements = [];
        try {
          const priceElementsResponse = await axios.get(
            `https://login.smoobu.com/api/reservations/${smoobuId}/price-elements`,
            {
              headers: {
                "Api-Key": "UZFV5QRY0ExHUfJi3c1DIG8Bpwet1X4knWa8rMkj6o",
                "Cache-Control": "no-cache",
              },
            }
          );
          priceElements = priceElementsResponse.data.priceElements || [];
        } catch (priceError) {
          console.error(`🟨 Error fetching price elements for booking ${smoobuId}:`, priceError.message);
        }
        
        // Find important price components
        const basePrice = priceElements.find(el => el.type === 'base')?.amount || 0;
        const linenFee = priceElements.find(el => 
          el.name?.toLowerCase().includes('linen') || 
          el.name?.toLowerCase().includes('linge') || 
          el.name?.toLowerCase().includes('cleaning')
        )?.amount || 0;
        const commission = priceElements.find(el => 
          el.name?.toLowerCase().includes('commission')
        )?.amount || 0;
        
        // Calculate nights
        const checkIn = new Date(booking.arrival);
        const checkOut = new Date(booking.departure);
        const nights = Math.ceil(
          (checkOut - checkIn) / (1000 * 60 * 60 * 24)
        );
        
        // Calculate extras total
        const extras = priceElements.filter(element => {
          const name = element.name?.toLowerCase() || "";
          return element.type === "addon" && 
            !name.includes("commission") &&
            !name.includes("linen") &&
            !name.includes("cleaning");
        }).map(extra => ({
          name: extra.name || "Extra",
          amount: parseFloat(extra.amount) || 0,
          quantity: parseInt(extra.quantity) || 1
        }));
        
        const extrasTotal = extras.reduce(
          (sum, extra) => sum + parseFloat(extra.amount || 0), 0
        );
        
        // Format guest name
        const guestName = booking["guest-name"] || 
          `${booking.firstName || ""} ${booking.lastName || ""}`.trim() ||
          "Unknown Guest";
          
        // Create booking document with corrected price calculations
        const totalPrice = parseFloat(booking.price) || 0;
        // Base price should be total minus linen fee (as requested)
        const correctedBasePrice = totalPrice - linenFee;
        
        const bookingDoc = {
          smoobuId: smoobuId,
          createdAt: booking["created-at"] || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          firstName: booking.firstName || guestName.split(' ')[0] || "",
          lastName: booking.lastName || (guestName.split(' ').length > 1 ? guestName.split(' ').slice(1).join(' ') : ""),
          guestName: guestName,
          email: booking.email || "",
          phone: booking.phone || "",
          address: booking.address || "",
          adults: parseInt(booking.adults) || 0,
          children: parseInt(booking.children) || 0,
          arrivalDate: booking.arrival,
          departureDate: booking.departure,
          checkInTime: booking["check-in"] || "",
          checkOutTime: booking["check-out"] || "",
          apartmentId: booking.apartment?.id,
          property: roomNames[booking.apartment?.id] || booking.apartment?.name || "",
          channelId: booking.channel?.id,
          channelName: booking.channel?.name || "",
          portalName: portalName,
          price: totalPrice,
          basePrice: correctedBasePrice, // CORRECTED: This is now total - linenFee
          linenFee: linenFee,
          commission: commission,
          extras: extras,
          nights: nights,
          priceDetails: {
            basePrice: correctedBasePrice,
            linenFee: linenFee,
            commission: commission,
            extrasTotal: extrasTotal,
            priceElements: priceElements
          },
          lastSyncedAt: new Date().toISOString(),
        };
        
        // Add or update in Firebase
        if (existingBookingSnapshot.empty) {
          // Add new booking
          await bookingsRef.add(bookingDoc);
          console.log(`🟩 Added new booking ${smoobuId} (${portalName}): ${guestName}`);
          stats.added++;
        } else {
          // Update existing booking
          const docId = existingBookingSnapshot.docs[0].id;
          await bookingsRef.doc(docId).update({
            ...bookingDoc,
            updatedAt: new Date().toISOString(),
          });
          console.log(`🟦 Updated booking ${smoobuId} (${portalName}): ${guestName}`);
          stats.updated++;
        }
      } catch (bookingError) {
        console.error(`🟥 Error processing booking ${booking.id}:`, bookingError.message);
        stats.errors++;
      }
    }
    
    console.log("🟩 Sync process completed:", stats);
    return res.json({
      success: true,
      stats: stats,
      message: "Fetch and sync completed successfully"
    });
    
  } catch (error) {
    console.error("🟥 Error in fetch-and-sync endpoint:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "An unknown error occurred",
      message: "Failed to fetch and sync bookings"
    });
  }
});

// Schedule automatic sync every 4 hours
cron.schedule("0 */4 * * *", async () => {
  try {
    console.log("🟦 Starting scheduled sync...");
    await syncReservations();
    console.log("🟩 Scheduled sync completed");
  } catch (error) {
    console.error("🟥 Scheduled sync failed:", error);
  }
});



app.post("/api/create-gift-voucher", verifyWordPressAuth, async (req, res) => {
  try {
    const {
      orderId,
      amount,
      customerEmail,
      customerName,
      customerPhone,
      language,
    } = req.body;

    // Generate unique voucher code
    const voucherCode = `GIFT-${Math.random()
      .toString(36)
      .substring(2, 12)
      .toUpperCase()}`;

    // Create voucher document in Firebase
    const voucherData = {
      code: voucherCode,
      amount: Number(amount),
      type: "fixed",
      isGiftVoucher: true,
      status: "active",
      orderId,
      customerEmail,
      customerName,
      customerPhone,
      language,
      dateCreated: new Date().toISOString(),
      expiryDate: new Date(
        Date.now() + 365 * 24 * 60 * 60 * 1000
      ).toISOString(),
      usedCount: 0,
      usageHistory: [],
    };

    await db.collection("coupons").add(voucherData);

    // Just return the success response, no email sending
    res.json({
      success: true,
      voucherCode,
      amount,
    });
  } catch (error) {
    console.error("Error creating gift voucher:", error);
    res.status(500).json({
      error: "Failed to create gift voucher",
      details: error.message,
    });
  }
});

// Endpoint to validate gift voucher during booking
app.post("/api/validate-voucher", async (req, res) => {
  try {
    const { code, amount } = req.body;
    console.log("Validating voucher with code:", code, "for amount:", amount);

    // Get voucher from Firebase
    const voucherQuery = await getDocs(
      query(collection(db, "coupons"), where("code", "==", code.toUpperCase()))
    );

    if (voucherQuery.empty) {
      console.log("No voucher found with code:", code);
      return res.status(404).json({
        valid: false,
        message: "Code invalide",
      });
    }

    const voucherDoc = voucherQuery.docs[0];
    const voucherData = voucherDoc.data();
    console.log("Found voucher:", voucherData);

    // If it's a gift voucher, perform specific validations
    if (voucherData.isGiftVoucher) {
      // Check if already used
      if (voucherData.usedCount > 0) {
        console.log("Gift voucher already used");
        return res.status(400).json({
          valid: false,
          message: "Ce bon cadeau a déjà été utilisé",
        });
      }

      // Check expiration - handle both Timestamp and regular date
      const expiryDate =
        voucherData.expiryDate?.toDate?.() || new Date(voucherData.expiryDate);
      if (expiryDate < new Date()) {
        console.log("Gift voucher expired");
        return res.status(400).json({
          valid: false,
          message: "Ce bon cadeau a expiré",
        });
      }

      // Check if booking amount is sufficient
      if (amount < voucherData.amount) {
        console.log("Booking amount insufficient");
        return res.status(400).json({
          valid: false,
          message: `Le montant de la réservation doit être supérieur au montant du bon cadeau (${voucherData.amount}€)`,
        });
      }
    }
    // Regular coupon validation
    else {
      // Check status
      if (voucherData.status !== "active" && code !== "POTES") {
        console.log("Coupon not active");
        return res.status(400).json({
          valid: false,
          message: "Ce code promo n'est plus valide",
        });
      }

      // Check expiration if exists
      if (voucherData.expiryDate) {
        const expiryDate =
          voucherData.expiryDate?.toDate?.() ||
          new Date(voucherData.expiryDate);
        if (expiryDate < new Date()) {
          console.log("Coupon expired");
          return res.status(400).json({
            valid: false,
            message: "Ce code promo a expiré",
          });
        }
      }
    }

    // Calculate discount based on type
    let discount = 0;
    if (voucherData.type === "percentage") {
      discount = (amount * voucherData.discount) / 100;
    } else {
      discount = voucherData.discount;
    }

    console.log("Voucher validated successfully");
    res.json({
      valid: true,
      code: voucherData.code,
      type: voucherData.type,
      isGiftVoucher: voucherData.isGiftVoucher || false,
      discount: discount,
      amount: voucherData.amount,
      percentageValue:
        voucherData.type === "percentage" ? voucherData.discount : null,
    });
  } catch (error) {
    console.error("Error validating voucher:", error);
    res.status(500).json({
      valid: false,
      message: "Erreur lors de la validation du bon cadeau",
    });
  }
});


app.get("/api/direct-bookings", async (req, res) => {
  try {
    const { startDate, endDate, showCancellation, excludeBlocked } = req.query;

    // Call Smoobu API directly
    const response = await axios.get(
      "https://login.smoobu.com/api/reservations",
      {
        headers: {
          "Api-Key": "UZFV5QRY0ExHUfJi3c1DIG8Bpwet1X4knWa8rMkj6o",
          "Cache-Control": "no-cache",
        },
        params: {
          arrivalFrom: startDate,
          arrivalTo: endDate,
          showCancellation: showCancellation === "true",
          excludeBlocked: excludeBlocked === "true",
          pageSize: 100,
        },
      }
    );

    // Log all channel information for debugging
    console.log(
      "All channels:",
      response.data.bookings?.map((b) => ({
        id: b.id,
        channelId: b.channel?.id,
        channelName: b.channel?.name,
        arrival: b.arrival,
      }))
    );

    res.json(response.data);
  } catch (error) {
    console.error("Error fetching direct bookings:", error);
    res.status(500).json({
      error: "Failed to fetch bookings",
      message: error.message,
    });
  }
});

// Helper function to generate email content

app.get("/api/extras-report", async (req, res) => {
  try {
    const { startMonth, startYear, endMonth, endYear } = req.query;

    const normalizeExtraName = (name) => {
      const frenchName = Object.entries(extrasFrenchNames).find(
        ([key, value]) =>
          value.toLowerCase() === name.toLowerCase() ||
          key.toLowerCase() === name.toLowerCase()
      );
      return frenchName ? frenchName[1] : name;
    };

    const startDate = `${startYear}-${String(startMonth).padStart(2, "0")}-01`;
    const lastDay = new Date(endYear, parseInt(endMonth), 0).getDate();
    const endDate = `${endYear}-${String(endMonth).padStart(
      2,
      "0"
    )}-${lastDay}`;

    console.log("=== START OF REQUEST ===");
    console.log("Request params:", {
      startMonth,
      startYear,
      endMonth,
      endYear,
    });
    console.log("Calculated dates:", { startDate, endDate });

    const bookingsResponse = await axios.get(
      "https://login.smoobu.com/api/reservations",
      {
        headers: {
          "Api-Key": "UZFV5QRY0ExHUfJi3c1DIG8Bpwet1X4knWa8rMkj6o",
          "Cache-Control": "no-cache",
        },
        params: {
          arrivalFrom: startDate,
          arrivalTo: endDate,
          excludeBlocked: true,
          showCancellation: false,
        },
      }
    );

    console.log("Smoobu API Response:", bookingsResponse.data);
    console.log(
      "Number of bookings:",
      bookingsResponse.data.bookings?.length || 0
    );

    const bookings = bookingsResponse.data.bookings || [];
    console.log(
      `Found ${bookings.length} bookings for period ${startMonth}/${startYear} - ${endMonth}/${endYear}`
    );

    const extrasCount = {};
    let processedCount = 0;
    let bookingsWithExtras = 0;

    for (const booking of bookings) {
      try {
        processedCount++;
        console.log(
          `Processing booking ${booking.id} (${booking.arrival} - ${booking.departure})`
        );

        const priceElementsResponse = await axios.get(
          `https://login.smoobu.com/api/reservations/${booking.id}/price-elements`,
          {
            headers: {
              "Api-Key": "UZFV5QRY0ExHUfJi3c1DIG8Bpwet1X4knWa8rMkj6o",
              "Cache-Control": "no-cache",
            },
          }
        );

        const extraNames = [
          "L'essentiel (pour 2) - Personne supplémentaire",
          "Le détente gourmet (pour 2) - Personne supplémentaire",
          "La raclette en détente (pour 2) - Personne supplémentaire",
          "Le romantique gourmet (pour 2) - Personne supplémentaire",
          "La raclette romantique (pour 2) - Personne supplémentaire",
          "Le barbecue détente (pour 2) - Personne supplémentaire",
          "Le romantique barbecue (pour 2) - Personne supplémentaire",
          "Formule petit-déjeuner (2 pers) - Personne supplémentaire",
          "Formule gourmet (2 pers) - Personne supplémentaire",
          "Formule raclette (2 pers) - Personne supplémentaire",
          "Formule barbecue (2 pers) - Personne supplémentaire",
          "Formule SPA (2 pers) - Personne supplémentaire",
          "Formule anniversaire (pour 2) - Personne supplémentaire",
          "L'essentiel (pour 2)",
          "Le détente gourmet (pour 2)",
          "La raclette en détente (pour 2)",
          "Le romantique gourmet (pour 2)",
          "La raclette romantique (pour 2)",
          "Le barbecue détente (pour 2)",
          "Le romantique barbecue (pour 2)",
          "Formule planche apéro (2 pers)",
          "Formule passion (pour 2)",
          "Formule anniversaire (pour 2)",
          "Formule petit-déjeuner (2 pers)",
          "Formule gourmet (2 pers)",
          "Formule raclette (2 pers)",
          "Formule barbecue (2 pers)",
          "Formule SPA (2 pers)",
          "Formule SPA + bouteille (2 pers)",
          "Boulettes de viande sauce liégeoise",
          "Boulette de viande sauce tomate",
          "Waterzooi de volaille",
          "Chili végétarien",
          "Velouté de carotte et cumin",
          "Brut de Bioul",
          "Cortil Barco",
          "Terre Charlot",
          "Houblonde Triple",
          "Houblonde Blonde",
          "Houblonde White IPA",
          "Brune du Condroz",
          "Ambrée du Condroz",
          "Blanche du Condroz",
          "Jus de pomme « Pom d'Happy »",
          "Ritchie Citron/Framboise",
          "Ritchie Orange/Vanille",
          "Ritchie Cola",
          "Ritchie Cola Zéro",
        ];

        const addons = (priceElementsResponse.data.priceElements || []).filter(
          (element) =>
            element.type === "addon" || extraNames.includes(element.name)
        );

        if (addons.length > 0) {
          bookingsWithExtras++;
          console.log(
            `Found ${addons.length} extras in booking ${booking.id}:`,
            addons.map((a) => ({
              name: a.name,
              amount: a.amount,
              quantity: a.quantity || 1,
            }))
          );
        }

        addons.forEach((addon) => {
          const normalizedName = normalizeExtraName(addon.name);
          if (!extrasCount[normalizedName]) {
            extrasCount[normalizedName] = {
              count: 0,
              totalAmount: 0,
              details: {
                calculationType: addon.calculationType || 0,
                optional: true,
                type: addon.type,
              },
            };
          }
          extrasCount[normalizedName].count += addon.quantity || 1;
          extrasCount[normalizedName].totalAmount += addon.amount;
        });
      } catch (error) {
        console.error(`Error processing booking ${booking.id}:`, error.message);
      }
    }

    const reportData = Object.entries(extrasCount)
      .map(([name, data]) => ({
        name,
        count: data.count,
        totalAmount: data.totalAmount,
        details: data.details,
      }))
      .sort((a, b) => b.count - a.count);

    console.log("=== PROCESSING SUMMARY ===");
    console.log({
      period: `${startMonth}/${startYear} - ${endMonth}/${endYear}`,
      totalBookingsInPeriod: bookings.length,
      processedBookings: processedCount,
      bookingsWithExtras,
      uniqueExtrasFound: reportData.length,
      extrasList: reportData.map((d) => `${d.name}: ${d.count}`),
    });

    res.json({
      startMonth,
      startYear,
      endMonth,
      endYear,
      data: reportData,
      totalBookings: bookings.length,
    });
  } catch (error) {
    console.error("=== ERROR IN REQUEST ===");
    console.error(error);
    res.status(500).json({
      error: "Failed to generate report",
      details: error.message,
    });
  }
});

app.get("/api/bookings-report", async (req, res) => {
  try {
    const { startMonth, startYear, endMonth, endYear } = req.query;

    // Validate and fix date range
    let finalStartMonth = String(startMonth).padStart(2, "0");
    let finalStartYear = startYear;
    let finalEndMonth = String(endMonth).padStart(2, "0");
    let finalEndYear = endYear;

    const startDate = `${finalStartYear}-${finalStartMonth}-01`;
    const lastDay = new Date(
      finalEndYear,
      parseInt(finalEndMonth),
      0
    ).getDate();
    const endDate = `${finalEndYear}-${finalEndMonth}-${lastDay}`;

    console.log("=== START OF BOOKINGS REPORT REQUEST ===");
    console.log("Request params:", {
      startMonth: finalStartMonth,
      startYear: finalStartYear,
      endMonth: finalEndMonth,
      endYear: finalEndYear,
    });

    // Fetch bookings for the period
    const bookingsResponse = await axios.get(
      "https://login.smoobu.com/api/reservations",
      {
        headers: {
          "Api-Key": "UZFV5QRY0ExHUfJi3c1DIG8Bpwet1X4knWa8rMkj6o",
          "Cache-Control": "no-cache",
        },
        params: {
          arrivalFrom: startDate,
          arrivalTo: endDate,
          excludeBlocked: true,
          showCancellation: true,
        },
      }
    );

    const bookings = bookingsResponse.data.bookings || [];
    console.log(
      `Found ${bookings.length} bookings for period ${finalStartMonth}/${finalStartYear} - ${finalEndMonth}/${finalEndYear}`
    );

    // Process each booking to get price elements and extras
    const processedBookings = [];
    for (const booking of bookings) {
      try {
        console.log(`Processing booking ${booking.id}`);

        // Skip if it's a blocked booking or cancelled booking
        if (
          booking.channelId === "Blocked" ||
          booking.type === "cancellation"
        ) {
          console.log(
            `Skipping ${
              booking.channelId === "Blocked" ? "blocked" : "cancelled"
            } booking ${booking.id}`
          );
          continue;
        }

        // Fetch price elements for each booking
        const priceElementsResponse = await axios.get(
          `https://login.smoobu.com/api/reservations/${booking.id}/price-elements`,
          {
            headers: {
              "Api-Key": "UZFV5QRY0ExHUfJi3c1DIG8Bpwet1X4knWa8rMkj6o",
              "Cache-Control": "no-cache",
            },
          }
        );

        const priceElements = priceElementsResponse.data.priceElements || [];
        console.log(
          "Price elements for booking",
          booking.id,
          ":",
          priceElements
        );

        // Calculate nights
        const checkIn = new Date(booking.arrival);
        const checkOut = new Date(booking.departure);
        const nights = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));

        // Find long stay discount first
        const longStayDiscount =
          priceElements.find(
            (el) =>
              el.name?.toLowerCase().includes("long stay") ||
              el.name?.toLowerCase().includes("long-stay")
          )?.amount || 0;

        // Process extras - all non-base price elements, excluding cancellations and long stay discount
        const extras = priceElements.filter((element) => {
          const name = element.name?.toLowerCase() || "";
          const type = element.type?.toLowerCase() || "";

          // Skip cancellation-related items and long stay discount
          if (
            name.includes("cancellation") ||
            name.includes("pass_through") ||
            name.includes("prix de base") ||
            name.includes("base price") ||
            name.includes("long stay") ||
            name.includes("long-stay") ||
            name === "base" ||
            type === "base"
          ) {
            return false;
          }

          // Include addons, linen fees, and exclude base price and discounts
          return (
            element.type === "addon" ||
            name.includes("linen fee") ||
            name.includes("frais de linge") ||
            (element.type !== "base" && element.type !== "discount")
          );
        });

        // Find commission from extras
        const commissionExtra = extras.find((extra) =>
          extra.name?.toLowerCase().includes("commission")
        );
        const commission = commissionExtra ? commissionExtra.amount : 0;

        // Remove commission from extras list if it exists
        const nonCommissionExtras = extras.filter(
          (extra) => !extra.name?.toLowerCase().includes("commission")
        );

        const linenFee =
          priceElements.find(
            (el) =>
              el.name?.toLowerCase().includes("linen_fee") ||
              el.name?.toLowerCase().includes("pass_through_linen_fee")
          )?.amount || 0;

        // Calculate base price
        const basePrice =
          priceElements.find(
            (el) =>
              el.name?.toLowerCase().includes("base") ||
              el.type?.toLowerCase() === "base"
          )?.amount || 0;

        // Calculate other discounts (excluding long stay)
        const otherDiscounts = priceElements
          .filter(
            (el) =>
              el.type === "discount" &&
              !el.name?.toLowerCase().includes("long stay") &&
              !el.name?.toLowerCase().includes("long-stay")
          )
          .reduce((sum, discount) => sum + Math.abs(discount.amount), 0);

        const extrasTotal = extras.reduce(
          (sum, extra) => sum + extra.amount,
          0
        );

        // Add portal name mapping



        const processedBooking = {
          id: booking.id,
          guest:
            booking["guest-name"] ||
            `${booking.firstName || ""} ${booking.lastName || ""}`.trim() ||
            (booking.notice?.match(/Message du client:?\s*([^\n]+)/) ||
              [])[1] ||
            booking.email?.split("@")[0] ||
            "Sans nom",
          property:
            roomNames[booking.apartmentId] || booking.apartment?.name || "",
          portal:
            portalNames[booking.channel?.name] ||
            booking.channel?.name ||
            "Website",
          created:
            booking["created-at"] ||
            booking.created ||
            new Date().toISOString(),
          email: booking.email || "",
          phone: booking.phone || "",
          address: booking.address || "",
          adults: parseInt(booking.adults) || 0,
          children: parseInt(booking.children) || 0,
          checkIn: booking.arrival,
          checkOut: booking.departure,
          arrivalTime: booking["check-in"] || "",
          departureTime: booking["check-out"] || "",
          notes: booking.notice || "",
          price: parseFloat(booking.price) || 0,
          priceDetails: {
            basePrice: parseFloat(basePrice),
            linenFee: parseFloat(linenFee),
            extrasTotal: parseFloat(extrasTotal),
            longStayDiscount: parseFloat(longStayDiscount),
            discounts: parseFloat(otherDiscounts),
            promoCode: priceElements.find(
              (el) =>
                el.name?.toLowerCase().includes("code promo") ||
                el.name?.toLowerCase().includes("coupon") ||
                (el.type === "discount" &&
                  !el.name?.toLowerCase().includes("long stay") &&
                  !el.name?.toLowerCase().includes("long-stay"))
            ),
            total:
              parseFloat(basePrice) +
              parseFloat(linenFee) +
              parseFloat(extrasTotal) +
              parseFloat(longStayDiscount) -
              parseFloat(otherDiscounts),
          },
          commission: parseFloat(commission),
          nights,
          extras:
            nonCommissionExtras
              .filter(
                (extra) =>
                  !extra.name?.toLowerCase().includes("code promo") &&
                  !extra.name?.toLowerCase().includes("coupon") &&
                  extra.type !== "discount"
              )
              .map((extra) => ({
                name: extra.name || "Extra sans nom",
                amount: parseFloat(extra.amount) || 0,
                quantity: parseInt(extra.quantity) || 1,
              })) || [],
        };

        processedBookings.push(processedBooking);
      } catch (error) {
        console.error(`Error processing booking ${booking.id}:`, error.message);
        console.error("Full error:", error);
      }
    }

    console.log("=== PROCESSING SUMMARY ===");
    console.log({
      period: `${finalStartMonth}/${finalStartYear} - ${finalEndMonth}/${finalEndYear}`,
      totalBookings: bookings.length,
      processedBookings: processedBookings.length,
      sampleBooking: processedBookings[0],
    });

    res.json({
      startMonth: finalStartMonth,
      startYear: finalStartYear,
      endMonth: finalEndMonth,
      endYear: finalEndYear,
      data: processedBookings,
    });
  } catch (error) {
    console.error("=== ERROR IN REQUEST ===");
    console.error("Full error:", error);
    console.error("Error response:", error.response?.data);
    res.status(500).json({
      error: "Failed to generate bookings report",
      details: error.message,
    });
  }
});

app.get("/api/apartments", async (req, res) => {
  try {
    const response = await axios.get(
      "https://login.smoobu.com/api/apartments",
      {
        headers: {
          "Api-Key": "UZFV5QRY0ExHUfJi3c1DIG8Bpwet1X4knWa8rMkj6o",
          "Cache-Control": "no-cache",
          "Content-Type": "application/json",
        },
      }
    );
    res.json(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).json({
      status: error.response?.status,
      title: error.response?.data?.title || "Error",
      detail: error.response?.data?.detail || "Failed to fetch apartments",
    });
  }
});

app.get("/api/apartments/:id", async (req, res) => {
  try {
    const response = await axios.get(
      `https://login.smoobu.com/api/apartments/${req.params.id}`,
      {
        headers: {
          "Api-Key": "UZFV5QRY0ExHUfJi3c1DIG8Bpwet1X4knWa8rMkj6o",
          "Content-Type": "application/json",
        },
      }
    );

    // Smoobu API returns images in the response
    const images = response.data.images || [];
    res.json({ images });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch apartment images" });
  }
});

// Replace your current /api/rates endpoint with this one
app.get("/api/rates", async (req, res) => {
  try {
    const { apartments, start_date, end_date, adults, children } = req.query;

    // console.log('Processing rates request:', {
    //   apartments,
    //   start_date,
    //   end_date,
    //   adults,
    //   children,
    // });

    // Validate required parameters
    if (!start_date || !end_date) {
      return res.status(400).json({
        error: "Missing dates",
        details: "Both start_date and end_date are required",
      });
    }

    if (!apartments) {
      return res.status(400).json({
        error: "Missing apartments",
        details: "Apartments parameter is required",
      });
    }

    // Make the API call to Smoobu
    const response = await axios.get("https://login.smoobu.com/api/rates", {
      headers: {
        "Api-Key": "UZFV5QRY0ExHUfJi3c1DIG8Bpwet1X4knWa8rMkj6o",
        "Content-Type": "application/json",
      },
      params: {
        apartments: Array.isArray(apartments) ? apartments : [apartments],
        start_date,
        end_date,
      },
    });

    if (!response.data || !response.data.data) {
      return res.status(404).json({
        error: "No rates found",
        details: "The API returned no data",
      });
    }

    const formattedData = {};
    const priceDetailsByApartment = {};
    let hasAvailability = false;

    // Process each apartment
    (Array.isArray(apartments) ? apartments : [apartments]).forEach(
      (apartmentId) => {
        const apartmentData = response.data.data[apartmentId];
        if (!apartmentData) return;

        formattedData[apartmentId] = apartmentData;
        const settings = discountSettings[apartmentId];

        if (!settings) {
          // console.log(`No settings found for apartment ${apartmentId}`);
          return;
        }

        try {
          // Calculate price details using your existing function
          const priceCalculation = calculatePriceWithSettings(
            apartmentData,
            start_date,
            end_date,
            parseInt(adults) || 1,
            parseInt(children) || 0,
            settings
          );

          if (priceCalculation && priceCalculation.finalPrice > 0) {
            priceDetailsByApartment[apartmentId] = {
              ...priceCalculation,
              isAvailable: true,
              settings: {
                maxGuests: settings.maxGuests,
                startingAtGuest: settings.startingAtGuest,
                extraGuestsPerNight: settings.extraGuestsPerNight,
                extraChildPerNight: settings.extraChildPerNight,
                lengthOfStayDiscount: settings.lengthOfStayDiscount,
              },
            };
            hasAvailability = true;
          }
        } catch (calcError) {
          // console.error(
          //   `Error calculating price for apartment ${apartmentId}:`,
          //   calcError
          // );
        }
      }
    );

    // Check if we found any available apartments
    if (!hasAvailability) {
      return res.status(200).json({
        data: formattedData,
        priceDetails: {},
        hasAvailability: false,
        message: "No apartments available for the selected dates and guests",
      });
    }

    // console.log('Sending response with price details:', {
    //   apartmentCount: Object.keys(priceDetailsByApartment).length,
    //   availableApartments: Object.keys(priceDetailsByApartment),
    // });

    res.json({
      data: formattedData,
      priceDetails: priceDetailsByApartment,
      hasAvailability: true,
    });
  } catch (error) {
    // console.error('Error in /api/rates:', error);
    res.status(500).json({
      error: "Failed to fetch rates",
      details: error.response?.data || error.message,
      status: error.response?.status || 500,
    });
  }
});

//CREATE PAYMENT INTENT

app.post("/api/create-payment-intent", async (req, res) => {
  try {
    const { price, bookingData } = req.body;

    // Calculate guest fees for metadata
    const totalGuests =
      (parseInt(bookingData.adults) || 0) +
      (parseInt(bookingData.children) || 0);
    const settings = discountSettings[bookingData.apartmentId];
    const extraGuests = Math.max(0, totalGuests - settings.startingAtGuest);
    const guestFees = extraGuests * settings.extraGuestsPerNight;

    const bookingReference = `BOOKING-${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    pendingBookings.set(bookingReference, {
      ...bookingData,
      guestFees, // Add guest fees to the stored booking data
    });

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(price * 100),
      currency: "eur",
      automatic_payment_methods: {
        enabled: true,
      },
      description: `Réservation - ${bookingData.firstName} ${
        bookingData.lastName
      }
        Chambre: ${roomNames[bookingData.apartmentId]} 
        (${bookingData.arrivalDate} - ${bookingData.departureDate})
        Base: ${bookingData.basePrice}€
        ${guestFees > 0 ? ` • Frais invités: ${guestFees}€` : ""}
        ${
          bookingData.extras?.length
            ? ` • Extras: ${price - bookingData.basePrice - guestFees}€`
            : ""
        }
        ${
          bookingData.couponApplied
            ? ` • Code ${bookingData.couponApplied.code}: -${bookingData.couponApplied.discount}€`
            : ""
        }`,
      metadata: {
        clientName: `${bookingData.firstName} ${bookingData.lastName}`,
        clientEmail: bookingData.email,
        clientPhone: bookingData.phone || "",
        roomId: bookingData.apartmentId,
        roomName: roomNames[bookingData.apartmentId],
        bookingReference: bookingReference,
        checkIn: bookingData.arrivalDate,
        checkOut: bookingData.departureDate,
        basePrice: `${bookingData.basePrice}€`,
        guestFees: `${guestFees}€`,
        extrasTotal: bookingData.extras?.length
          ? `${price - bookingData.basePrice - guestFees}€`
          : "0€",
        ...(bookingData.couponApplied && {
          couponCode: bookingData.couponApplied.code,
          couponDiscount: `-${bookingData.couponApplied.discount}€`,
          couponType: bookingData.couponApplied.type,
        }),
        finalPrice: `${price}€`,
      },
    });

    res.json({
      clientSecret: paymentIntent.client_secret,
      bookingReference: bookingReference,
    });
  } catch (error) {
    console.error("Error creating payment intent:", error);
    res.status(500).json({
      error: "Failed to create payment intent",
      details: error.message,
    });
  }
});

app.get("/api/bookings/:paymentIntentId", async (req, res) => {
  try {
    const { paymentIntentId } = req.params;

    // First get the payment intent from Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (!paymentIntent) {
      return res.status(404).json({ error: "Payment not found" });
    }

    // Then find the booking in Firebase
    const bookingsRef = db.collection("bookings");
    const bookingQuery = await bookingsRef
      .where("paymentIntentId", "==", paymentIntentId)
      .get();

    if (bookingQuery.empty) {
      return res.status(404).json({
        error: "Booking details not found",
        message: `No booking found for payment_intent: '${paymentIntentId}'`,
      });
    }

    const bookingDoc = bookingQuery.docs[0].data();

    // Calculate price breakdown
    const basePrice = parseFloat(bookingDoc.basePrice);
    const extrasTotal =
      bookingDoc.extras?.reduce((sum, extra) => sum + extra.amount, 0) || 0;
    const longStayDiscount = parseFloat(bookingDoc.priceDetails?.discount || 0);
    const couponDiscount = parseFloat(bookingDoc.appliedCoupon?.discount || 0);

    // Calculate final total
    const subtotalBeforeDiscounts = basePrice + extrasTotal;
    const finalTotal =
      subtotalBeforeDiscounts - longStayDiscount - couponDiscount;

    // Format response with all necessary data
    const responseData = {
      ...bookingDoc,
      paymentIntent: {
        id: paymentIntentId,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        status: paymentIntent.status,
      },
      priceBreakdown: {
        basePrice,
        extrasTotal,
        longStayDiscount,
        couponDiscount,
        totalPrice: finalTotal,
      },
    };

    res.json(responseData);
  } catch (error) {
    console.error("Error fetching booking:", error);
    res.status(500).json({
      error: "Failed to fetch booking details",
      message: error.message,
    });
  }
});


// Debug endpoint to check pending bookings
app.get("/api/pending-bookings", (req, res) => {
  const bookings = Array.from(pendingBookings.entries());
  res.json(bookings);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  // console.log(`Server running on port ${PORT}`);
  // console.log('Webhook endpoint ready at /webhook');
});

app.get("/api/bookings-history/:email", async (req, res) => {
  try {
    const { email } = req.params;
    const snapshot = await db
      .collection("bookings")
      .where("email", "==", email)
      .orderBy("createdAt", "desc")
      .get();

    const bookings = [];
    snapshot.forEach((doc) => {
      bookings.push({ id: doc.id, ...doc.data() });
    });

    res.json(bookings);
  } catch (error) {
    console.error("Error fetching bookings:", error);
    res.status(500).json({
      error: "Failed to fetch bookings",
      message: error.message,
    });
  }
});

app.post("/api/test-email", async (req, res) => {
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: process.env.EMAIL_USER, // Send to yourself first
      subject: "Test Email",
      html: "<h1>Test booking confirmation</h1><p>This is a test email.</p>",
    });
    res.json({ success: true });
    console.error("Email test worked:");
  } catch (error) {
    console.error("Email test failed:", error);
    res.status(500).json({ error: error.message });
  }
});
