const express = require('express');
const router = express.Router();
const { settings } = require('../database/repositories');
const { requireAuth } = require('../middleware/auth');

// GET /api/settings - Get public settings
router.get('/', (req, res) => {
  try {
    const publicSettings = settings.getPublic();
    res.json({ settings: publicSettings });
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// GET /api/settings/admin - Get all settings (admin only)
router.get('/admin', requireAuth, (req, res) => {
  try {
    const allSettings = settings.get();
    res.json({ settings: allSettings });
  } catch (error) {
    console.error('Get admin settings error:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// PUT /api/settings - Update settings (admin only)
router.put('/', requireAuth, (req, res) => {
  try {
    settings.update(req.body);
    const updated = settings.get();
    res.json({ success: true, settings: updated });
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// PATCH /api/settings - Partial update settings (admin only)
router.patch('/', requireAuth, (req, res) => {
  try {
    settings.updateFields(req.body);
    const updated = settings.get();
    res.json({ success: true, settings: updated });
  } catch (error) {
    console.error('Patch settings error:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// POST /api/settings/checkin - Update check-in time settings (public for now)
// TODO: Add authentication when admin dashboard is built
router.post('/checkin', (req, res) => {
  try {
    const { checkinStartTime, checkinEndTime, checkinSlotInterval } = req.body;

    // Validate input
    if (!checkinStartTime || !checkinEndTime) {
      return res.status(400).json({ error: 'Start and end times are required' });
    }

    // Validate time format (HH:MM)
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(checkinStartTime) || !timeRegex.test(checkinEndTime)) {
      return res.status(400).json({ error: 'Invalid time format. Use HH:MM' });
    }

    // Validate interval
    const validIntervals = [15, 30, 60];
    if (checkinSlotInterval && !validIntervals.includes(checkinSlotInterval)) {
      return res.status(400).json({ error: 'Invalid interval. Use 15, 30, or 60' });
    }

    // Update only check-in related fields
    settings.updateFields({
      checkinStartTime,
      checkinEndTime,
      checkinSlotInterval: checkinSlotInterval || 30,
    });

    const updated = settings.getPublic();
    res.json({ success: true, settings: updated });
  } catch (error) {
    console.error('Update check-in settings error:', error);
    res.status(500).json({ error: 'Failed to update check-in settings' });
  }
});

module.exports = router;
