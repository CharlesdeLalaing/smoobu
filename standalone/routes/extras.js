const express = require('express');
const router = express.Router();
const { extras } = require('../database/repositories');
const { requireAuth } = require('../middleware/auth');

// GET /api/extras - Get all extras (public, filtered by active)
router.get('/', (req, res) => {
  try {
    const { category, roomId, includeInactive } = req.query;

    // If roomId is provided, get extras available for that room
    if (roomId) {
      const roomExtras = extras.getForRoom(roomId);
      return res.json({ extras: roomExtras });
    }

    // Otherwise get all extras
    const filters = {
      category,
      isActive: includeInactive === 'true' ? undefined : true
    };

    const allExtras = extras.getAll(filters);
    res.json({ extras: allExtras });
  } catch (error) {
    console.error('Get extras error:', error);
    res.status(500).json({ error: 'Failed to fetch extras' });
  }
});

// GET /api/extras/grouped - Get extras grouped by category
router.get('/grouped', (req, res) => {
  try {
    const { roomId } = req.query;
    const grouped = extras.getGroupedByCategory(roomId);
    res.json({ extras: grouped });
  } catch (error) {
    console.error('Get grouped extras error:', error);
    res.status(500).json({ error: 'Failed to fetch grouped extras' });
  }
});

// GET /api/extras/:id - Get single extra
router.get('/:id', (req, res) => {
  try {
    const extra = extras.getById(req.params.id);

    if (!extra) {
      return res.status(404).json({ error: 'Extra not found' });
    }

    res.json({ extra });
  } catch (error) {
    console.error('Get extra error:', error);
    res.status(500).json({ error: 'Failed to fetch extra' });
  }
});

// POST /api/extras - Create a new extra
router.post('/', requireAuth, (req, res) => {
  try {
    // Check if code already exists
    if (req.body.code) {
      const existing = extras.getByCode(req.body.code);
      if (existing) {
        return res.status(400).json({ error: 'Extra code already exists' });
      }
    }

    const extra = extras.create(req.body);
    res.status(201).json({ success: true, extra });
  } catch (error) {
    console.error('Create extra error:', error);
    res.status(500).json({ error: 'Failed to create extra' });
  }
});

// PUT /api/extras/:id - Update an extra
router.put('/:id', requireAuth, (req, res) => {
  try {
    const existing = extras.getById(req.params.id);

    if (!existing) {
      return res.status(404).json({ error: 'Extra not found' });
    }

    // Check if new code conflicts with another extra
    if (req.body.code && req.body.code !== existing.code) {
      const conflict = extras.getByCode(req.body.code);
      if (conflict) {
        return res.status(400).json({ error: 'Extra code already exists' });
      }
    }

    extras.update(req.params.id, req.body);
    const updated = extras.getById(req.params.id);

    res.json({ success: true, extra: updated });
  } catch (error) {
    console.error('Update extra error:', error);
    res.status(500).json({ error: 'Failed to update extra' });
  }
});

// DELETE /api/extras/:id - Delete an extra
router.delete('/:id', requireAuth, (req, res) => {
  try {
    const existing = extras.getById(req.params.id);

    if (!existing) {
      return res.status(404).json({ error: 'Extra not found' });
    }

    extras.delete(req.params.id);
    res.json({ success: true, message: 'Extra deleted' });
  } catch (error) {
    console.error('Delete extra error:', error);
    res.status(500).json({ error: 'Failed to delete extra' });
  }
});

// POST /api/extras/batch - Create multiple extras
router.post('/batch', requireAuth, (req, res) => {
  try {
    const { extras: extrasList } = req.body;

    if (!Array.isArray(extrasList) || extrasList.length === 0) {
      return res.status(400).json({ error: 'Array of extras is required' });
    }

    const created = extras.createBatch(extrasList);
    res.status(201).json({ success: true, created: created.length, extras: created });
  } catch (error) {
    console.error('Batch create extras error:', error);
    res.status(500).json({ error: 'Failed to create extras' });
  }
});

module.exports = router;
