import * as dotenv from "dotenv";
import { SmoobuClient } from "./third-party/smoobu/actions/api/fetch-and-sync/smoobu-client.js";
import { BookingRepository } from "./third-party/smoobu/actions/api/fetch-and-sync/booking-repository.js";
import { BookingProcessor } from "./third-party/smoobu/actions/api/fetch-and-sync/booking-processor.js";

dotenv.config();

async function syncFailingBookings() {
  const bookingIds = [
    { id: "116168296", guest: "Alexander Gazov" },
    { id: "103531863", guest: "Adrenne étape" },
    { id: "112101336", guest: "Louis Satinet" }
  ];

  console.log("🔄 SYNCING FAILING BOOKINGS WITH FIXES");
  console.log("=" .repeat(100));

  const client = new SmoobuClient();
  const repository = new BookingRepository();
  const processor = new BookingProcessor(client, repository);

  // Fetch all existing bookings once
  console.log("📊 Fetching existing bookings from database...");
  const existingBookingMap = await repository.fetchExistingBookings();
  console.log(`✅ Found ${existingBookingMap.size} unique booking IDs in database`);

  for (const bookingInfo of bookingIds) {
    console.log(`\n📋 Syncing booking ${bookingInfo.id} - ${bookingInfo.guest}`);
    console.log("-".repeat(100));

    try {
      // Fetch the booking from Smoobu
      const booking = await client.fetchIndividualBooking(bookingInfo.id);

      if (!booking) {
        console.log(`❌ Could not fetch booking ${bookingInfo.id} from Smoobu`);
        continue;
      }

      console.log(`✅ Fetched booking from Smoobu: ${booking['guest-name']}`);

      // Fetch price elements
      const priceElements = await client.fetchPriceElements(bookingInfo.id);
      console.log(`✅ Fetched ${priceElements.length} price elements`);

      // Attach price elements to booking
      booking.priceElements = priceElements;

      // Check if this booking exists in database
      const existingBookings = existingBookingMap.get(bookingInfo.id);
      if (existingBookings && existingBookings.length > 0) {
        console.log(`📊 Found ${existingBookings.length} existing booking(s) in database`);
      } else {
        console.log(`📊 No existing booking found - will create new`);
      }

      // Process the booking (this will apply our fixes!)
      const stats = {
        added: 0,
        updated: 0,
        errors: 0
      };

      await processor.processBooking(booking, existingBookingMap, stats);

      if (stats.updated > 0) {
        console.log(`✅ Successfully UPDATED booking ${bookingInfo.id} with fixed calculations`);
      } else if (stats.added > 0) {
        console.log(`✅ Successfully ADDED booking ${bookingInfo.id} with fixed calculations`);
      } else if (stats.errors > 0) {
        console.log(`❌ Error processing booking ${bookingInfo.id}`);
      }

      // Verify the update by fetching the booking back
      const updatedMap = await repository.fetchExistingBookings();
      const updatedBookings = updatedMap.get(bookingInfo.id);
      if (updatedBookings && updatedBookings.length > 0) {
        const updatedBooking = updatedBookings[0];
        console.log(`\n   📊 VERIFICATION:`);
        console.log(`   Extras Count: ${updatedBooking.extras?.length || 0}`);
        console.log(`   Extras Total: €${updatedBooking.priceDetails?.extrasTotal?.toFixed(2) || 0}`);

        if (updatedBooking.extras && updatedBooking.extras.length > 0) {
          console.log(`\n   Extras Details:`);
          updatedBooking.extras.forEach((extra, idx) => {
            console.log(`   [${idx + 1}] ${extra.name}: €${extra.amount} (qty: ${extra.quantity})`);
            if (extra.hasExtraPerson) {
              console.log(`       + Extra Person: €${extra.extraPersonAmount} (${extra.extraPersonQuantity} persons)`);
            }
          });
        }
      }

    } catch (error) {
      console.log(`❌ Error syncing booking ${bookingInfo.id}: ${error.message}`);
      console.error(error);
    }
  }

  console.log("\n" + "=".repeat(100));
  console.log("🎯 SYNC COMPLETE");
}

syncFailingBookings().catch(console.error);
