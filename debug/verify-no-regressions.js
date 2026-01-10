// Verify that our fixes didn't BREAK any calculations
// This compares OLD logic vs NEW logic (not vs stored price)
// Run with: node debug/verify-no-regressions.js

import fs from 'fs';

const data = JSON.parse(fs.readFileSync('debug/baseline-nov-dec-2025.json', 'utf8'));

// OLD calculation logic (before our fixes)
function calculateOldWay(booking) {
  const portalName = booking.portalName || booking.channelName || booking.portal;
  const isAirbnb = portalName === "Airbnb";
  const isBookingCom = portalName === "Booking.com";

  const priceElements = booking.priceDetails?.priceElements || [];

  // OLD: No hasExplicitBasePrice check - always try to recalculate
  let basePrice = parseFloat(
    booking.priceDetails?.basePrice || booking.basePrice || 0
  );

  // OLD: Would recalculate basePrice when 0
  if (basePrice === 0 && priceElements.length > 0) {
    const basePriceElement = priceElements.find(
      (el) => el && el.name && (el.name === "Prix de base" || el.name === "Base Price" || el.type === "base")
    );
    if (basePriceElement) {
      basePrice = parseFloat(basePriceElement.amount) || 0;
    } else if (booking.price) {
      // OLD: Would use booking.price as fallback even for collaboration bookings
      basePrice = parseFloat(booking.price) || 0;
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

  // OLD: Would extract guest fees for all portals including Airbnb
  let guestFees = 0;
  if (booking.guestFees) {
    guestFees = parseFloat(booking.guestFees) || 0;
  } else if (priceElements.length > 0) {
    // OLD: No isAirbnb check here
    const guestFeeElement = priceElements.find((el) => {
      if (!el || !el.name || !el.amount) return false;
      const name = el.name.toLowerCase();
      if (el.type === "guests") return true;
      if (name.includes("frais voyageurs")) return true;
      if (name.includes("personne supplémentaire") && !name.includes(" - personne supplémentaire")) return true;
      return false;
    });
    if (guestFeeElement) {
      guestFees = parseFloat(guestFeeElement.amount) || 0;
    }
  }

  // OLD: No Airbnb management fee or additional guest fee
  let managementFee = 0;
  let additionalGuestFee = 0;

  // OLD: No excludePersonExtras - always include person extras
  const extras = getExtrasOldWay(priceElements, portalName);

  // OLD: Would use stored extrasTotal if available
  const extrasTotal = booking.priceDetails?.extrasTotal
    ? parseFloat(booking.priceDetails.extrasTotal)
    : extras.reduce((sum, e) => sum + e.amount, 0);

  let roomTotal = basePrice + linenFee + guestFees - longStayDiscount - couponDiscount;

  return roomTotal + extrasTotal;
}

function getExtrasOldWay(priceElements, portalName) {
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

    // OLD: No excludePersonExtras check - always include

    if (el.name.includes("Prix de base") || el.name.includes("Base price")) continue;
    if (el.name.includes("Code promo") || el.name.includes("Réduction")) continue;
    if (unwantedPatterns.some(p => el.name.includes(p))) continue;
    if (el.name.includes("Frais voyageurs") || el.name.includes("Frais de personnes supplémentaires")) continue;
    if (el.name.toLowerCase().includes("taxe de séjour")) continue;
    if (el.name.includes("TVA")) continue;

    if (isAirbnb) {
      const allowed = el.name.toLowerCase().includes("formule") ||
                      el.name.toLowerCase().includes("anniversaire") ||
                      el.name.toLowerCase().includes("détente");
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

// NEW calculation logic (after our fixes)
function calculateNewWay(booking) {
  const portalName = booking.portalName || booking.channelName || booking.portal;
  const isAirbnb = portalName === "Airbnb";
  const isBookingCom = portalName === "Booking.com";

  const priceElements = booking.priceDetails?.priceElements || [];

  // NEW: Check hasExplicitBasePrice
  const hasExplicitBasePrice = booking.priceDetails?.basePrice !== undefined &&
                                booking.priceDetails?.basePrice !== null;

  let basePrice = parseFloat(
    booking.priceDetails?.basePrice || booking.basePrice || 0
  );

  // NEW: Only recalculate if NOT explicitly set
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

  // NEW: Skip priceElements extraction for Airbnb
  let guestFees = 0;
  if (booking.guestFees) {
    guestFees = parseFloat(booking.guestFees) || 0;
  } else if (!isAirbnb && priceElements.length > 0) {
    const guestFeeElement = priceElements.find((el) => {
      if (!el || !el.name || !el.amount) return false;
      const name = el.name.toLowerCase();
      if (el.type === "guests") return true;
      if (name.includes("frais voyageurs")) return true;
      if (name.includes("personne supplémentaire") && !name.includes(" - personne supplémentaire")) return true;
      return false;
    });
    if (guestFeeElement) {
      guestFees = parseFloat(guestFeeElement.amount) || 0;
    }
  }

  // NEW: Extract Airbnb-specific fees
  let managementFee = 0;
  let additionalGuestFee = 0;

  if (isAirbnb && priceElements.length > 0) {
    const managementFeeEl = priceElements.find(el => el && el.name && el.name.includes("PASS_THROUGH_MANAGEMENT_FEE"));
    if (managementFeeEl) managementFee = parseFloat(managementFeeEl.amount) || 0;

    const additionalGuestFeeEl = priceElements.find(el => el && el.name && el.name.includes("Additional Guest Fee"));
    if (additionalGuestFeeEl) additionalGuestFee = parseFloat(additionalGuestFeeEl.amount) || 0;
  }

  // NEW (FIXED): Only exclude person extras if there's a standalone entry in extras array
  const extrasArray = booking.extras || [];
  const hasStandalonePersonExtraInExtras = extrasArray.some(
    (extra) => extra.name && extra.name.includes("Personne supplémentaire")
  );
  const excludePersonExtras = hasStandalonePersonExtraInExtras;

  const extras = getExtrasNewWay(priceElements, portalName, excludePersonExtras);

  // NEW: Always recalculate from displayed extras
  const extrasTotal = extras.reduce((sum, e) => sum + e.amount, 0);

  let roomTotal = basePrice + linenFee + guestFees + managementFee + additionalGuestFee - longStayDiscount - couponDiscount;

  return roomTotal + extrasTotal;
}

function getExtrasNewWay(priceElements, portalName, excludePersonExtras) {
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

    // NEW: Skip person extras when excludePersonExtras is true
    if (excludePersonExtras && el.name.includes("Personne supplémentaire")) continue;

    if (el.name.includes("Prix de base") || el.name.includes("Base price")) continue;
    if (el.name.includes("Code promo") || el.name.includes("Réduction")) continue;
    if (unwantedPatterns.some(p => el.name.includes(p))) continue;
    if (el.name.includes("Frais voyageurs") || el.name.includes("Frais de personnes supplémentaires")) continue;
    if (el.name.toLowerCase().includes("taxe de séjour")) continue;
    if (el.name.includes("TVA")) continue;

    if (isAirbnb) {
      const allowed = el.name.toLowerCase().includes("formule") ||
                      el.name.toLowerCase().includes("anniversaire") ||
                      el.name.toLowerCase().includes("détente") ||
                      el.name.toLowerCase().includes("gourmet") ||
                      el.name.toLowerCase().includes("essentiel") ||
                      el.name.toLowerCase().includes("romantique");
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
console.log('REGRESSION TEST: Comparing OLD vs NEW calculation logic');
console.log('='.repeat(100));

// Collect all reservations
const allReservations = [];

if (data.november) {
  Object.entries(data.november).forEach(([id, booking]) => {
    allReservations.push({ id, booking, month: 'November' });
  });
}

if (data.december) {
  Object.entries(data.december).forEach(([id, booking]) => {
    allReservations.push({ id, booking, month: 'December' });
  });
}

if (data.bugReservations) {
  Object.entries(data.bugReservations).forEach(([id, booking]) => {
    if (!allReservations.find(r => r.id === id)) {
      allReservations.push({ id, booking, month: 'Bug Cases' });
    }
  });
}

console.log(`\nTotal reservations: ${allReservations.length}`);

// Statistics
let unchanged = 0;
let improved = [];  // Bug cases that are now correct
let changed = [];   // Other reservations that changed

for (const { id, booking, month } of allReservations) {
  const oldTotal = calculateOldWay(booking);
  const newTotal = calculateNewWay(booking);
  const diff = newTotal - oldTotal;

  const expectedValue = expectedValues[id];

  if (Math.abs(diff) < 0.01) {
    unchanged++;
  } else if (expectedValue !== undefined) {
    // This is a bug case
    const oldDiff = Math.abs(oldTotal - expectedValue);
    const newDiff = Math.abs(newTotal - expectedValue);

    improved.push({
      id,
      guestName: booking.guestName,
      portalName: booking.portalName || booking.channelName,
      expected: expectedValue,
      oldTotal: oldTotal.toFixed(2),
      newTotal: newTotal.toFixed(2),
      status: newDiff < 1 ? '✓ FIXED' : '✗ STILL WRONG'
    });
  } else {
    // Not a bug case, but calculation changed
    changed.push({
      id,
      guestName: booking.guestName,
      portalName: booking.portalName || booking.channelName,
      month,
      oldTotal: oldTotal.toFixed(2),
      newTotal: newTotal.toFixed(2),
      diff: diff.toFixed(2)
    });
  }
}

console.log('');
console.log('='.repeat(100));
console.log('BUG CASES (The 7 reservations we were fixing)');
console.log('='.repeat(100));
console.log('');

for (const result of improved) {
  console.log(`#${result.id} - ${result.guestName} (${result.portalName})`);
  console.log(`  Expected: ${result.expected}€`);
  console.log(`  OLD calculation: ${result.oldTotal}€`);
  console.log(`  NEW calculation: ${result.newTotal}€`);
  console.log(`  ${result.status}`);
  console.log('');
}

console.log('='.repeat(100));
console.log('OTHER RESERVATIONS THAT CHANGED');
console.log('='.repeat(100));
console.log('');

if (changed.length === 0) {
  console.log('NONE - No other reservations were affected by the fixes!');
} else {
  console.log(`${changed.length} reservations changed:\n`);
  for (const c of changed) {
    console.log(`#${c.id} - ${c.guestName} (${c.portalName}) - ${c.month}`);
    console.log(`  OLD: ${c.oldTotal}€ → NEW: ${c.newTotal}€ (diff: ${c.diff >= 0 ? '+' : ''}${c.diff}€)`);
    console.log('');
  }
}

console.log('='.repeat(100));
console.log('SUMMARY');
console.log('='.repeat(100));
console.log('');
console.log(`Unchanged reservations: ${unchanged}`);
console.log(`Bug cases fixed: ${improved.filter(i => i.status.includes('FIXED')).length}/${improved.length}`);
console.log(`Other reservations changed: ${changed.length}`);
console.log('');

if (improved.every(i => i.status.includes('FIXED')) && changed.length === 0) {
  console.log('✓ ALL GOOD - Bug cases are fixed and no other reservations were affected!');
} else if (improved.every(i => i.status.includes('FIXED'))) {
  console.log('⚠ Bug cases are fixed, but some other reservations changed. Review above.');
} else {
  console.log('✗ Some issues remain. Review the details above.');
}
