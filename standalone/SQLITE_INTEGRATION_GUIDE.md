# SQLite Standalone Integration Guide

## What Was Built

A **standalone backend** for the Smoobu booking platform that uses **SQLite** instead of Firebase. This means:

- **Zero external database setup** - SQLite is a file-based database
- **No Google Cloud account needed**
- **No Firebase configuration**
- **Just add your API keys and run**

---

## Folder Structure

```
standalone/
├── server.js                 # Main Express server (port 3001)
├── package.json              # Dependencies
├── .env                      # Your configuration (create from .env.example)
├── .env.example              # Template for configuration
├── .gitignore
├── README.md
│
├── database/
│   ├── sqlite.js             # SQLite connection layer (using sql.js)
│   └── repositories/         # Data access functions
│       ├── bookings.js       # Booking CRUD operations
│       ├── coupons.js        # Coupon management
│       ├── pricing-config.js # Room pricing configuration
│       ├── spa.js            # SPA settings and bookings
│       ├── extras.js         # Extras/packages catalog
│       ├── settings.js       # Property settings
│       ├── users.js          # Admin authentication
│       └── index.js          # Export all repositories
│
├── routes/                   # API endpoints
│   ├── auth.js               # Login, register, JWT auth
│   ├── bookings.js           # Booking management
│   ├── coupons.js            # Coupon validation & management
│   ├── pricing-config.js     # Room pricing CRUD
│   ├── spa.js                # SPA settings & bookings
│   ├── extras.js             # Extras catalog
│   ├── settings.js           # Property settings
│   ├── smoobu.js             # Smoobu API integration
│   └── index.js              # Export all routes
│
├── middleware/
│   └── auth.js               # JWT authentication middleware
│
├── config/                   # (empty, for future use)
├── utils/                    # (empty, for future use)
│
└── data/
    └── smoobu.db             # SQLite database file (auto-created)
```

---

## Database Tables (SQLite)

| Table | Purpose |
|-------|---------|
| `users` | Admin accounts (email/password + JWT) |
| `bookings` | All reservations |
| `coupons` | Discount codes & gift vouchers |
| `room_pricing_config` | Guest fees per room |
| `spa_settings` | SPA time configuration |
| `spa_bookings` | SPA slot reservations |
| `extras` | Packages and add-ons catalog |
| `property_settings` | Property name, timezone, branding |

---

## API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/auth/setup-status` | Check if admin exists |
| POST | `/api/auth/register` | Create first admin (only works once) |
| POST | `/api/auth/login` | Login, get JWT token |
| GET | `/api/auth/me` | Get current user |

### Dynamic Rooms (Smoobu)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/dynamic-rooms` | List rooms from Smoobu |
| GET | `/api/dynamic-rates` | Get pricing for date range |
| GET | `/api/test-smoobu-connection` | Test Smoobu API key |

### Pricing Configuration
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/pricing-configs` | Get all room configs |
| GET | `/api/pricing-config/:smoobuId` | Get config for one room |
| POST | `/api/pricing-config/:smoobuId` | Save/update config |
| DELETE | `/api/pricing-config/:smoobuId` | Delete config |

### Other Endpoints
- `/api/bookings` - Booking management
- `/api/coupons` - Coupon management
- `/api/spa` - SPA settings and bookings
- `/api/extras` - Extras catalog
- `/api/settings` - Property settings

---

## How to Test

### Step 1: Kill any existing process on port 3001

```bash
# Find and kill process on port 3001
lsof -ti:3001 | xargs kill -9 2>/dev/null

# Or on Windows:
netstat -ano | findstr :3001
taskkill /PID <PID> /F
```

### Step 2: Go to the standalone folder

```bash
cd /home/mihaipatap/www/smoobu/standalone
```

### Step 3: Make sure dependencies are installed

```bash
npm install
```

### Step 4: Create your .env file (if not exists)

```bash
cp .env.example .env
```

Edit `.env` and set:
```env
PORT=3001
JWT_SECRET=your-secret-key-here
SMOOBU_API_KEY=your-smoobu-api-key  # Optional, can pass via frontend
```

### Step 5: Start the backend server

```bash
npm start
```

You should see:
```
Initializing database...
Created new database
Database schema initialized
Database ready!

╔═══════════════════════════════════════════════════════╗
║   Smoobu Standalone Backend                           ║
║   Server running on port 3001                         ║
╚═══════════════════════════════════════════════════════╝
```

### Step 6: Test the backend (in another terminal)

```bash
# Health check
curl http://localhost:3001/health

# Setup status
curl http://localhost:3001/api/auth/setup-status

# Create admin account (first time only)
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@test.com", "password": "yourpassword"}'
```

### Step 7: Configure frontend to use standalone backend

Edit `/home/mihaipatap/www/smoobu/.env`:
```env
VITE_API_URL=http://localhost:3001
```

### Step 8: Start the frontend (in another terminal)

```bash
cd /home/mihaipatap/www/smoobu
npm run dev
```

### Step 9: Test in browser

1. Open: http://localhost:5173/dynamic-rooms
2. Enter your Smoobu API key
3. Click "Load Rooms with This Key"
4. Click "Configure Fees" on any room
5. Save configuration → **saves to SQLite, not Firebase!**

---

## Troubleshooting

### Port 3001 is already in use

```bash
# Kill the process using port 3001
lsof -ti:3001 | xargs kill -9

# Or use a different port
PORT=3002 npm start
```

Then update frontend `.env`:
```env
VITE_API_URL=http://localhost:3002
```

### Database errors

Delete the database and restart:
```bash
rm -rf data/smoobu.db
npm start
```

### CORS errors in browser

Make sure your frontend URL is in `ALLOWED_ORIGINS` in `.env`:
```env
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000
```

---

## What Changed from Firebase Version

| Aspect | Firebase Version | SQLite Version |
|--------|-----------------|----------------|
| Database | Cloud Firestore | Local SQLite file |
| Auth | Firebase Auth | JWT tokens |
| Config location | `firebase-config.js` | `.env` file |
| Setup steps | 15+ steps | 3 steps |
| External services | Google Cloud | None |
| Cost | Free tier limits | Free forever |
| Deployment | Need Firebase credentials | Just copy files |

---

## Deployment

### For Production

1. Set `NODE_ENV=production` in `.env`
2. Set a strong `JWT_SECRET`
3. Set `ALLOWED_ORIGINS` to your production frontend URL
4. Deploy to Render, Railway, or any Node.js host

### Backup

Just copy the `data/smoobu.db` file:
```bash
cp data/smoobu.db backups/smoobu-$(date +%Y%m%d).db
```

---

## Next Steps

1. **Test locally** - Follow steps above
2. **Migrate existing data** - If you have data in Firebase, export and import
3. **Add Stripe integration** - Copy webhook handlers from main backend
4. **Add email sending** - Add nodemailer for confirmations
5. **Deploy** - Push to your hosting provider

---

## Files Reference

### Main files you might edit:

- `.env` - Configuration (API keys, secrets)
- `database/sqlite.js` - Database schema
- `routes/smoobu.js` - Smoobu API integration
- `routes/pricing-config.js` - Pricing configuration endpoints

### Data storage:

- `data/smoobu.db` - All your data (bookings, configs, users, etc.)
