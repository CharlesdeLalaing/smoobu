import * as dotenv from "dotenv";
import axios from "axios";

dotenv.config();

async function deepDiagnose() {
  const apiKey = process.env.SMOOBU_API_KEY;
  const problematicIds = ["111265756", "111716071", "111709716", "112421146"];

  console.log("🔍 DEEP DIAGNOSIS - WHY ARE THESE BOOKINGS MISSING?");
  console.log("=" .repeat(80));

  // Fetch each booking individually and examine ALL properties
  for (const bookingId of problematicIds) {
    console.log(`\n📋 Analyzing booking ${bookingId}:`);
    console.log("-".repeat(80));

    try {
      const response = await axios.get(`https://login.smoobu.com/api/reservations/${bookingId}`, {
        headers: {
          "Api-Key": apiKey,
          "Cache-Control": "no-cache",
        },
      });

      const booking = response.data;

      // Print ALL properties
      console.log("Full booking data:");
      console.log(JSON.stringify(booking, null, 2));

      // Key properties to check
      console.log("\n🔑 Key Properties:");
      console.log(`   ID: ${booking.id}`);
      console.log(`   Type: ${booking.type}`);
      console.log(`   Guest: ${booking['guest-name'] || booking.firstName + ' ' + booking.lastName}`);
      console.log(`   Apartment: ${booking.apartment?.name} (ID: ${booking.apartment?.id})`);
      console.log(`   Channel: ${booking.channel?.name} (ID: ${booking.channel?.id})`);
      console.log(`   Arrival: ${booking.arrival}`);
      console.log(`   Departure: ${booking.departure}`);
      console.log(`   Created At: ${booking['created-at']}`);
      console.log(`   Modified At: ${booking['modified-at'] || booking.modifiedAt || 'N/A'}`);
      console.log(`   Last Modified: ${booking['last-modified'] || 'N/A'}`);
      console.log(`   Price: ${booking.price}`);
      console.log(`   Price Elements: ${booking.priceElements?.length || 0}`);
      console.log(`   Status: ${booking.status || 'N/A'}`);
      console.log(`   Notice: ${booking.notice || 'N/A'}`);
      console.log(`   Assistant Notice: ${booking['assistant-notice'] || 'N/A'}`);
      console.log(`   Is Blocked: ${booking.isBlocked || false}`);
      console.log(`   Show On Webpage: ${booking.showOnWebpage !== undefined ? booking.showOnWebpage : 'N/A'}`);
      console.log(`   Related Apartments: ${booking.related?.length || 0}`);

      if (booking.related && booking.related.length > 0) {
        console.log(`   Related: ${booking.related.map(r => `${r.name} (${r.id})`).join(', ')}`);
      }

      // Check if booking is "valid" by various criteria
      console.log("\n✅ Validity Checks:");
      console.log(`   Has valid ID: ${!!booking.id}`);
      console.log(`   Has arrival date: ${!!booking.arrival}`);
      console.log(`   Has departure date: ${!!booking.departure}`);
      console.log(`   Has guest name: ${!!(booking['guest-name'] || booking.firstName)}`);
      console.log(`   Has apartment: ${!!booking.apartment?.id}`);
      console.log(`   Is NOT blocked: ${!booking.isBlocked}`);
      console.log(`   Type is NOT cancellation: ${booking.type !== 'cancellation'}`);

    } catch (error) {
      console.log(`❌ Error fetching booking: ${error.message}`);
      if (error.response) {
        console.log(`   Status: ${error.response.status}`);
        console.log(`   Data:`, error.response.data);
      }
    }
  }

  // Now let's fetch the bulk API and examine what we DO get
  console.log("\n\n📦 EXAMINING BULK API RESPONSE");
  console.log("=" .repeat(80));

  const startDate = '2025-09-01';
  const endDate = '2025-10-31';

  try {
    const bulkResponse = await axios.get("https://login.smoobu.com/api/reservations", {
      headers: {
        "Api-Key": apiKey,
        "Cache-Control": "no-cache",
      },
      params: {
        from: startDate,
        until: endDate,
        showCancellation: false,
        excludeBlocked: true,
        pageSize: 10000,
      },
    });

    console.log(`\n📊 Bulk API returned ${bulkResponse.data.bookings?.length || 0} bookings`);

    // Find Airbnb bookings for comparison
    const airbnbBookings = bulkResponse.data.bookings?.filter(b =>
      b.channel?.name === "Airbnb" || b.channel?.id === 2323543
    ) || [];

    console.log(`\n🏠 Airbnb bookings in bulk response (${airbnbBookings.length} total):`);
    airbnbBookings.forEach(b => {
      console.log(`   ${b.id}: ${b['guest-name']} | ${b.apartment?.name} | ${b.arrival} | Type: ${b.type} | Blocked: ${b.isBlocked || false}`);
    });

    // Show a sample booking structure from bulk API
    if (airbnbBookings.length > 0) {
      console.log(`\n📄 Sample Airbnb booking structure from bulk API:`);
      console.log(JSON.stringify(airbnbBookings[0], null, 2));
    }

  } catch (error) {
    console.log(`❌ Error fetching bulk bookings: ${error.message}`);
  }
}

deepDiagnose().catch(console.error);