const { db } = require('../sqlite');

const settingsRepo = {
  // Get all property settings
  get() {
    const stmt = db.prepare('SELECT * FROM property_settings WHERE id = 1');
    const row = stmt.get();

    if (!row) {
      // Create default settings if not exist
      this.update({});
      return this.get();
    }

    return {
      name: row.name,
      slug: row.slug,
      timezone: row.timezone,
      currency: row.currency,
      locale: row.locale,
      supportedLanguages: safeJsonParse(row.supported_languages, ['fr', 'en', 'nl']),
      logoUrl: row.logo_url,
      primaryColor: row.primary_color,
      secondaryColor: row.secondary_color,
      emailFrom: row.email_from,
      emailReplyTo: row.email_reply_to,
      minBookingDaysAhead: row.min_booking_days_ahead,
      maxBookingDaysAhead: row.max_booking_days_ahead,
      defaultAdults: row.default_adults,
      defaultChildren: row.default_children,
      checkinStartTime: row.checkin_start_time || '17:00',
      checkinEndTime: row.checkin_end_time || '22:00',
      checkinSlotInterval: row.checkin_slot_interval || 30,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  },

  // Update property settings
  update(settings) {
    const stmt = db.prepare(`
      INSERT INTO property_settings (
        id, name, slug, timezone, currency, locale, supported_languages,
        logo_url, primary_color, secondary_color,
        email_from, email_reply_to,
        min_booking_days_ahead, max_booking_days_ahead,
        default_adults, default_children,
        checkin_start_time, checkin_end_time, checkin_slot_interval
      ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        slug = excluded.slug,
        timezone = excluded.timezone,
        currency = excluded.currency,
        locale = excluded.locale,
        supported_languages = excluded.supported_languages,
        logo_url = excluded.logo_url,
        primary_color = excluded.primary_color,
        secondary_color = excluded.secondary_color,
        email_from = excluded.email_from,
        email_reply_to = excluded.email_reply_to,
        min_booking_days_ahead = excluded.min_booking_days_ahead,
        max_booking_days_ahead = excluded.max_booking_days_ahead,
        default_adults = excluded.default_adults,
        default_children = excluded.default_children,
        checkin_start_time = excluded.checkin_start_time,
        checkin_end_time = excluded.checkin_end_time,
        checkin_slot_interval = excluded.checkin_slot_interval,
        updated_at = CURRENT_TIMESTAMP
    `);

    return stmt.run(
      settings.name || 'My Property',
      settings.slug || null,
      settings.timezone || 'Europe/Brussels',
      settings.currency || 'EUR',
      settings.locale || 'fr',
      JSON.stringify(settings.supportedLanguages || ['fr', 'en', 'nl']),
      settings.logoUrl || null,
      settings.primaryColor || '#4F46E5',
      settings.secondaryColor || '#10B981',
      settings.emailFrom || null,
      settings.emailReplyTo || null,
      settings.minBookingDaysAhead || 1,
      settings.maxBookingDaysAhead || 365,
      settings.defaultAdults || 2,
      settings.defaultChildren || 0,
      settings.checkinStartTime || '17:00',
      settings.checkinEndTime || '22:00',
      settings.checkinSlotInterval || 30
    );
  },

  // Update specific fields
  updateFields(updates) {
    const current = this.get();
    return this.update({ ...current, ...updates });
  },

  // Get public settings (safe to expose to frontend)
  getPublic() {
    const settings = this.get();
    return {
      name: settings.name,
      timezone: settings.timezone,
      currency: settings.currency,
      locale: settings.locale,
      supportedLanguages: settings.supportedLanguages,
      logoUrl: settings.logoUrl,
      primaryColor: settings.primaryColor,
      secondaryColor: settings.secondaryColor,
      minBookingDaysAhead: settings.minBookingDaysAhead,
      maxBookingDaysAhead: settings.maxBookingDaysAhead,
      defaultAdults: settings.defaultAdults,
      defaultChildren: settings.defaultChildren,
      checkinStartTime: settings.checkinStartTime,
      checkinEndTime: settings.checkinEndTime,
      checkinSlotInterval: settings.checkinSlotInterval
    };
  }
};

function safeJsonParse(str, defaultValue) {
  if (!str) return defaultValue;
  try {
    return JSON.parse(str);
  } catch {
    return defaultValue;
  }
}

module.exports = settingsRepo;
