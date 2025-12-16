const { db } = require('../sqlite');

const pricingConfigRepo = {
  // Get all pricing configs
  getAll() {
    const stmt = db.prepare('SELECT * FROM room_pricing_config ORDER BY name ASC');
    return stmt.all();
  },

  // Get config by Smoobu ID
  getBySmoobuId(smoobuId) {
    const stmt = db.prepare('SELECT * FROM room_pricing_config WHERE smoobu_id = ?');
    return stmt.get(String(smoobuId));
  },

  // Get config by ID
  getById(id) {
    const stmt = db.prepare('SELECT * FROM room_pricing_config WHERE id = ?');
    return stmt.get(id);
  },

  // Create or update (upsert) a pricing config
  upsert(config) {
    const stmt = db.prepare(`
      INSERT INTO room_pricing_config (
        smoobu_id, name, extra_guest_fee_per_night, extra_child_fee_per_night,
        starting_at_guest, cleaning_fee_override, max_occupancy
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(smoobu_id) DO UPDATE SET
        name = excluded.name,
        extra_guest_fee_per_night = excluded.extra_guest_fee_per_night,
        extra_child_fee_per_night = excluded.extra_child_fee_per_night,
        starting_at_guest = excluded.starting_at_guest,
        cleaning_fee_override = excluded.cleaning_fee_override,
        max_occupancy = excluded.max_occupancy,
        updated_at = CURRENT_TIMESTAMP
    `);

    const result = stmt.run(
      String(config.smoobuId || config.smoobu_id),
      config.name || null,
      config.extraGuestFeePerNight || config.extra_guest_fee_per_night || 0,
      config.extraChildFeePerNight || config.extra_child_fee_per_night || 0,
      config.startingAtGuest || config.starting_at_guest || 2,
      config.cleaningFeeOverride || config.cleaning_fee_override || null,
      config.maxOccupancy || config.max_occupancy || null
    );

    return { id: result.lastInsertRowid, ...config };
  },

  // Update by Smoobu ID
  updateBySmoobuId(smoobuId, updates) {
    const fields = [];
    const values = [];

    const fieldMapping = {
      name: 'name',
      extraGuestFeePerNight: 'extra_guest_fee_per_night',
      extraChildFeePerNight: 'extra_child_fee_per_night',
      startingAtGuest: 'starting_at_guest',
      cleaningFeeOverride: 'cleaning_fee_override',
      maxOccupancy: 'max_occupancy'
    };

    for (const [key, value] of Object.entries(updates)) {
      const dbField = fieldMapping[key] || key;
      fields.push(`${dbField} = ?`);
      values.push(value);
    }

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(String(smoobuId));

    const stmt = db.prepare(`UPDATE room_pricing_config SET ${fields.join(', ')} WHERE smoobu_id = ?`);
    return stmt.run(...values);
  },

  // Delete by Smoobu ID
  deleteBySmoobuId(smoobuId) {
    const stmt = db.prepare('DELETE FROM room_pricing_config WHERE smoobu_id = ?');
    return stmt.run(String(smoobuId));
  },

  // Delete by ID
  delete(id) {
    const stmt = db.prepare('DELETE FROM room_pricing_config WHERE id = ?');
    return stmt.run(id);
  },

  // Batch upsert
  batchUpsert(configs) {
    const upsert = db.prepare(`
      INSERT INTO room_pricing_config (
        smoobu_id, name, extra_guest_fee_per_night, extra_child_fee_per_night,
        starting_at_guest, cleaning_fee_override, max_occupancy
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(smoobu_id) DO UPDATE SET
        name = excluded.name,
        extra_guest_fee_per_night = excluded.extra_guest_fee_per_night,
        extra_child_fee_per_night = excluded.extra_child_fee_per_night,
        starting_at_guest = excluded.starting_at_guest,
        cleaning_fee_override = excluded.cleaning_fee_override,
        max_occupancy = excluded.max_occupancy,
        updated_at = CURRENT_TIMESTAMP
    `);

    const upsertMany = db.transaction((items) => {
      const results = [];
      for (const config of items) {
        const result = upsert.run(
          String(config.smoobuId || config.smoobu_id),
          config.name || null,
          config.extraGuestFeePerNight || config.extra_guest_fee_per_night || 0,
          config.extraChildFeePerNight || config.extra_child_fee_per_night || 0,
          config.startingAtGuest || config.starting_at_guest || 2,
          config.cleaningFeeOverride || config.cleaning_fee_override || null,
          config.maxOccupancy || config.max_occupancy || null
        );
        results.push({ id: result.lastInsertRowid, ...config });
      }
      return results;
    });

    return upsertMany(configs);
  },

  // Get configs as a map (keyed by smoobuId)
  getAllAsMap() {
    const configs = this.getAll();
    const map = {};
    for (const config of configs) {
      map[config.smoobu_id] = {
        smoobuId: config.smoobu_id,
        name: config.name,
        extraGuestFeePerNight: config.extra_guest_fee_per_night,
        extraChildFeePerNight: config.extra_child_fee_per_night,
        startingAtGuest: config.starting_at_guest,
        cleaningFeeOverride: config.cleaning_fee_override,
        maxOccupancy: config.max_occupancy
      };
    }
    return map;
  }
};

module.exports = pricingConfigRepo;
