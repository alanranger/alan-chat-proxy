# Event Date Cleanup Fix - November 11, 2025

## Problem

When event dates were rescheduled (e.g., moving a workshop from one date to another), the ingestion system was creating new database entries with the new dates but **not removing** the old entries with the previous dates. This resulted in:

- **Duplicate entries**: Same event URL appearing multiple times with different dates
- **Stale data**: Old/rescheduled dates remaining in the database
- **Incorrect display**: Chat system showing both old and new dates for the same event
- **Data inconsistency**: Database containing dates that no longer exist in the source data

### Example

For the event `camera-courses-for-beginners-coventry-2k99k`:
- **Before fix**: Database contained both `2025-09-22` (old date) and `2026-02-23` (new date)
- **After fix**: Only `2026-02-23` (current date) remains in the database

## Root Cause

The ingestion logic in `api/ingest.js` was:
1. ✅ Fetching existing entities matching the **new dates** being ingested
2. ✅ Updating/inserting those entities
3. ❌ **NOT** checking for old dates that were no longer in the source data
4. ❌ **NOT** deleting outdated entries

This meant that when an event was rescheduled:
- The new date was added/updated correctly
- But the old date entry remained in the database indefinitely

## Solution

Added automatic cleanup logic that runs **before** processing new entities:

### Implementation Details

**Location**: `api/ingest.js` (lines 1055-1097)

**Process**:
1. **Fetch all existing events** for the URL (not just matching dates)
2. **Extract dates from new entities** (from both `start_date` and `date_start` fields)
3. **Compare dates**: Identify existing events with dates not in the new source data
4. **Delete old dates**: Remove outdated event entries before processing new ones
5. **Process normally**: Continue with standard insert/update logic

### Code Flow

```javascript
// 1. Fetch ALL existing event entities for this URL
const { data: allExistingEvents } = await supa
  .from('page_entities')
  .select('*')
  .eq('url', url)
  .eq('kind', 'event');

// 2. Extract dates from new entities
const newEventDates = new Set();
entities.filter(e => e.kind === 'event').forEach(e => {
  const newStartDate = e.start_date || (e.date_start ? e.date_start.split('T')[0] : null);
  if (newStartDate) {
    newEventDates.add(newStartDate);
  }
});

// 3. Find old dates to delete
const oldEventsToDelete = allExistingEvents.filter(ex => {
  const exStartDate = ex.start_date || (ex.date_start ? ex.date_start.split('T')[0] : null);
  return exStartDate && !newEventDates.has(exStartDate);
});

// 4. Delete old dates
if (oldEventsToDelete.length > 0) {
  const oldEventIds = oldEventsToDelete.map(e => e.id);
  await supa
    .from('page_entities')
    .delete()
    .in('id', oldEventIds);
  
  console.log(`Deleted ${oldEventsToDelete.length} old event date(s) for ${url}`);
}
```

## Behavior

### When an Event is Rescheduled

**Scenario**: Event `workshop-abc` is rescheduled from `2025-12-01` to `2026-01-15`

**Before Fix**:
- Database contains: `2025-12-01` (old) + `2026-01-15` (new)
- Chat shows: Both dates

**After Fix**:
- Old date `2025-12-01` is automatically deleted
- Database contains: `2026-01-15` (current) only
- Chat shows: Only current date

### When an Event Has Multiple Dates

**Scenario**: A 3-week course with dates `2026-01-10`, `2026-01-17`, `2026-01-24`

**Behavior**:
- All three dates are kept (they're all in the source data)
- Only dates **not** in the source are removed
- If one week is rescheduled, only that specific date is updated/deleted

### When an Event is Cancelled

**Scenario**: Event `workshop-xyz` with date `2026-02-20` is cancelled (removed from source)

**Behavior**:
- When the URL is re-ingested (or light-refresh runs), the event entry is deleted
- Database no longer contains the cancelled event
- Chat no longer shows the cancelled event

## Testing

### Test Script

Created `testing-scripts/test-event-date-cleanup.cjs` to verify the cleanup behavior:

```bash
node testing-scripts/test-event-date-cleanup.cjs
```

**What it tests**:
1. Checks database state before ingestion
2. Ingests a test URL
3. Checks database state after ingestion
4. Verifies old dates were removed
5. Reports cleanup results

### Manual Testing

To test manually:

1. **Check current state**:
   ```sql
   SELECT id, url, start_date, date_start, last_seen
   FROM page_entities
   WHERE kind = 'event'
     AND url = 'https://www.alanranger.com/beginners-photography-lessons/camera-courses-for-beginners-coventry-2k99k'
   ORDER BY start_date;
   ```

2. **Re-ingest the URL** (via UI or API):
   ```bash
   curl -X POST https://your-api.com/api/ingest \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -d '{"url": "https://www.alanranger.com/beginners-photography-lessons/camera-courses-for-beginners-coventry-2k99k"}'
   ```

3. **Verify cleanup**:
   - Old dates should be removed
   - Only current dates should remain
   - Check console logs for cleanup messages

## Impact

### Affected Systems

- ✅ **Event ingestion**: Old dates automatically cleaned up
- ✅ **Light-refresh cron**: Old dates cleaned up during scheduled refreshes
- ✅ **Manual re-ingestion**: Old dates cleaned up when URLs are manually re-ingested
- ✅ **Chat system**: Only shows current/valid event dates
- ✅ **Event-product mappings**: Only includes current dates

### Performance

- **Minimal impact**: One additional query to fetch all existing events for the URL
- **Efficient**: Only runs for event entities (not services, articles, etc.)
- **Safe**: Only deletes entries that are definitively not in the source data

## Logging

The cleanup process logs:
- Number of old dates deleted
- Which dates were deleted
- Any errors during cleanup

**Example log output**:
```
Deleted 1 old event date(s) for https://www.alanranger.com/.../event-url: 2025-09-22
```

## Edge Cases

### Multiple Dates for Same URL

**Handled correctly**: All dates in source are kept, only dates not in source are removed.

### Events Without Dates

**Not affected**: Cleanup only runs for events with dates (`date_start` or `start_date`).

### Past Events

**Behavior**: Past events are kept if they're still in the source data. They're only removed if:
- The event is rescheduled to a future date
- The event is cancelled (removed from source)

### CSV Metadata vs JSON-LD Dates

**Handled correctly**: System compares dates from both sources:
- `start_date` field (from CSV metadata)
- `date_start` field (from JSON-LD or CSV)

## Related Issues

- **Event-Product Mapping Export Fix** (Nov 10, 2025): Fixed date overwrite bug in export
- **View Deduplication** (Nov 10, 2025): Added DISTINCT ON clauses to prevent duplicate rows
- **Duplicate Event Handling** (Nov 10, 2025): Fixed unique constraint matching for events with dates

## Files Changed

- `api/ingest.js` - Added cleanup logic (lines 1055-1097)
- `testing-scripts/test-event-date-cleanup.cjs` - Test script (new file)
- `testing-scripts/EVENT-DATE-CLEANUP-FIX.md` - This documentation (new file)

## Deployment

- **Date**: November 11, 2025
- **Commit**: `f97e1c5`
- **Status**: ✅ Deployed to production

## Future Enhancements

Potential improvements:
- Add option to preserve historical dates (for audit trail)
- Add cleanup for past events older than X days
- Add metrics/analytics for cleanup operations
- Add admin UI to view cleanup history

## Questions?

If you have questions or encounter issues:
1. Check the console logs for cleanup messages
2. Run the test script to verify behavior
3. Check the database directly to see current state
4. Review this documentation for expected behavior

