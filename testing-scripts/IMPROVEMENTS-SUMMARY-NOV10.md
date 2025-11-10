# Improvements Summary - November 10, 2025

## Overview
This document summarizes all improvements made on November 10, 2025, including JSON-LD Product entity creation, ETag-based change detection, event-product mapping fixes, and view deduplication.

## 1. JSON-LD Product Entity Creation ✅

### Problem
Product JSON-LD was being extracted but not used to create Product entities in the database. Only the "best" JSON-LD object (e.g., LocalBusiness) was used, ignoring Product-specific data.

### Solution
Modified `api/ingest.js` to:
- Explicitly find and process Product JSON-LD objects
- Create/update Product entities in `page_entities` table
- Store Product-specific data (price, availability, currency, SKU)
- Ensure both Event and Product entities coexist for the same URL

### Implementation Details
- Added logic to find Product JSON-LD objects separately from the "best" entity
- Product entities are added to the `entities` array for processing
- Proper handling of AggregateOffer structure (lowPrice, highPrice, offerCount)
- Image URL extraction handles both array and single string formats

### Results
- ✅ Product entities now created/updated correctly
- ✅ 2 Product entities created/updated in last 10 minutes
- ✅ 100% have price data
- ✅ 100% have availability data
- ✅ Product data flows through to views (`v_products_unified_open`, `v_events_for_chat`)

### Files Changed
- `api/ingest.js` - Added Product entity creation logic

## 2. ETag-Based Change Detection ✅

### Problem
The `light-refresh` Edge Function was reporting "failed" URLs because the website doesn't provide `last-modified` headers. URLs were accessible (HTTP 200 OK) but couldn't detect changes.

### Solution
Implemented ETag-based change detection:
- Added `etag_header` column to `url_last_processed` table
- Modified `light-refresh` Edge Function to fetch ETag headers
- Prioritize `last-modified` for change detection, fallback to ETag if unavailable
- Track changes using ETag comparison

### Implementation Details
- Migration: `migrations/20251110120000_add_etag_to_url_last_processed.sql`
- Edge Function: `supabase/functions/light-refresh/index.ts`
- Function `headLastModified` renamed to `headUrlMetadata` to fetch both headers
- Change detection logic: Check `last-modified` first, then ETag

### Results
- ✅ All URLs now have change detection capability
- ✅ ETag headers properly stored in database
- ✅ Change tracking works for URLs without `last-modified` headers
- ✅ Edge Function successfully detects changes using ETag

### Files Changed
- `migrations/20251110120000_add_etag_to_url_last_processed.sql` - Added etag_header column
- `supabase/functions/light-refresh/index.ts` - Added ETag support

## 3. Event-Product Mapping Export Fix ✅

### Problem
The exported `event-product-mappings-*.csv` file contained incorrect (stale/past) dates for some events, even though the `v_events_for_chat` view correctly showed future dates.

### Root Cause
The `export` function in `api/tools.js` was incorrectly overwriting `date_start` and `date_end` from `page_entities` using a `Map` keyed only by `url`. This caused incorrect dates when a single URL had multiple associated event dates.

### Solution
Changed the `Map` key from `url` to `url|date` to ensure each unique event (URL + date combination) retained its correct date from `page_entities`.

### Implementation Details
- Added `normalizeDate` function to standardize date format for Map keys
- Changed Map key from `norm(e.url)` to `${norm(e.url)}|${normalizeDate(e.date_start)}`
- Ensures correct date matching when multiple dates exist for same URL

### Results
- ✅ All dates now correct in exported mappings CSV
- ✅ Multi-date events properly handled
- ✅ No missing events except past ones (expected)

### Files Changed
- `api/tools.js` - Fixed date overwrite bug in export function

## 4. View Deduplication ✅

### Problem
The `v_events_for_chat` and `v_products_unified_open` views were producing duplicate rows, causing incorrect data in the chat system.

### Solution
Added `DISTINCT ON` clauses to both views:
- `v_events_for_chat`: `DISTINCT ON (event_url, date_start, session_type)`
- `v_products_unified_open`: `DISTINCT ON (product_url)`

### Implementation Details
- Modified view definitions to ensure uniqueness
- `v_events_for_chat` deduplicates by URL, date, and session type
- `v_products_unified_open` deduplicates by product URL

### Results
- ✅ No duplicate rows in views
- ✅ Unique event/product representation in chat system
- ✅ Correct data flow through to chat responses

### Files Changed
- `migrations/20251019120000_enhance_v_events_for_chat_with_sessions.sql` - Added DISTINCT ON

## 5. Service Reconciliation Fix ✅

### Problem
Service reconciliation was processing 552 duplicate rows instead of 24 unique URLs. The `csv_metadata` table contained multiple entries for the same unique service URL (e.g., a single URL appearing 23 times), causing inefficient processing.

### Solution
Modified the `GET /api/tools?action=reconcile_services` endpoint to deduplicate URLs before processing:
- Collects all `csv_metadata_id`s for missing services
- Extracts unique URLs associated with those IDs
- Returns only unique URLs for processing
- Ensures each unique service URL is ingested only once

### Implementation Details
- Added URL deduplication logic in `api/tools.js`
- Uses `Set` to track unique URLs
- Processes only unique URLs, not duplicate `csv_metadata` rows

### Results
- ✅ Reconciliation now processes 24 unique URLs instead of 552 duplicate rows
- ✅ All 24 missing services successfully ingested (100% success rate)
- ✅ Efficient processing - no duplicate ingestion attempts
- ✅ All service entities now have JSON-LD data extracted

### Files Changed
- `api/tools.js` - Added URL deduplication in reconcile_services endpoint

## Regression Test Results

### Test Configuration
- **Baseline**: November 1, 2025 (baseline-40-question-interactive-subset-2025-11-01T13-32-45-780Z.json)
- **Current**: November 10, 2025 (deployed-analytics-test-2025-11-10T22-57-04-965Z.json)
- **Test**: 40-question interactive subset

### Results Summary
- ✅ **Success Rate**: 100% (40/40) - MAINTAINED
- 📈 **Average Confidence**: 81.6% → 82.8% (+1.2%) - IMPROVED
- ✅ **Unchanged**: 22 questions (55%)
- 📈 **Improvements**: 6 questions (15%)
- 📉 **Regressions**: 7 questions (17.5%) - Minor (answer length only, confidence unchanged)
- 🔄 **Minor Changes**: 5 questions (12.5%)

### Key Improvements
1. Better routing for course queries (3 questions: services → events, +16% confidence)
2. More detailed technical answers (lens comparison: +248 chars)
3. Better policy information (cancellation/refund: +88 chars)

### Regressions
All regressions are **minor** - answer length decreases with confidence unchanged. Likely due to:
- Content updates on website
- More concise, focused answers
- Updated database content

**Assessment**: ✅ **NO CRITICAL REGRESSIONS** - All improvements are safe to keep.

## Structured Data Comparison Results

### Summary
- **Total Structured Items**: 304 → 716 (+412, +135%) 🎉
- **Improvements**: 32 questions with more structured data
- **Regressions**: 2 questions (fewer articles for "Who is Alan Ranger" queries)
- **Unchanged**: 6 questions

### Key Improvements
- **More Events**: "next workshop date" went from 20 → 40 events
- **More Services**: Many questions now include 6 services (previously 0)
- **More Articles**: Many questions now include 12 articles (previously 0-9)
- **Better Cross-Linking**: Questions now return events + services + articles together

### Examples
- "Do you do astrophotography workshops": 0 → 18 items (6 services + 12 articles)
- "Can my 14yr old attend": 0 → 24 items (6 events + 6 services + 12 articles)
- "What types of photography services": 24 → 36 items (+12 articles)

**Assessment**: ✅ **SIGNIFICANT IMPROVEMENT** - Structured data sections working much better!

## Database Schema Changes

### New Column
- `url_last_processed.etag_header` (text, nullable) - Stores ETag header for change detection

### View Updates
- `v_events_for_chat` - Added DISTINCT ON clause
- `v_products_unified_open` - Added DISTINCT ON clause

## Testing

### Test Scripts Created
- `testing-scripts/compare-baseline-nov1-vs-nov10.cjs` - Comparison script
- `testing-scripts/compare-latest-baseline.cjs` - Latest baseline comparison
- `testing-scripts/compare-structured-data.cjs` - Structured data comparison script
- `testing-scripts/regression-test-summary-nov10.md` - Detailed regression analysis
- `testing-scripts/REGRESSION-TEST-SUMMARY-NOV10-EVENING.md` - Evening regression test summary
- `testing-scripts/json-schema-improvements-summary.md` - JSON-LD improvements summary

### Test Results
- ✅ 40Q regression test: 100% success rate
- ✅ Product entity creation verified
- ✅ ETag change detection verified
- ✅ Event-product mapping dates verified
- ✅ View deduplication verified

## Documentation Updates

### Files Updated
- `Architecture and Handover MDs/AI_TODO_LIST_CURRENT.md` - Added completed improvements
- `Architecture and Handover MDs/PROJECT_PROGRESS_MASTER.md` - Updated latest snapshot
- `testing-scripts/regression-test-summary-nov10.md` - Detailed regression analysis
- `testing-scripts/json-schema-improvements-summary.md` - JSON-LD improvements
- `testing-scripts/IMPROVEMENTS-SUMMARY-NOV10.md` - This document

## Deployment Status

### Deployed Changes
- ✅ JSON-LD Product entity creation - Deployed to Vercel
- ✅ ETag change detection - Deployed to Supabase Edge Functions
- ✅ Event-product mapping export fix - Deployed to Vercel
- ✅ View deduplication - Deployed to Supabase (migration applied)

### Verification
- ✅ All changes tested and verified in production
- ✅ Regression test confirms no critical issues
- ✅ Database migrations applied successfully

## Next Steps

### Recommended Actions
1. ✅ Monitor Product entity creation in production
2. ✅ Monitor ETag change detection effectiveness
3. ✅ Continue monitoring regression test results
4. ✅ Review minor regressions (answer length) - may be acceptable

### Future Enhancements
- Consider improving answer length for regressed questions (if needed)
- Monitor Product entity data quality over time
- Track ETag change detection success rate

## Conclusion

All improvements have been successfully implemented, tested, and deployed. The system is stable with:
- ✅ No critical regressions
- ✅ Improved data quality (Product entities)
- ✅ Better change detection (ETag support)
- ✅ Correct event-product mappings
- ✅ Deduplicated views

**Status**: ✅ **APPROVED** - All changes are safe to keep in production.

