# BookingReport Calculation System - Architecture Improvement Plan

> **Status:** Planned for future implementation
> **Created:** January 2026
> **Context:** After fixing 7 calculation bugs, this plan addresses the architectural issues that made those bugs possible.

## Overview

Refactor the BookingReport calculation system to eliminate code duplication, centralize portal-specific logic, and add automated testing with Vitest.

## Current Problems

| Issue | Impact | Current State |
|-------|--------|---------------|
| **Duplicated calculation logic** | Bug fixes need 3+ file updates | BookingsDetails.jsx (420 lines), PriceDetailsSection.jsx (duplicates 80%), extrasUtils.js (deprecated copy) |
| **Scattered portal logic** | 66 occurrences of portal checks | Each file independently handles Airbnb/Booking.com/Website |
| **Display components recalculate** | Inconsistent totals possible | PriceDetailsSection.jsx recalculates instead of consuming |
| **No automated tests** | Regressions go unnoticed | Only manual debug scripts exist |
| **Complex data fallbacks** | Same fallback chains repeated | `booking.priceDetails?.basePrice \|\| booking.basePrice \|\| 0` everywhere |

## Solution Architecture

### New File Structure

```
src/components/Admin/BookingReport/
├── services/
│   ├── BookingCalculationService.js    # Single source of truth
│   └── portalStrategies/
│       ├── index.js                    # Factory + registry
│       ├── BasePortalStrategy.js       # Shared logic
│       ├── AirbnbStrategy.js           # Airbnb rules
│       ├── BookingComStrategy.js       # Booking.com rules
│       └── WebsiteStrategy.js          # Website/Direct rules
├── hooks/
│   └── useBookingCalculation.js        # React hook for components
├── utils/
│   └── extrasUtils.js                  # Keep existing (mergeAndSortExtras, etc.)
└── __tests__/
    ├── BookingCalculationService.test.js
    ├── portalStrategies.test.js
    └── fixtures/
        └── bookingFixtures.js          # Real test data from debug/
```

### Core Service API

```javascript
// BookingCalculationService.js
export class BookingCalculationService {
  static calculate(booking) → BookingCalculationResult
  static debug(booking) → DebugBreakdown  // Step-by-step trace
}

// Result structure
{
  total: number,
  room: { basePrice, linenFee, guestFees, managementFee, additionalGuestFee, taxeDeSejour, subtotal },
  extras: { items: [], total: number },
  discounts: { longStayDiscount, couponDiscount, couponCode, isGiftVoucher, total },
  portal: string,
  calculationMethod: string
}
```

### Portal Strategy Pattern

Each portal has specific rules encapsulated in a strategy class:

| Portal | Base Price Source | Fees | Discounts | Extras Filter |
|--------|-------------------|------|-----------|---------------|
| **Airbnb** | `priceElements["Base Price"]` | managementFee, additionalGuestFee | None (reset to 0) | Only formules, drinks |
| **Booking.com** | Standard | taxeDeSejour | Standard | Exclude TVA |
| **Website/Direct** | Standard | guestFees | longStay, coupon | All allowed |

### React Hook Usage

```javascript
// In display components (PriceDetailsSection, ExtrasDetailsSection)
const { total, room, extras, discounts, portal } = useBookingCalculation(booking);

// Components just render the pre-calculated values
// No more duplicate calculation logic in display components
```

## Implementation Phases

### Phase 1: Setup Testing Infrastructure
**Files to create/modify:**
- `package.json` - Add vitest, @testing-library/react
- `vitest.config.js` - Configure Vitest
- `src/components/Admin/BookingReport/__tests__/fixtures/bookingFixtures.js` - Extract from debug/baseline-nov-dec-2025.json

**Verification:** `npm run test` works

### Phase 2: Create Core Service (No Breaking Changes)
**Files to create:**
- `services/BookingCalculationService.js` - Extract logic from BookingsDetails.jsx
- `services/portalStrategies/BasePortalStrategy.js` - Shared calculation methods
- `services/portalStrategies/AirbnbStrategy.js` - Airbnb-specific overrides
- `services/portalStrategies/BookingComStrategy.js` - Booking.com-specific overrides
- `services/portalStrategies/WebsiteStrategy.js` - Default strategy
- `services/portalStrategies/index.js` - Factory function

**Verification:**
- Tests pass for all 7 known bug cases
- New service produces identical results to current `calculateBookingTotal()`

### Phase 3: Add React Hook
**Files to create:**
- `hooks/useBookingCalculation.js` - Memoized hook wrapping the service

**Verification:** Hook returns correct results in isolation tests

### Phase 4: Migrate Display Components
**Files to modify:**
- `sections/PriceDetailsSection.jsx` - Use hook, remove 300+ lines of calculation
- `sections/ExtrasDetailsSection.jsx` - Use hook for extras data

**Verification:**
- UI displays same values as before
- All 7 bug cases still show correct totals in browser

### Phase 5: Migrate Main Calculation
**Files to modify:**
- `BookingsDetails.jsx` - Replace internal calculation with service call
- `BookingsTable.jsx` - Import from service instead of BookingsDetails
- `hooks/BookingReport/useBookingsData.jsx` - Use service for export calculations

**Verification:** Full end-to-end test in browser

### Phase 6: Cleanup
**Files to modify:**
- `utils/extrasUtils.js` - Remove deprecated `calculateBookingTotal()`
- Remove any remaining duplicate calculation code

**Verification:** All tests pass, no console warnings about deprecated code

## Critical Files Reference

| File | Lines | Action |
|------|-------|--------|
| `BookingsDetails.jsx` | 512 | Extract calculation to service (lines 21-441) |
| `PriceDetailsSection.jsx` | 511 | Simplify to ~100 lines using hook |
| `ExtrasDetailsSection.jsx` | 138 | Simplify using hook |
| `extrasUtils.js` | 361 | Remove deprecated function, keep utilities |
| `useBookingsData.jsx` | 800+ | Update to use service (line 739) |

## Test Cases to Implement

From the 7 known bugs (now fixed), create regression tests:

```javascript
describe('BookingCalculationService', () => {
  test('Website booking #110229666 = 275€', () => { ... });
  test('Collaboration booking #93687759 = 70€ (basePrice=0)', () => { ... });
  test('Airbnb #119462811 = 460€ (no person extra double-count)', () => { ... });
  test('Airbnb #120252316 = 750€ (includes management fee)', () => { ... });
  test('Website #119673136 = 315€ (duplicate person extra excluded)', () => { ... });
  test('Website #120163346 = 334€', () => { ... });
  test('Website #113496046 = 414€', () => { ... });
});
```

## Verification Checklist

After implementation:
- [ ] `npm run test` passes all calculation tests
- [ ] All 7 bug case reservations show correct totals in UI
- [ ] Reservation #116168296 shows 525€ (person extra included)
- [ ] PriceDetailsSection shows same breakdown as before
- [ ] ExtrasDetailsSection shows same extras as before
- [ ] Export to CSV/Excel has correct totals
- [ ] No console errors or warnings

## Estimated Effort

| Phase | Complexity | Files Changed |
|-------|------------|---------------|
| Phase 1: Testing setup | Low | 2 new |
| Phase 2: Core service | High | 5 new |
| Phase 3: React hook | Low | 1 new |
| Phase 4: Display components | Medium | 2 modified |
| Phase 5: Main calculation | Medium | 3 modified |
| Phase 6: Cleanup | Low | 1 modified |

## Risk Mitigation

1. **Parallel validation** - During Phase 4-5, log both old and new results to catch discrepancies
2. **Incremental migration** - Each phase is independently deployable
3. **Real data testing** - Use debug/baseline-nov-dec-2025.json for integration tests
4. **Rollback plan** - Keep old `calculateBookingTotal()` until Phase 6 is verified

## Related Files

- `debug/baseline-nov-dec-2025.json` - Backup of reservation data for testing
- `debug/verify-all-calculations.js` - Verification script
- `debug/verify-no-regressions.js` - Regression test script
