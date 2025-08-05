// DEFINITIVE TEST: Prove whether the issue is Smoobu API or our code
import * as dotenv from "dotenv";
import axios from "axios";

dotenv.config();

async function definitiveAPITest() {
  const apiKey = process.env.SMOOBU_API_KEY;

  if (!apiKey) {
    console.error("❌ SMOOBU_API_KEY not found");
    return;
  }

  console.log(
    "🔬 DEFINITIVE TEST: Is this a Smoobu API issue or our code issue?\n"
  );
  console.log(
    "We will use PURE axios calls with minimal parameters to eliminate any code interference.\n"
  );

  const testBookings = [
    { id: 105719121, name: "Anne Vicente", arrival: "2025-07-29" },
    { id: 105608666, name: "Baya Cheikh", arrival: "2025-07-28" },
  ];

  // TEST 1: Direct individual booking fetch (baseline - should work)
  console.log("=== TEST 1: Individual Booking Fetch (Baseline) ===");

  for (const booking of testBookings) {
    try {
      console.log(
        `\n--- Fetching booking ${booking.id} (${booking.name}) individually ---`
      );

      const response = await axios.get(
        `https://login.smoobu.com/api/reservations/${booking.id}`,
        {
          headers: { "Api-Key": apiKey },
        }
      );

      if (response.status === 200 && response.data) {
        console.log(`✅ SUCCESS: ${booking.name} found individually`);
        console.log(`   - Guest: ${response.data["guest-name"]}`);
        console.log(
          `   - Apartment: ${response.data.apartment?.name} (ID: ${response.data.apartment?.id})`
        );
        console.log(
          `   - Channel: ${response.data.channel?.name} (ID: ${response.data.channel?.id})`
        );
        console.log(`   - Arrival: ${response.data.arrival}`);
      } else {
        console.log(`❌ UNEXPECTED: ${booking.name} not found individually`);
      }
    } catch (error) {
      console.log(
        `❌ ERROR fetching ${booking.name} individually: ${error.message}`
      );
    }
  }

  // TEST 2: Pure bulk API call with absolute minimal parameters
  console.log("\n=== TEST 2: Pure Bulk API - Minimal Parameters ===");

  try {
    console.log("\n--- Pure GET /api/reservations (no parameters) ---");

    const response = await axios.get(
      "https://login.smoobu.com/api/reservations",
      {
        headers: { "Api-Key": apiKey },
      }
    );

    const bookings = response.data.bookings || [];
    console.log(`Total bookings returned: ${bookings.length}`);

    for (const testBooking of testBookings) {
      const found = bookings.find(
        (b) => b.id === testBooking.id || b.id === String(testBooking.id)
      );
      if (found) {
        console.log(
          `✅ FOUND: ${testBooking.name} (${testBooking.id}) in bulk response`
        );
      } else {
        console.log(
          `❌ MISSING: ${testBooking.name} (${testBooking.id}) NOT in bulk response`
        );
      }
    }
  } catch (error) {
    console.log(`❌ ERROR in bulk API call: ${error.message}`);
  }

  // TEST 3: Pure bulk API call with only date range (most basic filter)
  console.log("\n=== TEST 3: Pure Bulk API - Date Range Only ===");

  try {
    console.log(
      "\n--- GET /api/reservations?arrivalFrom=2025-07-01&arrivalTo=2025-08-31 ---"
    );

    const response = await axios.get(
      "https://login.smoobu.com/api/reservations",
      {
        headers: { "Api-Key": apiKey },
        params: {
          arrivalFrom: "2025-07-01",
          arrivalTo: "2025-08-31",
        },
      }
    );

    const bookings = response.data.bookings || [];
    console.log(`Total bookings returned: ${bookings.length}`);

    // Check if our test bookings are in the results
    for (const testBooking of testBookings) {
      const found = bookings.find(
        (b) => b.id === testBooking.id || b.id === String(testBooking.id)
      );
      if (found) {
        console.log(
          `✅ FOUND: ${testBooking.name} (${testBooking.id}) in date-filtered response`
        );
      } else {
        console.log(
          `❌ MISSING: ${testBooking.name} (${testBooking.id}) NOT in date-filtered response`
        );
      }
    }

    // Also check how many other Airbnb bookings are returned
    const airbnbBookings = bookings.filter(
      (b) =>
        b.channel?.name?.toLowerCase().includes("airbnb") ||
        b.channel?.id === 2323543
    );
    console.log(`Total Airbnb bookings in response: ${airbnbBookings.length}`);

    // Check specifically for apartment 1946276 bookings
    const apt1946276Bookings = bookings.filter(
      (b) =>
        b.apartment?.id === 1946276 ||
        b.related?.some((rel) => rel.id === 1946276)
    );
    console.log(
      `Total apartment 1946276 bookings in response: ${apt1946276Bookings.length}`
    );

    const airbnbApt1946276 = apt1946276Bookings.filter(
      (b) =>
        b.channel?.name?.toLowerCase().includes("airbnb") ||
        b.channel?.id === 2323543
    );
    console.log(
      `Airbnb bookings for apartment 1946276 in response: ${airbnbApt1946276.length}`
    );

    if (airbnbApt1946276.length > 0) {
      console.log("Found Airbnb bookings for apartment 1946276:");
      airbnbApt1946276.forEach((b) => {
        console.log(
          `  - ID: ${b.id}, Guest: ${b["guest-name"]}, Arrival: ${b.arrival}`
        );
      });
    }
  } catch (error) {
    console.log(`❌ ERROR in date-filtered bulk API call: ${error.message}`);
  }

  // TEST 4: Test with different HTTP clients (eliminate axios-specific issues)
  console.log("\n=== TEST 4: Different HTTP Client (node-fetch) ===");

  try {
    const fetch = (await import("node-fetch")).default;

    console.log("\n--- Using node-fetch instead of axios ---");

    const response = await fetch(
      "https://login.smoobu.com/api/reservations?arrivalFrom=2025-07-01&arrivalTo=2025-08-31",
      {
        method: "GET",
        headers: {
          "Api-Key": apiKey,
          Accept: "application/json",
        },
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    const bookings = data.bookings || [];
    console.log(`Total bookings returned via node-fetch: ${bookings.length}`);

    for (const testBooking of testBookings) {
      const found = bookings.find(
        (b) => b.id === testBooking.id || b.id === String(testBooking.id)
      );
      if (found) {
        console.log(
          `✅ FOUND: ${testBooking.name} (${testBooking.id}) via node-fetch`
        );
      } else {
        console.log(
          `❌ MISSING: ${testBooking.name} (${testBooking.id}) NOT found via node-fetch`
        );
      }
    }
  } catch (error) {
    console.log(`❌ ERROR with node-fetch: ${error.message}`);
  }

  // TEST 5: Raw curl command equivalent (eliminate all Node.js variables)
  console.log("\n=== TEST 5: Raw curl Command Test ===");
  console.log("Execute this curl command manually to test outside of Node.js:");
  console.log(
    `curl -H "Api-Key: ${apiKey}" "https://login.smoobu.com/api/reservations?arrivalFrom=2025-07-01&arrivalTo=2025-08-31"`
  );
  console.log(
    "\nThen search the JSON response for booking IDs 105719121 and 105608666"
  );

  // TEST 6: Compare with a working booking from the same period
  console.log("\n=== TEST 6: Control Test - Working Booking Comparison ===");

  try {
    console.log(
      "\n--- Finding a working Airbnb booking from same period for comparison ---"
    );

    const response = await axios.get(
      "https://login.smoobu.com/api/reservations",
      {
        headers: { "Api-Key": apiKey },
        params: {
          arrivalFrom: "2025-07-01",
          arrivalTo: "2025-08-31",
        },
      }
    );

    const bookings = response.data.bookings || [];
    const workingAirbnbBooking = bookings.find(
      (b) =>
        (b.channel?.name?.toLowerCase().includes("airbnb") ||
          b.channel?.id === 2323543) &&
        b.arrival >= "2025-07-01" &&
        b.arrival <= "2025-08-31"
    );

    if (workingAirbnbBooking) {
      console.log(`✅ CONTROL: Found working Airbnb booking for comparison:`);
      console.log(`   - ID: ${workingAirbnbBooking.id}`);
      console.log(`   - Guest: ${workingAirbnbBooking["guest-name"]}`);
      console.log(
        `   - Apartment: ${workingAirbnbBooking.apartment?.name} (ID: ${workingAirbnbBooking.apartment?.id})`
      );
      console.log(
        `   - Channel: ${workingAirbnbBooking.channel?.name} (ID: ${workingAirbnbBooking.channel?.id})`
      );
      console.log(`   - Arrival: ${workingAirbnbBooking.arrival}`);

      // Now test if this working booking is also fetchable individually
      try {
        const individualResponse = await axios.get(
          `https://login.smoobu.com/api/reservations/${workingAirbnbBooking.id}`,
          {
            headers: { "Api-Key": apiKey },
          }
        );

        if (individualResponse.status === 200) {
          console.log(
            `✅ CONTROL: Working booking ${workingAirbnbBooking.id} also fetchable individually`
          );
        } else {
          console.log(
            `❌ ANOMALY: Working booking ${workingAirbnbBooking.id} NOT fetchable individually`
          );
        }
      } catch (error) {
        console.log(
          `❌ ANOMALY: Error fetching working booking individually: ${error.message}`
        );
      }
    } else {
      console.log(
        `❌ NO CONTROL: No working Airbnb bookings found in July-August period`
      );
    }
  } catch (error) {
    console.log(`❌ ERROR in control test: ${error.message}`);
  }

  // CONCLUSION
  console.log("\n" + "=".repeat(80));
  console.log("🎯 CONCLUSION CRITERIA:");
  console.log("=".repeat(80));
  console.log("If our bookings:");
  console.log("✅ Work individually (Test 1) BUT");
  console.log("❌ Missing from ALL bulk API calls (Tests 2-4)");
  console.log("Then this is DEFINITELY a Smoobu API issue, not our code.");
  console.log("");
  console.log(
    "If ALL tests fail, then we have a broader authentication/permission issue."
  );
  console.log(
    "If results vary between HTTP clients, then we have a client-specific issue."
  );
}

definitiveAPITest().catch(console.error);
