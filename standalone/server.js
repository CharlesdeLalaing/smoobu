require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// Database initialization will be done async before starting server
const { initDatabase } = require('./database/sqlite');

// Import routes
const routes = require('./routes');

const app = express();
const PORT = process.env.PORT || 3001;

// ======================
// MIDDLEWARE
// ======================

// Security headers
app.use(helmet());

// CORS configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:5173', 'http://localhost:3000'];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`CORS blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

// Stripe webhook needs raw body - must be before JSON parsing
app.post('/api/stripe-webhook', express.raw({ type: 'application/json' }), (req, res, next) => {
  req.url = '/webhook';
  routes.payments(req, res, next);
});

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: { error: 'Too many requests, please try again later.' }
});

// Apply rate limiting to auth routes
app.use('/api/auth', limiter);

// Request logging (development)
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
    next();
  });
}

// ======================
// ROUTES
// ======================

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

// API routes
app.use('/api/auth', routes.auth);
app.use('/api/bookings', routes.bookings);
app.use('/api/coupons', routes.coupons);
app.use('/api/pricing-config', routes.pricingConfig);
app.use('/api/pricing-configs', routes.pricingConfig); // Alias
app.use('/api/spa', routes.spa);
app.use('/api/extras', routes.extras);
app.use('/api/settings', routes.settings);
app.use('/api/smoobu', routes.smoobu);

// Routes for frontend compatibility (DynamicRoomsPage)
app.use('/api/dynamic-rooms', routes.smoobu);  // GET / -> rooms list
app.get('/api/dynamic-rates', (req, res, next) => {
  // Rewrite to /api/smoobu/rates
  req.url = '/rates' + (req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '');
  routes.smoobu(req, res, next);
});
app.get('/api/test-smoobu-connection', (req, res, next) => {
  req.url = '/test-smoobu-connection';
  routes.smoobu(req, res, next);
});

// Route for booking form compatibility - mount smoobu routes at /api/rates to handle availability
// This allows /api/rates to serve the booking-rates endpoint
app.use('/api/rates', routes.smoobu);

// Stripe payment intent route - use app.use to properly mount the router
app.use('/api/create-payment-intent', routes.payments);

// ======================
// ERROR HANDLING
// ======================

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    path: req.path
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);

  // CORS errors
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({ error: 'CORS not allowed' });
  }

  // JSON parsing errors
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  res.status(500).json({
    error: process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message
  });
});

// ======================
// START SERVER
// ======================

async function startServer() {
  try {
    // Initialize database first
    console.log('Initializing database...');
    await initDatabase();
    console.log('Database ready!');

    app.listen(PORT, () => {
      console.log(`
╔═══════════════════════════════════════════════════════╗
║                                                       ║
║   Smoobu Standalone Backend                           ║
║   ─────────────────────────────────────────────────   ║
║                                                       ║
║   Server running on port ${PORT}                         ║
║   Environment: ${process.env.NODE_ENV || 'development'}                        ║
║                                                       ║
║   Endpoints:                                          ║
║   • GET  /health              - Health check          ║
║   • POST /api/auth/login      - Login                 ║
║   • POST /api/auth/register   - Initial setup         ║
║   • GET  /api/smoobu/apartments - List rooms          ║
║   • GET  /api/smoobu/rates    - Get pricing           ║
║   • ...and more                                       ║
║                                                       ║
╚═══════════════════════════════════════════════════════╝
      `);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

module.exports = app;
