# Dynamic Smoobu Integration - Current Work Status

**Last Updated:** December 16, 2025 (Session 4)
**Branch:** `smoobu-dynamic-integration`

---

## Recent Changes (This Session)

### Guest Fee Calculation Fix ✅ COMPLETED

Fixed guest fees to show per-night breakdown with separate adult/child fees:

| Change | File | Description |
|--------|------|-------------|
| Per-night calculation | `src/components/hooks/useBookingForm.js` | Rewrote `calculateGuestFees` to multiply by nights and return breakdown |
| Adult/child breakdown | `src/components/booking/PriceDetails.jsx` | Display separate lines for adult and child fees |
| PropertyDetails update | `src/components/booking/PropertyDetails.jsx` | Updated `getGuestFeeInfo` for adult/child display |
| BookingConfirmation | `src/components/BookingConfirmation.jsx` | Display adult/child fees with breakdown info |
| Email template | `standalone/services/email.js` | Show adult/child fee breakdown in admin email |
| Translations (FR) | `src/translations/fr.json` | Added `priceDetails.adultGuestFees`, `priceDetails.childGuestFees`, `propertyDetails.extraAdultFee`, `propertyDetails.extraChildFee` |
| Translations (EN) | `src/translations/en.json` | Same keys for English |

### Address Fields Fix ✅ COMPLETED

Fixed address fields not being saved/displayed:

| Change | File | Description |
|--------|------|-------------|
| Database columns | `standalone/database/sqlite.js` | Added `street`, `postal_code`, `city`, `country` to bookings table |
| Repository update | `standalone/database/repositories/bookings.js` | Updated INSERT to include address fields |
| Webhook save | `standalone/routes/payments.js` | Pass address fields when creating booking |
| API response | `standalone/routes/bookings.js` | Added address fields to `/api/bookings/by-payment/:id` |
| Email template | `standalone/services/email.js` | Added address to admin email |

### Configurable Check-in Times ✅ COMPLETED

Added tenant-configurable check-in time settings:

| Change | File | Description |
|--------|------|-------------|
| Database columns | `standalone/database/sqlite.js` | Added `checkin_start_time`, `checkin_end_time`, `checkin_slot_interval` to property_settings |
| Settings endpoint | `standalone/routes/settings.js` | Added `POST /api/settings/checkin` public endpoint |
| Settings hook | `src/components/hooks/useCheckinSettings.js` | NEW - Fetch and generate dynamic time slots |
| TimeSelect update | `src/components/booking/TimeSelect.jsx` | Uses `useCheckinSettings` hook |
| Admin UI | `src/components/DynamicRoomsTest/DynamicRoomsPage.jsx` | Added "Check-in Time Settings" section |

---

## Previous Session Changes

### Payment Flow Completed & Tested

Successfully completed end-to-end payment testing with Stripe:

| Change | File | Description |
|--------|------|-------------|
| Stripe Key Fix | `.env.development` | Fixed mismatch between frontend/backend Stripe accounts |
| SQLite Booking Save | `standalone/database/repositories/bookings.js` | Fixed undefined value binding, added null handling |
| Public Booking Endpoint | `standalone/routes/bookings.js` | Added `/by-payment/:paymentIntentId` for confirmation page |
| Booking Confirmation Fix | `src/components/BookingConfirmation.jsx` | Updated to use new public endpoint |
| Payment Router Mount | `standalone/server.js` | Fixed 404 by using `app.use()` for router |

### Data Completeness Fixes

| Change | File | Description |
|--------|------|-------------|
| Room Name Saving | `src/components/booking/BookingForm.jsx` | Added `roomName` to formData when selecting room |
| Room Name Field | `src/components/hooks/useBookingForm.js` | Added `roomName` to initial state |
| Arrival Time Column | `standalone/database/sqlite.js` | Added `arrival_time` column + migration |
| Arrival Time Saving | `standalone/database/repositories/bookings.js` | Updated INSERT to include `arrival_time` |
| Arrival Time in Payment | `standalone/routes/payments.js` | Pass `arrivalTime` when saving booking |

### Calendar Availability from SQLite

| Change | File | Description |
|--------|------|-------------|
| SQLite Booking Check | `standalone/routes/smoobu.js` | Merges SQLite bookings into Smoobu availability data |
| Unavailable Dates | `/api/rates` endpoint | Dates with bookings marked `available: 0` |
| Checkout-Only Dates | `/api/rates` endpoint | Departure dates marked `checkoutOnly: true` |

### Email Notifications

| Change | File | Description |
|--------|------|-------------|
| Email Service | `standalone/services/email.js` | NEW - Nodemailer with Gmail |
| Admin Notification | `standalone/routes/payments.js` | Sends email on successful payment |
| Email Config | `standalone/.env` | Added EMAIL_USER, EMAIL_PASSWORD, ADMIN_EMAIL |

---

## Current Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     FRONTEND (React + Vite)                      │
│                     http://localhost:5173                        │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  /                    →  Main booking flow (SQLite backend)  ││
│  │  /booking-confirmation→  Post-payment confirmation page      ││
│  │  /dynamic-rooms       →  Test page for dynamic Smoobu        ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│              STANDALONE BACKEND (Express + SQLite)               │
│                     http://localhost:3001                        │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  BOOKING FLOW ENDPOINTS:                                     ││
│  │  /api/dynamic-rooms         →  Rooms list (cached 5min)      ││
│  │  /api/rates                 →  Availability + SQLite bookings││
│  │  /api/create-payment-intent →  Stripe payment processing     ││
│  │  /api/stripe-webhook        →  Payment success handler       ││
│  │  /api/coupons/lookup/:code  →  Public coupon validation      ││
│  │  /api/bookings/recent       →  View recent bookings (public) ││
│  │  /api/bookings/by-payment/:id → Get booking by payment intent││
│  │                                                               ││
│  │  ADMIN ENDPOINTS:                                             ││
│  │  /api/bookings              →  Booking management (auth)     ││
│  │  /api/pricing-configs       →  Room fee configuration        ││
│  │  /api/coupons               →  Coupon management             ││
│  │  /api/extras                →  Extras catalog                ││
│  │  /api/spa                   →  SPA settings & bookings       ││
│  │  /api/settings              →  Property settings             ││
│  │  /api/auth                  →  Admin authentication          ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
         │                │               │               │
         ▼                ▼               ▼               ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  SMOOBU API  │  │    SQLite    │  │    STRIPE    │  │    EMAIL     │
│  (External)  │  │  smoobu.db   │  │  (Payments)  │  │   (Gmail)    │
└──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘
```

---

## What's Working Now

### Main Booking Flow ✅ FULLY CONNECTED

| Feature | Status | Notes |
|---------|--------|-------|
| Dynamic room loading | ✅ Working | Cached for 5 minutes |
| Availability calendar | ✅ Working | Shows SQLite + Smoobu bookings |
| Date selection | ✅ Working | Tomorrow minimum, booked dates blocked |
| Price calculation | ✅ Working | Uses SQLite pricing configs |
| Guest fee calculation | ✅ Working | Extra adults/children fees |
| Coupon validation | ✅ Working | Via `/api/coupons/lookup/:code` |
| Stripe payment | ✅ Working | Tested in sandbox mode |
| Booking saved to SQLite | ✅ Working | On payment success webhook |
| Room name saved | ✅ Working | Captured when selecting room |
| Arrival time saved | ✅ Working | Column added to database |
| Email to admin | ✅ Working | Sent on payment success |
| Booking confirmation page | ✅ Working | Shows booking details after payment |

### Calendar Availability Logic

| Scenario | Behavior |
|----------|----------|
| Booked dates (arrival to day before departure) | Marked unavailable (`available: 0`) |
| Departure date | Marked checkout-only (`checkoutOnly: true`) - can be new check-in |
| Example: Booking 17-19 Dec | 17th & 18th unavailable, 19th available for check-in |

---

## Known Issues / To Fix

| Issue | Status | Description |
|-------|--------|-------------|
| Arrival time not in BookingConfirmation | ✅ Fixed | Added `arrivalTime` to `/api/bookings/by-payment/:id` response |
| Arrival time not in admin email | ✅ Fixed | Added arrival time to both admin and guest email templates |
| Address fields not saved | ✅ Fixed | Added `street`, `postal_code`, `city`, `country` columns to bookings table |
| Guest fees one-time instead of per-night | ✅ Fixed | Updated `calculateGuestFees` with per-night × nights calculation |
| Guest fees no adult/child breakdown | ✅ Fixed | Updated PriceDetails, PropertyDetails, BookingConfirmation with breakdown |
| Smoobu API timeouts | ⚠️ Mitigated | 15-20s timeouts, suppresses errors if data exists |
| Slow initial load | ⚠️ Known | First 12-month availability fetch can be slow |

---

## Phase Progress (Updated)

### Phase 1: Configuration System - 70% Complete

| Task | Status | Notes |
|------|--------|-------|
| Database schema | ✅ Done | SQLite tables created |
| ConfigLoader utility | ✅ Done | Repository pattern implemented |
| Room pricing config | ✅ Done | Working with UI |
| Property settings | ⚠️ API Ready | No UI yet |
| Extras configuration | ⚠️ API Ready | No UI, no data |
| SPA configuration | ⚠️ API Ready | No UI, no data |

### Phase 2: Smoobu Auto-Sync - 95% Complete

| Task | Status | Notes |
|------|--------|-------|
| Fetch apartments from Smoobu | ✅ Done | `/api/dynamic-rooms` |
| Fetch rates from Smoobu | ✅ Done | `/api/rates` + `/api/dynamic-rates` |
| Test connection endpoint | ✅ Done | `/api/test-smoobu-connection` |
| Room auto-discovery UI | ✅ Done | DynamicRoomsPage |
| Main booking integration | ✅ Done | BookingForm uses dynamic rooms |
| SQLite bookings in calendar | ✅ Done | Merged with Smoobu data |
| Sync status dashboard | ❌ Not Started | |

### Phase 3: Dynamic Extras - 20% Complete

| Task | Status | Notes |
|------|--------|-------|
| Database table | ✅ Done | `extras` table exists |
| CRUD API endpoints | ✅ Done | `standalone/routes/extras.js` |
| Extras management UI | ❌ Not Started | |
| Migrate hardcoded extras | ❌ Not Started | Currently in `extraCategoriesData.js` |

### Phase 4: Stripe Integration - 95% Complete

| Task | Status | Notes |
|------|--------|-------|
| Payment intent endpoint | ✅ Done | `/api/create-payment-intent` |
| Webhook handler | ✅ Done | `/api/stripe-webhook` |
| Test mode configured | ✅ Done | Sandbox keys in `.env` |
| Booking saved on success | ✅ Done | Working |
| Admin email on success | ✅ Done | Via nodemailer |
| Production deployment | ❌ Not Done | Need live keys |

### Phase 5: Environment & Testing - 80% Complete

| Task | Status | Notes |
|------|--------|-------|
| `.env.example` template | ✅ Done | Both frontend and backend |
| Configurable API URLs | ✅ Done | Via VITE_API_URL |
| Configurable CORS origins | ✅ Done | Via ALLOWED_ORIGINS |
| End-to-end payment test | ✅ Done | Successfully tested |
| Manual testing | ✅ Ongoing | Core flow works |

---

## Recommended Next Steps (Priority Order)

### 🔴 HIGH PRIORITY

#### 1. ~~Fix Arrival Time Display~~ ✅ COMPLETED
**Status:** Fixed on December 16, 2025

**Completed Tasks:**
- [x] Add `arrivalTime` to booking endpoint response (`/api/bookings/by-payment/:id`)
- [x] Display arrival time on BookingConfirmation page (was already implemented, just needed API data)
- [x] Add arrival time to admin email template in `email.js`
- [x] Add arrival time to guest confirmation email in `email.js`

#### 2. Migrate Extras to SQLite
**Why:** Extras are hardcoded in `extraCategoriesData.js`. Need dynamic management.

**Tasks:**
- [ ] Create seed script to populate `extras` table from existing data
- [ ] Build Extras Management UI (admin page)
- [ ] Update booking form to fetch extras from API
- [ ] Add room-specific extras filtering

#### 3. Guest Email Confirmation
**Why:** Currently only admin gets email. Guests need confirmation too.

**Tasks:**
- [ ] Uncomment guest email in `payments.js`
- [ ] Create guest-friendly email template
- [ ] Add booking details, check-in time, property address

### 🟡 MEDIUM PRIORITY

#### 4. Admin Dashboard
**Why:** Currently only the pricing config modal exists. Need full admin UI.

**Tasks:**
- [ ] Create admin layout/navigation
- [ ] Build Property Settings page
- [ ] Build Extras Management page
- [ ] Build Bookings list/management page
- [ ] Build Coupons management page

#### 5. SPA Integration
**Why:** SPA bookings are part of the booking flow.

**Tasks:**
- [ ] Migrate SPA settings to SQLite
- [ ] Build SPA Settings admin page
- [ ] Connect booking form SPA selection to API

### 🟢 LOWER PRIORITY

#### 6. Smoobu Booking Sync
**Why:** Bookings made directly on Smoobu don't appear in SQLite.

**Tasks:**
- [ ] Create webhook endpoint for Smoobu booking notifications
- [ ] Periodic sync job to fetch Smoobu bookings
- [ ] Merge with SQLite bookings for calendar

#### 7. Production Deployment
**Why:** Move from development to live environment.

**Tasks:**
- [ ] Set up production database
- [ ] Configure production Stripe keys
- [ ] Deploy to hosting platform
- [ ] Set up SSL certificates
- [ ] Configure production webhooks

---

## Environment Configuration

### Frontend (.env)
```env
VITE_API_URL=http://localhost:3001
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

### Frontend (.env.development)
```env
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_51SeuME...  # Must match backend account!
```

### Backend (standalone/.env)
```env
PORT=3001
NODE_ENV=development
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=7d
SMOOBU_API_KEY=your-smoobu-api-key
STRIPE_SECRET_KEY=sk_test_51SeuME...
STRIPE_WEBHOOK_SECRET=whsec_...

# Email Configuration
EMAIL_USER=bookingfermedebasseilles@gmail.com
EMAIL_PASSWORD=xxxx xxxx xxxx xxxx  # Gmail App Password
ADMIN_EMAIL=mihaihargile@proton.me
```

---

## Quick Reference

### Start Development

```bash
# Terminal 1: Start SQLite backend
cd /home/mihaipatap/www/smoobu/standalone
node server.js

# Terminal 2: Start frontend
cd /home/mihaipatap/www/smoobu
npm run dev

# Terminal 3 (optional): Stripe webhook listener
stripe listen --forward-to localhost:3001/api/stripe-webhook
```

### Test URLs

| URL | Description |
|-----|-------------|
| http://localhost:5173 | Main booking form |
| http://localhost:5173/booking-confirmation | Post-payment confirmation |
| http://localhost:5173/dynamic-rooms | Dynamic rooms admin page |
| http://localhost:3001/health | Backend health check |
| http://localhost:3001/api/dynamic-rooms | View rooms from Smoobu |
| http://localhost:3001/api/bookings/recent | View saved bookings |
| http://localhost:3001/api/pricing-configs | View all pricing configs |

### Stripe Test Cards

| Card Number | Result |
|-------------|--------|
| 4242 4242 4242 4242 | Success |
| 4000 0000 0000 0002 | Declined |
| 4000 0025 0000 3155 | Requires 3D Secure |

### View SQLite Database

Open `standalone/data/smoobu.db` in VS Code with SQLite Viewer extension.

---

## Files Changed This Session (Session 4)

| File | Change |
|------|--------|
| `standalone/database/sqlite.js` | Added address columns + check-in settings columns + migrations |
| `standalone/database/repositories/bookings.js` | Added address fields to INSERT statement |
| `standalone/routes/bookings.js` | Added address fields to `/by-payment/:id` response |
| `standalone/routes/payments.js` | Pass address fields when creating booking |
| `standalone/routes/settings.js` | Added `POST /api/settings/checkin` public endpoint |
| `standalone/services/email.js` | Added address and guest fee breakdown to admin email |
| `src/components/hooks/useBookingForm.js` | Rewrote `calculateGuestFees` with per-night breakdown |
| `src/components/hooks/useCheckinSettings.js` | NEW - Hook for fetching check-in settings |
| `src/components/booking/PriceDetails.jsx` | Added adult/child guest fee breakdown display |
| `src/components/booking/PropertyDetails.jsx` | Updated `getGuestFeeInfo` for adult/child display |
| `src/components/booking/TimeSelect.jsx` | Uses `useCheckinSettings` for dynamic time slots |
| `src/components/BookingConfirmation.jsx` | Added adult/child guest fee display |
| `src/components/DynamicRoomsTest/DynamicRoomsPage.jsx` | Added Check-in Time Settings UI |
| `src/translations/fr.json` | Added guest fee breakdown translation keys |
| `src/translations/en.json` | Added guest fee breakdown translation keys |

---

## Files Changed Previous Session (Session 3)

| File | Change |
|------|--------|
| `.env.development` | Fixed Stripe publishable key to match backend account |
| `standalone/database/sqlite.js` | Added `arrival_time` column + migration |
| `standalone/database/repositories/bookings.js` | Added null handling, `arrival_time` field |
| `standalone/routes/bookings.js` | Added `/by-payment/:paymentIntentId` public endpoint, **added `arrivalTime` to response** |
| `standalone/routes/payments.js` | Added `arrivalTime` to booking save, email on success |
| `standalone/routes/smoobu.js` | Added SQLite booking check in `/api/rates` |
| `standalone/services/email.js` | NEW - Email service with admin notification, **added arrival time to admin & guest emails** |
| `src/components/booking/BookingForm.jsx` | Added `roomName` to formData on room select |
| `src/components/hooks/useBookingForm.js` | Added `roomName` to initial state |
| `src/components/BookingConfirmation.jsx` | Updated to use `/api/bookings/by-payment/:id` |
| `src/components/booking/PropertyDetails.jsx` | Fixed scrollTo syntax |

---

## Database Schema Updates

### bookings table - New Columns (Session 3 & 4)
```sql
-- Session 3
ALTER TABLE bookings ADD COLUMN arrival_time TEXT;

-- Session 4: Address fields
ALTER TABLE bookings ADD COLUMN street TEXT;
ALTER TABLE bookings ADD COLUMN postal_code TEXT;
ALTER TABLE bookings ADD COLUMN city TEXT;
ALTER TABLE bookings ADD COLUMN country TEXT;
```

### property_settings table - New Columns (Session 4)
```sql
-- Check-in time settings
ALTER TABLE property_settings ADD COLUMN checkin_start_time TEXT DEFAULT '17:00';
ALTER TABLE property_settings ADD COLUMN checkin_end_time TEXT DEFAULT '22:00';
ALTER TABLE property_settings ADD COLUMN checkin_slot_interval INTEGER DEFAULT 30;
```

These migrations run automatically on server start for existing databases.
