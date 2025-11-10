# Missing Events Analysis
**Date:** 2025-11-10  
**Mappings File:** `event-product-mappings-2025-11-10T11-44-25-698Z.csv`

## Summary

**Total Missing:** 33 events (28% of source events)

### Breakdown
- **Past Events:** 9 (27.3%) - Likely old/unrescheduled events ✅ Expected
- **Future Events:** 24 (72.7%) - Need investigation
  - **Course Events:** 19
  - **Workshop Events:** 5

---

## ❌ Past Events (9) - Expected to be Missing

These are old events that haven't been rescheduled yet. **This is expected behavior.**

1. **Peak District Photography Workshops - Heathers Sunrise** (Aug 24, 2024 - 444 days ago)
2. **Somerset Photography Workshops** (May 9, 2025 - 186 days ago)
3. **Landscape Photography Workshops Yorkshire** (May 15, 2025 - 180 days ago)
4. **Nant Mill Photography Workshop** (Jun 7, 2025 - 157 days ago)
5. **Hartland Quay, Devon** (Sep 26, 2025 - 46 days ago)
6. **Camera Courses - Week 1** (Nov 3, 2025 - 7 days ago)
7. **Lightroom Classes - Week 1** (Nov 4, 2025 - 6 days ago)
8. **RPS Courses** (Nov 6, 2025 - 4 days ago)
9. **Abstract and Macro Workshop** (Nov 8, 2025 - 2 days ago)

---

## ⚠️ Future Events (24) - Need Investigation

These are future events that should be in the mappings but aren't. **Most appear to be the same URLs with different dates.**

### Pattern Analysis

Many of these URLs already exist in the mappings but with **different dates**:

| URL | Date in Source CSV | Date in Mappings | Status |
|-----|-------------------|------------------|--------|
| `camera-courses-for-beginners-coventry-2k99k` | 2026-02-23 | 2025-09-22 | Different date |
| `camera-courses-for-beginners-coventry-2sj27` | 2026-02-16 | 2025-09-15 | Different date |
| `camera-courses-for-beginners-coventry-bds4t` | 2026-02-09 | 2025-09-08 | Different date |
| `batsford-arboretum-autumn-photography-1nov` | 2026-10-29 | 2025-10-29 | Different year |

### Future Course Events (19)

**RPS Courses (4 missing):**
1. RPS Courses - Enrol Anytime - 5-1 (Jan 5, 2026)
2. RPS Courses - Enrol Anytime-3-2 (Feb 3, 2026)
3. RPS Courses - Enrol Anytime -3-3 (Mar 3, 2026)
4. RPS Courses - Enrol Anytime -1-4 (Apr 1, 2026)

**Camera Courses (12 missing):**
- Week 1: 2026-02-09, 2026-03-04, 2026-04-02, 2026-05-05
- Week 2: 2026-02-16, 2026-03-11, 2026-04-09, 2026-05-12
- Week 3: 2026-02-23, 2026-03-18, 2026-04-16

**Lightroom Classes (3 missing):**
- Week 1: 2026-03-05, 2026-05-13
- Week 2: 2026-03-12
- Week 3: 2026-03-19

### Future Workshop Events (5)

1. **Coventry Evening Urban Architecture** (Apr 16, 2026)
2. **Long Exposure Photography - Kenilworth** (May 6, 2026)
3. **Sunset Chesterton Windmill** (Sep 16, 2026)
4. **Fairy Glen Betws-y-Coed** (Oct 3, 2026)
5. **Batsford Arboretum** (Oct 29, 2026) - Note: This URL has 6 dates, but one is missing

---

## 🔍 Root Cause Analysis

### Why These Are Missing

1. **Date Format Mismatches:** The same URL appears in mappings with an older date, but the source CSV has a newer date. The ingestion may have only captured one date per URL before the fix.

2. **Re-ingestion Needed:** After the multi-date fix was deployed, these URLs need to be re-ingested to capture all their scheduled dates.

3. **CSV Parsing Issues:** Some workshop events (55 total) failed to parse due to multiline text fields, which may have prevented them from being imported.

---

## ✅ Recommendations

1. **Re-ingest Missing URLs:** For the 24 future events, re-run ingestion on those specific URLs to capture all their dates.

2. **Verify Past Events:** Confirm the 9 past events are intentionally not rescheduled (expected behavior).

3. **Improve CSV Parser:** Fix the CSV parsing to handle multiline fields for the 55 workshop events that failed to parse.

4. **Date Validation:** Add validation to ensure all dates from source CSVs are captured during ingestion.

---

## 📊 Expected vs Actual

- **Expected Missing:** 9 past events (27.3%) ✅
- **Unexpected Missing:** 24 future events (72.7%) ⚠️
- **Action Required:** Re-ingest the 24 future event URLs


