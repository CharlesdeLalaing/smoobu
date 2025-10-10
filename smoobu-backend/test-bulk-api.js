import * as dotenv from "dotenv";
import { SmoobuClient } from "./third-party/smoobu/actions/api/fetch-and-sync/smoobu-client.js";

dotenv.config();

async function testBulkAPI() {
  const bookingIdsToFind = ["111265756", "111716071", "111709716", "112421146"];

  const client = new SmoobuClient();

  console.log("🔍 TESTING BULK API FOR MISSING BOOKINGS");
  console.log("=" .repeat(80));

  // Test with the sync range
  const startDate = '2025-09-01';
  const endDate = '2025-10-31';

  console.log(`\n📅 Fetching bookings from ${startDate} to ${endDate}`);
  const bulkBookings = await client.fetchBookings(startDate, endDate);

  console.log(`📦 Total bookings fetched: ${bulkBookings.length}`);

  // Check if our target bookings are in the bulk response
  console.log("\n🎯 Checking for target bookings in bulk response:");

  for (const targetId of bookingIdsToFind) {
    const found = bulkBookings.find(b => b.id.toString() === targetId);

    if (found) {
      console.log(`✅ FOUND ${targetId} - ${found['guest-name']}`);
      console.log(`   Apartment: ${found.apartment?.name}`);
      console.log(`   Channel: ${found.channel?.name}`);
      console.log(`   Type: ${found.type}`);
      console.log(`   Arrival: ${found.arrival}`);
      console.log(`   Price Elements: ${found.priceElements?.length || 0}`);
    } else {
      console.log(`❌ NOT FOUND ${targetId}`);
    }
  }

  // Show all Airbnb bookings in the response
  console.log("\n🏠 All Airbnb bookings in bulk response:");
  const airbnbBookings = bulkBookings.filter(b =>
    b.channel?.name === "Airbnb" || b.channel?.id === 2323543 || b.channel?.id === "2323543"
  );

  console.log(`Found ${airbnbBookings.length} Airbnb bookings:`);
  airbnbBookings.forEach(b => {
    console.log(`  - ${b.id}: ${b['guest-name']} | ${b.apartment?.name} | ${b.arrival} | Type: ${b.type}`);
  });
}

testBulkAPI().catch(console.error);