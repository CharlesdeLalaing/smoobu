const express = require('express');
const router = express.Router();
const { bookings } = require('../database/repositories');
const { requireAuth } = require('../middleware/auth');

// GET /api/bookings/recent - Get recent bookings (public for testing)
router.get('/recent', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const allBookings = bookings.getAll({ limit });
    res.json({
      success: true,
      count: allBookings.length,
      bookings: allBookings
    });
  } catch (error) {
    console.error('Get recent bookings error:', error);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

// GET /api/bookings/by-payment/:paymentIntentId - Get booking by Stripe payment intent (public)
// This allows the confirmation page to display booking details after payment
router.get('/by-payment/:paymentIntentId', (req, res) => {
  try {
    const { paymentIntentId } = req.params;

    if (!paymentIntentId || !paymentIntentId.startsWith('pi_')) {
      return res.status(400).json({ error: 'Invalid payment intent ID' });
    }

    // Find booking by stripe_payment_intent_id
    const allBookings = bookings.getAll({ limit: 100 });
    const booking = allBookings.find(b => b.stripe_payment_intent_id === paymentIntentId);

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // Parse JSON fields
    const extras = booking.extras || [];
    const priceBreakdown = booking.priceBreakdown || booking.price_breakdown || {};
    const couponApplied = booking.couponApplied || booking.coupon_applied || null;
    const selectedFreeDrinks = booking.selectedFreeDrinks || booking.selected_free_drinks || {};

    // Build full address string
    const addressParts = [
      booking.street,
      booking.postal_code,
      booking.city,
      booking.country
    ].filter(Boolean);
    const fullAddress = addressParts.length > 0 ? addressParts.join(', ') : null;

    // Return booking details in the format expected by BookingConfirmation
    res.json({
      id: booking.id,
      guestName: `${booking.first_name} ${booking.last_name}`,
      firstName: booking.first_name,
      lastName: booking.last_name,
      email: booking.email,
      phone: booking.phone,
      street: booking.street,
      postalCode: booking.postal_code,
      city: booking.city,
      location: booking.city, // Alias for backward compatibility with frontend
      country: booking.country,
      address: fullAddress,
      arrivalDate: booking.arrival_date,
      departureDate: booking.departure_date,
      arrivalTime: booking.arrival_time,
      adults: booking.adults,
      children: booking.children,
      price: booking.price,
      basePrice: priceBreakdown.roomBasePrice || booking.price,
      guestFees: priceBreakdown.calculatedGuestFees || 0,
      status: booking.status,
      extras: extras,
      priceBreakdown: priceBreakdown,
      priceDetailsSnapshot: priceBreakdown,
      couponApplied: couponApplied,
      processedFreeDrinks: [], // Will be populated if needed
      selectedFreeDrinks: selectedFreeDrinks,
      spaBookingPreference: null, // Default
      spaInfo: null,
      spaDateTime: null,
      apartmentName: booking.apartment_name,
      roomName: booking.apartment_name,
      createdAt: booking.created_at
    });
  } catch (error) {
    console.error('Get booking by payment intent error:', error);
    res.status(500).json({ error: 'Failed to fetch booking' });
  }
});

// GET /api/bookings - Get all bookings (with filters)
router.get('/', requireAuth, (req, res) => {
  try {
    const filters = {
      apartmentId: req.query.apartmentId,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      email: req.query.email,
      status: req.query.status,
      limit: req.query.limit ? parseInt(req.query.limit) : undefined
    };

    const allBookings = bookings.getAll(filters);
    res.json({ bookings: allBookings });
  } catch (error) {
    console.error('Get bookings error:', error);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

// GET /api/bookings/calendar - Get bookings for calendar view
router.get('/calendar', requireAuth, (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate are required' });
    }

    const calendarBookings = bookings.getByDateRange(startDate, endDate);
    res.json({ bookings: calendarBookings });
  } catch (error) {
    console.error('Get calendar bookings error:', error);
    res.status(500).json({ error: 'Failed to fetch calendar bookings' });
  }
});

// GET /api/bookings/:id - Get single booking
router.get('/:id', requireAuth, (req, res) => {
  try {
    const booking = bookings.getById(req.params.id);

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    res.json({ booking });
  } catch (error) {
    console.error('Get booking error:', error);
    res.status(500).json({ error: 'Failed to fetch booking' });
  }
});

// POST /api/bookings - Create a new booking
router.post('/', (req, res) => {
  try {
    const booking = bookings.create(req.body);
    res.status(201).json({ success: true, booking });
  } catch (error) {
    console.error('Create booking error:', error);
    res.status(500).json({ error: 'Failed to create booking' });
  }
});

// PUT /api/bookings/:id - Update a booking
router.put('/:id', requireAuth, (req, res) => {
  try {
    const existing = bookings.getById(req.params.id);

    if (!existing) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    bookings.update(req.params.id, req.body);
    const updated = bookings.getById(req.params.id);

    res.json({ success: true, booking: updated });
  } catch (error) {
    console.error('Update booking error:', error);
    res.status(500).json({ error: 'Failed to update booking' });
  }
});

// DELETE /api/bookings/:id - Delete a booking
router.delete('/:id', requireAuth, (req, res) => {
  try {
    const existing = bookings.getById(req.params.id);

    if (!existing) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    bookings.delete(req.params.id);
    res.json({ success: true, message: 'Booking deleted' });
  } catch (error) {
    console.error('Delete booking error:', error);
    res.status(500).json({ error: 'Failed to delete booking' });
  }
});

// POST /api/bookings/deduplicate - Remove duplicate bookings
router.post('/deduplicate', requireAuth, (req, res) => {
  try {
    const duplicates = bookings.findDuplicates();
    const result = bookings.removeDuplicates();

    res.json({
      success: true,
      duplicatesFound: duplicates.length,
      removed: result.changes
    });
  } catch (error) {
    console.error('Deduplicate error:', error);
    res.status(500).json({ error: 'Failed to deduplicate bookings' });
  }
});

module.exports = router;
