const { db } = require('../sqlite');

const bookingsRepo = {
  // Get all bookings with optional filters
  getAll(filters = {}) {
    let query = 'SELECT * FROM bookings WHERE 1=1';
    const params = [];

    if (filters.apartmentId) {
      query += ' AND apartment_id = ?';
      params.push(filters.apartmentId);
    }

    if (filters.startDate) {
      query += ' AND arrival_date >= ?';
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      query += ' AND departure_date <= ?';
      params.push(filters.endDate);
    }

    if (filters.email) {
      query += ' AND email = ?';
      params.push(filters.email);
    }

    if (filters.status) {
      query += ' AND status = ?';
      params.push(filters.status);
    }

    query += ' ORDER BY arrival_date DESC';

    if (filters.limit) {
      query += ' LIMIT ?';
      params.push(filters.limit);
    }

    const stmt = db.prepare(query);
    const rows = stmt.all(...params);

    return rows.map(parseBookingJson);
  },

  // Get booking by ID
  getById(id) {
    const stmt = db.prepare('SELECT * FROM bookings WHERE id = ?');
    const row = stmt.get(id);
    return row ? parseBookingJson(row) : null;
  },

  // Get booking by Smoobu reservation ID
  getBySmoobuReservationId(reservationId) {
    const stmt = db.prepare('SELECT * FROM bookings WHERE smoobu_reservation_id = ?');
    const row = stmt.get(reservationId);
    return row ? parseBookingJson(row) : null;
  },

  // Get bookings by date range (for calendar)
  getByDateRange(startDate, endDate) {
    const stmt = db.prepare(`
      SELECT * FROM bookings
      WHERE (arrival_date BETWEEN ? AND ?)
         OR (departure_date BETWEEN ? AND ?)
         OR (arrival_date <= ? AND departure_date >= ?)
      ORDER BY arrival_date ASC
    `);
    const rows = stmt.all(startDate, endDate, startDate, endDate, startDate, endDate);
    return rows.map(parseBookingJson);
  },

  // Create a new booking
  create(booking) {
    // Helper to convert undefined to null and handle JSON fields
    const toNull = (val) => val === undefined ? null : val;
    const toJson = (val, defaultVal = null) => {
      if (val === undefined || val === null) return JSON.stringify(defaultVal);
      if (typeof val === 'string') return val; // Already stringified
      return JSON.stringify(val);
    };

    const stmt = db.prepare(`
      INSERT INTO bookings (
        smoobu_id, smoobu_reservation_id, apartment_id, apartment_name,
        first_name, last_name, email, phone,
        street, postal_code, city, country,
        arrival_date, departure_date, arrival_time, adults, children,
        price, currency, cleaning_fee, extras, selected_free_drinks,
        coupon_applied, price_breakdown, stripe_payment_intent_id,
        stripe_session_id, booking_source, status, notes
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      )
    `);

    const values = [
      toNull(booking.smoobuId),
      toNull(booking.smoobuReservationId),
      toNull(booking.apartmentId || booking.apartment_id),
      toNull(booking.apartmentName || booking.apartment_name),
      toNull(booking.firstName || booking.first_name),
      toNull(booking.lastName || booking.last_name),
      toNull(booking.email),
      toNull(booking.phone),
      toNull(booking.street),
      toNull(booking.postalCode || booking.postal_code),
      toNull(booking.city || booking.location),
      toNull(booking.country),
      toNull(booking.arrivalDate || booking.arrival_date),
      toNull(booking.departureDate || booking.departure_date),
      toNull(booking.arrivalTime || booking.arrival_time),
      booking.adults ?? 2,
      booking.children ?? 0,
      toNull(booking.price),
      booking.currency || 'EUR',
      booking.cleaningFee ?? booking.cleaning_fee ?? 0,
      toJson(booking.extras, []),
      toJson(booking.selectedFreeDrinks || booking.selected_free_drinks, []),
      toJson(booking.couponApplied || booking.coupon_applied, null),
      toJson(booking.priceBreakdown || booking.price_breakdown, null),
      toNull(booking.stripePaymentIntentId || booking.stripe_payment_intent_id),
      toNull(booking.stripeSessionId || booking.stripe_session_id),
      booking.bookingSource || booking.booking_source || 'direct',
      booking.status || 'confirmed',
      toNull(booking.notes)
    ];

    const result = stmt.run(...values);

    return { id: result.lastInsertRowid, ...booking };
  },

  // Update a booking
  update(id, updates) {
    const fields = [];
    const values = [];

    const fieldMapping = {
      smoobuId: 'smoobu_id',
      smoobuReservationId: 'smoobu_reservation_id',
      apartmentId: 'apartment_id',
      apartmentName: 'apartment_name',
      firstName: 'first_name',
      lastName: 'last_name',
      email: 'email',
      phone: 'phone',
      street: 'street',
      postalCode: 'postal_code',
      city: 'city',
      country: 'country',
      arrivalDate: 'arrival_date',
      departureDate: 'departure_date',
      arrivalTime: 'arrival_time',
      adults: 'adults',
      children: 'children',
      price: 'price',
      currency: 'currency',
      cleaningFee: 'cleaning_fee',
      extras: 'extras',
      selectedFreeDrinks: 'selected_free_drinks',
      couponApplied: 'coupon_applied',
      priceBreakdown: 'price_breakdown',
      stripePaymentIntentId: 'stripe_payment_intent_id',
      stripeSessionId: 'stripe_session_id',
      bookingSource: 'booking_source',
      status: 'status',
      notes: 'notes'
    };

    for (const [key, value] of Object.entries(updates)) {
      const dbField = fieldMapping[key] || key;
      fields.push(`${dbField} = ?`);

      // JSON stringify arrays and objects
      if (Array.isArray(value) || (typeof value === 'object' && value !== null)) {
        values.push(JSON.stringify(value));
      } else {
        values.push(value);
      }
    }

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    const stmt = db.prepare(`UPDATE bookings SET ${fields.join(', ')} WHERE id = ?`);
    return stmt.run(...values);
  },

  // Delete a booking
  delete(id) {
    const stmt = db.prepare('DELETE FROM bookings WHERE id = ?');
    return stmt.run(id);
  },

  // Delete by Smoobu reservation ID
  deleteBySmoobuReservationId(reservationId) {
    const stmt = db.prepare('DELETE FROM bookings WHERE smoobu_reservation_id = ?');
    return stmt.run(reservationId);
  },

  // Check for duplicates
  findDuplicates() {
    const stmt = db.prepare(`
      SELECT smoobu_reservation_id, COUNT(*) as count
      FROM bookings
      WHERE smoobu_reservation_id IS NOT NULL
      GROUP BY smoobu_reservation_id
      HAVING count > 1
    `);
    return stmt.all();
  },

  // Remove duplicates (keep most recent)
  removeDuplicates() {
    const stmt = db.prepare(`
      DELETE FROM bookings
      WHERE id NOT IN (
        SELECT MAX(id)
        FROM bookings
        GROUP BY smoobu_reservation_id
      )
      AND smoobu_reservation_id IS NOT NULL
    `);
    return stmt.run();
  }
};

// Helper to parse JSON fields
function parseBookingJson(row) {
  if (!row) return null;

  return {
    ...row,
    extras: safeJsonParse(row.extras, []),
    selectedFreeDrinks: safeJsonParse(row.selected_free_drinks, []),
    couponApplied: safeJsonParse(row.coupon_applied, null),
    priceBreakdown: safeJsonParse(row.price_breakdown, null)
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

module.exports = bookingsRepo;
