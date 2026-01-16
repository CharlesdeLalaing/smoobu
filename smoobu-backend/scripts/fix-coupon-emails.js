/**
 * Migration Script: Fix coupon usageHistory emails
 *
 * This script fixes coupons where the usageHistory.email field contains
 * a Smoobu reservation ID instead of the actual user email.
 *
 * USAGE:
 *   node scripts/fix-coupon-emails.js [MODE]
 *
 * MODES:
 *   dry-run  - (DEFAULT) Show what would be changed without making changes
 *   single   - Fix only ONE record for testing (the first one found)
 *   all      - Fix ALL affected records (run after testing with 'single')
 *
 * EXAMPLES:
 *   node scripts/fix-coupon-emails.js           # Dry run
 *   node scripts/fix-coupon-emails.js dry-run   # Dry run
 *   node scripts/fix-coupon-emails.js single    # Fix one record only
 *   node scripts/fix-coupon-emails.js all       # Fix all records
 */

import admin from 'firebase-admin';
import * as dotenv from "dotenv";

dotenv.config();

// Admin SDK Configuration
const privateKey = process.env.FIREBASE_PRIVATE_KEY
  ? process.env.FIREBASE_PRIVATE_KEY.split(String.raw`\n`).join('\n')
  : undefined;

const serviceAccount = {
  type: "service_account",
  project_id: process.env.FIREBASE_PROJECT_ID,
  private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
  private_key: privateKey,
  client_email: process.env.FIREBASE_CLIENT_EMAIL,
  client_id: process.env.FIREBASE_CLIENT_ID,
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
  client_x509_cert_url: process.env.FIREBASE_CERT_URL
};

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// Check if a string looks like a Smoobu reservation ID (numeric string)
function looksLikeSmoobuId(value) {
  if (!value || typeof value !== 'string') return false;
  // Smoobu IDs are typically 8-9 digit numbers
  return /^\d{6,10}$/.test(value);
}

// Find booking by Smoobu reservation ID
async function findBookingBySmoobuId(smoobuId) {
  const bookingsSnapshot = await db.collection('bookings')
    .where('smoobuReservationId', '==', smoobuId)
    .limit(1)
    .get();

  if (bookingsSnapshot.empty) {
    // Try with number type
    const bookingsSnapshotNum = await db.collection('bookings')
      .where('smoobuReservationId', '==', Number(smoobuId))
      .limit(1)
      .get();

    if (bookingsSnapshotNum.empty) {
      return null;
    }
    return bookingsSnapshotNum.docs[0].data();
  }

  return bookingsSnapshot.docs[0].data();
}

async function findAffectedCoupons() {
  const couponsSnapshot = await db.collection('coupons').get();
  const affected = [];

  for (const doc of couponsSnapshot.docs) {
    const data = doc.data();

    if (!data.usageHistory || data.usageHistory.length === 0) continue;

    // Check each usage record
    for (let i = 0; i < data.usageHistory.length; i++) {
      const usage = data.usageHistory[i];

      if (looksLikeSmoobuId(usage.email)) {
        affected.push({
          docId: doc.id,
          code: data.code,
          usageIndex: i,
          currentEmail: usage.email,  // This is actually the SmoobuId
          usageHistory: data.usageHistory,
          lastUsedBy: data.lastUsedBy
        });
      }
    }
  }

  return affected;
}

async function fixCoupon(couponInfo, dryRun = true) {
  const smoobuId = couponInfo.currentEmail;

  console.log(`\n${'─'.repeat(60)}`);
  console.log(`Coupon: ${couponInfo.code} (Doc: ${couponInfo.docId})`);
  console.log(`Current "email" (actually SmoobuId): ${smoobuId}`);

  // Find the booking to get the real email
  const booking = await findBookingBySmoobuId(smoobuId);

  if (!booking) {
    console.log(`❌ Could not find booking with SmoobuId: ${smoobuId}`);
    console.log(`   Cannot fix this record automatically.`);
    return { success: false, reason: 'booking_not_found' };
  }

  const realEmail = booking.email;
  const realName = `${booking.firstName || ''} ${booking.lastName || ''}`.trim() || 'Unknown';
  const bookingAmount = booking.totalPrice || booking.priceBreakdown?.finalPayableAmount || 0;

  console.log(`✓ Found booking:`);
  console.log(`   Real email: ${realEmail}`);
  console.log(`   Real name: ${realName}`);
  console.log(`   Booking amount: ${bookingAmount}€`);

  if (dryRun) {
    console.log(`\n🔍 DRY RUN - Would update:`);
    console.log(`   usageHistory[${couponInfo.usageIndex}].email: "${smoobuId}" → "${realEmail}"`);
    console.log(`   usageHistory[${couponInfo.usageIndex}].name: "${couponInfo.usageHistory[couponInfo.usageIndex].name}" → "${realName}"`);
    console.log(`   usageHistory[${couponInfo.usageIndex}].smoobuReservationId: null → "${smoobuId}"`);
    if (couponInfo.lastUsedBy === smoobuId) {
      console.log(`   lastUsedBy: "${smoobuId}" → "${realEmail}"`);
    }
    return { success: true, dryRun: true };
  }

  // Actually perform the update
  try {
    // Create updated usage history
    const updatedUsageHistory = [...couponInfo.usageHistory];
    updatedUsageHistory[couponInfo.usageIndex] = {
      ...updatedUsageHistory[couponInfo.usageIndex],
      email: realEmail,
      name: realName,
      smoobuReservationId: smoobuId,
      bookingAmount: bookingAmount || updatedUsageHistory[couponInfo.usageIndex].bookingAmount
    };

    const updateData = {
      usageHistory: updatedUsageHistory,
      updatedAt: new Date().toISOString(),
      _migrationNote: `Fixed email from SmoobuId on ${new Date().toISOString()}`
    };

    // Also fix lastUsedBy if it has the SmoobuId
    if (couponInfo.lastUsedBy === smoobuId) {
      updateData.lastUsedBy = realEmail;
    }

    await db.collection('coupons').doc(couponInfo.docId).update(updateData);

    console.log(`\n✅ UPDATED successfully!`);
    return { success: true, dryRun: false };

  } catch (error) {
    console.log(`\n❌ ERROR updating: ${error.message}`);
    return { success: false, reason: error.message };
  }
}

async function main() {
  const mode = process.argv[2]?.toLowerCase() || 'dry-run';

  console.log('═'.repeat(60));
  console.log('COUPON EMAIL MIGRATION SCRIPT');
  console.log('═'.repeat(60));
  console.log(`Mode: ${mode.toUpperCase()}`);
  console.log(`Time: ${new Date().toISOString()}`);
  console.log('═'.repeat(60));

  if (!['dry-run', 'single', 'all'].includes(mode)) {
    console.error(`\n❌ Invalid mode: ${mode}`);
    console.log('Valid modes: dry-run, single, all');
    process.exit(1);
  }

  // Find all affected coupons
  console.log('\nSearching for affected coupons...');
  const affected = await findAffectedCoupons();

  console.log(`\nFound ${affected.length} coupon(s) with SmoobuId stored as email:`);
  affected.forEach(c => console.log(`  - ${c.code}: "${c.currentEmail}"`));

  if (affected.length === 0) {
    console.log('\n✅ No coupons need fixing!');
    process.exit(0);
  }

  const isDryRun = mode === 'dry-run';
  const isSingle = mode === 'single';

  let processed = 0;
  let fixed = 0;
  let failed = 0;

  const toProcess = isSingle ? [affected[0]] : affected;

  if (isSingle) {
    console.log(`\n⚠️  SINGLE MODE: Only processing first record for testing`);
  }

  for (const coupon of toProcess) {
    const result = await fixCoupon(coupon, isDryRun);
    processed++;

    if (result.success) {
      fixed++;
    } else {
      failed++;
    }
  }

  // Summary
  console.log('\n' + '═'.repeat(60));
  console.log('SUMMARY');
  console.log('═'.repeat(60));
  console.log(`Mode: ${mode.toUpperCase()}`);
  console.log(`Total affected: ${affected.length}`);
  console.log(`Processed: ${processed}`);
  console.log(`Fixed/Would fix: ${fixed}`);
  console.log(`Failed: ${failed}`);

  if (isDryRun) {
    console.log(`\n💡 This was a DRY RUN. No changes were made.`);
    console.log(`   To fix ONE record for testing: node scripts/fix-coupon-emails.js single`);
    console.log(`   To fix ALL records: node scripts/fix-coupon-emails.js all`);
  } else if (isSingle) {
    console.log(`\n💡 Fixed ONE record. Verify it looks correct, then run:`);
    console.log(`   node scripts/fix-coupon-emails.js all`);
  } else {
    console.log(`\n✅ All records processed!`);
  }

  process.exit(0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
