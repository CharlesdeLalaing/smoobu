/**
 * Test cases for BookingReport calculations
 *
 * These test cases are based on real bug reports from January 2026.
 * Run with: npm test -- --testPathPattern=calculations.test.js
 */

// Mock booking data for the 7 bug cases
export const testCases = [
  {
    id: '110229666',
    description: 'Website booking with extras - extrasTotal was wrong',
    expected: 275,
    booking: {
      portalName: 'Website',
      price: 275,
      priceDetails: {
        basePrice: 200,
        linenFee: 0,
        extrasTotal: 45, // Was being used instead of recalculating
        priceElements: [
          { name: 'Prix de base', amount: 200 },
          { name: 'Formule petit-déjeuner (2 pers)', amount: 35 },
          { name: 'Formule SPA (2 pers)', amount: 40 }
        ]
      }
    }
  },
  {
    id: '93687759',
    description: 'Collaboration/free booking - basePrice should be 0',
    expected: 70,
    booking: {
      portalName: 'Direct booking',
      price: 1297, // Wrong value in price field
      priceDetails: {
        basePrice: 0, // Explicitly set to 0 for collaboration
        linenFee: 0,
        extrasTotal: 70,
        priceElements: [
          { name: 'Formule petit-déjeuner (2 pers)', amount: 35 },
          { name: 'Formule SPA (2 pers)', amount: 35 }
        ]
      }
    }
  },
  {
    id: '119462811',
    description: 'Airbnb booking - person extras were double-counted',
    expected: 460,
    booking: {
      portalName: 'Airbnb',
      price: 460,
      priceDetails: {
        basePrice: 410,
        linenFee: 0,
        priceElements: [
          { name: 'Base Price', amount: 410 },
          { name: 'Formule détente (2 pers)', amount: 50 },
          { name: 'Personne supplémentaire', amount: 40 } // Should be excluded
        ]
      }
    }
  },
  {
    id: '120252316',
    description: 'Airbnb booking - management fee was missing',
    expected: 750,
    booking: {
      portalName: 'Airbnb',
      price: 750,
      priceDetails: {
        basePrice: 660,
        priceElements: [
          { name: 'Base Price', amount: 660 },
          { name: 'PASS_THROUGH_MANAGEMENT_FEE', amount: 40 },
          { name: 'Formule détente (2 pers)', amount: 50 }
        ]
      }
    }
  }
];

/**
 * To run these tests, import calculateBookingTotal and run:
 *
 * testCases.forEach(tc => {
 *   const result = calculateBookingTotal(tc.booking);
 *   console.assert(
 *     Math.abs(result - tc.expected) < 1,
 *     `${tc.id}: Expected ${tc.expected}, got ${result}`
 *   );
 * });
 */
