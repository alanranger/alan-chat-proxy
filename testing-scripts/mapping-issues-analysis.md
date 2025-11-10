# Event-Product Mapping Issues Analysis

## Summary

Analysis of the event-product mappings CSV and source data files reveals:

### 1. Duplicate Event URLs in Mappings CSV

**Issue**: 86 event URLs appear exactly twice in the exported mappings CSV with identical data.

**Root Cause**: The `v_events_for_chat` view may be creating duplicates due to:
- Multiple entries in `event_product_links_auto` table for the same event
- UNION ALL logic in the view creating multiple rows for events that match multiple session patterns
- Missing DISTINCT in the export query

**Impact**: Every event appears twice in the export, doubling the file size and causing confusion.

### 2. Missing Event Dates

**Issue**: User reported missing dates for specific events, but analysis shows:
- All events in the source CSVs (`beginners-photography-lessons.csv` and `photographic-workshops-near-me.csv`) have dates
- The 39 "missing dates" in workshops CSV are actually HTML content rows that were incorrectly parsed (from the `Text_Block` column)

**Specific Events Checked**:
- ✅ Coventry Evening Urban Architecture Photography Workshop - HAS DATE (2026-04-16)
- ✅ Long Exposure Photography Workshop - Sunset | Kenilworth - HAS DATE (2026-04-13)
- ✅ Long Exposure Photography Workshop - Kenilworth 11-05 - HAS DATE (2026-03-31)
- ✅ Sunset Photographic Workshop - Chesterton Windmill 16-09 - HAS DATE (2026-09-16)
- ✅ Fairy Glen Betws-y-Coed Photography Workshop - Wales Autumn - HAS DATE (2026-10-03)
- ✅ Batsford Arboretum Autumn Photography Workshop - 24/10 - HAS DATE (2026-10-24)
- ✅ Batsford Arboretum Autumn Photography Workshop - 25/10 - HAS DATE (2026-10-25)
- ✅ Batsford Arboretum Autumn Photography Workshop -29/10 - HAS DATE (2026-10-29)

**Lesson Events**:
- ✅ All 6 RPS Courses events have dates
- ✅ All 30 Camera Courses events have dates
- ✅ All 12 Lightroom events have dates

**Conclusion**: The missing dates issue is likely a display/export problem, not a source data problem. The events exist in the source CSVs with dates, but may not be appearing correctly in the mappings export due to the duplicate issue.

## Recommended Fixes

### Fix 1: Add DISTINCT to Export Query

Modify `api/tools.js` export function to use DISTINCT or GROUP BY to remove duplicates:

```javascript
// In fetchRows function, add DISTINCT or use GROUP BY
const { data, error } = await supa
  .from('v_events_for_chat')
  .select(selectStr)
  .order('event_url', { ascending: true })
  .limit(5000);
```

Then deduplicate in JavaScript:
```javascript
// After fetching rows, remove duplicates based on event_url + date_start
const seen = new Set();
rows = rows.filter(row => {
  const key = `${row.event_url}|${row.date_start}`;
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
});
```

### Fix 2: Fix View to Prevent Duplicates

Modify `v_events_for_chat` view to use DISTINCT ON or ensure `event_product_links_auto` doesn't have duplicates:

```sql
-- Check for duplicates in event_product_links_auto
SELECT event_url, COUNT(*) 
FROM event_product_links_auto 
GROUP BY event_url 
HAVING COUNT(*) > 1;

-- If duplicates exist, clean them up:
DELETE FROM event_product_links_auto 
WHERE id NOT IN (
  SELECT MIN(id) 
  FROM event_product_links_auto 
  GROUP BY event_url, product_url
);
```

### Fix 3: Improve CSV Parsing

The CSV parser is incorrectly treating HTML content from `Text_Block` column as separate rows. This is a parsing issue in the analysis script, not a data issue.

## Next Steps

1. ✅ Identify duplicate issue (DONE)
2. ⏳ Fix export function to deduplicate
3. ⏳ Check and clean `event_product_links_auto` table for duplicates
4. ⏳ Verify all events appear correctly in export after fix

