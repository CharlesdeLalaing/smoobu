const express = require('express');
const router = express.Router();
const { pricingConfig } = require('../database/repositories');
const { requireAuth } = require('../middleware/auth');

// GET /api/pricing-configs - Get all pricing configs
router.get('/', (req, res) => {
  try {
    const configs = pricingConfig.getAllAsMap();
    res.json({ success: true, configs });
  } catch (error) {
    console.error('Get pricing configs error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch pricing configs' });
  }
});

// GET /api/pricing-configs/map - Get configs as a map (keyed by smoobuId)
router.get('/map', (req, res) => {
  try {
    const configsMap = pricingConfig.getAllAsMap();
    res.json({ configs: configsMap });
  } catch (error) {
    console.error('Get pricing configs map error:', error);
    res.status(500).json({ error: 'Failed to fetch pricing configs' });
  }
});

// GET /api/pricing-config/:smoobuId - Get config for specific room
router.get('/:smoobuId', (req, res) => {
  try {
    const config = pricingConfig.getBySmoobuId(req.params.smoobuId);

    if (!config) {
      return res.status(404).json({ error: 'Pricing config not found' });
    }

    res.json({ config });
  } catch (error) {
    console.error('Get pricing config error:', error);
    res.status(500).json({ error: 'Failed to fetch pricing config' });
  }
});

// POST /api/pricing-config/:smoobuId - Save config for a room (upsert)
// In development, allow without auth for testing. In production, require auth.
const saveAuthMiddleware = process.env.NODE_ENV === 'production' ? requireAuth : (req, res, next) => next();

router.post('/:smoobuId', saveAuthMiddleware, (req, res) => {
  try {
    const config = pricingConfig.upsert({
      smoobuId: req.params.smoobuId,
      ...req.body
    });

    res.json({ success: true, config });
  } catch (error) {
    console.error('Save pricing config error:', error);
    res.status(500).json({ success: false, error: 'Failed to save pricing config' });
  }
});

// PUT /api/pricing-config/:smoobuId - Update config for a room
router.put('/:smoobuId', requireAuth, (req, res) => {
  try {
    const existing = pricingConfig.getBySmoobuId(req.params.smoobuId);

    if (!existing) {
      return res.status(404).json({ error: 'Pricing config not found' });
    }

    pricingConfig.updateBySmoobuId(req.params.smoobuId, req.body);
    const updated = pricingConfig.getBySmoobuId(req.params.smoobuId);

    res.json({ success: true, config: updated });
  } catch (error) {
    console.error('Update pricing config error:', error);
    res.status(500).json({ error: 'Failed to update pricing config' });
  }
});

// DELETE /api/pricing-config/:smoobuId - Delete config
router.delete('/:smoobuId', requireAuth, (req, res) => {
  try {
    const existing = pricingConfig.getBySmoobuId(req.params.smoobuId);

    if (!existing) {
      return res.status(404).json({ error: 'Pricing config not found' });
    }

    pricingConfig.deleteBySmoobuId(req.params.smoobuId);
    res.json({ success: true, message: 'Pricing config deleted' });
  } catch (error) {
    console.error('Delete pricing config error:', error);
    res.status(500).json({ error: 'Failed to delete pricing config' });
  }
});

// POST /api/pricing-configs/batch - Batch save multiple configs
router.post('/batch', requireAuth, (req, res) => {
  try {
    const { configs } = req.body;

    if (!Array.isArray(configs) || configs.length === 0) {
      return res.status(400).json({ error: 'Array of configs is required' });
    }

    const saved = pricingConfig.batchUpsert(configs);
    res.json({ success: true, saved: saved.length, configs: saved });
  } catch (error) {
    console.error('Batch save pricing configs error:', error);
    res.status(500).json({ error: 'Failed to save pricing configs' });
  }
});

module.exports = router;
