const express = require('express');
const router = express.Router();
const { coupons } = require('../database/repositories');
const { requireAuth } = require('../middleware/auth');

// GET /api/coupons - Get all coupons (admin only)
router.get('/', requireAuth, (req, res) => {
  try {
    const filters = {
      status: req.query.status,
      isGiftVoucher: req.query.isGiftVoucher === 'true' ? true :
                     req.query.isGiftVoucher === 'false' ? false : undefined
    };

    const allCoupons = coupons.getAll(filters);
    res.json({ coupons: allCoupons });
  } catch (error) {
    console.error('Get coupons error:', error);
    res.status(500).json({ error: 'Failed to fetch coupons' });
  }
});

// POST /api/coupons/validate - Validate a coupon (public endpoint for booking form)
router.post('/validate', (req, res) => {
  try {
    const { code, roomId, nights, totalAmount } = req.body;

    if (!code) {
      return res.status(400).json({ error: 'Coupon code is required' });
    }

    const result = coupons.validate(code, { roomId, nights, totalAmount });

    if (!result.valid) {
      return res.status(400).json({ valid: false, error: result.error });
    }

    res.json(result);
  } catch (error) {
    console.error('Validate coupon error:', error);
    res.status(500).json({ error: 'Failed to validate coupon' });
  }
});

// GET /api/coupons/lookup/:code - Get coupon by code (public endpoint for booking form)
// Returns full coupon data for frontend validation/calculation
router.get('/lookup/:code', (req, res) => {
  try {
    const coupon = coupons.getByCode(req.params.code);

    if (!coupon) {
      return res.status(404).json({ found: false, error: 'Coupon not found' });
    }

    // Return coupon data in a format compatible with what Firebase was returning
    res.json({
      found: true,
      coupon: {
        id: coupon.id,
        code: coupon.code,
        type: coupon.type,
        amount: coupon.amount,
        discount: coupon.amount, // Legacy field alias
        percentageValue: coupon.percentage_value,
        status: coupon.status,
        maxUsage: coupon.max_usage,
        usedCount: coupon.used_count,
        isGiftVoucher: coupon.is_gift_voucher,
        isUnlimited: coupon.is_unlimited,
        expiryDate: coupon.expiry_date,
        validityStartDate: coupon.validity_start_date,
        validityEndDate: coupon.validity_end_date,
        applicableRooms: coupon.applicableRooms,
        minimumNights: coupon.minimum_nights,
        minimumAmount: coupon.minimum_amount
      }
    });
  } catch (error) {
    console.error('Lookup coupon error:', error);
    res.status(500).json({ error: 'Failed to lookup coupon' });
  }
});

// GET /api/coupons/:id - Get single coupon
router.get('/:id', requireAuth, (req, res) => {
  try {
    const coupon = coupons.getById(req.params.id);

    if (!coupon) {
      return res.status(404).json({ error: 'Coupon not found' });
    }

    res.json({ coupon });
  } catch (error) {
    console.error('Get coupon error:', error);
    res.status(500).json({ error: 'Failed to fetch coupon' });
  }
});

// POST /api/coupons - Create a new coupon
router.post('/', requireAuth, (req, res) => {
  try {
    // Check if code already exists
    const existing = coupons.getByCode(req.body.code);
    if (existing) {
      return res.status(400).json({ error: 'Coupon code already exists' });
    }

    const coupon = coupons.create(req.body);
    res.status(201).json({ success: true, coupon });
  } catch (error) {
    console.error('Create coupon error:', error);
    res.status(500).json({ error: 'Failed to create coupon' });
  }
});

// PUT /api/coupons/:id - Update a coupon
router.put('/:id', requireAuth, (req, res) => {
  try {
    const existing = coupons.getById(req.params.id);

    if (!existing) {
      return res.status(404).json({ error: 'Coupon not found' });
    }

    // Check if new code conflicts with another coupon
    if (req.body.code && req.body.code.toUpperCase() !== existing.code) {
      const conflict = coupons.getByCode(req.body.code);
      if (conflict) {
        return res.status(400).json({ error: 'Coupon code already exists' });
      }
    }

    coupons.update(req.params.id, req.body);
    const updated = coupons.getById(req.params.id);

    res.json({ success: true, coupon: updated });
  } catch (error) {
    console.error('Update coupon error:', error);
    res.status(500).json({ error: 'Failed to update coupon' });
  }
});

// DELETE /api/coupons/:id - Delete a coupon
router.delete('/:id', requireAuth, (req, res) => {
  try {
    const existing = coupons.getById(req.params.id);

    if (!existing) {
      return res.status(404).json({ error: 'Coupon not found' });
    }

    coupons.delete(req.params.id);
    res.json({ success: true, message: 'Coupon deleted' });
  } catch (error) {
    console.error('Delete coupon error:', error);
    res.status(500).json({ error: 'Failed to delete coupon' });
  }
});

// POST /api/coupons/:id/record-usage - Record coupon usage after booking
router.post('/:id/record-usage', (req, res) => {
  try {
    const coupon = coupons.getById(req.params.id);

    if (!coupon) {
      return res.status(404).json({ error: 'Coupon not found' });
    }

    const { bookingId, guestEmail, guestName, amount } = req.body;

    coupons.recordUsage(coupon.code, {
      bookingId,
      guestEmail,
      guestName,
      discountApplied: amount
    });

    res.json({ success: true, message: 'Usage recorded' });
  } catch (error) {
    console.error('Record usage error:', error);
    res.status(500).json({ error: 'Failed to record coupon usage' });
  }
});

// POST /api/coupons/batch - Create multiple coupons
router.post('/batch', requireAuth, (req, res) => {
  try {
    const { coupons: couponList } = req.body;

    if (!Array.isArray(couponList) || couponList.length === 0) {
      return res.status(400).json({ error: 'Array of coupons is required' });
    }

    const created = coupons.createBatch(couponList);
    res.status(201).json({ success: true, created: created.length, coupons: created });
  } catch (error) {
    console.error('Batch create coupons error:', error);
    res.status(500).json({ error: 'Failed to create coupons' });
  }
});

module.exports = router;
