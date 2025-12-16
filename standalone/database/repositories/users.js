const { db } = require('../sqlite');
const bcrypt = require('bcryptjs');

const SALT_ROUNDS = 10;

const usersRepo = {
  // Get all users (without password)
  getAll() {
    const stmt = db.prepare('SELECT id, email, name, role, created_at, updated_at FROM users');
    return stmt.all();
  },

  // Get user by ID (without password)
  getById(id) {
    const stmt = db.prepare('SELECT id, email, name, role, created_at, updated_at FROM users WHERE id = ?');
    return stmt.get(id);
  },

  // Get user by email (without password)
  getByEmail(email) {
    const stmt = db.prepare('SELECT id, email, name, role, created_at, updated_at FROM users WHERE email = ?');
    return stmt.get(email.toLowerCase());
  },

  // Get user by email with password hash (for authentication)
  getByEmailWithPassword(email) {
    const stmt = db.prepare('SELECT * FROM users WHERE email = ?');
    return stmt.get(email.toLowerCase());
  },

  // Create a new user
  async create(user) {
    const passwordHash = await bcrypt.hash(user.password, SALT_ROUNDS);

    const stmt = db.prepare(`
      INSERT INTO users (email, password_hash, name, role)
      VALUES (?, ?, ?, ?)
    `);

    const result = stmt.run(
      user.email.toLowerCase(),
      passwordHash,
      user.name || null,
      user.role || 'admin'
    );

    return {
      id: result.lastInsertRowid,
      email: user.email.toLowerCase(),
      name: user.name,
      role: user.role || 'admin'
    };
  },

  // Verify password
  async verifyPassword(email, password) {
    const user = this.getByEmailWithPassword(email);
    if (!user) return null;

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) return null;

    // Return user without password hash
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role
    };
  },

  // Update user (without password)
  update(id, updates) {
    const fields = [];
    const values = [];

    if (updates.email) {
      fields.push('email = ?');
      values.push(updates.email.toLowerCase());
    }

    if (updates.name !== undefined) {
      fields.push('name = ?');
      values.push(updates.name);
    }

    if (updates.role) {
      fields.push('role = ?');
      values.push(updates.role);
    }

    if (fields.length === 0) return null;

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    const stmt = db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`);
    return stmt.run(...values);
  },

  // Update password
  async updatePassword(id, newPassword) {
    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

    const stmt = db.prepare(`
      UPDATE users
      SET password_hash = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    return stmt.run(passwordHash, id);
  },

  // Delete user
  delete(id) {
    const stmt = db.prepare('DELETE FROM users WHERE id = ?');
    return stmt.run(id);
  },

  // Check if any users exist (for initial setup)
  hasUsers() {
    const stmt = db.prepare('SELECT COUNT(*) as count FROM users');
    const result = stmt.get();
    return result.count > 0;
  },

  // Create initial admin user if none exists
  async createInitialAdmin(email, password) {
    if (this.hasUsers()) {
      throw new Error('Users already exist. Cannot create initial admin.');
    }

    return this.create({
      email,
      password,
      name: 'Admin',
      role: 'admin'
    });
  }
};

module.exports = usersRepo;
