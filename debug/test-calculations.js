// Test script to simulate BookingReport calculations
// Run with: node debug/test-calculations.js

import fs from 'fs';

const data = JSON.parse(fs.readFileSync('debug/baseline-nov-dec-2025.json', 'utf8'));

// Simulate the calculation from BookingsDetails.jsx (with fixes)
function calculateBookingTotal(booking) {
  const portalName = booking.portalName || booking.channelName || booking.portal;
  const isAirbnb = portalName === "Airbnb";
  const isBookingCom = portalName === "Booking.com";

  const priceElements = booking.priceDetails?.priceElements || [];

  let basePrice = parseFloat(booking.priceDetails?.basePrice || booking.basePrice || 0);
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

  // Extract guest fees (NOT for Airbnb - handled separately via additionalGuestFee)
  let guestFees = 0;
  if (booking.guestFees) {
    guestFees = parseFloat(booking.guestFees) || 0;
  } else if (!isAirbnb) {
    // Only extract from priceElements for non-Airbnb
    guestFees = parseFloat(booking.guestFees || 0);
  }

  // FIX: Extract Airbnb-specific fees
  let managementFee = 0;
  let additionalGuestFee = 0;

  if (isAirbnb && priceElements.length > 0) {
    const managementFeeEl = priceElements.find(el => el && el.name && el.name.includes("PASS_THROUGH_MANAGEMENT_FEE"));
    if (managementFeeEl) managementFee = parseFloat(managementFeeEl.amount) || 0;

    const additionalGuestFeeEl = priceElements.find(el => el && el.name && el.name.includes("Additional Guest Fee"));
    if (additionalGuestFeeEl) additionalGuestFee = parseFloat(additionalGuestFeeEl.amount) || 0;
  }

  // FIX: Exclude person extras when basePrice > 0
  const excludePersonExtras = basePrice > 0;

  // Get extras from priceElements (simulating getCleanExtrasFromPriceElements)
  const extras = getExtrasFromPriceElements(priceElements, portalName, excludePersonExtras);
  const extrasTotal = extras.reduce((sum, e) => sum + e.amount, 0);

  // Calculate room total (including Airbnb fees)
  let roomTotal = basePrice + linenFee + guestFees + managementFee + additionalGuestFee - longStayDiscount - couponDiscount;

  // Calculate total
  const calculatedTotal = roomTotal + extrasTotal;

  return {
    basePrice,
    linenFee,
    guestFees,
    managementFee,
    additionalGuestFee,
    longStayDiscount,
    couponDiscount,
    roomTotal,
    extras,
    extrasTotal,
    calculatedTotal,
    storedPrice: booking.price,
    storedExtrasTotal: booking.priceDetails?.extrasTotal,
    excludePersonExtras
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
    if (el.amount <= 0) continue; // Skip discounts

    // FIX: Skip person extras when excludePersonExtras is true
    if (excludePersonExtras && el.name.includes("Personne supplémentaire")) continue;

    // Skip base price and discounts
    if (el.name.includes("Prix de base") || el.name.includes("Base price")) continue;
    if (el.name.includes("Code promo") || el.name.includes("Réduction")) continue;

    // Skip unwanted patterns
    if (unwantedPatterns.some(p => el.name.includes(p))) continue;

    // Skip guest fees (they're added separately)
    if (el.name.includes("Frais voyageurs") || el.name.includes("Frais de personnes supplémentaires")) continue;

    // For Airbnb, only allow specific items
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

// Test all bug reservations
const bugIds = ['110229666', '120163346', '120252316', '119673136', '93687759', '119462811', '113496046'];
const expected = {
  '110229666': 275,
  '120163346': 334,
  '120252316': 750,
  '119673136': 315,
  '93687759': 70,
  '119462811': 460,
  '113496046': 414
};

console.log('='.repeat(80));
console.log('BOOKING CALCULATION TEST');
console.log('='.repeat(80));

for (const id of bugIds) {
  const booking = data.bugReservations[id];
  if (!booking) {
    console.log(`\n#${id}: NOT FOUND\n`);
    continue;
  }

  const calc = calculateBookingTotal(booking);
  const diff = calc.calculatedTotal - expected[id];
  const status = Math.abs(diff) < 1 ? '✓' : '✗';

  console.log(`\n${'='.repeat(80)}`);
  console.log(`#${id} - ${booking.guestName} (${booking.portalName || booking.channelName})`);
  console.log('='.repeat(80));
  console.log(`Expected: ${expected[id]}€ | Calculated: ${calc.calculatedTotal}€ | Diff: ${diff >= 0 ? '+' : ''}${diff}€ ${status}`);
  console.log(`Stored Price: ${calc.storedPrice}€ | Stored ExtrasTotal: ${calc.storedExtrasTotal}€`);
  console.log(`Exclude Person Extras: ${calc.excludePersonExtras}`);
  console.log('-'.repeat(40));
  console.log(`Base Price: ${calc.basePrice}€`);
  console.log(`Linen Fee: ${calc.linenFee}€`);
  console.log(`Guest Fees: ${calc.guestFees}€`);
  if (calc.managementFee > 0) console.log(`Management Fee (Airbnb): ${calc.managementFee}€`);
  if (calc.additionalGuestFee > 0) console.log(`Additional Guest Fee (Airbnb): ${calc.additionalGuestFee}€`);
  console.log(`Long Stay Discount: -${calc.longStayDiscount}€`);
  console.log(`Coupon Discount: -${calc.couponDiscount}€`);
  console.log(`Room Total: ${calc.roomTotal}€`);
  console.log('-'.repeat(40));
  console.log('Extras:');
  for (const e of calc.extras) {
    console.log(`  • ${e.name}: ${e.amount}€ (qty: ${e.quantity})`);
  }
  console.log(`Extras Total: ${calc.extrasTotal}€`);
  console.log('-'.repeat(40));
  console.log(`FINAL: ${calc.roomTotal}€ (room) + ${calc.extrasTotal}€ (extras) = ${calc.calculatedTotal}€`);

  // Show priceElements for debugging
  console.log('\nRaw priceElements:');
  const pe = booking.priceDetails?.priceElements || [];
  for (const el of pe) {
    console.log(`  [${el.type || 'N/A'}] ${el.name}: ${el.amount}€`);
  }
}
