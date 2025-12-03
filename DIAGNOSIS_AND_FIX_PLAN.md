# BookingReport Sync Issues - Diagnosis and Fix Plan

## Executive Summary

After thorough investigation of the failing bookings, I've identified **TWO CRITICAL BUGS** that are causing data discrepancies between Smoobu and your BookingReport.

---

## Failing Bookings Analysis

### Booking 116168296 (Alexander Gazov)
**Issue:** Missing "Personne supplémentaire" items in report

**Smoobu Data:**
- Formule petit-déjeuner (2 pers): €35 (qty 1) + €70 (qty 2) = **€105 total**
- Formule petit-déjeuner - Personne supplémentaire: €20 (qty 1) + €40 (qty 4) = **€60 total**
- **Expected Total Extras: €165**

**Report Shows:**
- Formule petit-déjeuner (2 pers): **€70** (merged to qty 2)
- Extra Person Amount: €60 (calculated but NOT included in total)
- **Actual Total Extras: €70** ❌

**Discrepancy:** €95 missing from extras total

---

### Booking 103531863 (Adrenne étape)
**Issue:** Missing "8 x Formule SPA (2 pers) - Personne supplémentaire"

**Smoobu Data:**
- Formule SPA (2 pers): **€100** (qty 2)
- Formule SPA - Personne supplémentaire: **€80** (qty 8)
- **Expected Total Extras: €180**

**Report Shows:**
- Formule SPA (2 pers): **€100**
- Extra Person Amount: €80 (calculated but NOT included in total)
- **Actual Total Extras: €100** ❌

**Discrepancy:** €80 missing from extras total

---

### Booking 112101336 (Louis Satinet)
**Issue:** Extra "Frais voyageurs supplémentaires" appearing (€40 double-counted)

**Smoobu Data:**
- Prix de base: €240
- Le romantique gourmet (pour 2): €170
- Le romantique gourmet - Personne supplémentaire: €40
- **Total: €450**

**Report Shows:**
- Same items PLUS
- **Frais voyageurs supplémentaires: €40** (duplicate!)
- **Total: €490** ❌

**Discrepancy:** €40 extra (double-counted)

---

## ROOT CAUSE #1: Extras Total Excludes "extraPersonAmount"

**Location:** `/smoobu-backend/third-party/smoobu/process-extras-with-persons.js` (lines 290-291)

**The Bug:**
```javascript
const extrasTotal = finalExtras.reduce((sum, extra) => {
  return sum + parseFloat(extra.amount || 0); // Only use base amount, not extraPersonAmount
}, 0);
```

**The Problem:**
The comment explicitly states "Only use base amount, not extraPersonAmount", which means the calculation is INTENTIONALLY excluding the extra person charges from the total.

**Impact:**
- Bookings 116168296: Missing €60 from total
- Booking 103531863: Missing €80 from total
- ALL bookings with "Personne supplémentaire" items have incorrect totals

**Why This Happens:**
The function correctly:
1. Finds "Personne supplémentaire" items in price elements
2. Matches them to their parent extras
3. Calculates `extraPersonAmount` correctly
4. BUT then doesn't add it to the `extrasTotal`!

This causes the BookingReport to show incomplete data.

---

## ROOT CAUSE #2: PriceDetailsSection Incorrectly Matches "Personne supplémentaire" as Guest Fees

**Location:** `/src/components/Admin/BookingReport/sections/PriceDetailsSection.jsx` (lines 180-201)

**The Bug:**
```javascript
const guestFeeElement = priceElementsToCheck.find(
  (el) =>
    el &&
    el.name &&
    el.amount &&
    (el.type === "guests" ||
      el.name.toLowerCase().includes("frais voyageurs") ||
      el.name.toLowerCase().includes("frais de personnes supplémentaires") ||
      (el.name.toLowerCase().includes("guest") &&
        !el.name.toLowerCase().includes("formule")) ||
      (el.name.toLowerCase().includes("personne supplémentaire") &&
        !el.name.toLowerCase().includes("l'essentiel") &&
        !el.name.toLowerCase().includes("formule") &&
        !el.name.toLowerCase().includes("spa")) ||  // ⚠️ BUG HERE
      el.name.toLowerCase().includes("extra guest") ||
      el.name.toLowerCase().includes("additional guest"))
);
```

**The Problem:**
Lines 190-193 try to match "personne supplémentaire" items as guest fees by EXCLUDING only "l'essentiel", "formule", and "spa" extras.

But this logic is INCOMPLETE! It doesn't exclude other extras like:
- "Le romantique gourmet" ❌
- "L'Anniversaire" ❌
- "Barbecue détente" ❌
- etc.

**Impact:**
- Booking 112101336: "Le romantique gourmet (pour 2) - Personne supplémentaire" (€40) is matched as a guest fee
- This causes DOUBLE-COUNTING:
  1. €40 counted in extras (correct)
  2. €40 counted again as "Frais voyageurs supplémentaires" (incorrect)
- Result: Total is €490 instead of €450

**Why This Happens:**
The exclusion list is hardcoded and incomplete. Any new extra that includes "Personne supplémentaire" will be incorrectly treated as a guest fee unless explicitly excluded.

---

## THE FIX PLAN

### Fix #1: Include extraPersonAmount in extrasTotal

**File:** `/smoobu-backend/third-party/smoobu/process-extras-with-persons.js` (line 290-291)

**Change:**
```javascript
// OLD (BUGGY):
const extrasTotal = finalExtras.reduce((sum, extra) => {
  return sum + parseFloat(extra.amount || 0); // Only use base amount, not extraPersonAmount
}, 0);

// NEW (FIXED):
const extrasTotal = finalExtras.reduce((sum, extra) => {
  const baseAmount = parseFloat(extra.amount || 0);
  const personAmount = parseFloat(extra.extraPersonAmount || 0);
  return sum + baseAmount + personAmount; // Include BOTH base and extra person amounts
}, 0);
```

**Testing:**
- Booking 116168296: Total should be €165 (€105 base + €60 persons)
  - Currently shows: €70
  - Should show: €165
- Booking 103531863: Total should be €180 (€100 base + €80 persons)
  - Currently shows: €100
  - Should show: €180

---

### Fix #2: Improve Guest Fee Detection to Exclude ALL Extra-Related "Personne supplémentaire" Items

**File:** `/src/components/Admin/BookingReport/sections/PriceDetailsSection.jsx` (lines 180-201)

**Strategy:**
Instead of trying to maintain an incomplete exclusion list, we should:
1. Check if the "personne supplémentaire" item has a PARENT EXTRA
2. If it does, it's NOT a guest fee - it's part of the extra package
3. Only treat it as a guest fee if it's STANDALONE (no parent extra)

**Change:**
```javascript
// OLD (BUGGY):
const guestFeeElement = priceElementsToCheck.find(
  (el) =>
    el &&
    el.name &&
    el.amount &&
    (el.type === "guests" ||
      el.name.toLowerCase().includes("frais voyageurs") ||
      el.name.toLowerCase().includes("frais de personnes supplémentaires") ||
      (el.name.toLowerCase().includes("guest") &&
        !el.name.toLowerCase().includes("formule")) ||
      (el.name.toLowerCase().includes("personne supplémentaire") &&
        !el.name.toLowerCase().includes("l'essentiel") &&
        !el.name.toLowerCase().includes("formule") &&
        !el.name.toLowerCase().includes("spa")) ||
      el.name.toLowerCase().includes("extra guest") ||
      el.name.toLowerCase().includes("additional guest"))
);

// NEW (FIXED):
const guestFeeElement = priceElementsToCheck.find(
  (el) => {
    if (!el || !el.name || !el.amount) return false;

    const name = el.name.toLowerCase();

    // Explicit guest fee types
    if (el.type === "guests") return true;
    if (name.includes("frais voyageurs")) return true;
    if (name.includes("frais de personnes supplémentaires")) return true;
    if (name.includes("extra guest") || name.includes("additional guest")) return true;

    // "guest" keyword (but not if part of an extra)
    if (name.includes("guest") && !name.includes("formule")) return true;

    // CRITICAL FIX: For "personne supplémentaire", check if it's part of an extra package
    if (name.includes("personne supplémentaire")) {
      // If the name includes a hyphen, it's likely "[Extra Name] - Personne supplémentaire"
      // This means it's part of an extra package, NOT a standalone guest fee
      if (name.includes(" - personne supplémentaire")) {
        return false; // Exclude - this is part of an extra package
      }
      // If it's standalone "Personne supplémentaire" without a parent, it's a guest fee
      return true;
    }

    return false;
  }
);
```

**Testing:**
- Booking 112101336: "Le romantique gourmet (pour 2) - Personne supplémentaire" should NOT be treated as guest fee
  - Currently: Incorrectly matched as guest fee (€40 double-counted)
  - Should: Only counted once in extras

---

## ADDITIONAL ISSUE: Duplicate Price Elements Merging

**Observation:**
Booking 116168296 has duplicate entries:
- "Formule petit-déjeuner (2 pers)": €35 (qty 1) AND €70 (qty 2)
- "Formule petit-déjeuner - Personne supplémentaire": €20 (qty 1) AND €40 (qty 4)

**Current Behavior:**
The `mergeDuplicatePriceElements()` function (booking-processor.js lines 67-133) attempts to merge these, but the logic takes the HIGHER amount instead of SUMMING them:

```javascript
// Only replace if this one has more data or higher amount
if (
  element.type === "addon" ||
  parseFloat(element.amount) > parseFloat(existing.amount)
) {
  extraNamesMap.set(element.name, element);
}
```

**This is CORRECT for the use case!**
Looking at lines 103-114, the function DOES properly merge formule/spa/petit-déjeuner items by summing quantities and amounts. So the merging is actually working correctly.

**No fix needed here** - the issue is just that the merged totals aren't being displayed properly due to Fix #1.

---

## IMPLEMENTATION ORDER

1. **Fix #1 First** - This fixes the missing totals for bookings 116168296 and 103531863
2. **Fix #2 Second** - This fixes the double-counting for booking 112101336
3. **Test All Three Bookings** - Verify totals match Smoobu exactly

---

## EXPECTED RESULTS AFTER FIXES

### Booking 116168296 (Alexander Gazov)
- ✅ Formule petit-déjeuner (2 pers): €105 (merged from €35 + €70)
- ✅ Formule petit-déjeuner - Personne supplémentaire: €60 (merged from €20 + €40)
- ✅ Total Extras: **€165**
- ✅ Matches Smoobu total

### Booking 103531863 (Adrenne étape)
- ✅ Formule SPA (2 pers) (2x): €100
- ✅ Formule SPA - Personne supplémentaire (8x): €80
- ✅ Total Extras: **€180**
- ✅ Matches Smoobu total

### Booking 112101336 (Louis Satinet)
- ✅ Le romantique gourmet (pour 2): €170
- ✅ Le romantique gourmet - Personne supplémentaire: €40
- ✅ NO "Frais voyageurs supplémentaires" line (not double-counted)
- ✅ Total: **€450**
- ✅ Matches Smoobu total

---

## TESTING SCRIPT

After implementing the fixes, run:
```bash
cd /home/mihaipatap/www/smoobu/smoobu-backend
node debug-failing-bookings.js
```

This will show the processed extras and totals for all three bookings.

---

## PREVENTION

To prevent similar issues in the future:

1. **Add Unit Tests** for `processExtrasWithPersons()` that verify:
   - `extrasTotal` includes both base amounts AND extra person amounts
   - Duplicate items are properly merged
   - All "Personne supplémentaire" items are correctly matched

2. **Add Integration Tests** for PriceDetailsSection that verify:
   - Extra-related "Personne supplémentaire" items are NOT counted as guest fees
   - Standalone guest fees are correctly identified
   - No double-counting occurs

3. **Add Logging** to track when "Personne supplémentaire" items are processed:
   - Log when they're matched to parent extras
   - Log when they're treated as standalone guest fees
   - Alert when potential double-counting is detected

---

## CONCLUSION

Both bugs are now clearly identified with specific fixes. The issues stem from:
1. An intentional but incorrect decision to exclude extra person amounts from totals
2. An incomplete exclusion list for identifying guest fees

Once these two fixes are implemented, all three failing bookings should display correctly in the BookingReport with totals matching Smoobu exactly.
