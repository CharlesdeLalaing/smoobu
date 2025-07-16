import { db } from "./firebase-config.js";
import fs from "fs";

async function restoreDatabase(backupFile) {
  try {
    console.log(`🔄 Starting database restore from: ${backupFile}`);

    // Read backup file
    const backupData = JSON.parse(fs.readFileSync(backupFile, "utf8"));

    if (!backupData.bookings) {
      throw new Error("No bookings data found in backup file");
    }

    // Restore bookings
    const batch = db.batch();
    let restoredCount = 0;

    for (const [docId, data] of Object.entries(backupData.bookings)) {
      const docRef = db.collection("bookings").doc(docId);
      batch.set(docRef, data);
      restoredCount++;
    }

    await batch.commit();

    console.log(`✅ Restored ${restoredCount} bookings from backup`);
  } catch (error) {
    console.error("🟥 Restore failed:", error);
    throw error;
  }
}

// Usage: node restore-database.js backup-filename.json
const backupFile = process.argv[2];
if (!backupFile) {
  console.error("Usage: node restore-database.js <backup-file.json>");
  process.exit(1);
}

restoreDatabase(backupFile).catch(console.error);
