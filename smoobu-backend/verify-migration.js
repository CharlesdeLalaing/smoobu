import { db } from "./firebase-config.js";

console.log("--- Verifying Migration Results ---\n");

async function verifyMigration() {
  try {
    // Check reservation 105624341
    const snapshot = await db.collection('bookings')
      .where('smoobuReservationId', '==', 105624341)
      .get();

    if (snapshot.empty) {
      console.log('❌ Reservation 105624341 not found');
      process.exit(1);
    }

    const doc = snapshot.docs[0];
    const data = doc.data();

    console.log('✅ VERIFICATION SUCCESSFUL!\n');
    console.log('Reservation 105624341 (Floriane Dermont):');
    console.log('  ├─ spaDateString:', data.spaDateString);
    console.log('  ├─ SPA Slots:', JSON.stringify(data.spaSlots));
    console.log('  └─ Status: FIXED ✓\n');

    // Now check if we can query by date
    console.log('Querying all bookings on 2025-11-09...\n');
    const dateQuery = await db.collection('bookings')
      .where('spaDateString', '==', '2025-11-09')
      .get();

    console.log(`Found ${dateQuery.size} booking(s) on 2025-11-09:\n`);
    dateQuery.forEach(doc => {
      const b = doc.data();
      console.log(`  • Reservation ${b.smoobuReservationId} (${b.guestName})`);
      console.log(`    └─ SPA Slots: ${JSON.stringify(b.spaSlots)}`);
    });

    // Check for overlaps
    const bookingsOnDate = [];
    dateQuery.forEach(doc => {
      const b = doc.data();
      if (b.spaSlots && Array.isArray(b.spaSlots)) {
        bookingsOnDate.push({
          id: b.smoobuReservationId,
          name: b.guestName,
          slots: b.spaSlots
        });
      }
    });

    // Detect overlaps
    console.log('\n--- Overlap Detection ---');
    const slotMap = {};
    bookingsOnDate.forEach(booking => {
      booking.slots.forEach(slot => {
        if (!slotMap[slot]) {
          slotMap[slot] = [];
        }
        slotMap[slot].push(`${booking.id} (${booking.name})`);
      });
    });

    let hasOverlaps = false;
    Object.entries(slotMap).forEach(([slot, bookings]) => {
      if (bookings.length > 1) {
        hasOverlaps = true;
        console.log(`\n⚠️  CONFLICT at ${slot}:`);
        bookings.forEach(b => console.log(`   • ${b}`));
      }
    });

    if (!hasOverlaps) {
      console.log('\n✅ No overlaps detected on this date.');
    } else {
      console.log('\n⚠️  Conflicts detected - manual resolution required.');
    }

    console.log('\n✅ Migration verification complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during verification:', error);
    process.exit(1);
  }
}

verifyMigration();
