const { db } = require('../sqlite');

const spaRepo = {
  // ==================== SPA SETTINGS ====================

  // Get SPA settings
  getSettings() {
    const stmt = db.prepare('SELECT * FROM spa_settings WHERE id = 1');
    const row = stmt.get();

    if (!row) {
      // Create default settings if not exist
      this.updateSettings({});
      return this.getSettings();
    }

    return {
      slotDurationMinutes: row.slot_duration_minutes,
      startTime: row.start_time,
      endTime: row.end_time,
      isEnabled: row.is_enabled === 1
    };
  },

  // Update SPA settings
  updateSettings(settings) {
    const stmt = db.prepare(`
      INSERT INTO spa_settings (id, slot_duration_minutes, start_time, end_time, is_enabled)
      VALUES (1, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        slot_duration_minutes = excluded.slot_duration_minutes,
        start_time = excluded.start_time,
        end_time = excluded.end_time,
        is_enabled = excluded.is_enabled,
        updated_at = CURRENT_TIMESTAMP
    `);

    return stmt.run(
      settings.slotDurationMinutes || 30,
      settings.startTime || '17:00',
      settings.endTime || '22:00',
      settings.isEnabled !== false ? 1 : 0
    );
  },

  // ==================== SPA BOOKINGS ====================

  // Get all SPA bookings
  getAllBookings(filters = {}) {
    let query = 'SELECT * FROM spa_bookings WHERE 1=1';
    const params = [];

    if (filters.date) {
      query += ' AND date = ?';
      params.push(filters.date);
    }

    if (filters.startDate && filters.endDate) {
      query += ' AND date BETWEEN ? AND ?';
      params.push(filters.startDate, filters.endDate);
    }

    if (filters.status) {
      query += ' AND status = ?';
      params.push(filters.status);
    }

    query += ' ORDER BY date ASC, time_slot ASC';

    const stmt = db.prepare(query);
    return stmt.all(...params);
  },

  // Get SPA bookings by date
  getBookingsByDate(date) {
    const stmt = db.prepare('SELECT * FROM spa_bookings WHERE date = ? ORDER BY time_slot ASC');
    return stmt.all(date);
  },

  // Get SPA bookings for date range
  getBookingsByDateRange(startDate, endDate) {
    const stmt = db.prepare(`
      SELECT * FROM spa_bookings
      WHERE date BETWEEN ? AND ?
      ORDER BY date ASC, time_slot ASC
    `);
    return stmt.all(startDate, endDate);
  },

  // Get SPA booking by ID
  getBookingById(id) {
    const stmt = db.prepare('SELECT * FROM spa_bookings WHERE id = ?');
    return stmt.get(id);
  },

  // Create SPA booking
  createBooking(booking) {
    const stmt = db.prepare(`
      INSERT INTO spa_bookings (
        booking_id, date, time_slot, duration_minutes,
        guest_name, guest_email, status, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      booking.bookingId || booking.booking_id || null,
      booking.date,
      booking.timeSlot || booking.time_slot,
      booking.durationMinutes || booking.duration_minutes || 30,
      booking.guestName || booking.guest_name || null,
      booking.guestEmail || booking.guest_email || null,
      booking.status || 'confirmed',
      booking.notes || null
    );

    return { id: result.lastInsertRowid, ...booking };
  },

  // Create multiple SPA bookings (for multi-slot reservations)
  createBookings(bookings) {
    const insert = db.prepare(`
      INSERT INTO spa_bookings (
        booking_id, date, time_slot, duration_minutes,
        guest_name, guest_email, status, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMany = db.transaction((items) => {
      const results = [];
      for (const booking of items) {
        const result = insert.run(
          booking.bookingId || booking.booking_id || null,
          booking.date,
          booking.timeSlot || booking.time_slot,
          booking.durationMinutes || booking.duration_minutes || 30,
          booking.guestName || booking.guest_name || null,
          booking.guestEmail || booking.guest_email || null,
          booking.status || 'confirmed',
          booking.notes || null
        );
        results.push({ id: result.lastInsertRowid, ...booking });
      }
      return results;
    });

    return insertMany(bookings);
  },

  // Update SPA booking
  updateBooking(id, updates) {
    const fields = [];
    const values = [];

    const fieldMapping = {
      bookingId: 'booking_id',
      date: 'date',
      timeSlot: 'time_slot',
      durationMinutes: 'duration_minutes',
      guestName: 'guest_name',
      guestEmail: 'guest_email',
      status: 'status',
      notes: 'notes'
    };

    for (const [key, value] of Object.entries(updates)) {
      const dbField = fieldMapping[key] || key;
      fields.push(`${dbField} = ?`);
      values.push(value);
    }

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    const stmt = db.prepare(`UPDATE spa_bookings SET ${fields.join(', ')} WHERE id = ?`);
    return stmt.run(...values);
  },

  // Delete SPA booking
  deleteBooking(id) {
    const stmt = db.prepare('DELETE FROM spa_bookings WHERE id = ?');
    return stmt.run(id);
  },

  // Delete SPA bookings by main booking ID
  deleteBookingsByBookingId(bookingId) {
    const stmt = db.prepare('DELETE FROM spa_bookings WHERE booking_id = ?');
    return stmt.run(bookingId);
  },

  // Check if time slot is available
  isSlotAvailable(date, timeSlot) {
    const stmt = db.prepare(`
      SELECT COUNT(*) as count FROM spa_bookings
      WHERE date = ? AND time_slot = ? AND status != 'cancelled'
    `);
    const result = stmt.get(date, timeSlot);
    return result.count === 0;
  },

  // Get available slots for a date
  getAvailableSlots(date) {
    const settings = this.getSettings();
    if (!settings.isEnabled) return [];

    // Generate all possible slots
    const allSlots = generateTimeSlots(
      settings.startTime,
      settings.endTime,
      settings.slotDurationMinutes
    );

    // Get booked slots
    const bookedSlots = this.getBookingsByDate(date)
      .filter(b => b.status !== 'cancelled')
      .map(b => b.time_slot);

    // Return available slots
    return allSlots.filter(slot => !bookedSlots.includes(slot));
  }
};

// Helper to generate time slots
function generateTimeSlots(startTime, endTime, durationMinutes) {
  const slots = [];
  const [startHour, startMin] = startTime.split(':').map(Number);
  const [endHour, endMin] = endTime.split(':').map(Number);

  let currentMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;

  while (currentMinutes < endMinutes) {
    const hours = Math.floor(currentMinutes / 60);
    const mins = currentMinutes % 60;
    slots.push(`${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`);
    currentMinutes += durationMinutes;
  }

  return slots;
}

module.exports = spaRepo;
