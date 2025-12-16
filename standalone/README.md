# Smoobu Standalone Backend

A self-contained booking management backend integrated with Smoobu. Uses SQLite for zero-configuration database setup.

## Features

- **Zero Firebase Setup** - SQLite database auto-creates on first run
- **Smoobu Integration** - Fetch apartments, rates, and availability
- **Dynamic Pricing** - Configure guest fees per room
- **Booking Management** - Store and manage bookings locally
- **Coupon System** - Create and validate discount codes
- **SPA Scheduling** - Manage spa time slots
- **Extras Catalog** - Dynamic extras/packages management
- **JWT Authentication** - Secure admin access

## Quick Start

### 1. Install Dependencies

```bash
cd standalone
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and add your:
- Smoobu API key (required)
- JWT secret (required)
- Stripe keys (optional)
- Email credentials (optional)

### 3. Start the Server

```bash
# Development (with auto-reload)
npm run dev

# Production
npm start
```

### 4. Initial Setup

On first run, register an admin account:

```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@example.com", "password": "your-password"}'
```

## API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Create initial admin (first run only) |
| POST | `/api/auth/login` | Login and get JWT token |
| GET | `/api/auth/me` | Get current user |
| GET | `/api/auth/setup-status` | Check if setup is complete |

### Smoobu Integration
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/smoobu/test-connection` | Test API key |
| GET | `/api/smoobu/apartments` | List all apartments |
| GET | `/api/smoobu/rates` | Get pricing for dates |
| GET | `/api/smoobu/availability` | Check availability |

### Pricing Configuration
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/pricing-configs` | List all configs |
| GET | `/api/pricing-config/:smoobuId` | Get room config |
| POST | `/api/pricing-config/:smoobuId` | Save room config |
| DELETE | `/api/pricing-config/:smoobuId` | Delete config |

### Bookings
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/bookings` | List bookings |
| GET | `/api/bookings/:id` | Get booking |
| POST | `/api/bookings` | Create booking |
| PUT | `/api/bookings/:id` | Update booking |
| DELETE | `/api/bookings/:id` | Delete booking |

### Coupons
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/coupons` | List coupons (admin) |
| POST | `/api/coupons/validate` | Validate coupon code |
| POST | `/api/coupons` | Create coupon |
| PUT | `/api/coupons/:id` | Update coupon |
| DELETE | `/api/coupons/:id` | Delete coupon |

### Extras
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/extras` | List extras |
| GET | `/api/extras/grouped` | Get by category |
| POST | `/api/extras` | Create extra |
| PUT | `/api/extras/:id` | Update extra |
| DELETE | `/api/extras/:id` | Delete extra |

### SPA
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/spa/settings` | Get SPA settings |
| PUT | `/api/spa/settings` | Update settings |
| GET | `/api/spa/bookings` | List SPA bookings |
| GET | `/api/spa/bookings/available-slots` | Get free slots |
| POST | `/api/spa/bookings` | Create booking |

### Settings
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/settings` | Get public settings |
| PUT | `/api/settings` | Update settings |

## Database

SQLite database is auto-created at `data/smoobu.db` on first run.

### Tables
- `users` - Admin accounts
- `bookings` - Reservation records
- `coupons` - Discount codes
- `room_pricing_config` - Guest fee configuration
- `spa_settings` - SPA time configuration
- `spa_bookings` - SPA reservations
- `extras` - Packages and add-ons
- `property_settings` - Property configuration

### Backup

Simply copy the `data/smoobu.db` file:

```bash
cp data/smoobu.db backups/smoobu-$(date +%Y%m%d).db
```

## Deployment

### Render.com

1. Create new Web Service
2. Connect your repository
3. Set build command: `cd standalone && npm install`
4. Set start command: `cd standalone && npm start`
5. Add environment variables from `.env.example`

### Railway

1. Create new project
2. Connect repository
3. Set root directory to `standalone`
4. Add environment variables

### VPS/Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3001
CMD ["node", "server.js"]
```

## Customer Setup

For customers deploying their own instance:

1. Clone the repository
2. Copy `.env.example` to `.env`
3. Add Smoobu API key and JWT secret
4. Run `npm install && npm start`
5. Register admin account
6. Done!

No Firebase, no Google Cloud, no external database setup required.
