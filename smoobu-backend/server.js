import express from "express";
import cors from "cors";
import axios from "axios";
import Stripe from "stripe";

import admin from 'firebase-admin';
import serviceAccount from './serviceAccountKey.json' assert { type: "json" };


import * as dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();

const app = express();

app.use((req, res, next) => {
  console.log("Incoming Origin:", req.headers.origin);
  next();
});

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

const stripe = new Stripe(
  "sk_test_51QHmafIhkftuEy3nihoW4ZunaXVY1D85r176d91x9BAhGfvW92zG7r7A5rVeGuL1ysHVMOzflF0jwoCpyKJl760n00GC9ZYSJ4"
);
const pendingBookings = new Map();

// Discount settings
const discountSettings = {
  1644643: {
    cleaningFee: 0,
    prepayment: 0,
    minDaysBetweenBookingAndArrival: 1,
    extraGuestsPerNight: 20,
    startingAtGuest: 2,
    maxGuests: 2,
    extraChildPerNight: 0,
    lengthOfStayDiscount: {
      minNights: 0,
      discountPercentage: 0,
    },
  },
  1946282: {
    cleaningFee: 0,
    prepayment: 0,
    minDaysBetweenBookingAndArrival: 1,
    extraGuestsPerNight: 20,
    startingAtGuest: 3,
    maxGuests: 4,
    extraChildPerNight: 20,
    lengthOfStayDiscount: {
      minNights: 0,
      discountPercentage: 0,
    },
  },
  1946279: {
    cleaningFee: 0,
    prepayment: 0,
    minDaysBetweenBookingAndArrival: 1,
    extraGuestsPerNight: 20,
    startingAtGuest: 2,
    maxGuests: 4,
    extraChildPerNight: 20,
    lengthOfStayDiscount: {
      minNights: 2,
      discountPercentage: 40,
    },
  },
  1946276: {
    cleaningFee: 0,
    prepayment: 0,
    minDaysBetweenBookingAndArrival: 1,
    extraGuestsPerNight: 20,
    startingAtGuest: 2,
    maxGuests: 4,
    extraChildPerNight: 20,
    lengthOfStayDiscount: {
      minNights: 2,
      discountPercentage: 40,
    },
  },
  1946270: {
    cleaningFee: 0,
    prepayment: 0,
    minDaysBetweenBookingAndArrival: 1,
    extraGuestsPerNight: 20,
    startingAtGuest: 5,
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
  'extras.packs.essential.name': "L'essentiel (pour 2)",
  'extras.packs.relaxGourmet.name': "Le détente gourmet (pour 2)",
  'extras.packs.racletteRelax.name': "La raclette en détente (pour 2)",
  'extras.packs.romanticGourmet.name': "Le romantique gourmet (pour 2)",
  'extras.packs.racletteRomantic.name': "La raclette romantique (pour 2)",
  
  // Spa
  'extras.spa.basic.name': "Formule SPA (2 pers)",
  'extras.spa.withBottle.name': "Formule SPA + bouteille (2 pers)",
  
  // Meals
  'extras.meals.meatballsLiege.name': "Boulettes de viande sauce liégeoise",
  'extras.meals.meatballsTomato.name': "Boulette de viande sauce tomate",
  'extras.meals.waterzooi.name': "Waterzooi de volaille",
  'extras.meals.chiliVeg.name': "Chili végétarien",
  'extras.meals.carrotSoup.name': "Velouté de carotte et cumin",
  
  // Meal Formulas
  'extras.formulesRepas.breakfast.name': "Formule petit-déjeuner (2 pers)",
  'extras.formulesRepas.gourmet.name': "Formule gourmet (2 pers)",
  'extras.formulesRepas.raclette.name': "Formule raclette (2 pers)",
  'extras.formulesRepas.apero.name': "Formule planche apéro (2 pers)",
  
  // Additional Person translation
  'extras.additionalPerson': "Personne supplémentaire"
};



// Modified processExtraName function
const processExtraName = (extra) => {
  // If the name is a translation key (starts with "extras.")
  if (extra.name && extra.name.startsWith('extras.')) {
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

  // Special handling for departure-arrival day
  const startDateStr = currentDate.toISOString().split("T")[0];
  const prevDay = new Date(currentDate);
  prevDay.setDate(prevDay.getDate() - 1);
  const prevDayStr = prevDay.toISOString().split("T")[0];

  // If starting on a departure day, don't count it as unavailable
  const isDepartureDay =
    (!rates[prevDayStr] || rates[prevDayStr].available === 0) &&
    rates[startDateStr] &&
    rates[startDateStr].available === 1;


  while (currentDate <= endDateTime) {
    const dateStr = currentDate.toISOString().split("T")[0];
    const nextDate = new Date(currentDate);
    nextDate.setDate(nextDate.getDate() + 1);
    const nextDateStr = nextDate.toISOString().split("T")[0];
    
    // Only count if this is not the departure day OK
    if (dateStr !== endDateTime.toISOString().split("T")[0]) {
      const dayRate = rates[dateStr];
      if (dayRate) {
        if (
          dayRate.available === 1 ||
          (dateStr === startDateStr && isDepartureDay)
        ) {
          totalPrice += dayRate.price;
          numberOfNights++;
          console.log(`Adding price for ${dateStr}:`, dayRate.price);
        }
      }
    }
  
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  console.log("Base calculation:", {
    totalPrice,
    numberOfNights,
  });

  // Calculate long stay discount only on the base room price
  let discount = 0;
  if (numberOfNights >= settings.lengthOfStayDiscount.minNights) {
    discount =
      (totalPrice * settings.lengthOfStayDiscount.discountPercentage) / 100;
    console.log("Long stay discount:", {
      numberOfNights,
      minimumNights: settings.lengthOfStayDiscount.minNights,
      discountPercentage: settings.lengthOfStayDiscount.discountPercentage,
      discountAmount: discount,
    });
  }

  // Guest fees
  const extraGuests = Math.max(0, numberOfGuests - settings.startingAtGuest);
  const extraGuestsFee =
    extraGuests * settings.extraGuestsPerNight * numberOfNights;
  const extraChildrenFee =
    numberOfChildren * settings.extraChildPerNight * numberOfNights;

  console.log("Guest fees:", {
    extraGuests,
    extraGuestsFee,
    extraChildrenFee,
    extraGuestsPerNight: settings.extraGuestsPerNight,
    extraChildPerNight: settings.extraChildPerNight,
  });

  // Build price elements array
  const priceElements = [
    {
      type: "basePrice",
      name: "Prix de base",
      amount: totalPrice,
      currencyCode: "EUR",
    },
  ];

  if (extraGuestsFee > 0) {
    priceElements.push({
      type: "addon",
      name: "Frais de personne supplémentaire",
      amount: extraGuestsFee,
      currencyCode: "EUR",
    });
  }

  if (extraChildrenFee > 0) {
    priceElements.push({
      type: "addon",
      name: "Frais d'enfants supplémentaires",
      amount: extraChildrenFee,
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

  // Calculate final price
  const subtotal =
    totalPrice + extraGuestsFee + extraChildrenFee + settings.cleaningFee;
  const finalPrice = subtotal - discount;

  console.log("Final price calculation:", {
    basePrice: totalPrice,
    extraGuestsFee,
    extraChildrenFee,
    cleaningFee: settings.cleaningFee,
    subtotal,
    discount,
    finalPrice,
    numberOfNights,
    priceElements,
  });

  return {
    originalPrice: totalPrice,
    extraGuestsFee,
    extraChildrenFee,
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
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

app.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const sig = req.headers["stripe-signature"];
    let event;
    console.log("Received webhook call");

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        "whsec_uzumVmrKDrksQlTpgo5gEUPk1HIxZwBv"
      );

      console.log("Webhook event verified:", event.type);

      if (event.type === "payment_intent.succeeded") {
        const paymentIntent = event.data.object;
        const bookingReference = paymentIntent.metadata.bookingReference;
        const bookingData = pendingBookings.get(bookingReference);

        console.log("Retrieved booking data:", bookingData);

        if (!bookingData) {
          console.error(
            "No booking data found for reference:",
            bookingReference
          );
          return res.status(400).json({ error: "Booking data not found!" });
        }

        try {
          // First create the main booking
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

          console.log("Smoobu booking created:", smoobuResponse.data);

          // Store booking in Firebase
          const bookingDoc = {
            ...bookingData,
              smoobuReservationId: smoobuResponse.data.id,
              paymentIntentId: paymentIntent.id,
              stripePaymentStatus: paymentIntent.status,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
          };

          try {
            const docRef = await db.collection('bookings').add(bookingDoc);
            console.log("Booking stored in Firebase with ID:", docRef.id);
            } catch (firebaseError) {
            console.error("Error storing in Firebase:", firebaseError);
            // Continue with the rest of the booking process even if Firebase storage fails
          }


          const reservationId = smoobuResponse.data.id;

          // Add initial delay after booking creation
          await wait(2000);

          // Process extras if they exist


        // Modified webhook handler
        if (bookingData.extras && bookingData.extras.length > 0) {
          console.log("Creating extras as price elements...");

          for (const extra of bookingData.extras) {
            let retryCount = 0;
            const maxRetries = 3;

            while (retryCount < maxRetries) {
              try {
                // Process the name to get French version
                const processedName = {
                  nameKey: extra.name.startsWith('extras.') ? extra.name : null,
                  name: extra.name.startsWith('extras.') ? extrasFrenchNames[extra.name] : extra.name
                };

                // Add base extra if it's not an additional person charge
                if (!processedName.name.includes("Personne supplémentaire")) {
                  const extraResponse = await axios.post(
                    `https://login.smoobu.com/api/reservations/${reservationId}/price-elements`,
                    {
                      type: "addon",
                      name: processedName.name, // French name for Smoobu
                      nameKey: processedName.nameKey, // Original translation key for frontend
                      amount: extra.amount,
                      quantity: extra.quantity,
                      currencyCode: "EUR",
                    },
                    {
                      headers: {
                        "Api-Key": "UZFV5QRY0ExHUfJi3c1DIG8Bpwet1X4knWa8rMkj6o",
                        "Content-Type": "application/json",
                      },
                    }
                  );
                  console.log(
                    `Added base extra: ${processedName.name}`,
                    extraResponse.data
                  );
                }

                // Handle additional persons with French translation
                if (extra.extraPersonQuantity > 0 && extra.extraPersonPrice) {
                  await wait(1000);
                  const extraPersonResponse = await axios.post(
                    `https://login.smoobu.com/api/reservations/${reservationId}/price-elements`,
                    {
                      type: "addon",
                      name: `${processedName.name} - ${extrasFrenchNames['extras.additionalPerson']}`,
                      nameKey: "extras.additionalPerson",
                      amount: extra.extraPersonPrice * extra.extraPersonQuantity,
                      quantity: extra.extraPersonQuantity,
                      currencyCode: "EUR",
                    },
                    {
                      headers: {
                        "Api-Key": "UZFV5QRY0ExHUfJi3c1DIG8Bpwet1X4knWa8rMkj6o",
                        "Content-Type": "application/json",
                      },
                    }
                  );
                  console.log(
                    `Added extra person charges for: ${processedName.name}`,
                    extraPersonResponse.data
                  );
                }

                break; // Success - exit retry loop
              } catch (extraError) {
                retryCount++;
                console.log(`Retry ${retryCount} for extra ${extra.name}`);

                if (retryCount === maxRetries) {
                  console.error(
                    `Failed to add extra ${extra.name} after ${maxRetries} attempts:`,
                    extraError.response?.data || extraError.message
                  );
                } else {
                  await wait(2000 * retryCount); // Exponential backoff
                  continue;
                }
              }
            }
          }
        }

          // Clean up the pending booking after successful processing
          pendingBookings.delete(bookingReference);
          console.log("Successfully processed booking and removed from pending bookings");

        } catch (error) {
          console.error(
            "Error creating Smoobu booking:",
            error.response?.data || error.message
          );
          return res.status(500).json({
            error: "Failed to create booking in Smoobu",
            details: error.response?.data || error.message
          });
        }
      }

      res.json({ received: true });
    } catch (err) {
      console.error("Webhook Error:", err.message);
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
      "https://booking-rho-plum.vercel.app"  
    ],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true
  })
);

app.get('/api/apartments', async (req, res) => {
  try {
    const response = await axios.get('https://login.smoobu.com/api/apartments', {
      headers: {
        'Api-Key': "UZFV5QRY0ExHUfJi3c1DIG8Bpwet1X4knWa8rMkj6o",
        'Cache-Control': 'no-cache',
        "Content-Type": "application/json",
      }
    });
    res.json(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).json({
      status: error.response?.status,
      title: error.response?.data?.title || 'Error',
      detail: error.response?.data?.detail || 'Failed to fetch apartments'
    });
  }
});

app.get('/api/apartments/:id', async (req, res) => {
  try {
    const response = await axios.get(`https://login.smoobu.com/api/apartments/${req.params.id}`, {
      headers: {
        'Api-Key': "UZFV5QRY0ExHUfJi3c1DIG8Bpwet1X4knWa8rMkj6o",
        "Content-Type": "application/json",
      }
    });
    
    // Smoobu API returns images in the response
    const images = response.data.images || [];
    res.json({ images });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch apartment images' });
  }
});


  // Replace your current /api/rates endpoint with this one
app.get("/api/rates", async (req, res) => {
  try {
    const { apartments, start_date, end_date, adults, children } = req.query;

    console.log("Processing rates request:", {
      apartments,
      start_date,
      end_date,
      adults,
      children
    });

    // Validate required parameters
    if (!start_date || !end_date) {
      return res.status(400).json({
        error: "Missing dates",
        details: "Both start_date and end_date are required"
      });
    }

    if (!apartments) {
      return res.status(400).json({
        error: "Missing apartments",
        details: "Apartments parameter is required"
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
        details: "The API returned no data"
      });
    }

    const formattedData = {};
    const priceDetailsByApartment = {};
    let hasAvailability = false;

    // Process each apartment
    (Array.isArray(apartments) ? apartments : [apartments]).forEach(apartmentId => {
      const apartmentData = response.data.data[apartmentId];
      if (!apartmentData) return;

      formattedData[apartmentId] = apartmentData;
      const settings = discountSettings[apartmentId];
      
      if (!settings) {
        console.log(`No settings found for apartment ${apartmentId}`);
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
              lengthOfStayDiscount: settings.lengthOfStayDiscount
            }
          };
          hasAvailability = true;
        }
      } catch (calcError) {
        console.error(`Error calculating price for apartment ${apartmentId}:`, calcError);
      }
    });

    // Check if we found any available apartments
    if (!hasAvailability) {
      return res.status(200).json({
        data: formattedData,
        priceDetails: {},
        hasAvailability: false,
        message: "No apartments available for the selected dates and guests"
      });
    }

    console.log("Sending response with price details:", {
      apartmentCount: Object.keys(priceDetailsByApartment).length,
      availableApartments: Object.keys(priceDetailsByApartment)
    });

    res.json({
      data: formattedData,
      priceDetails: priceDetailsByApartment,
      hasAvailability: true
    });

  } catch (error) {
    console.error("Error in /api/rates:", error);
    res.status(500).json({
      error: "Failed to fetch rates",
      details: error.response?.data || error.message,
      status: error.response?.status || 500
    });
  }
});

app.post("/api/create-payment-intent", async (req, res) => {
  try {
    const { price, bookingData } = req.body;

    // Process extras to preserve translation information
    if (bookingData.extras) {
      bookingData.extras = bookingData.extras.map((extra) => {
        const baseExtra = {
          ...extra,
          nameKey: extra.name.startsWith("extras.") ? extra.name : null,
        };

        // If there are extra persons, ensure their translation is preserved too
        if (extra.extraPersonQuantity > 0) {
          return {
            ...baseExtra,
            extraPersonNameKey: "extras.additionalPerson",
          };
        }

        return baseExtra;
      });
    }

    const bookingReference = `BOOKING-${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 9)}`;
    console.log("Generated booking reference:", bookingReference);

    // Store booking data for webhook
    pendingBookings.set(bookingReference, bookingData);
    console.log("Stored booking data with extras:", bookingData);

    // Create payment intent with total price (including extras and discounts)
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(price * 100), // Convert to cents
      currency: "eur",
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
        bookingReference: bookingReference,
        basePrice: bookingData.basePrice.toString(),
        extrasTotal: (price - bookingData.basePrice).toString(),
        longStayDiscount: bookingData.priceDetails.discount.toString(),
        couponDiscount: (bookingData.couponApplied?.discount || "0").toString(),
      },
    });

    console.log("Created payment intent:", paymentIntent.id);

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

    // Fetch the payment intent from Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (!paymentIntent) {
      return res.status(404).json({ error: "Payment not found" });
    }

    const bookingReference = paymentIntent.metadata.bookingReference;
    const bookingData = pendingBookings.get(bookingReference);



    if (!bookingData) {
      return res.status(404).json({
        error: "Booking details not found",
        paymentIntent: paymentIntentId,
        bookingReference: bookingReference,
      });
    }
    

    // Récupérer les montants des réductions depuis les metadata
    const basePrice = parseFloat(paymentIntent.metadata.basePrice);
    const extrasTotal = parseFloat(paymentIntent.metadata.extrasTotal || 0);
    const longStayDiscount = parseFloat(
      paymentIntent.metadata.longStayDiscount || 0
    );
    const couponDiscount = parseFloat(
      paymentIntent.metadata.couponDiscount || 0
    );

    // Calculer le total final
    const subtotalBeforeDiscounts = basePrice + extrasTotal;
    const finalTotal =
      subtotalBeforeDiscounts - longStayDiscount - couponDiscount;

    const responseData = {
      ...bookingData,
      basePrice: basePrice,
      paymentIntent: {
        id: paymentIntent.id,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        status: paymentIntent.status,
      },
      priceBreakdown: {
        basePrice: basePrice,
        extrasTotal: extrasTotal,
        longStayDiscount: longStayDiscount,
        couponDiscount: couponDiscount,
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
  console.log(`Server running on port ${PORT}`);
  console.log("Webhook endpoint ready at /webhook");
});


app.get("/api/bookings-history/:email", async (req, res) => {
  try {
    const { email } = req.params;
    const snapshot = await db.collection('bookings')
      .where('email', '==', email)
      .orderBy('createdAt', 'desc')
      .get();
    
    const bookings = [];
    snapshot.forEach(doc => {
      bookings.push({ id: doc.id, ...doc.data() });
    });
    
    res.json(bookings);
  } catch (error) {
    console.error("Error fetching bookings:", error);
    res.status(500).json({
      error: "Failed to fetch bookings",
      message: error.message
    });
  }
});