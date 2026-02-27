# Fix: Cancelled Bookings Not Being Removed from Booking Report

**Date:** 2026-01-30
**Issue:** Booking Fabrice Gueury (smoobuId 113190761) appeared in Booking Report despite being cancelled in Smoobu

---

## Problem

When a booking is cancelled in Smoobu:
1. The bulk fetch API (`showCancellation: false`) doesn't return it
2. The sync detects it as "missing" and fetches it individually
3. **Previously:** All rescued bookings were added back to processing queue regardless of status
4. **Result:** Cancelled bookings stayed in Firebase with their old `type: "reservation"` status

---

## Solution Implemented

### 1. Modified `/api/fetch-and-sync` (server.js)

Updated the missing bookings rescue loop to check for cancellations:

```javascript
if (freshBooking.type === 'cancellation') {
  console.log(`  🗑️ DELETING CANCELLED: ${missingBooking.smoobuId}`);
  await repository.deleteBookingBySmoobuId(missingBooking.smoobuId);
  deletedCancelledCount++;
} else {
  bulkBookings.push(freshBooking);
  rescuedCount++;
}
```

Stats now include `deletedCancelled` count.

### 2. Added `deleteBookingBySmoobuId()` method (booking-repository.js)

- Backs up booking to `bookings_backup` collection before deletion
- Stores metadata: `originalDocId`, `deletedAt`, `reason: 'cancellation'`
- Uses batch operation for atomic backup + delete

### 3. New Endpoint: `/api/cleanup-cancelled`

For manual cleanup of cancelled bookings outside the sync date range:

```
GET /api/cleanup-cancelled?smoobuId=113190761  # Check specific booking
GET /api/cleanup-cancelled                      # Scan ALL bookings (slow)
```

### 4. Updated Sync Date Range

Changed from `2025-10-01 - 2025-12-31` to `2026-01-01 - 2026-06-30`

---

## Files Modified

1. `server.js` (lines 117-149) - Cancellation detection in rescue loop
2. `server.js` (lines 79-81) - Date range update
3. `server.js` (new endpoint) - `/api/cleanup-cancelled`
4. `third-party/smoobu/actions/api/fetch-and-sync/booking-repository.js` - Added `deleteBookingBySmoobuId()` method

---

## Verification

1. Run `/api/fetch-and-sync` - check logs for `🗑️ DELETING CANCELLED`
2. Check stats response for `deletedCancelled` count
3. Verify booking removed from Firebase `bookings` collection
4. Verify backup exists in `bookings_backup` collection

---

## Notes

- The sync date range needs periodic updates (currently set to Jan-Jun 2026)
- Use `/api/cleanup-cancelled` for bookings outside the sync range
- Database backup was created before implementing: `backup-2026-01-30T14-32-34-109Z.json`
