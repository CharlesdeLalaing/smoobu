import * as dotenv from "dotenv";
import axios from "axios";

dotenv.config();

async function testAPIParams() {
  const apiKey = process.env.SMOOBU_API_KEY;
  const bookingIdsToFind = ["111265756", "111716071", "111709716", "112421146"];

  const startDate = '2025-09-01';
  const endDate = '2025-10-31';

  console.log("🔍 TESTING DIFFERENT API PARAMETERS");
  console.log("=" .repeat(80));

  // Test 1: Current parameters
  console.log("\n📋 Test 1: Current parameters (showCancellation: false, excludeBlocked: true)");
  try {
    const response1 = await axios.get("https://login.smoobu.com/api/reservations", {
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

    const bookings1 = response1.data.bookings || [];
    console.log(`   Total bookings: ${bookings1.length}`);

    for (const targetId of bookingIdsToFind) {
      const found = bookings1.find(b => b.id.toString() === targetId);
      console.log(`   ${found ? '✅' : '❌'} ${targetId}`);
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
  }

  // Test 2: Without excludeBlocked
  console.log("\n📋 Test 2: Without excludeBlocked (showCancellation: false)");
  try {
    const response2 = await axios.get("https://login.smoobu.com/api/reservations", {
      headers: {
        "Api-Key": apiKey,
        "Cache-Control": "no-cache",
      },
      params: {
        from: startDate,
        until: endDate,
        showCancellation: false,
        pageSize: 10000,
      },
    });

    const bookings2 = response2.data.bookings || [];
    console.log(`   Total bookings: ${bookings2.length}`);

    for (const targetId of bookingIdsToFind) {
      const found = bookings2.find(b => b.id.toString() === targetId);
      console.log(`   ${found ? '✅' : '❌'} ${targetId}`);
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
  }

  // Test 3: Include everything
  console.log("\n📋 Test 3: Include everything (showCancellation: true, excludeBlocked: false)");
  try {
    const response3 = await axios.get("https://login.smoobu.com/api/reservations", {
      headers: {
        "Api-Key": apiKey,
        "Cache-Control": "no-cache",
      },
      params: {
        from: startDate,
        until: endDate,
        showCancellation: true,
        excludeBlocked: false,
        pageSize: 10000,
      },
    });

    const bookings3 = response3.data.bookings || [];
    console.log(`   Total bookings: ${bookings3.length}`);

    for (const targetId of bookingIdsToFind) {
      const found = bookings3.find(b => b.id.toString() === targetId);
      console.log(`   ${found ? '✅' : '❌'} ${targetId} ${found ? `(Type: ${found.type})` : ''}`);
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
  }

  // Test 4: Try with arrivalFrom/arrivalUntil instead
  console.log("\n📋 Test 4: Using arrivalFrom/arrivalUntil parameters");
  try {
    const response4 = await axios.get("https://login.smoobu.com/api/reservations", {
      headers: {
        "Api-Key": apiKey,
        "Cache-Control": "no-cache",
      },
      params: {
        arrivalFrom: startDate,
        arrivalUntil: endDate,
        showCancellation: false,
        excludeBlocked: false,
        pageSize: 10000,
      },
    });

    const bookings4 = response4.data.bookings || [];
    console.log(`   Total bookings: ${bookings4.length}`);

    for (const targetId of bookingIdsToFind) {
      const found = bookings4.find(b => b.id.toString() === targetId);
      console.log(`   ${found ? '✅' : '❌'} ${targetId}`);
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
  }

  console.log("\n" + "=".repeat(80));
}

testAPIParams().catch(console.error);