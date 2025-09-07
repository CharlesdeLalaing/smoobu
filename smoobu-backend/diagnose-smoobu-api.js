import { SmoobuClient } from './third-party/smoobu/actions/api/fetch-and-sync/smoobu-client.js';

async function diagnoseSmoobuAPI() {
  const client = new SmoobuClient();
  const targetBookingId = '104843583';
  
  console.log('=== SMOOBU API DIAGNOSIS ===');
  console.log(`Investigating booking ${targetBookingId}`);
  
  try {
    // 1. Fetch individual booking directly from API
    console.log('\n1. Direct API fetch:');
    const directBooking = await client.fetchIndividualBooking(targetBookingId);
    if (directBooking) {
      console.log('✅ Individual booking fetch successful');
      console.log('Type from API:', directBooking.type);
      console.log('PriceElements count:', directBooking.priceElements?.length || 0);
      console.log('Last modified (from API):', directBooking['last-modified'] || directBooking.updatedAt || 'No timestamp');
    } else {
      console.log('❌ Individual booking fetch failed');
    }
    
    // 2. Check recently modified bookings  
    console.log('\n2. Recently modified bookings check:');
    const lookbackHours = 25;
    const modifiedSince = new Date();
    modifiedSince.setHours(modifiedSince.getHours() - lookbackHours);
    const modifiedSinceDate = modifiedSince.toISOString().split('T')[0];
    const modifiedUntil = new Date();
    modifiedUntil.setDate(modifiedUntil.getDate() + 1);
    const modifiedUntilDate = modifiedUntil.toISOString().split('T')[0];
    
    console.log(`Checking range: ${modifiedSinceDate} to ${modifiedUntilDate}`);
    
    const recentlyModified = await client.fetchRecentlyModifiedBookings(
      modifiedSinceDate,
      modifiedUntilDate
    );
    
    console.log(`Found ${recentlyModified.length} recently modified bookings`);
    
    // Look for our target booking
    const targetInModified = recentlyModified.find(b => b.id.toString() === targetBookingId);
    if (targetInModified) {
      console.log('✅ Found target booking in recently modified!');
      console.log('Type in modified list:', targetInModified.type);
      console.log('PriceElements in modified:', targetInModified.priceElements?.length || 0);
    } else {
      console.log('❌ Target booking NOT found in recently modified list');
      
      // Show what apartment IDs are in the modified list
      const apartmentIds = [...new Set(recentlyModified.map(b => b.apartment?.id).filter(id => id))];
      console.log('Apartment IDs in modified list:', apartmentIds);
      
      // Show booking IDs for same apartment as target
      if (directBooking?.apartment?.id) {
        const sameApartment = recentlyModified.filter(b => b.apartment?.id === directBooking.apartment.id);
        console.log(`Bookings for same apartment (${directBooking.apartment.id}):`, sameApartment.map(b => b.id));
      }
    }
    
    // 3. Check arrival date range (Phase 1)
    console.log('\n3. Arrival date range check:');
    const now = new Date();
    const threeMonthsAgo = new Date(now.getTime() - (90 * 24 * 60 * 60 * 1000));
    const threeMonthsFromNow = new Date(now.getTime() + (90 * 24 * 60 * 60 * 1000));
    const startDate = threeMonthsAgo.toISOString().split('T')[0];
    const endDate = threeMonthsFromNow.toISOString().split('T')[0];
    
    console.log(`Phase 1 range: ${startDate} to ${endDate}`);
    if (directBooking?.arrival) {
      const arrivalDate = directBooking.arrival;
      const inRange = arrivalDate >= startDate && arrivalDate <= endDate;
      console.log(`Booking arrival: ${arrivalDate} - In range: ${inRange}`);
    }
    
    // 4. Summary
    console.log('\n=== DIAGNOSIS SUMMARY ===');
    console.log('Issue: Booking not appearing in automated sync');
    console.log('Root cause: Smoobu API not marking booking as "recently modified"');
    console.log('When you add extras, Smoobu should:');
    console.log('  1. Change type from "reservation" to "modification of booking"');
    console.log('  2. Include it in recently modified API response');
    console.log('  3. Update last-modified timestamp');
    console.log('\nCurrent status:');
    console.log(`  - Type: ${directBooking?.type || 'unknown'}`);
    console.log(`  - In recently modified: ${targetInModified ? 'YES' : 'NO'}`);
    
  } catch (error) {
    console.error('❌ Diagnosis failed:', error.message);
  }
}

diagnoseSmoobuAPI();