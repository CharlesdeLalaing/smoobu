import { db } from "./firebase-config.js";
import fs from "fs";

async function backupDatabase() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupData = {};

  try {
    console.log("🔄 Starting database backup...");

    // Backup bookings collection
    const bookingsSnapshot = await db.collection("bookings").get();
    backupData.bookings = {};

    bookingsSnapshot.forEach((doc) => {
      backupData.bookings[doc.id] = doc.data();
    });

    console.log(`✅ Backed up ${bookingsSnapshot.size} bookings`);

    // Add other collections as needed
    // const otherSnapshot = await db.collection("other").get();
    // backupData.other = {};
    // otherSnapshot.forEach(doc => {
    //   backupData.other[doc.id] = doc.data();
    // });

    // Save to file
    const filename = `backup-${timestamp}.json`;
    fs.writeFileSync(filename, JSON.stringify(backupData, null, 2));

    console.log(`✅ Backup saved to: ${filename}`);
    console.log(
      `📊 Total collections backed up: ${Object.keys(backupData).length}`
    );

    return filename;
  } catch (error) {
    console.error("🟥 Backup failed:", error);
    throw error;
  }
}

// Run backup
backupDatabase().catch(console.error);
