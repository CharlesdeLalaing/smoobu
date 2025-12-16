const { db } = require('../sqlite');

const couponsRepo = {
  // Get all coupons
  getAll(filters = {}) {
    let query = 'SELECT * FROM coupons WHERE 1=1';
    const params = [];

    if (filters.status) {
      query += ' AND status = ?';
      params.push(filters.status);
    }

    if (filters.isGiftVoucher !== undefined) {
      query += ' AND is_gift_voucher = ?';
      params.push(filters.isGiftVoucher ? 1 : 0);
    }

    query += ' ORDER BY created_at DESC';

    const stmt = db.prepare(query);
    const rows = stmt.all(...params);

    return rows.map(parseCouponJson);
  },

  // Get coupon by ID
  getById(id) {
    const stmt = db.prepare('SELECT * FROM coupons WHERE id = ?');
    const row = stmt.get(id);
    return row ? parseCouponJson(row) : null;
  },

  // Get coupon by code
  getByCode(code) {
    const stmt = db.prepare('SELECT * FROM coupons WHERE UPPER(code) = UPPER(?)');
    const row = stmt.get(code);
    return row ? parseCouponJson(row) : null;
  },

  // Validate a coupon
  validate(code, { roomId, nights, totalAmount } = {}) {
    const coupon = this.getByCode(code);

    if (!coupon) {
      return { valid: false, error: 'Coupon not found' };
    }

    if (coupon.status !== 'active') {
      return { valid: false, error: 'Coupon is not active' };
    }

    // Check expiry
    if (coupon.expiry_date) {
      const expiry = new Date(coupon.expiry_date);
      if (expiry < new Date()) {
        return { valid: false, error: 'Coupon has expired' };
      }
    }

    // Check validity dates
    const now = new Date();
    if (coupon.validity_start_date && new Date(coupon.validity_start_date) > now) {
      return { valid: false, error: 'Coupon is not yet valid' };
    }
    if (coupon.validity_end_date && new Date(coupon.validity_end_date) < now) {
      return { valid: false, error: 'Coupon validity period has ended' };
    }

    // Check usage limit
    if (!coupon.is_unlimited && coupon.max_usage && coupon.used_count >= coupon.max_usage) {
      return { valid: false, error: 'Coupon usage limit reached' };
    }

    // Check applicable rooms
    if (coupon.applicableRooms && roomId) {
      if (!coupon.applicableRooms.includes(roomId)) {
        return { valid: false, error: 'Coupon not valid for this room' };
      }
    }

    // Check minimum nights
    if (coupon.minimum_nights && nights && nights < coupon.minimum_nights) {
      return { valid: false, error: `Minimum ${coupon.minimum_nights} nights required` };
    }

    // Check minimum amount
    if (coupon.minimum_amount && totalAmount && totalAmount < coupon.minimum_amount) {
      return { valid: false, error: `Minimum amount of €${coupon.minimum_amount} required` };
    }

    // Calculate discount
    let discount = 0;
    if (coupon.type === 'fixed') {
      discount = coupon.amount || 0;
    } else if (coupon.type === 'percentage') {
      discount = totalAmount ? (totalAmount * (coupon.percentage_value || 0) / 100) : 0;
    }

    return {
      valid: true,
      coupon: {
        id: coupon.id,
        code: coupon.code,
        type: coupon.type,
        amount: coupon.amount,
        percentageValue: coupon.percentage_value,
        isGiftVoucher: coupon.is_gift_voucher
      },
      discount
    };
  },

  // Create a new coupon
  create(coupon) {
    const stmt = db.prepare(`
      INSERT INTO coupons (
        code, type, amount, percentage_value, status,
        max_usage, used_count, is_gift_voucher, is_unlimited,
        expiry_date, validity_start_date, validity_end_date,
        applicable_rooms, minimum_nights, minimum_amount, usage_history
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      coupon.code.toUpperCase(),
      coupon.type || 'fixed',
      coupon.amount || null,
      coupon.percentageValue || coupon.percentage_value || null,
      coupon.status || 'active',
      coupon.maxUsage || coupon.max_usage || null,
      coupon.usedCount || coupon.used_count || 0,
      coupon.isGiftVoucher || coupon.is_gift_voucher ? 1 : 0,
      coupon.isUnlimited || coupon.is_unlimited ? 1 : 0,
      coupon.expiryDate || coupon.expiry_date || null,
      coupon.validityStartDate || coupon.validity_start_date || null,
      coupon.validityEndDate || coupon.validity_end_date || null,
      JSON.stringify(coupon.applicableRooms || coupon.applicable_rooms || null),
      coupon.minimumNights || coupon.minimum_nights || null,
      coupon.minimumAmount || coupon.minimum_amount || null,
      JSON.stringify(coupon.usageHistory || coupon.usage_history || [])
    );

    return { id: result.lastInsertRowid, ...coupon };
  },

  // Update a coupon
  update(id, updates) {
    const fields = [];
    const values = [];

    const fieldMapping = {
      code: 'code',
      type: 'type',
      amount: 'amount',
      percentageValue: 'percentage_value',
      status: 'status',
      maxUsage: 'max_usage',
      usedCount: 'used_count',
      isGiftVoucher: 'is_gift_voucher',
      isUnlimited: 'is_unlimited',
      expiryDate: 'expiry_date',
      validityStartDate: 'validity_start_date',
      validityEndDate: 'validity_end_date',
      applicableRooms: 'applicable_rooms',
      minimumNights: 'minimum_nights',
      minimumAmount: 'minimum_amount',
      usageHistory: 'usage_history'
    };

    for (const [key, value] of Object.entries(updates)) {
      const dbField = fieldMapping[key] || key;
      fields.push(`${dbField} = ?`);

      if (key === 'code') {
        values.push(value.toUpperCase());
      } else if (key === 'isGiftVoucher' || key === 'isUnlimited' || key === 'is_gift_voucher' || key === 'is_unlimited') {
        values.push(value ? 1 : 0);
      } else if (Array.isArray(value) || (typeof value === 'object' && value !== null)) {
        values.push(JSON.stringify(value));
      } else {
        values.push(value);
      }
    }

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    const stmt = db.prepare(`UPDATE coupons SET ${fields.join(', ')} WHERE id = ?`);
    return stmt.run(...values);
  },

  // Record coupon usage
  recordUsage(code, usageInfo) {
    const coupon = this.getByCode(code);
    if (!coupon) return null;

    const usageHistory = coupon.usageHistory || [];
    usageHistory.push({
      ...usageInfo,
      usedAt: new Date().toISOString()
    });

    const stmt = db.prepare(`
      UPDATE coupons
      SET used_count = used_count + 1,
          usage_history = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    return stmt.run(JSON.stringify(usageHistory), coupon.id);
  },

  // Delete a coupon
  delete(id) {
    const stmt = db.prepare('DELETE FROM coupons WHERE id = ?');
    return stmt.run(id);
  },

  // Batch create coupons
  createBatch(coupons) {
    const insert = db.prepare(`
      INSERT INTO coupons (
        code, type, amount, percentage_value, status,
        max_usage, is_gift_voucher, is_unlimited, expiry_date
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMany = db.transaction((items) => {
      const results = [];
      for (const coupon of items) {
        const result = insert.run(
          coupon.code.toUpperCase(),
          coupon.type || 'fixed',
          coupon.amount || null,
          coupon.percentageValue || null,
          coupon.status || 'active',
          coupon.maxUsage || null,
          coupon.isGiftVoucher ? 1 : 0,
          coupon.isUnlimited ? 1 : 0,
          coupon.expiryDate || null
        );
        results.push({ id: result.lastInsertRowid, ...coupon });
      }
      return results;
    });

    return insertMany(coupons);
  }
};

// Helper to parse JSON fields
function parseCouponJson(row) {
  if (!row) return null;

  return {
    ...row,
    is_gift_voucher: row.is_gift_voucher === 1,
    is_unlimited: row.is_unlimited === 1,
    applicableRooms: safeJsonParse(row.applicable_rooms, null),
    usageHistory: safeJsonParse(row.usage_history, [])
  };
}

function safeJsonParse(str, defaultValue) {
  if (!str) return defaultValue;
  try {
    return JSON.parse(str);
  } catch {
    return defaultValue;
  }
}

module.exports = couponsRepo;
