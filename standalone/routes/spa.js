const express = require('express');
const router = express.Router();
const { spa } = require('../database/repositories');
const { requireAuth } = require('../middleware/auth');

// ==================== SPA SETTINGS ====================

// GET /api/spa/settings - Get SPA settings
router.get('/settings', (req, res) => {
  try {
    const settings = spa.getSettings();
    res.json({ settings });
  } catch (error) {
    console.error('Get SPA settings error:', error);
    res.status(500).json({ error: 'Failed to fetch SPA settings' });
  }
});

// PUT /api/spa/settings - Update SPA settings
router.put('/settings', requireAuth, (req, res) => {
  try {
    spa.updateSettings(req.body);
    const settings = spa.getSettings();
    res.json({ success: true, settings });
  } catch (error) {
    console.error('Update SPA settings error:', error);
    res.status(500).json({ error: 'Failed to update SPA settings' });
  }
});

// ==================== SPA BOOKINGS ====================

// GET /api/spa/bookings - Get SPA bookings
router.get('/bookings', requireAuth, (req, res) => {
  try {
    const { date, startDate, endDate, status } = req.query;

    const filters = { status };

    let bookings;
    if (date) {
      bookings = spa.getBookingsByDate(date);
    } else if (startDate && endDate) {
      bookings = spa.getBookingsByDateRange(startDate, endDate);
    } else {
      bookings = spa.getAllBookings(filters);
    }

    res.json({ bookings });
  } catch (error) {
    console.error('Get SPA bookings error:', error);
    res.status(500).json({ error: 'Failed to fetch SPA bookings' });
  }
});

// GET /api/spa/bookings/available-slots - Get available slots for a date
router.get('/bookings/available-slots', (req, res) => {
  try {
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({ error: 'Date is required' });
    }

    const availableSlots = spa.getAvailableSlots(date);
    const settings = spa.getSettings();

    res.json({
      date,
      availableSlots,
      settings: {
        startTime: settings.startTime,
        endTime: settings.endTime,
        slotDurationMinutes: settings.slotDurationMinutes
      }
    });
  } catch (error) {
    console.error('Get available slots error:', error);
    res.status(500).json({ error: 'Failed to fetch available slots' });
  }
});

// GET /api/spa/bookings/:id - Get single SPA booking
router.get('/bookings/:id', requireAuth, (req, res) => {
  try {
    const booking = spa.getBookingById(req.params.id);

    if (!booking) {
      return res.status(404).json({ error: 'SPA booking not found' });
    }

    res.json({ booking });
  } catch (error) {
    console.error('Get SPA booking error:', error);
    res.status(500).json({ error: 'Failed to fetch SPA booking' });
  }
});

// POST /api/spa/bookings - Create SPA booking
router.post('/bookings', (req, res) => {
  try {
    const { date, timeSlot } = req.body;

    if (!date || !timeSlot) {
      return res.status(400).json({ error: 'Date and timeSlot are required' });
    }

    // Check if slot is available
    if (!spa.isSlotAvailable(date, timeSlot)) {
      return res.status(400).json({ error: 'This time slot is not available' });
    }

    const booking = spa.createBooking(req.body);
    res.status(201).json({ success: true, booking });
  } catch (error) {
    console.error('Create SPA booking error:', error);
    res.status(500).json({ error: 'Failed to create SPA booking' });
  }
});

// POST /api/spa/bookings/bulk - Create multiple SPA bookings
router.post('/bookings/bulk', (req, res) => {
  try {
    const { bookings: bookingsList } = req.body;

    if (!Array.isArray(bookingsList) || bookingsList.length === 0) {
      return res.status(400).json({ error: 'Array of bookings is required' });
    }

    // Check all slots are available
    for (const booking of bookingsList) {
      if (!spa.isSlotAvailable(booking.date, booking.timeSlot)) {
        return res.status(400).json({
          error: `Time slot ${booking.timeSlot} on ${booking.date} is not available`
        });
      }
    }

    const created = spa.createBookings(bookingsList);
    res.status(201).json({ success: true, bookings: created });
  } catch (error) {
    console.error('Bulk create SPA bookings error:', error);
    res.status(500).json({ error: 'Failed to create SPA bookings' });
  }
});

// PUT /api/spa/bookings/:id - Update SPA booking
router.put('/bookings/:id', requireAuth, (req, res) => {
  try {
    const existing = spa.getBookingById(req.params.id);

    if (!existing) {
      return res.status(404).json({ error: 'SPA booking not found' });
    }

    spa.updateBooking(req.params.id, req.body);
    const updated = spa.getBookingById(req.params.id);

    res.json({ success: true, booking: updated });
  } catch (error) {
    console.error('Update SPA booking error:', error);
    res.status(500).json({ error: 'Failed to update SPA booking' });
  }
});

// DELETE /api/spa/bookings/:id - Delete SPA booking
router.delete('/bookings/:id', requireAuth, (req, res) => {
  try {
    const existing = spa.getBookingById(req.params.id);

    if (!existing) {
      return res.status(404).json({ error: 'SPA booking not found' });
    }

    spa.deleteBooking(req.params.id);
    res.json({ success: true, message: 'SPA booking deleted' });
  } catch (error) {
    console.error('Delete SPA booking error:', error);
    res.status(500).json({ error: 'Failed to delete SPA booking' });
  }
});

module.exports = router;
