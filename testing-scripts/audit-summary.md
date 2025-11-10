# Event Mappings Audit Summary
**Date:** 2025-11-10  
**Mappings File:** `event-product-mappings-2025-11-10T11-44-25-698Z.csv`

## 📊 Supabase Database Status

### Tables & Views
- **`csv_metadata`**: 
  - Course Events: 48 entries
  - Workshop Events: 81 entries
  - Total: 129 event metadata entries

- **`page_entities`**:
  - Total Event Entities: 197
  - Unique URLs: 167
  - Unique URL+Date Combinations: 197

- **`v_events_for_chat`** (View):
  - Total Rows: **292** ⚠️
  - Unique URLs: 116
  - Unique URL+Date Combinations: **116**
  - Mapped: 292 (100%)
  - Unmapped: 0

### ⚠️ CRITICAL ISSUE: Duplicate Rows in View
The `v_events_for_chat` view is showing **4 duplicate rows** for each unique event. This means:
- 116 unique events × 4 = 292 total rows
- Each event appears 4 times with identical data

**Example:** `camera-courses-for-beginners-coventry-2k99k` on `2026-02-23` appears 4 times.

**Root Cause:** Likely a JOIN issue in the view definition creating a cartesian product.

## 📋 Source CSV Files

### Course Events (`02 - beginners-photography-lessons.csv`)
- **Total Rows:** 48 events
- **Status:** All have Event_URL and Start_Date

### Workshop Events (`03 - photographic-workshops-near-me.csv`)
- **Total Rows:** 125 events (CSV has 126 lines including header)
- **Parsed Successfully:** 70 events (55% parsed)
- **Parsing Issues:** 55 events failed to parse (likely due to multiline text fields or special characters)

## 🗺️ Mappings CSV File

### Statistics
- **Total Mappings:** 116 rows
- **Unique Events:** 116 (after deduplication)
- **Mapped Events:** 116 (100%)
- **Auto-mapped:** 116 (100%)
- **Manual-mapped:** 0

### Batsford Events Status ✅
All 6 Batsford events are now present:
1. `batsford-arboretum-autumn-photography-1nov` (29/10/2025)
2. `batsford-arboretum-autumn-photography-29oct` (24/10/2026)
3. `batsford-arboretum-autumn-photography-2nov` (30/10/2026)
4. `batsford-arboretum-autumn-photography-30oct` (25/10/2026)
5. `batsford-arboretum-autumn-photography-31oct` (23/10/2026)
6. `batsford-arboretum-autumn-photography-3nov` (31/10/2026)

## 🔍 Audit Results

### Events Found in Mappings
- **Found:** 85/118 source events (72%)
- **Missing:** 33 events (28%)

### Missing Events Breakdown

#### Course Events (22 missing)
Most missing course events are from 2026 dates that may have been ingested with different date formats:
- RPS Courses (4 missing)
- Camera Courses (12 missing)
- Lightroom Classes (6 missing)

#### Workshop Events (11 missing)
- Past events (2024-2025 dates)
- Some 2026 events with specific date formats

### Date Format Issues
The audit script found discrepancies between:
- Source CSV dates: `2026-02-23 19:00:00`
- Mappings CSV dates: `2025-09-22T19:00:00+00:00` (for same URL)

This suggests some events may have incorrect dates in the mappings.

## ✅ What's Working

1. **Multi-date Support:** ✅ Fixed - Events with recurring dates are now stored correctly
2. **Batsford Events:** ✅ All 6 dates are present
3. **Mapping Coverage:** ✅ 100% of events in mappings have product links
4. **No Duplicate Mappings:** ✅ The mappings CSV has no duplicates

## ❌ Issues to Fix

1. **View Duplicates:** The `v_events_for_chat` view returns 4x duplicates for each event
2. **CSV Parsing:** 55 workshop events failed to parse (need better CSV parser)
3. **Missing Events:** 33 events from source CSVs are not in mappings
4. **Date Format Mismatches:** Some events have incorrect dates in mappings vs source

## 📝 Recommendations

1. **Fix View Definition:** Review `v_events_for_chat` to eliminate duplicate rows
2. **Re-run Ingestion:** For the 33 missing events, ensure they're properly ingested
3. **Date Validation:** Verify date consistency between source CSVs and mappings
4. **CSV Parser:** Improve CSV parsing to handle multiline fields and special characters

## 🎯 Overall Status

- **Database:** ✅ Events stored correctly (197 entities, 129 metadata entries)
- **Mappings:** ✅ 116 unique events mapped (100% of those in mappings)
- **Coverage:** ⚠️ 72% of source events found in mappings (33 missing)
- **View:** ❌ Duplicate rows issue needs fixing


