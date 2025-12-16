const { db } = require('../sqlite');

const extrasRepo = {
  // Get all extras
  getAll(filters = {}) {
    let query = 'SELECT * FROM extras WHERE 1=1';
    const params = [];

    if (filters.category) {
      query += ' AND category = ?';
      params.push(filters.category);
    }

    if (filters.isActive !== undefined) {
      query += ' AND is_active = ?';
      params.push(filters.isActive ? 1 : 0);
    }

    query += ' ORDER BY sort_order ASC, name_fr ASC';

    const stmt = db.prepare(query);
    const rows = stmt.all(...params);

    return rows.map(parseExtraJson);
  },

  // Get extras for a specific room
  getForRoom(smoobuRoomId) {
    const stmt = db.prepare(`
      SELECT * FROM extras
      WHERE is_active = 1
        AND (available_for_rooms IS NULL OR available_for_rooms LIKE ?)
      ORDER BY sort_order ASC, name_fr ASC
    `);
    const rows = stmt.all(`%${smoobuRoomId}%`);
    return rows.map(parseExtraJson);
  },

  // Get extra by ID
  getById(id) {
    const stmt = db.prepare('SELECT * FROM extras WHERE id = ?');
    const row = stmt.get(id);
    return row ? parseExtraJson(row) : null;
  },

  // Get extra by code
  getByCode(code) {
    const stmt = db.prepare('SELECT * FROM extras WHERE code = ?');
    const row = stmt.get(code);
    return row ? parseExtraJson(row) : null;
  },

  // Create a new extra
  create(extra) {
    const stmt = db.prepare(`
      INSERT INTO extras (
        code, category, name_fr, name_en, name_nl,
        description_fr, description_en, description_nl,
        base_price, per_person, extra_person_fee,
        available_for_rooms, max_quantity, is_active, sort_order, image_url
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      extra.code,
      extra.category,
      extra.nameFr || extra.name_fr || extra.name?.fr || '',
      extra.nameEn || extra.name_en || extra.name?.en || '',
      extra.nameNl || extra.name_nl || extra.name?.nl || '',
      extra.descriptionFr || extra.description_fr || extra.description?.fr || '',
      extra.descriptionEn || extra.description_en || extra.description?.en || '',
      extra.descriptionNl || extra.description_nl || extra.description?.nl || '',
      extra.basePrice || extra.base_price || 0,
      extra.perPerson || extra.per_person ? 1 : 0,
      extra.extraPersonFee || extra.extra_person_fee || 0,
      JSON.stringify(extra.availableForRooms || extra.available_for_rooms || null),
      extra.maxQuantity || extra.max_quantity || null,
      extra.isActive !== false ? 1 : 0,
      extra.sortOrder || extra.sort_order || 0,
      extra.imageUrl || extra.image_url || null
    );

    return { id: result.lastInsertRowid, ...extra };
  },

  // Update an extra
  update(id, updates) {
    const fields = [];
    const values = [];

    const fieldMapping = {
      code: 'code',
      category: 'category',
      nameFr: 'name_fr',
      nameEn: 'name_en',
      nameNl: 'name_nl',
      descriptionFr: 'description_fr',
      descriptionEn: 'description_en',
      descriptionNl: 'description_nl',
      basePrice: 'base_price',
      perPerson: 'per_person',
      extraPersonFee: 'extra_person_fee',
      availableForRooms: 'available_for_rooms',
      maxQuantity: 'max_quantity',
      isActive: 'is_active',
      sortOrder: 'sort_order',
      imageUrl: 'image_url'
    };

    for (const [key, value] of Object.entries(updates)) {
      const dbField = fieldMapping[key] || key;
      fields.push(`${dbField} = ?`);

      if (key === 'perPerson' || key === 'per_person' || key === 'isActive' || key === 'is_active') {
        values.push(value ? 1 : 0);
      } else if (key === 'availableForRooms' || key === 'available_for_rooms') {
        values.push(JSON.stringify(value));
      } else {
        values.push(value);
      }
    }

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    const stmt = db.prepare(`UPDATE extras SET ${fields.join(', ')} WHERE id = ?`);
    return stmt.run(...values);
  },

  // Delete an extra
  delete(id) {
    const stmt = db.prepare('DELETE FROM extras WHERE id = ?');
    return stmt.run(id);
  },

  // Batch create extras
  createBatch(extras) {
    const insert = db.prepare(`
      INSERT INTO extras (
        code, category, name_fr, name_en, name_nl,
        description_fr, description_en, description_nl,
        base_price, per_person, extra_person_fee,
        available_for_rooms, max_quantity, is_active, sort_order, image_url
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMany = db.transaction((items) => {
      const results = [];
      for (const extra of items) {
        const result = insert.run(
          extra.code,
          extra.category,
          extra.nameFr || extra.name?.fr || '',
          extra.nameEn || extra.name?.en || '',
          extra.nameNl || extra.name?.nl || '',
          extra.descriptionFr || extra.description?.fr || '',
          extra.descriptionEn || extra.description?.en || '',
          extra.descriptionNl || extra.description?.nl || '',
          extra.basePrice || 0,
          extra.perPerson ? 1 : 0,
          extra.extraPersonFee || 0,
          JSON.stringify(extra.availableForRooms || null),
          extra.maxQuantity || null,
          extra.isActive !== false ? 1 : 0,
          extra.sortOrder || 0,
          extra.imageUrl || null
        );
        results.push({ id: result.lastInsertRowid, ...extra });
      }
      return results;
    });

    return insertMany(extras);
  },

  // Get extras grouped by category
  getGroupedByCategory(roomId = null) {
    const extras = roomId ? this.getForRoom(roomId) : this.getAll({ isActive: true });

    const grouped = {};
    for (const extra of extras) {
      if (!grouped[extra.category]) {
        grouped[extra.category] = [];
      }
      grouped[extra.category].push(extra);
    }

    return grouped;
  }
};

// Helper to parse JSON fields and format output
function parseExtraJson(row) {
  if (!row) return null;

  return {
    id: row.id,
    code: row.code,
    category: row.category,
    name: {
      fr: row.name_fr,
      en: row.name_en,
      nl: row.name_nl
    },
    description: {
      fr: row.description_fr,
      en: row.description_en,
      nl: row.description_nl
    },
    basePrice: row.base_price,
    perPerson: row.per_person === 1,
    extraPersonFee: row.extra_person_fee,
    availableForRooms: safeJsonParse(row.available_for_rooms, null),
    maxQuantity: row.max_quantity,
    isActive: row.is_active === 1,
    sortOrder: row.sort_order,
    imageUrl: row.image_url,
    createdAt: row.created_at,
    updatedAt: row.updated_at
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

module.exports = extrasRepo;
