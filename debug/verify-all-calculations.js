// Verification script to check all reservations after fixes
// Run with: node debug/verify-all-calculations.js

import fs from 'fs';

const data = JSON.parse(fs.readFileSync('debug/baseline-nov-dec-2025.json', 'utf8'));

// Simulate the FIXED calculation logic from BookingsDetails.jsx
function calculateBookingTotal(booking) {
  const portalName = booking.portalName || booking.channelName || booking.portal;
  const isAirbnb = portalName === "Airbnb";
  const isBookingCom = portalName === "Booking.com";

  const priceElements = booking.priceDetails?.priceElements || [];

  // Get base price - check if it's explicitly set in priceDetails
  // For collaboration/free bookings, priceDetails.basePrice is intentionally 0
  const hasExplicitBasePrice = booking.priceDetails?.basePrice !== undefined &&
                                booking.priceDetails?.basePrice !== null;

  let basePrice = parseFloat(
    booking.priceDetails?.basePrice || booking.basePrice || 0
  );

  // Only try to calculate basePrice if:
  // 1. basePrice is 0 AND
  // 2. We don't have explicit priceDetails.basePrice AND
  // 3. We have priceElements to calculate from
  if (basePrice === 0 && !hasExplicitBasePrice && priceElements.length > 0) {
    const basePriceElement = priceElements.find(
      (el) => el && el.name && (el.name === "Prix de base" || el.name === "Base Price" || el.type === "base")
    );
    if (basePriceElement) {
      basePrice = parseFloat(basePriceElement.amount) || 0;
    }
  }

  let linenFee = parseFloat(booking.priceDetails?.linenFee || booking.linenFee || 0);
  let longStayDiscount = parseFloat(
    booking.priceBreakdown?.appliedLongStayDiscount ||
    booking.priceDetails?.longStayDiscount || 0
  );
  let couponDiscount = parseFloat(
    booking.couponApplied?.discount ||
    booking.priceDetails?.couponDiscount ||
    booking.priceDetails?.promoCode?.amount || 0
  );

  // Extract guest fees (NOT for Airbnb - handled separately)
  let guestFees = 0;
  if (booking.guestFees) {
    guestFees = parseFloat(booking.guestFees) || 0;
  } else if (!isAirbnb && priceElements.length > 0) {
    const guestFeeElement = priceElements.find((el) => {
      if (!el || !el.name || !el.amount) return false;
      const name = el.name.toLowerCase();
      if (el.type === "guests") return true;
      if (name.includes("frais voyageurs")) return true;
      if (name.includes("frais de personnes supplémentaires")) return true;
      if (name.includes("personne supplémentaire") && !name.includes(" - personne supplémentaire")) return true;
      return false;
    });
    if (guestFeeElement) {
      guestFees = parseFloat(guestFeeElement.amount) || 0;
    }
  }

  // Airbnb-specific fees
  let managementFee = 0;
  let additionalGuestFee = 0;

  if (isAirbnb && priceElements.length > 0) {
    const managementFeeEl = priceElements.find(el => el && el.name && el.name.includes("PASS_THROUGH_MANAGEMENT_FEE"));
    if (managementFeeEl) managementFee = parseFloat(managementFeeEl.amount) || 0;

    const additionalGuestFeeEl = priceElements.find(el => el && el.name && el.name.includes("Additional Guest Fee"));
    if (additionalGuestFeeEl) additionalGuestFee = parseFloat(additionalGuestFeeEl.amount) || 0;
  }

  // Taxe de séjour for Booking.com
  let taxeDeSejour = 0;
  if (isBookingCom && priceElements.length > 0) {
    const taxeElement = priceElements.find(el => el && el.name && el.name.toLowerCase().includes("taxe de séjour"));
    if (taxeElement) taxeDeSejour = parseFloat(taxeElement.amount) || 0;
  }

  // Exclude person extras when basePrice > 0
  const excludePersonExtras = basePrice > 0;

  // Get extras from priceElements
  const extras = getExtrasFromPriceElements(priceElements, portalName, excludePersonExtras);
  const extrasTotal = extras.reduce((sum, e) => sum + e.amount, 0);

  // Calculate room total
  let roomTotal = basePrice + linenFee + guestFees + managementFee + additionalGuestFee - longStayDiscount - couponDiscount;
  if (isBookingCom) {
    roomTotal += taxeDeSejour;
  }

  // Calculate total
  const calculatedTotal = roomTotal + extrasTotal;

  return {
    basePrice,
    linenFee,
    guestFees,
    managementFee,
    additionalGuestFee,
    taxeDeSejour,
    longStayDiscount,
    couponDiscount,
    roomTotal,
    extras,
    extrasTotal,
    calculatedTotal,
    storedPrice: booking.price,
    storedExtrasTotal: booking.priceDetails?.extrasTotal,
    hasExplicitBasePrice,
    excludePersonExtras,
    portalName
  };
}

function getExtrasFromPriceElements(priceElements, portalName, excludePersonExtras = false) {
  if (!priceElements || !Array.isArray(priceElements)) return [];

  const isAirbnb = portalName === "Airbnb";

  const unwantedPatterns = [
    "cancellation", "Cancellation", "pass_through", "PASS_THROUGH",
    "service fee", "Service Fee", "host fee", "Host Fee",
    "guest fee", "Guest Fee", "cleaning fee", "Cleaning Fee",
    "LINEN_FEE", "linen_fee", "Base Price", "base_price",
    "Commission", "commission", "Tax", "tax", "VAT", "vat"
  ];

  const result = [];

  for (const el of priceElements) {
    if (!el || !el.amount || !el.name) continue;
    if (el.amount <= 0) continue;

    // Skip person extras when excludePersonExtras is true
    if (excludePersonExtras && el.name.includes("Personne supplémentaire")) continue;

    // Skip base price and discounts
    if (el.name.includes("Prix de base") || el.name.includes("Base price")) continue;
    if (el.name.includes("Code promo") || el.name.includes("Réduction")) continue;

    // Skip unwanted patterns
    if (unwantedPatterns.some(p => el.name.includes(p))) continue;

    // Skip guest fees (added separately)
    if (el.name.includes("Frais voyageurs") || el.name.includes("Frais de personnes supplémentaires")) continue;

    // Skip taxe de séjour (added to room total for Booking.com)
    if (el.name.toLowerCase().includes("taxe de séjour")) continue;

    // Skip TVA
    if (el.name.includes("TVA")) continue;

    // For Airbnb, only allow specific items
    if (isAirbnb) {
      const allowed = el.name.toLowerCase().includes("formule") ||
                      el.name.toLowerCase().includes("anniversaire") ||
                      el.name.toLowerCase().includes("détente") ||
                      el.name.toLowerCase().includes("gourmet") ||
                      el.name.toLowerCase().includes("essentiel") ||
                      el.name.toLowerCase().includes("romantique") ||
                      el.name.includes("Brut de Bioul") ||
                      el.name.includes("Cortil Barco");
      if (!allowed) continue;
    }

    result.push({
      name: el.name,
      amount: parseFloat(el.amount),
      quantity: el.quantity || 1
    });
  }

  return result;
}

// Expected values for the 7 bug reservations
const expectedValues = {
  '110229666': 275,
  '120163346': 334,
  '120252316': 750,
  '119673136': 315,
  '93687759': 70,
  '119462811': 460,
  '113496046': 414
};

console.log('='.repeat(100));
console.log('VERIFICATION OF ALL RESERVATIONS AFTER FIXES');
console.log('='.repeat(100));

// Collect all reservations
const allReservations = [];

// Add November reservations
if (data.november) {
  Object.entries(data.november).forEach(([id, booking]) => {
    allReservations.push({ id, booking, month: 'November' });
  });
}

// Add December reservations
if (data.december) {
  Object.entries(data.december).forEach(([id, booking]) => {
    allReservations.push({ id, booking, month: 'December' });
  });
}

// Add bug reservations
if (data.bugReservations) {
  Object.entries(data.bugReservations).forEach(([id, booking]) => {
    // Check if already included
    if (!allReservations.find(r => r.id === id)) {
      allReservations.push({ id, booking, month: 'Bug Cases' });
    }
  });
}

console.log(`\nTotal reservations to verify: ${allReservations.length}`);
console.log('');

// Statistics
let totalChecked = 0;
let exactMatches = 0;
let closeMatches = 0; // Within 5€
let significantDiffs = [];
let bugCaseResults = [];

// Check each reservation
for (const { id, booking, month } of allReservations) {
  const calc = calculateBookingTotal(booking);
  const storedPrice = parseFloat(booking.price) || 0;
  const diff = calc.calculatedTotal - storedPrice;
  const absDiff = Math.abs(diff);

  totalChecked++;

  // Check if this is a bug case with expected value
  const expectedValue = expectedValues[id];

  if (expectedValue !== undefined) {
    const diffFromExpected = calc.calculatedTotal - expectedValue;
    const status = Math.abs(diffFromExpected) < 1 ? '✓ FIXED' : '✗ STILL BROKEN';
    bugCaseResults.push({
      id,
      guestName: booking.guestName,
      portalName: calc.portalName,
      expected: expectedValue,
      calculated: calc.calculatedTotal,
      stored: storedPrice,
      diffFromExpected,
      status
    });
  }

  // Track match quality
  if (absDiff < 1) {
    exactMatches++;
  } else if (absDiff <= 5) {
    closeMatches++;
  } else {
    // Significant difference - but check if it's expected (bug case)
    if (expectedValue === undefined) {
      significantDiffs.push({
        id,
        guestName: booking.guestName,
        portalName: calc.portalName,
        month,
        stored: storedPrice,
        calculated: calc.calculatedTotal,
        diff,
        basePrice: calc.basePrice,
        extrasTotal: calc.extrasTotal,
        hasExplicitBasePrice: calc.hasExplicitBasePrice
      });
    }
  }
}

// Report bug case results
console.log('='.repeat(100));
console.log('BUG CASE VERIFICATION (The 7 reservations we were fixing)');
console.log('='.repeat(100));
console.log('');

for (const result of bugCaseResults) {
  const diffSign = result.diffFromExpected >= 0 ? '+' : '';
  console.log(`#${result.id} - ${result.guestName} (${result.portalName})`);
  console.log(`  Expected: ${result.expected}€ | Calculated: ${result.calculated.toFixed(2)}€ | Diff: ${diffSign}${result.diffFromExpected.toFixed(2)}€ | ${result.status}`);
  console.log('');
}

// Summary statistics
console.log('='.repeat(100));
console.log('OVERALL STATISTICS');
console.log('='.repeat(100));
console.log('');
console.log(`Total reservations checked: ${totalChecked}`);
console.log(`Exact matches (diff < 1€): ${exactMatches}`);
console.log(`Close matches (diff 1-5€): ${closeMatches}`);
console.log(`Significant differences (diff > 5€): ${significantDiffs.length}`);
console.log('');

// Report significant differences (potential issues)
if (significantDiffs.length > 0) {
  console.log('='.repeat(100));
  console.log('RESERVATIONS WITH SIGNIFICANT DIFFERENCES (potential issues)');
  console.log('='.repeat(100));
  console.log('');

  for (const diff of significantDiffs) {
    console.log(`#${diff.id} - ${diff.guestName} (${diff.portalName}) - ${diff.month}`);
    console.log(`  Stored: ${diff.stored}€ | Calculated: ${diff.calculated.toFixed(2)}€ | Diff: ${diff.diff >= 0 ? '+' : ''}${diff.diff.toFixed(2)}€`);
    console.log(`  BasePrice: ${diff.basePrice}€ | ExtrasTotal: ${diff.extrasTotal}€ | HasExplicitBasePrice: ${diff.hasExplicitBasePrice}`);
    console.log('');
  }
} else {
  console.log('No unexpected significant differences found! All calculations are consistent.');
}

// Final summary
console.log('='.repeat(100));
console.log('FINAL SUMMARY');
console.log('='.repeat(100));
console.log('');
const bugCasesFixed = bugCaseResults.filter(r => r.status.includes('FIXED')).length;
const bugCasesBroken = bugCaseResults.filter(r => r.status.includes('BROKEN')).length;
console.log(`Bug cases fixed: ${bugCasesFixed}/${bugCaseResults.length}`);
console.log(`Bug cases still broken: ${bugCasesBroken}/${bugCaseResults.length}`);
console.log(`Other reservations with issues: ${significantDiffs.length}`);
console.log('');
if (bugCasesFixed === bugCaseResults.length && significantDiffs.length === 0) {
  console.log('✓ ALL TESTS PASSED - Fixes are working correctly!');
} else {
  console.log('✗ SOME ISSUES REMAIN - Review the details above.');
}
