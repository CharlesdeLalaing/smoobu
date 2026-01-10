// Script to backup November and December 2025 reservations from Firebase
// Run with: node debug/backup-nov-dec-2025.js

import { db } from '../smoobu-backend/firebase-config.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Bug reservation IDs to specifically track
const BUG_RESERVATION_IDS = [
  '110229666', // Nov: 275€ vs 245€
  '120163346', // Dec: 334€ vs 330€
  '120252316', // Dec: 750€ vs 710€ (Airbnb management fee)
  '119673136', // Dec: 315€ vs 355€
  '93687759',  // Dec: 70€ vs 1297€ (collaboration booking)
  '119462811', // Dec: 460€ vs 500€ (person extra)
  '113496046', // Dec: 414€ vs 374€
];

async function backupNovDecBookings() {
  console.log('Starting backup of November and December 2025 reservations...\n');

  try {
    // Query bookings for November 2025
    console.log('Fetching November 2025 bookings...');
    const novSnapshot = await db.collection('bookings')
      .where('arrivalDate', '>=', '2025-11-01')
      .where('arrivalDate', '<=', '2025-11-30')
      .get();

    // Query bookings for December 2025
    console.log('Fetching December 2025 bookings...');
    const decSnapshot = await db.collection('bookings')
      .where('arrivalDate', '>=', '2025-12-01')
      .where('arrivalDate', '<=', '2025-12-31')
      .get();

    const novBookings = {};
    const decBookings = {};
    const bugBookings = {};

    // Process November bookings
    novSnapshot.forEach((doc) => {
      const data = doc.data();
      const smoobuId = data.smoobuId || doc.id;
      novBookings[smoobuId] = {
        firebaseDocId: doc.id,
        ...data
      };

      // Check if this is a bug reservation
      if (BUG_RESERVATION_IDS.includes(smoobuId)) {
        bugBookings[smoobuId] = novBookings[smoobuId];
      }
    });

    // Process December bookings
    decSnapshot.forEach((doc) => {
      const data = doc.data();
      const smoobuId = data.smoobuId || doc.id;
      decBookings[smoobuId] = {
        firebaseDocId: doc.id,
        ...data
      };

      // Check if this is a bug reservation
      if (BUG_RESERVATION_IDS.includes(smoobuId)) {
        bugBookings[smoobuId] = decBookings[smoobuId];
      }
    });

    // Create backup object
    const backup = {
      timestamp: new Date().toISOString(),
      dateRange: {
        start: '2025-11-01',
        end: '2025-12-31'
      },
      counts: {
        november: Object.keys(novBookings).length,
        december: Object.keys(decBookings).length,
        bugReservations: Object.keys(bugBookings).length
      },
      november: novBookings,
      december: decBookings,
      bugReservations: bugBookings
    };

    // Save to file
    const filename = path.join(__dirname, 'baseline-nov-dec-2025.json');
    fs.writeFileSync(filename, JSON.stringify(backup, null, 2));

    console.log('\n=== BACKUP COMPLETE ===');
    console.log(`November bookings: ${backup.counts.november}`);
    console.log(`December bookings: ${backup.counts.december}`);
    console.log(`Bug reservations found: ${backup.counts.bugReservations}`);
    console.log(`\nSaved to: ${filename}`);

    // Print summary of bug reservations
    console.log('\n=== BUG RESERVATIONS SUMMARY ===');
    for (const id of BUG_RESERVATION_IDS) {
      if (bugBookings[id]) {
        const b = bugBookings[id];
        console.log(`\n#${id}:`);
        console.log(`  Guest: ${b.guestName || 'N/A'}`);
        console.log(`  Arrival: ${b.arrivalDate}`);
        console.log(`  Property: ${b.property || 'N/A'}`);
        console.log(`  Portal: ${b.portalName || b.channelName || 'N/A'}`);
        console.log(`  Stored Price: ${b.price}€`);
        console.log(`  Base Price: ${b.priceDetails?.basePrice || b.basePrice || 0}€`);
        console.log(`  Extras Total: ${b.priceDetails?.extrasTotal || 'N/A'}`);
        console.log(`  Price Elements: ${b.priceDetails?.priceElements?.length || 0} items`);
      } else {
        console.log(`\n#${id}: NOT FOUND in Firebase`);
      }
    }

    process.exit(0);
  } catch (error) {
    console.error('Error backing up bookings:', error);
    process.exit(1);
  }
}

backupNovDecBookings();
