# Smoobu Integration Platform - Architecture & Refactoring Guide

## Table of Contents
1. [Application Overview](#application-overview)
2. [Current Architecture](#current-architecture)
3. [Hardcoded Elements Analysis](#hardcoded-elements-analysis)
4. [Step-by-Step Refactoring Plan](#step-by-step-refactoring-plan)
5. [New Dynamic Architecture](#new-dynamic-architecture)
6. [Implementation Checklist](#implementation-checklist)

---

## Application Overview

### What This Application Does

This is a **full-stack accommodation booking platform** integrated with **Smoobu** (a property management system). The application serves "Ferme de Basseilles" - a luxury glamping/accommodation venue in Belgium.

### Core Features

| Feature | Description |
|---------|-------------|
| **Guest Booking** | Multi-step booking form with calendar availability, room selection, guest counts, extras selection |
| **SPA Scheduling** | Time slot management for spa bookings (17:00-22:00, 30-min increments) |
| **Payment Processing** | Stripe integration for secure payments |
| **Admin Dashboard** | Booking reports, coupon management, extras inventory, SPA calendar |
| **Multi-channel Sync** | Bi-directional sync with Smoobu (Airbnb, Booking.com, direct bookings) |
| **Email Notifications** | Booking confirmation emails via Gmail/Nodemailer |
| **Multi-language** | French, English, Dutch translations |

### Technology Stack

```
Frontend:     React 18 + Vite
Backend:      Express.js (Node.js)
Database:     Firebase Firestore
Payments:     Stripe
PMS:          Smoobu API
Email:        Gmail SMTP / Nodemailer
Hosting:      Vercel (frontend) + Render (backend)
```

---

## Current Architecture

### Directory Structure

```
/src/                           # Frontend (React)
  /components/
    /booking/                   # Main booking form & steps
    /Admin/                     # Dashboard, reports, management
    /spa/                       # SPA scheduling
    /utils/                     # API calls, helpers
    /hooks/                     # Custom React hooks
  /config/                      # i18n, routes, room config
  /contexts/                    # Auth context
  /translations/                # Translation files (fr, en, nl)
  /assets/                      # Images, fonts

/smoobu-backend/                # Backend (Express.js)
  /third-party/
    /smoobu/                    # Smoobu API integration
    /stripe/                    # Stripe webhooks & payment
    /firebase/                  # Firebase operations
    /wordpress/                 # WordPress integration (gift vouchers)
  /helpers/                     # Utilities (pricing, dates)
  /config/                      # Constants (rooms, pricing)
  server.js                     # Main Express app
  firebase-config.js            # Firebase Admin setup
```

### Data Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Frontend  │────▶│   Backend   │────▶│   Smoobu    │
│   (React)   │◀────│  (Express)  │◀────│    API      │
└─────────────┘     └─────────────┘     └─────────────┘
                          │
              ┌───────────┼───────────┐
              ▼           ▼           ▼
        ┌─────────┐ ┌─────────┐ ┌─────────┐
        │Firebase │ │ Stripe  │ │  Gmail  │
        │Firestore│ │   API   │ │  SMTP   │
        └─────────┘ └─────────┘ └─────────┘
```

---

## Hardcoded Elements Analysis

### Critical Hardcoded Values

#### 1. Room/Apartment IDs (Smoobu)

**Current hardcoded values in `/src/config/config.js` and `/src/components/hooks/roomsData.js`:**

| Room Name | Smoobu ID | Max Guests | Extra Guest Fee |
|-----------|-----------|------------|-----------------|
| Le Dôme des Libellules | 1946282 | 4 | 20€/night after 2 guests |
| La Bulle Romantique | 1644643 | 2 | None |
| Le Moulin | 1946279 | 4 | 20€/night after 2 guests |
| La Chambre de Blé | 1946276 | 4 | 20€/night after 2 guests |
| Le Logis du Meunier | 1946270 | 10 | 20€/night after 4 guests |
| La Cabane dans les Arbres | 2565753 | 2 | None |

#### 2. Pricing Rules (Per Room)

```javascript
// /smoobu-backend/config/room-config.js
const ROOM_CONFIGS = {
  1946282: { extraGuestFee: 20, freeGuests: 2, longStayDiscount: 0 },
  1644643: { extraGuestFee: 0, freeGuests: 2, longStayDiscount: 0 },
  1946279: { extraGuestFee: 20, freeGuests: 2, longStayDiscount: 0.40, minNightsForDiscount: 2 },
  // ... etc
}
```

#### 3. Extras & Packages

**Location: `/src/components/extraCategoriesData.js`**

| Category | Examples | Price Range |
|----------|----------|-------------|
| Packs | L'essentiel, Détente gourmet, Romantique | 85€ - 250€ |
| Formulas | Breakfast, Gourmet, Raclette, Barbecue | 35€ - 85€ |
| SPA | Formule SPA, SPA + bottle | Varies by room |
| Drinks | Wine, Beer, Soft drinks | Variable |
| Meals | Poulet Tikka, Risotto, Linguines | Variable |

#### 4. API Endpoints & Domains

```javascript
// Hardcoded in multiple files
const SMOOBU_API = 'https://login.smoobu.com/api/';
const BACKEND_URL = 'https://spatest.onrender.com';
const FIREBASE_PROJECT = 'ferme-de-basseilles-9c7ff';

// CORS origins in server.js
const allowedOrigins = [
  'http://localhost:5173',
  'https://reservation.fermedebasseilles.be',
  'https://smoobu-test.vercel.app',
  'https://spa-test-beige.vercel.app'
];
```

#### 5. SPA Configuration

```javascript
// /src/components/utils/constants.js
const SPA_START_TIME = '17:00';
const SPA_END_TIME = '22:00';
const SLOT_DURATION = 30; // minutes
const TIME_SLOTS = ['17:00', '17:30', '18:00', ...];
```

#### 6. Business Rules

```javascript
// Hardcoded throughout the codebase
const MIN_BOOKING_DAYS_AHEAD = 1;
const CLEANING_FEE = 0;
const TIMEZONE = 'Europe/Brussels';
const EXTRA_PERSON_FEE_FOR_PACKAGES = 20;
```

#### 7. Email Templates

- Hardcoded property name: "Ferme de Basseilles"
- Hardcoded sender: `bookingfermedebasseilles@gmail.com`
- Hardcoded branding/colors in templates

---

## Step-by-Step Refactoring Plan

### Phase 1: Create Central Configuration System

#### Step 1.1: Create a Property Configuration Schema

Create a new file `/smoobu-backend/config/property-config.schema.js`:

```javascript
const PropertyConfigSchema = {
  property: {
    name: String,           // "Ferme de Basseilles"
    slug: String,           // "ferme-de-basseilles"
    timezone: String,       // "Europe/Brussels"
    currency: String,       // "EUR"
    locale: String,         // "fr-BE"
    supportedLanguages: [String],  // ["fr", "en", "nl"]
  },

  smoobu: {
    apiKey: String,         // From environment
    baseUrl: String,        // "https://login.smoobu.com/api/"
  },

  rooms: [{
    smoobuId: Number,       // 1946282
    name: String,           // "Le Dôme des Libellules"
    slug: String,           // "dome-libellules"
    maxGuests: Number,      // 4
    maxChildren: Number,    // 2
    freeGuests: Number,     // 2
    extraGuestFee: Number,  // 20
    cleaningFee: Number,    // 0
    minNights: Number,      // 1
    longStayDiscount: {
      percentage: Number,   // 0.40 (40%)
      minNights: Number,    // 2
    },
    amenities: [String],    // ["spa", "breakfast", "wifi"]
    images: [String],       // URLs
  }],

  extras: [{
    id: String,
    category: String,       // "pack", "formula", "spa", "drink", "meal"
    name: Object,           // { fr: "...", en: "...", nl: "..." }
    price: Number,
    perPerson: Boolean,
    extraPersonFee: Number,
    availableForRooms: [Number],  // Smoobu IDs or null for all
    maxQuantity: Number,
  }],

  spa: {
    enabled: Boolean,
    startTime: String,      // "17:00"
    endTime: String,        // "22:00"
    slotDuration: Number,   // 30
    treatments: [{
      id: String,
      name: Object,
      duration: Number,
      price: Number,
    }],
  },

  booking: {
    minDaysAhead: Number,   // 1
    maxDaysAhead: Number,   // 365
    defaultAdults: Number,  // 2
    defaultChildren: Number,// 0
    maxAdults: Number,      // 10
    maxChildren: Number,    // 10
  },

  payments: {
    provider: String,       // "stripe"
    currency: String,       // "eur"
    depositPercentage: Number,  // 100 (full payment)
  },

  email: {
    provider: String,       // "gmail"
    from: String,           // "booking@property.com"
    templates: {
      confirmation: String,
      cancellation: String,
    },
  },

  branding: {
    logo: String,
    primaryColor: String,
    secondaryColor: String,
  },
};
```

#### Step 1.2: Create Admin Interface for Configuration

Build a new admin page to manage property configuration:

```
/src/components/Admin/PropertyConfig/
  PropertyConfigPage.jsx      # Main config editor
  RoomConfigEditor.jsx        # Add/edit rooms
  ExtrasConfigEditor.jsx      # Manage extras catalog
  SpaConfigEditor.jsx         # SPA settings
  BrandingConfigEditor.jsx    # Colors, logo, name
```

#### Step 1.3: Store Configuration in Firebase

Create a new Firestore collection `propertyConfig`:

```javascript
// Collection: propertyConfig
// Document: "settings" (single document per property)
{
  property: { ... },
  rooms: [ ... ],
  extras: [ ... ],
  spa: { ... },
  booking: { ... },
  // etc.
}
```

### Phase 2: Auto-Sync Rooms from Smoobu

#### Step 2.1: Create Room Sync Endpoint

```javascript
// /smoobu-backend/third-party/smoobu/sync-apartments.js

async function syncApartmentsFromSmoobu() {
  // 1. Fetch all apartments from Smoobu API
  const response = await fetch('https://login.smoobu.com/api/apartments', {
    headers: { 'Api-Key': process.env.SMOOBU_API_KEY }
  });
  const apartments = await response.json();

  // 2. For each apartment, create/update room config
  for (const apt of apartments.apartments) {
    await createOrUpdateRoomConfig({
      smoobuId: apt.id,
      name: apt.name,
      maxGuests: apt.maxOccupancy,
      // Set defaults for new rooms
      extraGuestFee: 0,
      freeGuests: 2,
      cleaningFee: 0,
    });
  }

  // 3. Return list of synced rooms for admin review
  return apartments;
}
```

#### Step 2.2: Add "Import from Smoobu" Button in Admin

```jsx
// In RoomConfigEditor.jsx
const handleImportFromSmoobu = async () => {
  const apartments = await api.get('/admin/sync-apartments');
  // Show modal with imported rooms
  // Admin can then customize pricing/settings
};
```

### Phase 3: Dynamic Extras Management

#### Step 3.1: Move Extras to Database

Instead of hardcoded `extraCategoriesData.js`, store in Firebase:

```javascript
// Collection: extras
{
  id: "pack-essentiel",
  category: "pack",
  name: {
    fr: "L'essentiel",
    en: "The Essential",
    nl: "Het Essentiële"
  },
  description: {
    fr: "Petit-déjeuner + formule SPA...",
    en: "Breakfast + SPA formula...",
    nl: "Ontbijt + SPA formule..."
  },
  basePrice: 85,
  perPerson: true,
  extraPersonFee: 20,
  availableForRooms: null, // null = all rooms
  isActive: true,
  sortOrder: 1,
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

#### Step 3.2: Create Extras Management UI

```
/src/components/Admin/Extras/
  ExtrasListPage.jsx          # List all extras
  ExtrasForm.jsx              # Add/edit extra
  ExtrasCategoryFilter.jsx    # Filter by category
  ExtrasRoomAssignment.jsx    # Assign to specific rooms
```

#### Step 3.3: Update Frontend to Fetch Extras Dynamically

```javascript
// /src/hooks/useExtras.js
const useExtras = (roomId) => {
  const [extras, setExtras] = useState([]);

  useEffect(() => {
    const fetchExtras = async () => {
      const response = await api.get(`/extras?roomId=${roomId}`);
      setExtras(response.data);
    };
    fetchExtras();
  }, [roomId]);

  return extras;
};
```

### Phase 4: Environment-Based Configuration

#### Step 4.1: Restructure Environment Variables

```env
# .env.example

# === REQUIRED: API Keys ===
SMOOBU_API_KEY=your_smoobu_api_key
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_xxx

# === REQUIRED: Firebase ===
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# === REQUIRED: Email ===
EMAIL_PROVIDER=gmail  # or "sendgrid", "mailgun"
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password

# === OPTIONAL: Defaults ===
DEFAULT_TIMEZONE=Europe/Brussels
DEFAULT_CURRENCY=EUR
DEFAULT_LOCALE=fr

# === DEPLOYMENT ===
VITE_API_URL=https://your-backend.com
ALLOWED_ORIGINS=https://your-frontend.com,http://localhost:5173
```

#### Step 4.2: Create Config Loader

```javascript
// /smoobu-backend/config/config-loader.js

class ConfigLoader {
  constructor() {
    this.config = null;
  }

  async load() {
    // 1. Load from environment (API keys, secrets)
    const envConfig = this.loadFromEnv();

    // 2. Load from Firebase (property settings)
    const dbConfig = await this.loadFromFirebase();

    // 3. Merge with defaults
    this.config = {
      ...this.getDefaults(),
      ...dbConfig,
      ...envConfig,  // Env vars override DB
    };

    return this.config;
  }

  loadFromEnv() {
    return {
      smoobu: {
        apiKey: process.env.SMOOBU_API_KEY,
      },
      stripe: {
        secretKey: process.env.STRIPE_SECRET_KEY,
        webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
      },
      firebase: {
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY,
      },
      email: {
        provider: process.env.EMAIL_PROVIDER || 'gmail',
        user: process.env.EMAIL_USER,
        password: process.env.EMAIL_PASSWORD,
      },
    };
  }

  async loadFromFirebase() {
    const doc = await db.collection('propertyConfig').doc('settings').get();
    return doc.exists ? doc.data() : {};
  }

  getDefaults() {
    return {
      property: {
        timezone: 'Europe/Brussels',
        currency: 'EUR',
        locale: 'fr',
      },
      booking: {
        minDaysAhead: 1,
        maxDaysAhead: 365,
        defaultAdults: 2,
        defaultChildren: 0,
      },
      spa: {
        startTime: '17:00',
        endTime: '22:00',
        slotDuration: 30,
      },
    };
  }
}

module.exports = new ConfigLoader();
```

### Phase 5: Smoobu Onboarding Flow

#### Step 5.1: Create Setup Wizard

Build a first-run setup wizard for new installations:

```
/src/components/Setup/
  SetupWizard.jsx             # Main wizard container
  Step1_SmoobuConnect.jsx     # Enter API key, test connection
  Step2_ImportRooms.jsx       # Auto-import rooms from Smoobu
  Step3_ConfigureRooms.jsx    # Set pricing rules per room
  Step4_SetupExtras.jsx       # Configure extras catalog
  Step5_SetupPayments.jsx     # Connect Stripe
  Step6_SetupEmail.jsx        # Configure email settings
  Step7_Branding.jsx          # Logo, colors, property name
  Step8_Review.jsx            # Review and confirm
```

#### Step 5.2: Smoobu Connection Test

```javascript
// /smoobu-backend/third-party/smoobu/test-connection.js

async function testSmoobuConnection(apiKey) {
  try {
    const response = await fetch('https://login.smoobu.com/api/apartments', {
      headers: { 'Api-Key': apiKey }
    });

    if (!response.ok) {
      return { success: false, error: 'Invalid API key' };
    }

    const data = await response.json();
    return {
      success: true,
      apartmentCount: data.apartments.length,
      apartments: data.apartments.map(a => ({
        id: a.id,
        name: a.name,
        maxOccupancy: a.maxOccupancy
      }))
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
```

### Phase 6: Price Sync from Smoobu

#### Step 6.1: Automatic Rate Import

```javascript
// /smoobu-backend/third-party/smoobu/sync-rates.js

async function syncRatesFromSmoobu(roomId, startDate, endDate) {
  const response = await fetch(
    `https://login.smoobu.com/api/rates?` +
    `apartments[]=${roomId}&` +
    `start_date=${startDate}&` +
    `end_date=${endDate}`,
    { headers: { 'Api-Key': config.smoobu.apiKey } }
  );

  const rates = await response.json();

  // Store in Firebase for quick access
  for (const [date, priceData] of Object.entries(rates.data[roomId])) {
    await db.collection('rates').doc(`${roomId}_${date}`).set({
      roomId,
      date,
      price: priceData.price,
      minStay: priceData.min_length_of_stay,
      available: priceData.available > 0,
      syncedAt: new Date()
    });
  }
}
```

#### Step 6.2: Real-time Availability Check

```javascript
// Instead of hardcoded room IDs, fetch from config
async function checkAvailability(checkIn, checkOut) {
  const config = await configLoader.load();
  const roomIds = config.rooms.map(r => r.smoobuId);

  const availability = await Promise.all(
    roomIds.map(id => fetchSmoobuAvailability(id, checkIn, checkOut))
  );

  return availability;
}
```

---

## New Dynamic Architecture

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        ADMIN DASHBOARD                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│  │  Rooms   │ │  Extras  │ │   SPA    │ │ Branding │           │
│  │  Config  │ │  Config  │ │  Config  │ │  Config  │           │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘           │
└───────┼────────────┼────────────┼────────────┼──────────────────┘
        │            │            │            │
        ▼            ▼            ▼            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    FIREBASE FIRESTORE                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ propertyConfig│  │   bookings   │  │    extras    │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │    rooms     │  │    rates     │  │   coupons    │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
        ▲                    ▲                    ▲
        │                    │                    │
┌───────┴────────────────────┴────────────────────┴───────────────┐
│                        EXPRESS BACKEND                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ ConfigLoader │  │ SmoobuSync   │  │ PriceEngine  │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
        ▲                    │                    │
        │                    ▼                    ▼
┌───────┴─────────┐  ┌──────────────┐  ┌──────────────┐
│   Environment   │  │   SMOOBU     │  │    STRIPE    │
│   Variables     │  │     API      │  │     API      │
│  (API Keys)     │  └──────────────┘  └──────────────┘
└─────────────────┘
```

### Key Changes Summary

| Before (Hardcoded) | After (Dynamic) |
|-------------------|-----------------|
| Room IDs in source code | Fetched from Smoobu API + stored in Firebase |
| Extras in JavaScript file | Stored in Firebase `extras` collection |
| Pricing rules per room | Configurable via admin UI |
| SPA hours in constants | Stored in `propertyConfig.spa` |
| Property name in templates | Loaded from `propertyConfig.property.name` |
| Email sender hardcoded | Configurable via environment + config |
| CORS origins hardcoded | Loaded from environment variable |

---

## Implementation Checklist

### Phase 1: Configuration System
- [ ] Create `PropertyConfigSchema` definition
- [ ] Create Firestore `propertyConfig` collection
- [ ] Build `ConfigLoader` utility
- [ ] Create admin Property Config page
- [ ] Add room configuration editor
- [ ] Add extras configuration editor
- [ ] Add SPA configuration editor
- [ ] Add branding configuration editor

### Phase 2: Smoobu Auto-Sync
- [ ] Create `/api/admin/sync-apartments` endpoint
- [ ] Build "Import from Smoobu" UI
- [ ] Implement room auto-discovery
- [ ] Add rate sync functionality
- [ ] Create sync status dashboard

### Phase 3: Dynamic Extras
- [ ] Migrate extras data to Firebase
- [ ] Create extras CRUD API endpoints
- [ ] Build extras management UI
- [ ] Update booking form to fetch extras dynamically
- [ ] Add room-specific extras filtering

### Phase 4: Environment Restructure
- [ ] Create `.env.example` template
- [ ] Update all hardcoded API URLs
- [ ] Make CORS origins configurable
- [ ] Update deployment documentation

### Phase 5: Setup Wizard
- [ ] Build setup wizard components
- [ ] Create Smoobu connection test
- [ ] Implement Stripe connection flow
- [ ] Add email configuration step
- [ ] Create branding customization step

### Phase 6: Testing & Deployment
- [ ] Write tests for ConfigLoader
- [ ] Test with new Smoobu account
- [ ] Document deployment process
- [ ] Create admin user guide

---

## API Endpoints to Create

### Configuration Endpoints

```
GET    /api/config                    # Get public configuration
GET    /api/admin/config              # Get full admin configuration
PUT    /api/admin/config              # Update configuration
POST   /api/admin/config/reset        # Reset to defaults
```

### Room Sync Endpoints

```
POST   /api/admin/sync-apartments     # Import rooms from Smoobu
GET    /api/admin/rooms               # List configured rooms
PUT    /api/admin/rooms/:id           # Update room settings
DELETE /api/admin/rooms/:id           # Remove room
```

### Extras Management Endpoints

```
GET    /api/extras                    # List extras (public)
GET    /api/admin/extras              # List all extras (admin)
POST   /api/admin/extras              # Create extra
PUT    /api/admin/extras/:id          # Update extra
DELETE /api/admin/extras/:id          # Delete extra
```

### Setup Endpoints

```
POST   /api/setup/test-smoobu         # Test Smoobu API connection
POST   /api/setup/test-stripe         # Test Stripe connection
POST   /api/setup/complete            # Complete initial setup
GET    /api/setup/status              # Check if setup is complete
```

---

## Estimated Effort

| Phase | Components | Complexity |
|-------|------------|------------|
| Phase 1 | Config System | Medium |
| Phase 2 | Smoobu Auto-Sync | Medium |
| Phase 3 | Dynamic Extras | Medium |
| Phase 4 | Environment Restructure | Low |
| Phase 5 | Setup Wizard | High |
| Phase 6 | Testing | Medium |

---

## Notes

### Benefits of This Approach

1. **Multi-tenant Ready**: Same codebase can serve multiple properties
2. **No Redeployment**: Changes via admin UI, not code changes
3. **Smoobu-Native**: Rooms and rates sync automatically
4. **Scalable**: Easy to add new properties or features
5. **Maintainable**: Configuration separate from code

### Migration Strategy

For existing installation:
1. Export current hardcoded values to Firebase config
2. Deploy new version with ConfigLoader
3. Verify all functionality works
4. Remove hardcoded files after verification

### Security Considerations

- API keys should NEVER be stored in Firebase (use environment variables)
- Admin routes must be protected with authentication
- Rate limit configuration endpoints
- Validate all configuration inputs
