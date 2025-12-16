const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

// Database file path
const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'smoobu.db');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

let db = null;
let SQL = null;

// Initialize database
async function initDatabase() {
  if (db) return db;

  SQL = await initSqlJs();

  // Load existing database or create new one
  try {
    if (fs.existsSync(DB_PATH)) {
      const fileBuffer = fs.readFileSync(DB_PATH);
      db = new SQL.Database(fileBuffer);
      console.log('Loaded existing database');
    } else {
      db = new SQL.Database();
      console.log('Created new database');
    }
  } catch (error) {
    console.error('Error loading database:', error);
    db = new SQL.Database();
  }

  // Initialize schema
  initializeSchema();

  // Save database periodically
  setInterval(saveDatabase, 30000); // Every 30 seconds

  // Save on process exit
  process.on('exit', saveDatabase);
  process.on('SIGINT', () => { saveDatabase(); process.exit(); });
  process.on('SIGTERM', () => { saveDatabase(); process.exit(); });

  return db;
}

// Save database to file
function saveDatabase() {
  if (!db) return;
  try {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  } catch (error) {
    console.error('Error saving database:', error);
  }
}

// Initialize schema
function initializeSchema() {
  const schema = `
    -- Users table for admin authentication
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT,
      role TEXT DEFAULT 'admin',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Bookings table
    CREATE TABLE IF NOT EXISTS bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      smoobu_id TEXT,
      smoobu_reservation_id TEXT UNIQUE,
      apartment_id TEXT,
      apartment_name TEXT,
      first_name TEXT,
      last_name TEXT,
      email TEXT,
      phone TEXT,
      street TEXT,
      postal_code TEXT,
      city TEXT,
      country TEXT,
      arrival_date TEXT,
      departure_date TEXT,
      arrival_time TEXT,
      adults INTEGER DEFAULT 2,
      children INTEGER DEFAULT 0,
      price REAL,
      currency TEXT DEFAULT 'EUR',
      cleaning_fee REAL DEFAULT 0,
      extras TEXT,
      selected_free_drinks TEXT,
      coupon_applied TEXT,
      price_breakdown TEXT,
      stripe_payment_intent_id TEXT,
      stripe_session_id TEXT,
      booking_source TEXT DEFAULT 'direct',
      status TEXT DEFAULT 'confirmed',
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Coupons table
    CREATE TABLE IF NOT EXISTS coupons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      type TEXT NOT NULL,
      amount REAL,
      percentage_value REAL,
      status TEXT DEFAULT 'active',
      max_usage INTEGER,
      used_count INTEGER DEFAULT 0,
      is_gift_voucher INTEGER DEFAULT 0,
      is_unlimited INTEGER DEFAULT 0,
      expiry_date TEXT,
      validity_start_date TEXT,
      validity_end_date TEXT,
      applicable_rooms TEXT,
      minimum_nights INTEGER,
      minimum_amount REAL,
      usage_history TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Room pricing configuration
    CREATE TABLE IF NOT EXISTS room_pricing_config (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      smoobu_id TEXT UNIQUE NOT NULL,
      name TEXT,
      extra_guest_fee_per_night REAL DEFAULT 0,
      extra_child_fee_per_night REAL DEFAULT 0,
      starting_at_guest INTEGER DEFAULT 2,
      cleaning_fee_override REAL,
      max_occupancy INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Room configurations (display settings)
    CREATE TABLE IF NOT EXISTS room_configs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      smoobu_id TEXT UNIQUE NOT NULL,
      name TEXT,
      description TEXT,
      short_description TEXT,
      images TEXT,
      features TEXT,
      type TEXT,
      is_active INTEGER DEFAULT 1,
      sort_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- SPA settings
    CREATE TABLE IF NOT EXISTS spa_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      slot_duration_minutes INTEGER DEFAULT 30,
      start_time TEXT DEFAULT '17:00',
      end_time TEXT DEFAULT '22:00',
      is_enabled INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- SPA bookings
    CREATE TABLE IF NOT EXISTS spa_bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      booking_id INTEGER,
      date TEXT NOT NULL,
      time_slot TEXT NOT NULL,
      duration_minutes INTEGER DEFAULT 30,
      guest_name TEXT,
      guest_email TEXT,
      status TEXT DEFAULT 'confirmed',
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE SET NULL
    );

    -- Extras catalog
    CREATE TABLE IF NOT EXISTS extras (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      category TEXT NOT NULL,
      name_fr TEXT,
      name_en TEXT,
      name_nl TEXT,
      description_fr TEXT,
      description_en TEXT,
      description_nl TEXT,
      base_price REAL NOT NULL,
      per_person INTEGER DEFAULT 0,
      extra_person_fee REAL DEFAULT 0,
      available_for_rooms TEXT,
      max_quantity INTEGER,
      is_active INTEGER DEFAULT 1,
      sort_order INTEGER DEFAULT 0,
      image_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Property settings
    CREATE TABLE IF NOT EXISTS property_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      name TEXT DEFAULT 'My Property',
      slug TEXT,
      timezone TEXT DEFAULT 'Europe/Brussels',
      currency TEXT DEFAULT 'EUR',
      locale TEXT DEFAULT 'fr',
      supported_languages TEXT DEFAULT '["fr", "en", "nl"]',
      logo_url TEXT,
      primary_color TEXT DEFAULT '#4F46E5',
      secondary_color TEXT DEFAULT '#10B981',
      email_from TEXT,
      email_reply_to TEXT,
      min_booking_days_ahead INTEGER DEFAULT 1,
      max_booking_days_ahead INTEGER DEFAULT 365,
      default_adults INTEGER DEFAULT 2,
      default_children INTEGER DEFAULT 0,
      checkin_start_time TEXT DEFAULT '17:00',
      checkin_end_time TEXT DEFAULT '22:00',
      checkin_slot_interval INTEGER DEFAULT 30,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `;

  // Execute schema statements
  const statements = schema.split(';').filter(s => s.trim());
  for (const stmt of statements) {
    try {
      db.run(stmt);
    } catch (error) {
      // Ignore errors for existing tables
    }
  }

  // Create indexes
  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_bookings_arrival ON bookings(arrival_date)',
    'CREATE INDEX IF NOT EXISTS idx_bookings_departure ON bookings(departure_date)',
    'CREATE INDEX IF NOT EXISTS idx_bookings_apartment ON bookings(apartment_id)',
    'CREATE INDEX IF NOT EXISTS idx_bookings_email ON bookings(email)',
    'CREATE INDEX IF NOT EXISTS idx_coupons_code ON coupons(code)',
    'CREATE INDEX IF NOT EXISTS idx_coupons_status ON coupons(status)',
    'CREATE INDEX IF NOT EXISTS idx_spa_bookings_date ON spa_bookings(date)',
    'CREATE INDEX IF NOT EXISTS idx_extras_category ON extras(category)'
  ];

  for (const idx of indexes) {
    try {
      db.run(idx);
    } catch (error) {
      // Ignore errors for existing indexes
    }
  }

  // Insert default records
  try {
    db.run('INSERT OR IGNORE INTO spa_settings (id) VALUES (1)');
    db.run('INSERT OR IGNORE INTO property_settings (id) VALUES (1)');
  } catch (error) {
    // Ignore
  }

  // Migrations for existing databases
  const migrations = [
    'ALTER TABLE bookings ADD COLUMN arrival_time TEXT',
    'ALTER TABLE bookings ADD COLUMN street TEXT',
    'ALTER TABLE bookings ADD COLUMN postal_code TEXT',
    'ALTER TABLE bookings ADD COLUMN city TEXT',
    'ALTER TABLE bookings ADD COLUMN country TEXT',
    'ALTER TABLE property_settings ADD COLUMN checkin_start_time TEXT DEFAULT \'17:00\'',
    'ALTER TABLE property_settings ADD COLUMN checkin_end_time TEXT DEFAULT \'22:00\'',
    'ALTER TABLE property_settings ADD COLUMN checkin_slot_interval INTEGER DEFAULT 30'
  ];

  for (const migration of migrations) {
    try {
      db.run(migration);
    } catch (error) {
      // Column already exists, ignore
    }
  }

  saveDatabase();
  console.log('Database schema initialized');
}

// Helper class to provide better-sqlite3-like interface
class DatabaseWrapper {
  prepare(sql) {
    return new StatementWrapper(sql);
  }

  exec(sql) {
    db.run(sql);
    saveDatabase();
  }

  transaction(fn) {
    return (...args) => {
      db.run('BEGIN TRANSACTION');
      try {
        const result = fn(...args);
        db.run('COMMIT');
        saveDatabase();
        return result;
      } catch (error) {
        db.run('ROLLBACK');
        throw error;
      }
    };
  }

  pragma(pragma) {
    // sql.js doesn't support all pragmas, ignore
  }
}

class StatementWrapper {
  constructor(sql) {
    this.sql = sql;
  }

  run(...params) {
    try {
      db.run(this.sql, params);
      saveDatabase();
      return {
        changes: db.getRowsModified(),
        lastInsertRowid: getLastInsertRowId()
      };
    } catch (error) {
      console.error('SQL Error:', error.message, '\nSQL:', this.sql);
      throw error;
    }
  }

  get(...params) {
    try {
      const stmt = db.prepare(this.sql);
      stmt.bind(params);
      if (stmt.step()) {
        const row = stmt.getAsObject();
        stmt.free();
        return row;
      }
      stmt.free();
      return undefined;
    } catch (error) {
      console.error('SQL Error:', error.message, '\nSQL:', this.sql);
      throw error;
    }
  }

  all(...params) {
    try {
      const results = [];
      const stmt = db.prepare(this.sql);
      stmt.bind(params);
      while (stmt.step()) {
        results.push(stmt.getAsObject());
      }
      stmt.free();
      return results;
    } catch (error) {
      console.error('SQL Error:', error.message, '\nSQL:', this.sql);
      throw error;
    }
  }
}

function getLastInsertRowId() {
  const result = db.exec('SELECT last_insert_rowid() as id');
  if (result.length > 0 && result[0].values.length > 0) {
    return result[0].values[0][0];
  }
  return 0;
}

// Export wrapper
const dbWrapper = new DatabaseWrapper();

module.exports = {
  db: dbWrapper,
  DB_PATH,
  initDatabase,
  saveDatabase,
  getDb: () => db
};
