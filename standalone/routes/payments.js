const express = require('express');
const router = express.Router();
const Stripe = require('stripe');
const { formatInTimeZone } = require('date-fns-tz');
const { bookings } = require('../database/repositories');
const { sendAdminNotification, sendGuestConfirmation } = require('../services/email');

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// In-memory storage for pending bookings (before payment completion)
const pendingBookings = new Map();

// POST /api/create-payment-intent - Create Stripe payment intent
router.post('/', async (req, res) => {
  try {
    const { price, bookingData } = req.body;

    if (!bookingData) {
      return res.status(400).json({ error: 'Booking data is required' });
    }

    // Define timezone for formatting
    const timeZone = 'Europe/Brussels';

    // Calculate total price
    let totalPrice = Number(bookingData.basePrice) || 0;
    totalPrice += Number(bookingData.guestFees || 0);

    // Add extras
    if (bookingData.extras && bookingData.extras.length > 0) {
      const extrasTotal = bookingData.extras.reduce((sum, extra) => {
        const extraAmount = Number(extra.amount) || 0;
        const extraPersonFee = (Number(extra.extraPersonPrice) || 0) * (Number(extra.extraPersonQuantity) || 0);
        return sum + extraAmount + extraPersonFee;
      }, 0);
      totalPrice += extrasTotal;
    }

    // Subtract coupon discount
    if (bookingData.couponApplied) {
      totalPrice -= Number(bookingData.couponApplied.discount || 0);
    }

    // Subtract long stay discount
    if (bookingData.priceDetailsSnapshot?.discount) {
      totalPrice -= Number(bookingData.priceDetailsSnapshot.discount);
    }

    // Generate booking reference
    const bookingReference = `BOOKING-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Store pending booking
    pendingBookings.set(bookingReference, {
      ...bookingData,
      totalPriceWithExtras: totalPrice,
      spaDateTime: bookingData.spaDateTime || null,
      spaBookingPreference: bookingData.spaBookingPreference || null,
      createdAt: new Date().toISOString()
    });

    // Get room name (fallback to apartment ID if not found)
    const roomName = bookingData.roomName || bookingData.apartmentName || `Room ${bookingData.apartmentId}`;

    // Build description
    let description = `Réservation - ${bookingData.firstName} ${bookingData.lastName}
    Chambre: ${roomName}
    (${bookingData.arrivalDate} - ${bookingData.departureDate})
    Base: ${bookingData.basePrice}€`;

    if (bookingData.guestFees > 0) {
      description += ` • Frais invités: ${bookingData.guestFees}€`;
    }

    if (bookingData.extras?.length) {
      const extrasTotal = bookingData.extras.reduce((sum, extra) =>
        sum + Number(extra.amount) + Number(extra.extraPersonPrice || 0) * Number(extra.extraPersonQuantity || 0), 0
      );
      description += ` • Extras: ${extrasTotal}€`;
    }

    if (bookingData.couponApplied) {
      description += ` • Code ${bookingData.couponApplied.code}: -${bookingData.couponApplied.discount}€`;
    }

    if (bookingData.spaDateTime) {
      description += ` • SPA: ${formatInTimeZone(new Date(bookingData.spaDateTime), timeZone, 'dd/MM/yyyy HH:mm')}`;
    } else if (bookingData.spaBookingPreference === 'later') {
      description += ` • SPA: À réserver ultérieurement`;
    }

    // Create Stripe payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(totalPrice * 100), // Convert to cents
      currency: 'eur',
      automatic_payment_methods: {
        enabled: true,
      },
      description,
      metadata: {
        clientName: `${bookingData.firstName} ${bookingData.lastName}`,
        clientEmail: bookingData.email,
        clientPhone: bookingData.phone || '',
        roomId: String(bookingData.apartmentId),
        roomName: roomName,
        bookingReference: bookingReference,
        checkIn: bookingData.arrivalDate,
        checkOut: bookingData.departureDate,
        basePrice: `${bookingData.basePrice}€`,
        guestFees: `${bookingData.guestFees || 0}€`,
        extrasTotal: bookingData.extras?.length
          ? `${bookingData.extras.reduce((sum, extra) =>
              sum + Number(extra.amount) + Number(extra.extraPersonPrice || 0) * Number(extra.extraPersonQuantity || 0), 0
            )}€`
          : '0€',
        ...(bookingData.couponApplied && {
          couponCode: bookingData.couponApplied.code,
          couponDiscount: `-${bookingData.couponApplied.discount}€`,
          couponType: bookingData.couponApplied.type,
        }),
        ...(bookingData.spaDateTime && {
          spaDateTime: bookingData.spaDateTime,
          spaFormatted: formatInTimeZone(new Date(bookingData.spaDateTime), timeZone, 'dd/MM/yyyy HH:mm'),
        }),
        ...(bookingData.spaBookingPreference && {
          spaBookingPreference: bookingData.spaBookingPreference,
        }),
        finalPrice: `${totalPrice}€`,
        spaDateString: bookingData.spaDateString || '',
      },
    });

    res.json({
      clientSecret: paymentIntent.client_secret,
      bookingReference: bookingReference,
    });
  } catch (error) {
    console.error('Error creating payment intent:', error);
    res.status(500).json({
      error: 'Failed to create payment intent',
      details: error.message,
    });
  }
});

// POST /api/stripe-webhook - Handle Stripe webhooks
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  switch (event.type) {
    case 'payment_intent.succeeded':
      const paymentIntent = event.data.object;
      const bookingRef = paymentIntent.metadata.bookingReference;

      console.log(`Payment succeeded for booking: ${bookingRef}`);

      // Get pending booking data
      const pendingBooking = pendingBookings.get(bookingRef);

      if (pendingBooking) {
        try {
          // Save booking to SQLite
          const savedBooking = bookings.create({
            smoobuReservationId: null, // Will be set after Smoobu sync
            apartmentId: pendingBooking.apartmentId,
            apartmentName: pendingBooking.roomName || pendingBooking.apartmentName,
            firstName: pendingBooking.firstName,
            lastName: pendingBooking.lastName,
            email: pendingBooking.email,
            phone: pendingBooking.phone,
            street: pendingBooking.street || null,
            postalCode: pendingBooking.postalCode || null,
            city: pendingBooking.location || pendingBooking.city || null,
            country: pendingBooking.country || null,
            arrivalDate: pendingBooking.arrivalDate,
            departureDate: pendingBooking.departureDate,
            arrivalTime: pendingBooking.arrivalTime || null,
            adults: pendingBooking.adults || 2,
            children: pendingBooking.children || 0,
            price: pendingBooking.totalPriceWithExtras,
            extras: JSON.stringify(pendingBooking.extras || []),
            selectedFreeDrinks: JSON.stringify(pendingBooking.selectedFreeDrinks || {}),
            couponApplied: pendingBooking.couponApplied ? JSON.stringify(pendingBooking.couponApplied) : null,
            priceBreakdown: JSON.stringify(pendingBooking.priceBreakdown || pendingBooking.priceDetailsSnapshot || {}),
            stripePaymentIntentId: paymentIntent.id,
            bookingSource: 'direct',
            status: 'confirmed'
          });

          console.log(`Booking saved to SQLite: ${savedBooking.id}`);

          // Send email notifications (don't await - let them send in background)
          // Send admin notification
          sendAdminNotification(pendingBooking, paymentIntent)
            .then(() => console.log('Admin notification email sent successfully'))
            .catch(err => console.error('Failed to send admin notification:', err.message));

          // Send guest confirmation - COMMENTED OUT FOR NOW (only admin gets email)
          // sendGuestConfirmation(pendingBooking)
          //   .then(() => console.log('Guest confirmation email sent successfully'))
          //   .catch(err => console.error('Failed to send guest confirmation:', err.message));

          // Clean up pending booking
          pendingBookings.delete(bookingRef);
        } catch (dbError) {
          console.error('Error saving booking to database:', dbError);
        }
      }
      break;

    case 'payment_intent.payment_failed':
      const failedIntent = event.data.object;
      console.log(`Payment failed for: ${failedIntent.metadata.bookingReference}`);
      // Clean up pending booking
      pendingBookings.delete(failedIntent.metadata.bookingReference);
      break;

    default:
      console.log(`Unhandled event type: ${event.type}`);
  }

  res.json({ received: true });
});

// Export for use in webhook handler
module.exports = router;
module.exports.pendingBookings = pendingBookings;
