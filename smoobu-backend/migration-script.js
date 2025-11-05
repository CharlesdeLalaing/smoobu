import { db } from "./firebase-config.js"; // Make sure this path points to your admin Firebase config
import { format } from "date-fns";

console.log(
  "--- Starting FINAL Firestore Migration Script for spaDateString ---"
);

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

async function runMigration() {
  try {
    const bookingsRef = db.collection("bookings");

    console.log(
      "Querying for bookings that have 'spaDateTime' but have missing or null 'spaDateString'..."
    );

    // We still query this way to narrow down the documents we need to check
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
      `Found ${docsToUpdate.length} booking(s) that need the spaDateString field.`
    );

    const batchSize = 400;
    let commitCounter = 0;

    for (let i = 0; i < docsToUpdate.length; i += batchSize) {
      const batch = db.batch();
      const chunk = docsToUpdate.slice(i, i + batchSize);
      console.log(
        `\nProcessing batch #${i / batchSize + 1} of ${Math.ceil(
          docsToUpdate.length / batchSize
        )} (size: ${chunk.length})...`
      );

      chunk.forEach((doc) => {
        const bookingData = doc.data();
        const docId = doc.id;

        // Use our new robust parser
        const jsDate = parseDate(bookingData.spaDateTime);

        if (jsDate && !isNaN(jsDate.getTime())) {
          // Check if the parsing was successful
          const newSpaDateString = format(jsDate, "yyyy-MM-dd");

          console.log(
            `  - SUCCESS: Preparing update for doc [${docId}]: Set spaDateString to "${newSpaDateString}"`
          );

          const docRef = bookingsRef.doc(docId);
          batch.update(docRef, { spaDateString: newSpaDateString });
        } else {
          console.warn(
            `  - SKIPPING doc [${docId}]: Could not parse 'spaDateTime'. Value:`,
            JSON.stringify(bookingData.spaDateTime)
          );
        }
      });

      // Commit this batch of updates to Firestore
      await batch.commit();
      commitCounter += chunk.length;
      console.log(`✅ Batch committed successfully.`);
    }

    console.log(`\n--- Migration Complete! ---`);
    console.log(`Successfully processed ${commitCounter} documents.`);
  } catch (error) {
    console.error("❌ An error occurred during the migration:", error);
  }
}

// Run the migration function
runMigration();
