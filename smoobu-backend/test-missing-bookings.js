import * as dotenv from "dotenv";
import { SmoobuClient } from "./third-party/smoobu/actions/api/fetch-and-sync/smoobu-client.js";

dotenv.config();

async function testMissingBookings() {
  const bookingIds = [
    { id: "111265756", guest: "Delphine Oosters", property: "Cabane du Chêne" },
    { id: "111716071", guest: "Maxime Stalmans", property: "Cabane du Chêne" },
    { id: "111709716", guest: "Stefan Benz", property: "Le moulin" },
    { id: "112421146", guest: "Shima Sime", property: "Le moulin" }
  ];

  const client = new SmoobuClient();

  console.log("🔍 TESTING MISSING AIRBNB BOOKINGS");
  console.log("=" .repeat(80));

  for (const booking of bookingIds) {
    console.log(`\n📋 Testing booking ${booking.id} - ${booking.guest} (${booking.property})`);
    console.log("-".repeat(80));

    try {
      const result = await client.fetchIndividualBooking(booking.id);

      if (result) {
        console.log(`✅ Successfully fetched from Smoobu API`);
        console.log(`   Guest: ${result['guest-name']}`);
        console.log(`   Apartment: ${result.apartment?.name} (ID: ${result.apartment?.id})`);
        console.log(`   Channel: ${result.channel?.name} (ID: ${result.channel?.id})`);
        console.log(`   Type: ${result.type}`);
        console.log(`   Arrival: ${result.arrival}`);
        console.log(`   Departure: ${result.departure}`);
        console.log(`   Price Elements: ${result.priceElements?.length || 0}`);
        console.log(`   Total Price: ${result.price}`);

        // Check if arrival date is within current sync range
        const syncStartDate = '2025-09-01';
        const syncEndDate = '2025-10-31';
        const arrivalDate = result.arrival;
        const inRange = arrivalDate >= syncStartDate && arrivalDate <= syncEndDate;

        console.log(`   📅 Arrival date ${arrivalDate} is ${inRange ? '✅ WITHIN' : '❌ OUTSIDE'} sync range (${syncStartDate} to ${syncEndDate})`);

        if (!inRange) {
          console.log(`   ⚠️  ISSUE FOUND: This booking's arrival date is outside the hardcoded date range in server.js`);
        }

      } else {
        console.log(`❌ Could not fetch booking from Smoobu API`);
      }

    } catch (error) {
      console.log(`❌ Error fetching booking: ${error.message}`);
    }
  }

  console.log("\n" + "=".repeat(80));
  console.log("🎯 DIAGNOSIS COMPLETE");
  console.log("\nCheck the output above to see:");
  console.log("1. If bookings can be fetched from Smoobu API");
  console.log("2. If their arrival dates fall within the sync date range");
  console.log("3. If there are any other issues with the booking data");
}

testMissingBookings().catch(console.error);