import * as dotenv from "dotenv";
import axios from "axios";

dotenv.config();

async function testApartments() {
  const apiKey = process.env.SMOOBU_API_KEY;

  console.log("🔍 TESTING APARTMENT-SPECIFIC QUERIES");
  console.log("=" .repeat(80));

  const targetIds = ["111265756", "111716071", "111709716", "112421146"];

  // Apartment IDs from the problematic bookings
  const apartments = [
    { id: 2565753, name: "La cabane du chêne", bookings: ["111265756", "111716071"] },
    { id: 1946279, name: "Le moulin", bookings: ["111709716", "112421146"] }
  ];

  // Test 1: Query each apartment specifically
  for (const apt of apartments) {
    console.log(`\n📋 Querying apartment: ${apt.name} (ID: ${apt.id})`);

    try {
      const response = await axios.get("https://login.smoobu.com/api/reservations", {
        headers: {
          "Api-Key": apiKey,
          "Cache-Control": "no-cache",
        },
        params: {
          from: '2025-09-01',
          until: '2025-10-31',
          apartments: [apt.id],
          showCancellation: false,
          excludeBlocked: true,
          pageSize: 10000,
        },
      });

      const bookings = response.data.bookings || [];
      console.log(`   Total bookings for this apartment: ${bookings.length}`);

      for (const bookingId of apt.bookings) {
        const found = bookings.find(b => b.id.toString() === bookingId);
        console.log(`   ${found ? '✅' : '❌'} ${bookingId} ${found ? `(${found['guest-name']})` : ''}`);
      }

      if (bookings.length > 0) {
        console.log(`   Bookings returned: ${bookings.map(b => `${b.id} (${b['guest-name']})`).join(', ')}`);
      }

    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
    }
  }

  // Test 2: Check if there's pagination with page parameter
  console.log(`\n\n📋 Testing pagination`);

  try {
    const response = await axios.get("https://login.smoobu.com/api/reservations", {
      headers: {
        "Api-Key": apiKey,
        "Cache-Control": "no-cache",
      },
      params: {
        from: '2025-09-01',
        until: '2025-10-31',
        showCancellation: false,
        excludeBlocked: true,
        page: 1,
        pageSize: 10000,
      },
    });

    console.log(`   Full response structure:`);
    console.log(`   - bookings: ${response.data.bookings?.length || 0}`);
    console.log(`   - page_count: ${response.data.page_count || 'N/A'}`);
    console.log(`   - total_items: ${response.data.total_items || 'N/A'}`);
    console.log(`   - current_page: ${response.data.current_page || 'N/A'}`);

    // If there are multiple pages, fetch them all
    if (response.data.page_count && response.data.page_count > 1) {
      console.log(`\n   Multiple pages detected! Fetching all pages...`);

      for (let page = 2; page <= response.data.page_count; page++) {
        const pageResponse = await axios.get("https://login.smoobu.com/api/reservations", {
          headers: {
            "Api-Key": apiKey,
            "Cache-Control": "no-cache",
          },
          params: {
            from: '2025-09-01',
            until: '2025-10-31',
            showCancellation: false,
            excludeBlocked: true,
            page: page,
            pageSize: 10000,
          },
        });

        const pageBookings = pageResponse.data.bookings || [];
        console.log(`   Page ${page}: ${pageBookings.length} bookings`);

        for (const targetId of targetIds) {
          const found = pageBookings.find(b => b.id.toString() === targetId);
          if (found) {
            console.log(`   ✅ FOUND ON PAGE ${page}: ${targetId} (${found['guest-name']})`);
          }
        }
      }
    }

  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
  }

  console.log("\n" + "=".repeat(80));
}

testApartments().catch(console.error);