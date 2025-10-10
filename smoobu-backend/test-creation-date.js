import * as dotenv from "dotenv";
import axios from "axios";

dotenv.config();

async function testCreationDate() {
  const apiKey = process.env.SMOOBU_API_KEY;

  console.log("🔍 TESTING IF CREATION DATE AFFECTS BULK API");
  console.log("=" .repeat(80));
  console.log(`Today's date: ${new Date().toISOString().split('T')[0]}`);

  // Test 1: Query with different date ranges
  const tests = [
    {
      name: "Original query (Sept 1 - Oct 31 arrival)",
      params: {
        from: '2025-09-01',
        until: '2025-10-31',
        showCancellation: false,
        excludeBlocked: true,
        pageSize: 10000,
      }
    },
    {
      name: "Wider range (Aug 1 - Nov 30 arrival)",
      params: {
        from: '2025-08-01',
        until: '2025-11-30',
        showCancellation: false,
        excludeBlocked: true,
        pageSize: 10000,
      }
    },
    {
      name: "Using modifiedFrom/modifiedUntil instead",
      params: {
        modifiedFrom: '2025-09-15',
        modifiedUntil: '2025-09-30',
        showCancellation: false,
        excludeBlocked: true,
        pageSize: 10000,
      }
    },
    {
      name: "Using createdFrom instead",
      params: {
        createdFrom: '2025-09-15',
        showCancellation: false,
        excludeBlocked: true,
        pageSize: 10000,
      }
    }
  ];

  const targetIds = ["111265756", "111716071", "111709716", "112421146"];

  for (const test of tests) {
    console.log(`\n📋 ${test.name}`);
    console.log(`   Params: ${JSON.stringify(test.params)}`);

    try {
      const response = await axios.get("https://login.smoobu.com/api/reservations", {
        headers: {
          "Api-Key": apiKey,
          "Cache-Control": "no-cache",
        },
        params: test.params,
      });

      const bookings = response.data.bookings || [];
      console.log(`   Total bookings: ${bookings.length}`);

      let foundCount = 0;
      for (const targetId of targetIds) {
        const found = bookings.find(b => b.id.toString() === targetId);
        if (found) {
          console.log(`   ✅ ${targetId} - ${found['guest-name']}`);
          foundCount++;
        }
      }

      if (foundCount === 0) {
        console.log(`   ❌ None of the target bookings found`);
      } else {
        console.log(`   ✨ FOUND ${foundCount}/${targetIds.length} target bookings!`);
      }

    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
      if (error.response) {
        console.log(`   Response status: ${error.response.status}`);
      }
    }
  }

  console.log("\n" + "=".repeat(80));
}

testCreationDate().catch(console.error);