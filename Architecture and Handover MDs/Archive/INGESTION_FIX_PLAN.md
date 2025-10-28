# Ingestion Fix Plan: Database Duplication Issue

## Problem Summary
The ingestion process is creating multiple entries for the same URL with different `kind` values and titles, causing:
- Generic "Alan Ranger Photography" titles overriding actual page titles
- Up to 7 duplicate entries per URL
- Incorrect content matching in the chatbot

**UPDATE (2025-10-18)**: The critical "free course" query issue has been resolved through database cleanup, but the underlying ingestion duplication problem remains. Additionally, a major refactoring effort has been completed, improving code maintainability across 37 functions.

## Phase 1: Immediate Database Cleanup
1. **Identify all duplicate URLs**
   ```sql
   SELECT page_url, COUNT(*) as duplicate_count
   FROM page_entities 
   GROUP BY page_url
   HAVING COUNT(*) > 1
   ORDER BY duplicate_count DESC;
   ```

2. **Clean up duplicates systematically**
   - Keep entries with actual page titles
   - Remove generic "Alan Ranger Photography" entries
   - Preserve the most specific/valuable content

3. **Test the free course query** to verify the fix works

## Phase 2: Fix Ingestion Logic
1. **Analyze ingest.js** to understand how duplicates are created
2. **Identify schema.org extraction** that's causing generic titles
3. **Implement deduplication logic** in the ingestion process
4. **Prioritize actual page titles** over generic organization names

## Phase 3: Prevent Future Issues
1. **Add database constraints** to prevent URL+kind duplication
2. **Implement upsert logic** instead of insert logic
3. **Add validation** to ensure title quality

## Phase 4: Testing & Validation
1. **Re-test the free course query** after fixes
2. **Test other affected queries** to ensure they work
3. **Validate that new content** doesn't create duplicates

## Success Criteria
- ✅ "Free online photography course" returns correct content
- ✅ No duplicate entries in page_entities table
- ✅ New content ingestion doesn't create duplicates
- ✅ All existing queries work correctly

## Current Status
- ✅ **Phase 1 COMPLETED**: Database cleanup done (322 duplicates removed)
- ✅ **Service prioritization fixed**: `findServices` limit increased to 100
- ✅ **Live testing passed**: Both clarification chain and direct query work
- ⏳ **Phase 2 PENDING**: Ingestion logic fix needed
- ⏳ **Phase 3 PENDING**: Prevention measures needed
- ⏳ **Phase 4 PENDING**: Full testing needed

## Timeline
- **Phase 1**: ✅ COMPLETED (immediate fix)
- **Phase 2**: 2-4 hours (ingestion logic fix) - **NEXT PRIORITY**
- **Phase 3**: 1-2 hours (prevention measures)
- **Phase 4**: 1 hour (testing)

**Total Estimated Time Remaining**: 4-7 hours
