import { db } from "./firebase-config.js";
import { format } from "date-fns";

console.log(
  "--- DRY RUN: Firestore Migration Script for spaDateString ---"
);
console.log("This will NOT make any changes to your database.\n");

// A helper function to safely parse a date from different formats
function parseDate(value) {
  if (!value) return null;

  // Case 1: It's a real Firestore Timestamp
  if (value.toDate && typeof value.toDate === "function") {
    return value.toDate();
  }

  // Case 2: It's a plain object with _seconds or seconds
  if (
    typeof value === "object" &&
    (value._seconds !== undefined || value.seconds !== undefined)
  ) {
    const seconds =
      value._seconds !== undefined ? value._seconds : value.seconds;
    if (typeof seconds === "number") {
      return new Date(seconds * 1000);
    }
  }

  // Case 3: It might be an ISO string
  if (typeof value === "string") {
    const date = new Date(value);
    if (!isNaN(date.getTime())) {
      return date;
    }
  }

  return null; // Could not parse
}

async function runDryRun() {
  try {
    const bookingsRef = db.collection("bookings");

    console.log(
      "Querying for bookings that have 'spaDateTime' but have missing or null 'spaDateString'...\n"
    );

    const snapshot = await bookingsRef.where("spaDateTime", "!=", null).get();

    // Filter for documents where spaDateString is missing (undefined) OR null
    const docsToUpdate = snapshot.docs.filter((doc) => {
      const spaDateString = doc.data().spaDateString;
      return spaDateString === undefined || spaDateString === null;
    });

    if (docsToUpdate.length === 0) {
      console.log("✅ No documents found that need updating.");
      return;
    }

    console.log(
      `Found ${docsToUpdate.length} booking(s) that would be updated:\n`
    );
    console.log("=" .repeat(80));

    let successCount = 0;
    let skipCount = 0;

    docsToUpdate.forEach((doc) => {
      const bookingData = doc.data();
      const docId = doc.id;

      // Use our robust parser
      const jsDate = parseDate(bookingData.spaDateTime);

      if (jsDate && !isNaN(jsDate.getTime())) {
        const newSpaDateString = format(jsDate, "yyyy-MM-dd");

        console.log(`\n📋 Reservation ${bookingData.smoobuReservationId || 'N/A'} (Doc: ${docId})`);
        console.log(`   Current spaDateString: ${bookingData.spaDateString}`);
        console.log(`   Would set to: ${newSpaDateString}`);
        console.log(`   SPA Slots: ${JSON.stringify(bookingData.spaSlots)}`);
        console.log(`   Guest: ${bookingData.guestName || 'N/A'}`);

        successCount++;
      } else {
        console.log(`\n⚠️  WOULD SKIP Reservation ${bookingData.smoobuReservationId || 'N/A'} (Doc: ${docId})`);
        console.log(`   Reason: Could not parse 'spaDateTime'`);
        console.log(`   Value: ${JSON.stringify(bookingData.spaDateTime)}`);
        skipCount++;
      }
    });

    console.log("\n" + "=".repeat(80));
    console.log(`\n📊 DRY RUN SUMMARY:`);
    console.log(`   ✅ Would successfully update: ${successCount} bookings`);
    console.log(`   ⚠️  Would skip: ${skipCount} bookings`);
    console.log(`\n⚠️  NOTE: This was a DRY RUN - NO changes were made to the database.`);
    console.log(`   To apply these changes, run: node smoobu-backend/migration-script.js\n`);

  } catch (error) {
    console.error("❌ An error occurred during the dry run:", error);
  } finally {
    process.exit(0);
  }
}

// Run the dry run function
runDryRun();
