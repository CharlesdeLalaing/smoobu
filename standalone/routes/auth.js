const express = require('express');
const router = express.Router();
const { users } = require('../database/repositories');
const { generateToken, requireAuth } = require('../middleware/auth');

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await users.verifyPassword(email, password);

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = generateToken(user);

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// GET /api/auth/me - Get current user
router.get('/me', requireAuth, (req, res) => {
  try {
    const user = users.getById(req.user.id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

// POST /api/auth/register - Register new user (only if no users exist)
router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Check if this is the first user (setup mode)
    const hasExistingUsers = users.hasUsers();

    if (hasExistingUsers) {
      return res.status(403).json({
        error: 'Registration is disabled. Contact admin for access.'
      });
    }

    // Create initial admin user
    const user = await users.create({
      email,
      password,
      name: name || 'Admin',
      role: 'admin'
    });

    const token = generateToken(user);

    res.status(201).json({
      success: true,
      message: 'Admin account created successfully',
      token,
      user
    });
  } catch (error) {
    console.error('Registration error:', error);

    if (error.message?.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ error: 'Email already exists' });
    }

    res.status(500).json({ error: 'Registration failed' });
  }
});

// POST /api/auth/change-password
router.post('/change-password', requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }

    // Verify current password
    const user = await users.verifyPassword(req.user.email, currentPassword);

    if (!user) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Update password
    await users.updatePassword(req.user.id, newPassword);

    res.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

// GET /api/auth/setup-status - Check if initial setup is needed
router.get('/setup-status', (req, res) => {
  try {
    const hasExistingUsers = users.hasUsers();

    res.json({
      setupComplete: hasExistingUsers,
      needsSetup: !hasExistingUsers
    });
  } catch (error) {
    console.error('Setup status error:', error);
    res.status(500).json({ error: 'Failed to check setup status' });
  }
});

module.exports = router;
