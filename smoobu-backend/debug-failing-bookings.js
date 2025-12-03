import * as dotenv from "dotenv";
import { SmoobuClient } from "./third-party/smoobu/actions/api/fetch-and-sync/smoobu-client.js";
import { processExtrasWithPersons } from "./third-party/smoobu/process-extras-with-persons.js";

dotenv.config();

async function debugFailingBookings() {
  const bookingIds = [
    { id: "116168296", guest: "Alexander Gazov", issue: "Missing Personne supplémentaire items" },
    { id: "103531863", guest: "Adrenne étape", issue: "Missing SPA Personne supplémentaire" },
    { id: "112101336", guest: "Louis Satinet", issue: "Extra Frais voyageurs supplémentaires" }
  ];

  const client = new SmoobuClient();

  console.log("🔍 DEBUGGING FAILING BOOKINGS - SMOOBU API DATA");
  console.log("=" .repeat(100));

  for (const booking of bookingIds) {
    console.log(`\n📋 Booking ${booking.id} - ${booking.guest}`);
    console.log(`   Issue: ${booking.issue}`);
    console.log("-".repeat(100));

    try {
      const result = await client.fetchIndividualBooking(booking.id);

      if (result) {
        console.log(`✅ Successfully fetched from Smoobu API`);
        console.log(`   Guest: ${result['guest-name']}`);
        console.log(`   Total Price: ${result.price}`);

        // Fetch price elements
        const priceElements = await client.fetchPriceElements(booking.id);

        console.log(`\n   📊 PRICE ELEMENTS (${priceElements.length} items):`);
        console.log("   " + "=".repeat(95));

        // Display all price elements
        priceElements.forEach((el, index) => {
          console.log(`\n   [${index + 1}] Name: "${el.name}"`);
          console.log(`       Amount: €${el.amount}`);
          console.log(`       Quantity: ${el.quantity}`);
          console.log(`       Type: ${el.type}`);
          console.log(`       ID: ${el.id}`);
        });

        console.log("\n   " + "=".repeat(95));
        console.log("   🔍 SEARCHING FOR PERSONNE SUPPLÉMENTAIRE ITEMS:");
        console.log("   " + "-".repeat(95));

        const personneItems = priceElements.filter(el =>
          el.name && el.name.toLowerCase().includes("personne supplémentaire")
        );

        if (personneItems.length > 0) {
          console.log(`   ✅ Found ${personneItems.length} Personne supplémentaire item(s):`);
          personneItems.forEach((el, index) => {
            console.log(`\n   [${index + 1}] Full Name: "${el.name}"`);
            console.log(`       Amount: €${el.amount}`);
            console.log(`       Quantity: ${el.quantity}`);

            // Check if it matches the expected naming pattern
            const hasExpectedFormat = el.name.includes(" - Personne supplémentaire");
            console.log(`       Expected Format Match: ${hasExpectedFormat ? "✅ YES" : "❌ NO"}`);

            if (!hasExpectedFormat) {
              console.log(`       ⚠️  ISSUE: Name doesn't match expected pattern "[Extra Name] - Personne supplémentaire"`);
            }
          });
        } else {
          console.log(`   ❌ NO Personne supplémentaire items found in price elements`);
        }

        console.log("\n   " + "=".repeat(95));
        console.log("   🔍 SEARCHING FOR FRAIS VOYAGEURS ITEMS:");
        console.log("   " + "-".repeat(95));

        const fraisItems = priceElements.filter(el =>
          el.name && el.name.toLowerCase().includes("frais voyageurs")
        );

        if (fraisItems.length > 0) {
          console.log(`   ✅ Found ${fraisItems.length} Frais voyageurs item(s):`);
          fraisItems.forEach((el, index) => {
            console.log(`\n   [${index + 1}] Full Name: "${el.name}"`);
            console.log(`       Amount: €${el.amount}`);
            console.log(`       Quantity: ${el.quantity}`);
            console.log(`       Type: ${el.type}`);
          });
        } else {
          console.log(`   ❌ NO Frais voyageurs items found in price elements`);
        }

        console.log("\n   " + "=".repeat(95));
        console.log("   🧪 PROCESSING WITH processExtrasWithPersons():");
        console.log("   " + "-".repeat(95));

        // Process with the actual function
        const processedExtras = processExtrasWithPersons(priceElements);

        console.log(`\n   Total Extras Found: ${processedExtras.extras.length}`);
        console.log(`   Total Extras Amount: €${processedExtras.extrasTotal.toFixed(2)}`);

        console.log("\n   Processed Extras:");
        processedExtras.extras.forEach((extra, index) => {
          console.log(`\n   [${index + 1}] ${extra.name}`);
          console.log(`       Amount: €${extra.amount}`);
          console.log(`       Quantity: ${extra.quantity}`);
          if (extra.hasExtraPerson) {
            console.log(`       Has Extra Person: YES`);
            console.log(`       Extra Person Quantity: ${extra.extraPersonQuantity}`);
            console.log(`       Extra Person Price: €${extra.extraPersonPrice}`);
            console.log(`       Extra Person Amount: €${extra.extraPersonAmount}`);
          }
        });

      } else {
        console.log(`❌ Could not fetch booking from Smoobu API`);
      }

    } catch (error) {
      console.log(`❌ Error fetching booking: ${error.message}`);
      console.error(error);
    }
  }

  console.log("\n" + "=".repeat(100));
  console.log("🎯 DEBUG COMPLETE");
}

debugFailingBookings().catch(console.error);
