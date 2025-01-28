import express from 'express';
import cors from 'cors';
import axios from 'axios';
import Stripe from 'stripe';
import nodemailer from 'nodemailer';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';


import { 
  doc, 
  updateDoc, 
  increment, 
  arrayUnion,
  collection,
  query,
  where,
  getDocs 
} from 'firebase/firestore';

import { db, FieldValue } from './firebase-config.js';


const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();

const app = express();

app.use((req, res, next) => {
  // console.log('Incoming Origin:', req.headers.origin);
  next();
});

app.options('/webhook', cors());

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const pendingBookings = new Map();

// After imports, with other configurations
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

// Add this function near the top with other helpers
const formatDate = (dateString) => {
  return new Date(dateString).toLocaleDateString('fr-BE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
};

const sendBookingConfirmation = async (bookingData) => {
  try {
    const emailContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1>Confirmation de réservation - Ferme de Basseilles</h1>
        
        <div style="margin: 20px 0;">
          <h2>Détails du séjour</h2>
          <p>Arrivée: ${formatDate(bookingData.arrivalDate)} à ${bookingData.arrivalTime}</p>
          <p>Départ: ${formatDate(bookingData.departureDate)}</p>
          <p>Voyageurs: ${bookingData.adults} adultes${bookingData.children ? `, ${bookingData.children} enfants` : ''}</p>
        </div>

        <div style="margin: 20px 0;">
          <h2>Détails des prix</h2>
          <p>Prix de base: ${bookingData.basePrice.toFixed(2)} EUR</p>
          ${bookingData.extras?.map(extra => `
            <p>${extra.name} (x${extra.quantity}): ${extra.amount.toFixed(2)} EUR</p>
            ${extra.extraPersonQuantity ? `<p>Personne supplémentaire (x${extra.extraPersonQuantity}): ${extra.extraPersonAmount.toFixed(2)} EUR</p>` : ''}
          `).join('')}
          ${bookingData.priceDetails?.discount ? 
            `<p style="color: #22c55e;">Réduction long séjour (${bookingData.priceDetails.settings.lengthOfStayDiscount.discountPercentage}%): -${bookingData.priceDetails.discount.toFixed(2)} EUR</p>` 
            : ''}
          ${bookingData.couponApplied ? 
            `<p style="color: #22c55e;">
              ${bookingData.couponApplied.type === 'percentage' 
                ? `Code promo (${bookingData.couponApplied.code} - ${bookingData.couponApplied.percentageValue}%): -${(bookingData.couponApplied.discount || 0).toFixed(2)} EUR`
                : `Code promo (${bookingData.couponApplied.code}): -${(bookingData.couponApplied.discount || 0).toFixed(2)} EUR`}
            </p>` 
            : ''}
          <p style="font-weight: bold; margin-top: 10px;">Total: ${bookingData.price.toFixed(2)} EUR</p>
        </div>

        <div style="margin: 20px 0;">
          <h2>Coordonnées</h2>
          <p>${bookingData.firstName} ${bookingData.lastName}</p>
          <p>Email: ${bookingData.email}</p>
          ${bookingData.phone ? `<p>Téléphone: ${bookingData.phone}</p>` : ''}
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
      subject: 'Confirmation de réservation - Ferme de Basseilles',
      html: emailContent
    });

    console.log('Confirmation email sent to:', bookingData.email);
  } catch (error) {
    console.error('Error sending confirmation email:', error);
  }
};

// Discount settings
const discountSettings = {
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
  'extras.packs.relaxGourmet.name': 'Le détente gourmet (pour 2)',
  'extras.packs.racletteRelax.name': 'La raclette en détente (pour 2)',
  'extras.packs.romanticGourmet.name': 'Le romantique gourmet (pour 2)',
  'extras.packs.racletteRomantic.name': 'La raclette romantique (pour 2)',
  'extras.packs.bbqRelax.name': 'Le barbecue détente (pour 2)',
  'extras.packs.bbqRomantic.name': 'Le romantique barbecue (pour 2)',
  'extras.formulesDecouverte.passion.name': 'Formule passion (pour 2)',
  'extras.formulesDecouverte.birthday.name': 'Formule anniversaire (pour 2)',

  // Spa
  'extras.spa.basic.name': 'Formule SPA (2 pers)',
  'extras.spa.withBottle.name': 'Formule SPA + bouteille (2 pers)',

  // Meals
  'extras.meals.meatballsLiege.name': 'Boulettes de viande sauce liégeoise',
  'extras.meals.meatballsTomato.name': 'Boulette de viande sauce tomate',
  'extras.meals.waterzooi.name': 'Waterzooi de volaille',
  'extras.meals.chiliVeg.name': 'Chili végétarien',
  'extras.meals.carrotSoup.name': 'Velouté de carotte et cumin',

  // Meal Formulas
  'extras.formulesRepas.breakfast.name': 'Formule petit-déjeuner (2 pers)',
  'extras.formulesRepas.gourmet.name': 'Formule gourmet (2 pers)',
  'extras.formulesRepas.raclette.name': 'Formule raclette (2 pers)',
  'extras.formulesRepas.bbq.name': 'Formule barbecue (2 pers)',
  'extras.formulesRepas.apero.name': 'Formule planche apéro (2 pers)',

  // Additional Person translation
  'extras.additionalPerson': 'Personne supplémentaire',
};

// Add this near your other constants at the top of server.js
const roomNames = {
  '1946282': 'Le Dôme des Libellules',
  '1644643': 'La Bulle du Ruisseau',
  '1946279': 'Le Moulin',
  '1946276': 'La Chambre de Blé',
  '1946270': 'Le Logis'
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
  const startDateStr = currentDate.toISOString().split('T')[0];
  const prevDay = new Date(currentDate);
  prevDay.setDate(prevDay.getDate() - 1);
  const prevDayStr = prevDay.toISOString().split('T')[0];

  // If starting on a departure day, don't count it as unavailable
  const isDepartureDay =
    (!rates[prevDayStr] || rates[prevDayStr].available === 0) &&
    rates[startDateStr] &&
    rates[startDateStr].available === 1;

  while (currentDate <= endDateTime) {
    const dateStr = currentDate.toISOString().split('T')[0];
    const nextDate = new Date(currentDate);
    nextDate.setDate(nextDate.getDate() + 1);
    const nextDateStr = nextDate.toISOString().split('T')[0];

    // Only count if this is not the departure day OK
    if (dateStr !== endDateTime.toISOString().split('T')[0]) {
      const dayRate = rates[dateStr];
      if (dayRate) {
        if (
          dayRate.available === 1 ||
          (dateStr === startDateStr && isDepartureDay)
        ) {
          totalPrice += dayRate.price;
          numberOfNights++;
          // console.log(`Adding price for ${dateStr}:`, dayRate.price);
        }
      }
    }

    currentDate.setDate(currentDate.getDate() + 1);
  }

  // console.log('Base calculation:', {
  //   totalPrice,
  //   numberOfNights,
  // });

  // Calculate long stay discount only on the base room price
  let discount = 0;
  if (numberOfNights >= settings.lengthOfStayDiscount.minNights) {
    discount =
      (totalPrice * settings.lengthOfStayDiscount.discountPercentage) / 100;
    // console.log('Long stay discount:', {
    //   numberOfNights,
    //   minimumNights: settings.lengthOfStayDiscount.minNights,
    //   discountPercentage: settings.lengthOfStayDiscount.discountPercentage,
    //   discountAmount: discount,
    // });
  }

  // Guest fees
  const extraGuests = Math.max(0, numberOfGuests - settings.startingAtGuest);
  const extraGuestsFee =
    extraGuests * settings.extraGuestsPerNight * numberOfNights;
  const extraChildrenFee =
    numberOfChildren * settings.extraChildPerNight * numberOfNights;

  // console.log('Guest fees:', {
  //   extraGuests,
  //   extraGuestsFee,
  //   extraChildrenFee,
  //   extraGuestsPerNight: settings.extraGuestsPerNight,
  //   extraChildPerNight: settings.extraChildPerNight,
  // });

  // Build price elements array
  const priceElements = [
    {
      type: 'basePrice',
      name: 'Prix de base',
      amount: totalPrice,
      currencyCode: 'EUR',
    },
  ];

  if (extraGuestsFee > 0) {
    priceElements.push({
      type: 'addon',
      name: 'Frais de personne supplémentaire',
      amount: extraGuestsFee,
      currencyCode: 'EUR',
    });
  }

  if (extraChildrenFee > 0) {
    priceElements.push({
      type: 'addon',
      name: "Frais d'enfants supplémentaires",
      amount: extraChildrenFee,
      currencyCode: 'EUR',
    });
  }

  if (settings.cleaningFee > 0) {
    priceElements.push({
      type: 'cleaningFee',
      name: 'Frais de nettoyage',
      amount: settings.cleaningFee,
      currencyCode: 'EUR',
    });
  }

  if (discount > 0) {
    priceElements.push({
      type: 'longStayDiscount',
      name: `Réduction long séjour (${settings.lengthOfStayDiscount.discountPercentage}%)`,
      amount: -discount,
      currencyCode: 'EUR',
    });
  }

  // Calculate final price
  const subtotal =
    totalPrice + extraGuestsFee + extraChildrenFee + settings.cleaningFee;
  const finalPrice = subtotal - discount;

  // console.log('Final price calculation:', {
  //   basePrice: totalPrice,
  //   extraGuestsFee,
  //   extraChildrenFee,
  //   cleaningFee: settings.cleaningFee,
  //   subtotal,
  //   discount,
  //   finalPrice,
  //   numberOfNights,
  //   priceElements,
  // });

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
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

app.post(
  '/webhook',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    console.log('🟦 Webhook received:', new Date().toISOString());
    const sig = req.headers['stripe-signature'];
    let event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        'whsec_sbVaa5obD8UFZ5hzg0iEZpLHozrHi4Z8'
      );

      if (event.type === 'payment_intent.succeeded') {
        const paymentIntent = event.data.object;
        console.log('🟦 Payment Intent metadata:', paymentIntent.metadata);
        
        const bookingReference = paymentIntent.metadata.bookingReference;
        console.log('🟦 Booking Reference:', bookingReference);
        
        const bookingData = pendingBookings.get(bookingReference);
        console.log('🟦 Retrieved booking data:', {
          hasBookingData: !!bookingData,
          couponData: bookingData?.couponApplied,
          bookingReference
        });

        if (!bookingData) {
          console.error('No booking data found for reference:', bookingReference);
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

          // Store booking in Firebase
          const bookingDoc = {
            ...bookingData,
            smoobuReservationId: smoobuResponse.data.id,
            paymentIntentId: paymentIntent.id,
            stripePaymentStatus: paymentIntent.status,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            extras: bookingData.extras
              ? bookingData.extras.map((extra) => {
                  const translatedExtra = {
                    ...extra,
                    name: extra.name.startsWith('extras.')
                      ? extrasFrenchNames[extra.name] || extra.name
                      : extra.name,
                  };

                  if (extra.extraPersonQuantity > 0) {
                    translatedExtra.extraPersonName =
                      extrasFrenchNames['extras.additionalPerson'];
                  }

                  return translatedExtra;
                })
              : [],
            appliedCoupon: bookingData.couponApplied ? {
              code: bookingData.couponApplied.code,
              type: bookingData.couponApplied.type,
              discount: bookingData.couponApplied.discount,
              percentageValue: bookingData.couponApplied.type === 'percentage' 
                ? Number(bookingData.couponApplied.percentageValue) || null
                : null
            } : null
          };

          try {
            const docRef = await db.collection('bookings').add(bookingDoc);
            console.log('🟩 Booking stored in Firebase with ID:', docRef.id);

            await sendBookingConfirmation(bookingDoc);
          } catch (firebaseError) {
            console.error('🟥 Error storing in Firebase:', firebaseError);
          }

          const reservationId = smoobuResponse.data.id;
          await wait(2000);

          // First add base price
          try {
            await axios.post(
              `https://login.smoobu.com/api/reservations/${reservationId}/price-elements`,
              {
                type: 'base',
                name: 'Prix de base',
                amount: bookingData.basePrice,
                quantity: 1,
                currencyCode: 'EUR'
              },
              {
                headers: {
                  'Api-Key': 'UZFV5QRY0ExHUfJi3c1DIG8Bpwet1X4knWa8rMkj6o',
                  'Content-Type': 'application/json'
                }
              }
            );
            await wait(1000);
          } catch (error) {
            console.error('🟥 Failed to add base price:', error);
          }

          // Process extras if they exist
          if (bookingData.extras && bookingData.extras.length > 0) {
            for (const extra of bookingData.extras) {
              let retryCount = 0;
              const maxRetries = 3;

              while (retryCount < maxRetries) {
                try {
                  const processedName = {
                    nameKey: extra.name.startsWith('extras.')
                      ? extra.name
                      : null,
                    name: extra.name.startsWith('extras.')
                      ? extrasFrenchNames[extra.name]
                      : extra.name,
                  };

                // With this
if (processedName.name && !processedName.name.toLowerCase().includes('personne supplémentaire'.toLowerCase())) {
  await axios.post(
    `https://login.smoobu.com/api/reservations/${reservationId}/price-elements`,
    {
      type: 'addon',
      name: processedName.name,
      nameKey: processedName.nameKey,
      amount: extra.amount,
      quantity: extra.quantity,
      currencyCode: 'EUR',
    },
    {
      headers: {
        'Api-Key': 'UZFV5QRY0ExHUfJi3c1DIG8Bpwet1X4knWa8rMkj6o',
        'Content-Type': 'application/json',
      },
    }
  );
  await wait(1000);
}

                  if (extra.extraPersonQuantity > 0 && extra.extraPersonPrice) {
                    await axios.post(
                      `https://login.smoobu.com/api/reservations/${reservationId}/price-elements`,
                      {
                        type: 'addon',
                        name: `${processedName.name} - ${extrasFrenchNames['extras.additionalPerson']}`,
                        nameKey: 'extras.additionalPerson',
                        amount: extra.extraPersonPrice * extra.extraPersonQuantity,
                        quantity: extra.extraPersonQuantity,
                        currencyCode: 'EUR',
                      },
                      {
                        headers: {
                          'Api-Key': 'UZFV5QRY0ExHUfJi3c1DIG8Bpwet1X4knWa8rMkj6o',
                          'Content-Type': 'application/json',
                        },
                      }
                    );
                    await wait(1000);
                  }

                  break;
                } catch (extraError) {
                  retryCount++;
                  if (retryCount === maxRetries) {
                    console.error('🟥 Failed to add extra:', extraError);
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
                const couponName = bookingData.couponApplied.type === 'percentage'
                ? `Code promo: ${bookingData.couponApplied.code} (-${bookingData.couponApplied.percentageValue}%)`
                : `Code promo: ${bookingData.couponApplied.code} (-${bookingData.couponApplied.discount}€)`;
        
                await axios.post(
                  `https://login.smoobu.com/api/reservations/${reservationId}/price-elements`,
                  {
                    type: 'discount',
                    name: couponName,
                    amount: -bookingData.couponApplied.discount, // Negative amount for discount
                    quantity: 1,
                    currencyCode: 'EUR'
                  },
                  {
                    headers: {
                      'Api-Key': 'UZFV5QRY0ExHUfJi3c1DIG8Bpwet1X4knWa8rMkj6o',
                      'Content-Type': 'application/json'
                    }
                  }
                );
                await wait(1000);
                break;
              } catch (couponError) {
                retryCount++;
                if (retryCount === maxRetries) {
                  console.error('🟥 Failed to add coupon discount:', couponError);
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
                    type: 'discount',
                    name: `Réduction long séjour (${bookingData.priceDetails.settings.lengthOfStayDiscount.discountPercentage}%)`,
                    amount: -bookingData.priceDetails.discount,
                    quantity: 1,
                    currencyCode: 'EUR'
                  },
                  {
                    headers: {
                      'Api-Key': 'UZFV5QRY0ExHUfJi3c1DIG8Bpwet1X4knWa8rMkj6o',
                      'Content-Type': 'application/json'
                    }
                  }
                );
                break;
              } catch (discountError) {
                retryCount++;
                if (retryCount === maxRetries) {
                  console.error('🟥 Failed to add long stay discount:', discountError);
                } else {
                  await wait(2000 * retryCount);
                  continue;
                }
              }
            }
          }


          // Inside your webhook handler where the coupon update happens:
          if (bookingData.couponApplied?.code) {
            console.log('🟨 Starting coupon update process:', {
              couponCode: bookingData.couponApplied.code,
              couponData: bookingData.couponApplied
            });

            try {
              const couponsRef = db.collection('coupons');
              const couponQuery = await couponsRef
                .where('code', '==', bookingData.couponApplied.code)
                .get();

              if (!couponQuery.empty) {
                const couponDoc = couponQuery.docs[0];
                console.log('🟨 Found coupon document:', couponDoc.id);

                const usageRecord = {
                  email: bookingData.email,
                  name: `${bookingData.firstName} ${bookingData.lastName}`,
                  bookingAmount: bookingData.price,
                  usageDate: new Date().toISOString(),
                  discountApplied: bookingData.couponApplied.discount
                };

                const newStatus = bookingData.couponApplied.code === 'POTES' ? 'active' : 'inactive';

                // For "POTES" coupon, only update usage history
                if (bookingData.couponApplied.code === 'POTES') {
                  await couponDoc.ref.update({
                    usageHistory: FieldValue.arrayUnion(usageRecord)
                  });
                  
                  console.log('🟩 POTES coupon usage recorded:', {
                    couponId: couponDoc.id,
                    code: bookingData.couponApplied.code
                  });
                } else {
                await couponDoc.ref.update({
                  status: newStatus,
                  usedCount: FieldValue.increment(1),
                  lastUsedDate: new Date().toISOString(),
                  lastUsedBy: bookingData.email,
                  usageHistory: FieldValue.arrayUnion(usageRecord),
                  updatedAt: new Date().toISOString()
                });
                
                console.log('🟩 Coupon update successful:', {
                  couponId: couponDoc.id,
                  code: bookingData.couponApplied.code,
                  newStatus: newStatus
                });
              }
              } else {
                console.error('🟥 Coupon document not found for code:', bookingData.couponApplied.code);
              }
            } catch (error) {
              console.error('🟥 Error updating coupon:', {
                error: error.message,
                stack: error.stack,
                couponData: bookingData.couponApplied
              });
            }
          }

          pendingBookings.delete(bookingReference);
          console.log('🟩 Booking process completed successfully');
          
        } catch (error) {
          console.error('🟥 Error in booking creation:', {
            error: error.message,
            details: error.response?.data
          });
          return res.status(500).json({
            error: 'Failed to create booking in Smoobu',
            details: error.response?.data || error.message,
          });
        }
      }

      res.json({ received: true });
    } catch (err) {
      console.error('🟥 Webhook Error:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }
  }
);

// Use JSON parsing and CORS for all other routes
app.use(express.json());
app.use(
  cors({
    origin: [
      'https://reservation.fermedebasseilles.be',
      'http://localhost:5173',
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
  })
);

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
    const lastDay = new Date(finalEndYear, parseInt(finalEndMonth), 0).getDate();
    const endDate = `${finalEndYear}-${finalEndMonth}-${lastDay}`;

    console.log("=== START OF BOOKINGS REPORT REQUEST ===");
    console.log("Request params:", {
      startMonth: finalStartMonth,
      startYear: finalStartYear,
      endMonth: finalEndMonth,
      endYear: finalEndYear
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
          excludeBlocked: true, // Change to true to exclude blocked bookings
          showCancellation: true,
        },
      }
    );

    const bookings = bookingsResponse.data.bookings || [];
    console.log(`Found ${bookings.length} bookings for period ${finalStartMonth}/${finalStartYear} - ${finalEndMonth}/${finalEndYear}`);

    // Process each booking to get price elements and extras
    const processedBookings = [];
    for (const booking of bookings) {
      try {
        console.log(`Processing booking ${booking.id}`);
        
        // Skip if it's a blocked booking
        if (booking.channelId === 'Blocked') {
          console.log(`Skipping blocked booking ${booking.id}`);
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
        console.log('Price elements for booking', booking.id, ':', priceElements);
        
        // Calculate nights
        const checkIn = new Date(booking.arrival);
        const checkOut = new Date(booking.departure);
        const nights = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));

        // Process extras - all non-base price elements, excluding cancellations
        const extras = priceElements.filter(element => {
          const name = element.name?.toLowerCase() || '';
          const type = element.type?.toLowerCase() || '';
          
          // Skip cancellation-related items
          if (
            name.includes('cancellation') || 
            name.includes('pass_through') ||
            name.includes('prix de base') ||
            name.includes('base price') ||
            name === 'base' ||
            type === 'base'
          ) {
            return false;
          }

          // Include only addons and exclude base price
          return (
            element.type === "addon" || 
            (element.type !== "base" && element.type !== "discount")
          );
        });

        // Find commission from extras
        const commissionExtra = extras.find(extra => 
          extra.name?.toLowerCase().includes('commission')
        );
        const commission = commissionExtra ? commissionExtra.amount : 0;

        // Remove commission from extras list if it exists
        const nonCommissionExtras = extras.filter(extra => 
          !extra.name?.toLowerCase().includes('commission')
        );


        // Calculate totals - fix base price detection
        const basePrice = priceElements.find(el => 
          el.name?.toLowerCase().includes('base') ||
          el.type?.toLowerCase() === 'base'
        )?.amount || 0;

        const extrasTotal = extras.reduce((sum, extra) => sum + extra.amount, 0);
        const discounts = priceElements
          .filter(el => el.type === 'discount')
          .reduce((sum, discount) => sum + Math.abs(discount.amount), 0);

        // Log price elements breakdown for debugging
        // Log price elements breakdown for debugging
        console.log('Price elements breakdown:', {
          bookingId: booking.id,
          allElements: priceElements.map(el => ({
            name: el.name,
            type: el.type,
            amount: el.amount
          })),
          basePrice,
          commission,
          filteredExtras: nonCommissionExtras.map(ex => ({
            name: ex.name,
            amount: ex.amount
          })),
          extrasTotal,
          discounts
        });
        // Format created date
        let createdDate = null;
        try {
          if (booking.created) {
            createdDate = new Date(booking.created).toISOString();
          }
        } catch (e) {
          console.error('Error parsing created date:', e);
        }

        // Add a portal name mapping
        const portalNames = {
          'Homepage': 'Site web'
        };
        // Get apartment name
        // In the processedBooking object creation
        const processedBooking = {
          id: booking.id,
          guest: booking["guest-name"] || 
                `${booking.firstName || ''} ${booking.lastName || ''}`.trim() || 
                (booking.notice?.match(/Message du client:?\s*([^\n]+)/) || [])[1] ||
                booking.email?.split('@')[0] ||
                'Sans nom',
          property: roomNames[booking.apartmentId] || booking.apartment?.name || '',
          portal: portalNames[booking.channel?.name] || booking.channel?.name || 'Site web',
          created: booking['created-at'] || booking.created || new Date().toISOString(), // Fix the date
          email: booking.email || '',
          phone: booking.phone || '',
          address: booking.address || '',
          adults: parseInt(booking.adults) || 0,
          children: parseInt(booking.children) || 0,
          checkIn: booking.arrival,
          checkOut: booking.departure,
          arrivalTime: booking["check-in"] || '', // Use check-in from API
          departureTime: booking["check-out"] || '',
          notes: booking.notice || '',
          price: parseFloat(booking.price) || 0,
          
          // Price details with promo code
          priceDetails: {
            basePrice: parseFloat(basePrice),
            extrasTotal: parseFloat(extrasTotal),
            discounts: parseFloat(discounts),
            promoCode: priceElements.find(el => 
              el.name?.toLowerCase().includes('code promo') || 
              el.name?.toLowerCase().includes('coupon') ||
              el.type === 'discount'
            ),
            total: parseFloat(basePrice) + parseFloat(extrasTotal) - parseFloat(discounts),
          },
          commission: parseFloat(commission),
          nights,
          extras: nonCommissionExtras
            .filter(extra => 
              !extra.name?.toLowerCase().includes('code promo') && 
              !extra.name?.toLowerCase().includes('coupon') &&
              extra.type !== 'discount'
            )
            .map(extra => ({
              name: extra.name || 'Extra sans nom',
              amount: parseFloat(extra.amount) || 0,
              quantity: parseInt(extra.quantity) || 1
            })) || []
        };
        
        // Only add if not blocked booking
        if (booking.channelId !== 'Blocked') {
          processedBookings.push(processedBooking);
        }

        // Log raw booking data and processed result
        console.log('Raw booking data:', {
          id: booking.id,
          guestName: booking["guest-name"],
          firstName: booking.firstName,
          lastName: booking.lastName,
          email: booking.email,
          address: booking.address,
          channel: booking.channel?.name,
          created: booking['created-at'], // Log the correct created-at field
          arrivalTime: booking["check-in"]
        });

        console.log('Processed booking:', {
          id: processedBooking.id,
          guest: processedBooking.guest,
          price: processedBooking.price,
          extras: processedBooking.extras
        });

      } catch (error) {
        console.error(`Error processing booking ${booking.id}:`, error.message);
        console.error('Full error:', error);
      }
    }

    console.log("=== PROCESSING SUMMARY ===");
    console.log({
      period: `${finalStartMonth}/${finalStartYear} - ${finalEndMonth}/${finalEndYear}`,
      totalBookings: bookings.length,
      processedBookings: processedBookings.length,
      sampleBooking: processedBookings[0]
    });

    res.json({
      startMonth: finalStartMonth,
      startYear: finalStartYear,
      endMonth: finalEndMonth,
      endYear: finalEndYear,
      data: processedBookings
    });

  } catch (error) {
    console.error("=== ERROR IN REQUEST ===");
    console.error('Full error:', error);
    console.error('Error response:', error.response?.data);
    res.status(500).json({
      error: "Failed to generate bookings report",
      details: error.message,
    });
  }
});

app.get('/api/apartments', async (req, res) => {
  try {
    const response = await axios.get(
      'https://login.smoobu.com/api/apartments',
      {
        headers: {
          'Api-Key': 'UZFV5QRY0ExHUfJi3c1DIG8Bpwet1X4knWa8rMkj6o',
          'Cache-Control': 'no-cache',
          'Content-Type': 'application/json',
        },
      }
    );
    res.json(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).json({
      status: error.response?.status,
      title: error.response?.data?.title || 'Error',
      detail: error.response?.data?.detail || 'Failed to fetch apartments',
    });
  }
});

app.get('/api/apartments/:id', async (req, res) => {
  try {
    const response = await axios.get(
      `https://login.smoobu.com/api/apartments/${req.params.id}`,
      {
        headers: {
          'Api-Key': 'UZFV5QRY0ExHUfJi3c1DIG8Bpwet1X4knWa8rMkj6o',
          'Content-Type': 'application/json',
        },
      }
    );

    // Smoobu API returns images in the response
    const images = response.data.images || [];
    res.json({ images });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch apartment images' });
  }
});

// Replace your current /api/rates endpoint with this one
app.get('/api/rates', async (req, res) => {
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
        error: 'Missing dates',
        details: 'Both start_date and end_date are required',
      });
    }

    if (!apartments) {
      return res.status(400).json({
        error: 'Missing apartments',
        details: 'Apartments parameter is required',
      });
    }

    // Make the API call to Smoobu
    const response = await axios.get('https://login.smoobu.com/api/rates', {
      headers: {
        'Api-Key': 'UZFV5QRY0ExHUfJi3c1DIG8Bpwet1X4knWa8rMkj6o',
        'Content-Type': 'application/json',
      },
      params: {
        apartments: Array.isArray(apartments) ? apartments : [apartments],
        start_date,
        end_date,
      },
    });

    if (!response.data || !response.data.data) {
      return res.status(404).json({
        error: 'No rates found',
        details: 'The API returned no data',
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
        message: 'No apartments available for the selected dates and guests',
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
      error: 'Failed to fetch rates',
      details: error.response?.data || error.message,
      status: error.response?.status || 500,
    });
  }
});

app.post('/api/create-payment-intent', async (req, res) => {
  try {
    const { price, bookingData } = req.body;

    // Process extras to preserve translation information
    if (bookingData.extras) {
      bookingData.extras = bookingData.extras.map((extra) => {
        const baseExtra = {
          ...extra,
          nameKey: extra.name.startsWith('extras.') ? extra.name : null,
        };

        // If there are extra persons, ensure their translation is preserved too
        if (extra.extraPersonQuantity > 0) {
          return {
            ...baseExtra,
            extraPersonNameKey: 'extras.additionalPerson',
          };
        }

        return baseExtra;
      });
    }

    const bookingReference = `BOOKING-${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 9)}`;
    // console.log('Generated booking reference:', bookingReference);

    // Store booking data for webhook
    pendingBookings.set(bookingReference, bookingData);
    // console.log('Stored booking data with extras:', bookingData);


    // For Stripe payment intent creation
const paymentIntent = await stripe.paymentIntents.create({
  amount: Math.round(price * 100),
  currency: 'eur',
  automatic_payment_methods: {
    enabled: true,
  },
  description: `Réservation - ${bookingData.firstName} ${bookingData.lastName}
    Chambre: ${roomNames[bookingData.apartmentId]} 
    (${bookingData.arrivalDate} - ${bookingData.departureDate})
    Base: ${bookingData.basePrice}€${bookingData.extras?.length ? ` • Extras: ${(price - bookingData.basePrice)}€` : ''}${bookingData.couponApplied ? ` • Code ${bookingData.couponApplied.code}: -${bookingData.couponApplied.discount}€` : ''}`,
  metadata: {
    // Client information
    clientName: `${bookingData.firstName} ${bookingData.lastName}`,
    clientEmail: bookingData.email,
    clientPhone: bookingData.phone || '',
    
    // Room details
    roomId: bookingData.apartmentId,
    roomName: roomNames[bookingData.apartmentId],
    
    // Booking details
    bookingReference: bookingReference,
    checkIn: bookingData.arrivalDate,
    checkOut: bookingData.departureDate,
    
    // Price breakdown
    basePrice: `${bookingData.basePrice}€`,
    extrasTotal: bookingData.extras?.length ? `${(price - bookingData.basePrice)}€` : '0€',
    
    // Coupon information if exists
    ...(bookingData.couponApplied && {
      couponCode: bookingData.couponApplied.code,
      couponDiscount: `-${bookingData.couponApplied.discount}€`,
      couponType: bookingData.couponApplied.type
    }),
    
    finalPrice: `${price}€`
  }
});

    // console.log('Created payment intent:', paymentIntent.id);

    res.json({
      clientSecret: paymentIntent.client_secret,
      bookingReference: bookingReference,
    });
  } catch (error) {
    // console.error('Error creating payment intent:', error);
    res.status(500).json({
      error: 'Failed to create payment intent',
      details: error.message,
    });
  }
});

app.get('/api/bookings/:paymentIntentId', async (req, res) => {
  try {
    const { paymentIntentId } = req.params;

    // Fetch the payment intent from Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (!paymentIntent) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    const bookingReference = paymentIntent.metadata.bookingReference;
    const bookingData = pendingBookings.get(bookingReference);

    if (!bookingData) {
      return res.status(404).json({
        error: 'Booking details not found',
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
    // console.error('Error fetching booking:', error);
    res.status(500).json({
      error: 'Failed to fetch booking details',
      message: error.message,
    });
  }
});

// Debug endpoint to check pending bookings
app.get('/api/pending-bookings', (req, res) => {
  const bookings = Array.from(pendingBookings.entries());
  res.json(bookings);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  // console.log(`Server running on port ${PORT}`);
  // console.log('Webhook endpoint ready at /webhook');
});

app.get('/api/bookings-history/:email', async (req, res) => {
  try {
    const { email } = req.params;
    const snapshot = await db
      .collection('bookings')
      .where('email', '==', email)
      .orderBy('createdAt', 'desc')
      .get();

    const bookings = [];
    snapshot.forEach((doc) => {
      bookings.push({ id: doc.id, ...doc.data() });
    });

    res.json(bookings);
  } catch (error) {
    console.error('Error fetching bookings:', error);
    res.status(500).json({
      error: 'Failed to fetch bookings',
      message: error.message,
    });
  }
});


app.post('/api/test-email', async (req, res) => {
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: process.env.EMAIL_USER, // Send to yourself first
      subject: 'Test Email',
      html: '<h1>Test booking confirmation</h1><p>This is a test email.</p>'
    });
    res.json({ success: true });
    console.error('Email test worked:');
  } catch (error) {
    console.error('Email test failed:', error);
    res.status(500).json({ error: error.message });
  }
});

