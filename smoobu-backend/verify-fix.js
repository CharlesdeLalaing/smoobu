import * as dotenv from "dotenv";
import { SmoobuClient } from "./third-party/smoobu/actions/api/fetch-and-sync/smoobu-client.js";

dotenv.config();

async function verifyFix() {
  console.log("🔍 VERIFYING THE PAGINATION FIX");
  console.log("=" .repeat(80));

  const client = new SmoobuClient();
  const targetIds = ["111265756", "111716071", "111709716", "112421146"];

  console.log("\n📦 Fetching all bookings with pagination fix...\n");
  const bookings = await client.fetchBookings('2025-09-01', '2025-10-31');

  console.log("\n✅ VERIFICATION RESULTS:");
  console.log(`Total bookings fetched: ${bookings.length}`);
  console.log("\nTarget Airbnb reservations:");

  let allFound = true;
  targetIds.forEach(id => {
    const found = bookings.find(b => b.id.toString() === id);
    console.log(`  ${found ? '✅' : '❌'} ${id} ${found ? '- ' + found['guest-name'] + ' (' + found.apartment?.name + ')' : '- NOT FOUND'}`);
    if (!found) allFound = false;
  });

  if (allFound) {
    console.log("\n🎉 SUCCESS! All 4 Airbnb reservations are now included in the fetch!");
    console.log("   Your fetch-and-sync will now work correctly.");
  } else {
    console.log("\n❌ ISSUE: Some bookings still missing. Further investigation needed.");
  }
}

verifyFix().catch(console.error);