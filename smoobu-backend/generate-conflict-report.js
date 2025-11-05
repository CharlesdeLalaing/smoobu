import { db } from "./firebase-config.js";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

console.log("=".repeat(80));
console.log("           SPA BOOKING CONFLICTS - DETAILED RESOLUTION REPORT");
console.log("=".repeat(80));
console.log("\n");

async function generateConflictReport() {
  try {
    const conflicts = [];

    // Get all bookings with SPA
    const allBookingsSnap = await db.collection('bookings')
      .where('spaDateString', '!=', null)
      .get();

    // Get all WordPress bookings
    const allWpBookingsSnap = await db.collection('spaBookings').get();

    // Build a map of slots by date
    const dateSlotMap = {};

    // Add Smoobu bookings
    allBookingsSnap.forEach(doc => {
      const data = doc.data();
      const date = data.spaDateString;
      const slots = data.spaSlots || [];

      if (!dateSlotMap[date]) {
        dateSlotMap[date] = { smoobu: [], wordpress: [] };
      }

      slots.forEach(slot => {
        dateSlotMap[date].smoobu.push({
          slot: slot,
          reservationId: data.smoobuReservationId,
          docId: doc.id,
          guestName: data.guestName || `${data.firstName} ${data.lastName}`,
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          phone: data.phone,
          property: data.property,
          arrivalDate: data.arrivalDate,
          departureDate: data.departureDate,
          allSlots: data.spaSlots,
          spaInfo: data.spaInfo
        });
      });
    });

    // Add WordPress bookings
    allWpBookingsSnap.forEach(doc => {
      const data = doc.data();
      const date = data.date;
      const time = data.time;
      const isTest = data.isTemporary === true && data.testBooking === true;

      if (!isTest && date && time) {
        if (!dateSlotMap[date]) {
          dateSlotMap[date] = { smoobu: [], wordpress: [] };
        }

        dateSlotMap[date].wordpress.push({
          slot: time,
          docId: doc.id,
          source: 'WordPress',
          createdAt: data.createdAt,
          allData: data
        });
      }
    });

    // Find conflicts
    for (const [date, bookings] of Object.entries(dateSlotMap)) {
      const slotConflicts = {};

      // Check Smoobu vs Smoobu
      const smoobuSlotMap = {};
      bookings.smoobu.forEach(booking => {
        if (!smoobuSlotMap[booking.slot]) {
          smoobuSlotMap[booking.slot] = [];
        }
        smoobuSlotMap[booking.slot].push(booking);
      });

      // Find Smoobu overlaps
      for (const [slot, bookingsList] of Object.entries(smoobuSlotMap)) {
        if (bookingsList.length > 1) {
          conflicts.push({
            type: 'smoobu-smoobu',
            date: date,
            slot: slot,
            bookings: bookingsList
          });
        }
      }

      // Check WordPress vs Smoobu
      bookings.wordpress.forEach(wpBooking => {
        const conflictingSmoobu = bookings.smoobu.filter(
          sb => sb.slot === wpBooking.slot
        );

        if (conflictingSmoobu.length > 0) {
          conflicts.push({
            type: 'wordpress-smoobu',
            date: date,
            slot: wpBooking.slot,
            wordpress: wpBooking,
            smoobu: conflictingSmoobu
          });
        }
      });
    }

    // Generate report
    if (conflicts.length === 0) {
      console.log("✅ No conflicts found!");
      process.exit(0);
    }

    console.log(`Found ${conflicts.length} conflict(s) requiring manual resolution.\n`);
    console.log("=".repeat(80));

    conflicts.forEach((conflict, index) => {
      console.log(`\n${"#".repeat(80)}`);
      console.log(`CONFLICT #${index + 1}`);
      console.log("#".repeat(80));

      // Parse and format the date
      const dateObj = new Date(conflict.date);
      const formattedDate = format(dateObj, "EEEE d MMMM yyyy", { locale: fr });

      console.log(`\n📅 DATE: ${formattedDate} (${conflict.date})`);
      console.log(`⏰ CONFLICTING TIME SLOT: ${conflict.slot}\n`);

      if (conflict.type === 'smoobu-smoobu') {
        console.log(`⚠️  TYPE: Multiple Smoobu bookings at the same time\n`);

        conflict.bookings.forEach((booking, i) => {
          console.log(`${"─".repeat(80)}`);
          console.log(`BOOKING ${i + 1}/${conflict.bookings.length}`);
          console.log("─".repeat(80));
          console.log(`\n📋 RESERVATION ID: ${booking.reservationId}`);
          console.log(`👤 GUEST: ${booking.guestName}`);
          console.log(`📧 EMAIL: ${booking.email}`);
          console.log(`📞 PHONE: ${booking.phone || 'N/A'}`);
          console.log(`🏠 PROPERTY: ${booking.property}`);
          console.log(`📆 STAY: ${booking.arrivalDate} → ${booking.departureDate}`);
          console.log(`🕐 CURRENT SPA BOOKING: ${booking.allSlots.join(', ')}`);

          // Calculate time range
          if (booking.allSlots.length > 0) {
            const startTime = booking.allSlots[0];
            const endSlot = booking.allSlots[booking.allSlots.length - 1];
            // Calculate end time (add 1 hour to last slot)
            const [hours, mins] = endSlot.split(':').map(Number);
            const endTime = `${String(hours + 1).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
            console.log(`🕐 TIME RANGE: ${startTime} à ${endTime} (${booking.allSlots.length} slots)`);
          }
          console.log(`\n📝 Firebase Doc ID: ${booking.docId}`);
        });

        console.log(`\n${"─".repeat(80)}`);
        console.log("💡 RECOMMENDED ACTION:");
        console.log("─".repeat(80));
        console.log("Contact ONE of the guests above and offer alternative time slots.");
        console.log("Priority: Contact the guest with the most flexible schedule or");
        console.log("the one who booked most recently.\n");

      } else if (conflict.type === 'wordpress-smoobu') {
        console.log(`⚠️  TYPE: WordPress booking conflicts with Smoobu booking\n`);

        console.log(`${"─".repeat(80)}`);
        console.log("WORDPRESS BOOKING (External)");
        console.log("─".repeat(80));
        console.log(`\n🌐 SOURCE: WordPress / External System`);
        console.log(`📝 DOCUMENT ID: ${conflict.wordpress.docId}`);
        console.log(`🕐 TIME SLOT: ${conflict.wordpress.slot}`);
        console.log(`📅 CREATED: ${conflict.wordpress.createdAt || 'N/A'}`);
        console.log(`\n⚠️  Note: Guest contact info not available for WordPress bookings.`);
        console.log(`Check your WordPress system for guest details.`);

        conflict.smoobu.forEach((booking, i) => {
          console.log(`\n${"─".repeat(80)}`);
          console.log(`CONFLICTING SMOOBU BOOKING`);
          console.log("─".repeat(80));
          console.log(`\n📋 RESERVATION ID: ${booking.reservationId}`);
          console.log(`👤 GUEST: ${booking.guestName}`);
          console.log(`📧 EMAIL: ${booking.email}`);
          console.log(`📞 PHONE: ${booking.phone || 'N/A'}`);
          console.log(`🏠 PROPERTY: ${booking.property}`);
          console.log(`📆 STAY: ${booking.arrivalDate} → ${booking.departureDate}`);
          console.log(`🕐 CURRENT SPA BOOKING: ${booking.allSlots.join(', ')}`);

          if (booking.allSlots.length > 0) {
            const startTime = booking.allSlots[0];
            const endSlot = booking.allSlots[booking.allSlots.length - 1];
            const [hours, mins] = endSlot.split(':').map(Number);
            const endTime = `${String(hours + 1).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
            console.log(`🕐 TIME RANGE: ${startTime} à ${endTime} (${booking.allSlots.length} slots)`);
          }
          console.log(`\n📝 Firebase Doc ID: ${booking.docId}`);
        });

        console.log(`\n${"─".repeat(80)}`);
        console.log("💡 RECOMMENDED ACTION:");
        console.log("─".repeat(80));
        console.log("1. Check which booking was made first (timestamps)");
        console.log("2. Contact the Smoobu guest OR cancel WordPress booking");
        console.log("3. Offer alternative time slots to the guest you contact\n");
      }

      // Suggest alternative slots
      console.log("─".repeat(80));
      console.log("🔄 SUGGESTED ALTERNATIVE TIME SLOTS:");
      console.log("─".repeat(80));

      // Get all booked slots for this date
      const allBookedSlots = new Set();
      if (dateSlotMap[conflict.date]) {
        dateSlotMap[conflict.date].smoobu.forEach(b => allBookedSlots.add(b.slot));
        dateSlotMap[conflict.date].wordpress.forEach(b => allBookedSlots.add(b.slot));
      }

      // Generate time slots from 09:00 to 23:00
      const possibleSlots = [];
      for (let hour = 9; hour <= 23; hour++) {
        const slot = `${String(hour).padStart(2, '0')}:00`;
        if (!allBookedSlots.has(slot)) {
          possibleSlots.push(slot);
        }
      }

      if (possibleSlots.length > 0) {
        console.log("\nAvailable time slots on this date:");
        const slotsPerLine = 6;
        for (let i = 0; i < possibleSlots.length; i += slotsPerLine) {
          const line = possibleSlots.slice(i, i + slotsPerLine);
          console.log(`  ${line.join('   ')}`);
        }

        console.log(`\n💡 For a 2-hour booking, suggest consecutive pairs like:`);
        const pairs = [];
        for (let i = 0; i < possibleSlots.length - 1; i++) {
          const slot1 = possibleSlots[i];
          const [h1] = slot1.split(':').map(Number);
          const slot2 = `${String(h1 + 1).padStart(2, '0')}:00`;
          if (possibleSlots.includes(slot2)) {
            pairs.push(`${slot1}-${String(h1 + 2).padStart(2, '0')}:00`);
          }
        }
        if (pairs.length > 0) {
          console.log(`  ${pairs.slice(0, 5).join('   ')}`);
          if (pairs.length > 5) console.log(`  ... and ${pairs.length - 5} more options`);
        }
      } else {
        console.log("\n⚠️  This date is fully booked. Suggest a different date.");
      }
    });

    console.log(`\n\n${"=".repeat(80)}`);
    console.log("SUMMARY");
    console.log("=".repeat(80));

    const smoobuConflicts = conflicts.filter(c => c.type === 'smoobu-smoobu').length;
    const wpConflicts = conflicts.filter(c => c.type === 'wordpress-smoobu').length;

    console.log(`\nTotal Conflicts: ${conflicts.length}`);
    console.log(`  • Smoobu vs Smoobu: ${smoobuConflicts}`);
    console.log(`  • WordPress vs Smoobu: ${wpConflicts}`);

    console.log("\n📋 NEXT STEPS:");
    console.log("  1. Review each conflict above");
    console.log("  2. Contact the guests using the email/phone provided");
    console.log("  3. Offer alternative time slots from the suggestions");
    console.log("  4. Update the bookings in your admin panel or Firebase");
    console.log("  5. Verify no conflicts remain after changes\n");

    console.log("=".repeat(80));
    console.log("\n✅ Report generation complete!\n");

    process.exit(0);
  } catch (error) {
    console.error('❌ Error generating report:', error);
    process.exit(1);
  }
}

generateConflictReport();
