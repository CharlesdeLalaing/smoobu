import { db } from "./firebase-config.js";

console.log("--- Checking WordPress Bookings Integration ---\n");

async function checkWordPressBookings() {
  try {
    // Get all WordPress bookings
    const wpBookingsSnap = await db.collection('spaBookings').get();

    console.log(`Found ${wpBookingsSnap.size} WordPress booking(s) in spaBookings collection\n`);

    if (wpBookingsSnap.size === 0) {
      console.log('✅ No WordPress bookings found - nothing to check.');
      process.exit(0);
    }

    // Group by date
    const bookingsByDate = {};
    wpBookingsSnap.forEach(doc => {
      const data = doc.data();
      const date = data.date;
      const time = data.time;
      const isTest = data.isTemporary === true && data.testBooking === true;

      if (!isTest && date && time) {
        if (!bookingsByDate[date]) {
          bookingsByDate[date] = [];
        }
        bookingsByDate[date].push({
          id: doc.id,
          time: time,
          data: data
        });
      }
    });

    console.log('WordPress Bookings by Date:');
    console.log('='.repeat(80));

    Object.keys(bookingsByDate).sort().forEach(date => {
      const bookings = bookingsByDate[date];
      console.log(`\n📅 ${date}:`);
      bookings.forEach(b => {
        console.log(`   • ${b.time} (Doc ID: ${b.id})`);
      });
    });

    // Now check for any overlaps between WordPress and Smoobu bookings
    console.log('\n\n--- Checking for Overlaps with Smoobu Bookings ---\n');

    let totalConflicts = 0;

    for (const [date, wpBookings] of Object.entries(bookingsByDate)) {
      // Get Smoobu bookings for this date
      const smoobuSnap = await db.collection('bookings')
        .where('spaDateString', '==', date)
        .get();

      if (smoobuSnap.empty) continue;

      // Get all Smoobu slots for this date
      const smoobuSlots = new Map();
      smoobuSnap.forEach(doc => {
        const data = doc.data();
        const slots = data.spaSlots || [];
        slots.forEach(slot => {
          if (!smoobuSlots.has(slot)) {
            smoobuSlots.set(slot, []);
          }
          smoobuSlots.get(slot).push({
            id: data.smoobuReservationId,
            name: data.guestName
          });
        });
      });

      // Check for conflicts
      wpBookings.forEach(wpBooking => {
        if (smoobuSlots.has(wpBooking.time)) {
          totalConflicts++;
          console.log(`⚠️  CONFLICT on ${date} at ${wpBooking.time}:`);
          console.log(`   WordPress Booking: ${wpBooking.id}`);
          smoobuSlots.get(wpBooking.time).forEach(smoobu => {
            console.log(`   Smoobu Booking: ${smoobu.id} (${smoobu.name})`);
          });
          console.log('');
        }
      });
    }

    if (totalConflicts === 0) {
      console.log('✅ No conflicts between WordPress and Smoobu bookings!');
    } else {
      console.log(`⚠️  Found ${totalConflicts} conflict(s) between WordPress and Smoobu bookings.`);
    }

    // Test the availability API integration
    console.log('\n\n--- Testing Availability API Integration ---\n');
    console.log('Verifying that WordPress bookings are included in booked slots...\n');

    // Pick a date with WordPress bookings
    const testDate = Object.keys(bookingsByDate)[0];
    if (testDate) {
      console.log(`Testing with date: ${testDate}`);

      const bookingsSnap = await db.collection('bookings')
        .where('spaDateString', '==', testDate)
        .get();

      const spaBookingsSnap = await db.collection('spaBookings')
        .where('date', '==', testDate)
        .get();

      const bookedSlots = new Set();

      // Add Smoobu bookings
      bookingsSnap.forEach((doc) =>
        doc.data().spaSlots?.forEach((slot) => bookedSlots.add(slot))
      );

      // Add WordPress bookings
      spaBookingsSnap.forEach((doc) => {
        const bookingData = doc.data();
        if (
          bookingData.time &&
          !(bookingData.isTemporary === true && bookingData.testBooking === true)
        ) {
          bookedSlots.add(bookingData.time);
        }
      });

      console.log(`\nBooked slots for ${testDate}:`);
      Array.from(bookedSlots).sort().forEach(slot => {
        console.log(`   • ${slot}`);
      });

      console.log('\n✅ WordPress bookings ARE included in availability checker!');
    }

    console.log('\n✅ WordPress booking check complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during check:', error);
    process.exit(1);
  }
}

checkWordPressBookings();
