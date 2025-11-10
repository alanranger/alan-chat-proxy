# Audit Summary - November 10, 2025
**Mappings File:** `event-product-mappings-2025-11-10T14-23-49-474Z.csv`

## ✅ Improvements

1. **No Duplicates:** The mappings file has 116 unique URL+date combinations (no duplicates)
2. **View Fixed:** `v_events_for_chat` shows 116 events, all mapped (100% mapping rate)
3. **Database State:** 
   - 159 total events in `page_entities` (includes past events)
   - 116 future events in view (filtered by `date_start >= CURRENT_DATE`)
   - 129 unique event URLs

## ⚠️ Remaining Issues

### Missing Events: 32 total

**Past Events (9):** Expected - old/unrescheduled events
- These are intentionally filtered out by the view (`date_start >= CURRENT_DATE`)

**Future Events (23):** Need investigation
- These events exist in source CSVs but are missing from mappings
- **Root Cause:** The events exist in `page_entities` and `v_events_norm` with future dates, but:
  1. Some may not be in `csv_metadata` (CSV import issue - only 81/125 workshop events imported)
  2. Some may have dates that don't match exactly between source CSV and database

### Example Issue

**URL:** `camera-courses-for-beginners-coventry-2k99k`
- **In Supabase:** Has both dates - `2025-09-22` (past) and `2026-02-23` (future)
- **In View:** Shows `2026-02-23` (correct - future date only)
- **In Mappings File:** Shows `2025-09-22` (WRONG - past date)
- **In Source CSV:** Has `2026-02-23` (future date)

**This suggests the export is using stale data or there's a caching issue.**

## 📊 Statistics

| Metric | Count |
|--------|-------|
| Source Course Events | 48 |
| Source Workshop Events | 70 |
| Total Source Events | 118 |
| Events in Mappings | 116 |
| Missing Events | 32 |
| - Past (expected) | 9 |
| - Future (issue) | 23 |
| Events in Supabase View | 116 |
| Mapping Rate | 100% |

## 🔍 Next Steps

1. **Check Export Function:** Verify the export is reading from `v_events_for_chat` and not a cached/stale source
2. **Re-export Mappings:** Run the export again to see if it picks up the correct future dates
3. **CSV Import:** Still need to fix the CSV import to capture all 125 workshop events (currently only 81 imported)
4. **Date Matching:** Verify date formats match between source CSV and database

## ✅ What's Working

- View deduplication fixed (no more 2x duplicates)
- Multi-date ingestion working (URLs can have multiple dates)
- 100% mapping rate for events in view
- No duplicate URL+date combinations in mappings file

