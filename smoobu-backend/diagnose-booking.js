// Diagnostic tool for troubleshooting booking sync issues
// Usage: node diagnose-booking.js <booking-id>

import * as dotenv from "dotenv";
import { SmoobuClient } from "./third-party/smoobu/actions/api/fetch-and-sync/smoobu-client.js";

dotenv.config();

async function diagnoseBooking() {
  const bookingId = process.argv[2];
  
  if (!bookingId) {
    console.error("❌ Usage: node diagnose-booking.js <booking-id>");
    console.error("   Example: node diagnose-booking.js 107123456");
    process.exit(1);
  }

  const apiKey = process.env.SMOOBU_API_KEY;
  if (!apiKey) {
    console.error("❌ SMOOBU_API_KEY not found in environment");
    process.exit(1);
  }

  console.log(`🔍 DIAGNOSING BOOKING: ${bookingId}`);
  console.log("=" .repeat(60));

  const client = new SmoobuClient();
  
  try {
    const diagnosis = await client.diagnoseBookingIssue(bookingId);
    
    console.log(`\n📋 DIAGNOSIS RESULTS:`);
    console.log(`Booking ID: ${diagnosis.bookingId}`);
    console.log(`Is Problematic: ${diagnosis.isProblematic ? '🚨 YES' : '✅ NO'}`);
    console.log(`Reason: ${diagnosis.reason}`);
    console.log(`Recommendation: ${diagnosis.recommendation}`);
    
    if (diagnosis.bookingDetails) {
      console.log(`\n📄 BOOKING DETAILS:`);
      console.log(`Guest: ${diagnosis.bookingDetails.guest}`);
      console.log(`Apartment: ${diagnosis.bookingDetails.apartment} (ID: ${diagnosis.bookingDetails.apartmentId})`);
      console.log(`Channel: ${diagnosis.bookingDetails.channel} (ID: ${diagnosis.bookingDetails.channelId})`);
      console.log(`Arrival: ${diagnosis.bookingDetails.arrival}`);
      console.log(`Has Extras: ${diagnosis.bookingDetails.hasExtras ? 'Yes' : 'No'} (${diagnosis.bookingDetails.extraCount} extras)`);
    }

    if (diagnosis.isProblematic) {
      console.log(`\n🔧 ACTION REQUIRED:`);
      console.log(`1. Open: /home/mihaipatap/smoobu/smoobu-backend/third-party/smoobu/actions/api/fetch-and-sync/smoobu-client.js`);
      console.log(`2. Find the 'knownProblematicBookingIds' array (around line 302)`);
      console.log(`3. Add this booking ID: "${bookingId}",`);
      console.log(`4. Add a comment like: // ${diagnosis.bookingDetails.guest} - ${diagnosis.bookingDetails.channel} ${diagnosis.bookingDetails.apartment}`);
      console.log(`\nExample addition:`);
      console.log(`"${bookingId}", // ${diagnosis.bookingDetails.guest} - ${diagnosis.bookingDetails.channel} ${diagnosis.bookingDetails.apartment}`);
    }
    
  } catch (error) {
    console.error(`❌ Error during diagnosis: ${error.message}`);
  }
}

diagnoseBooking().catch(console.error);