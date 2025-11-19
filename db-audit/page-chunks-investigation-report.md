# Page Chunks Investigation Report
**Date:** 2025-11-19  
**Issue:** `page_chunks` table has 0 rows despite 12,716 `page_html` entries

## Executive Summary

The `page_chunks` table is empty due to **two root causes**:

1. **CRITICAL BUG in `cleanup_orphaned_records()` function** - Incorrect SQL logic deletes ALL chunks
2. **No active ingestion** - Light refresh runs show 0 URLs changed, so no new chunks are being created

## Root Cause #1: Bug in `cleanup_orphaned_records()` Function

### The Problem

The function `cleanup_orphaned_records()` in the database has **incorrect SQL logic** that deletes ALL chunks:

```sql
DELETE FROM page_chunks pc
WHERE NOT EXISTS (
  SELECT 1 FROM page_entities pe 
  WHERE pe.id = pc.csv_metadata_id  -- ❌ WRONG: csv_metadata_id references csv_metadata.id, NOT page_entities.id
);
```

### Why This Deletes Everything

- `page_chunks.csv_metadata_id` is a foreign key to `csv_metadata.id` (NOT `page_entities.id`)
- The condition `pe.id = pc.csv_metadata_id` will **never match** because it's comparing different ID spaces
- Therefore, `NOT EXISTS` is **always true**, causing ALL chunks to be deleted

### Correct Logic Should Be

Chunks should be linked to `page_entities` by **URL**, not by `csv_metadata_id`:

```sql
DELETE FROM page_chunks pc
WHERE NOT EXISTS (
  SELECT 1 FROM page_entities pe 
  WHERE pe.url = pc.url  -- ✅ CORRECT: Match by URL
);
```

### Evidence

- Function exists: `cleanup_orphaned_records()` in database
- This function is called by Job #31: "cleanup-orphaned-records"
- Job runs via cron schedule (likely daily or weekly)
- All chunks have been deleted (0 rows in table)

## Root Cause #2: No Active Ingestion

### The Problem

Recent `light_refresh_runs` show:
- **0 URLs changed** in last 5 runs
- **0 ingested_count** in all runs
- Last successful ingestion: Unknown (no data in runs)

### Why No Ingestion

1. **Light refresh checks `last-modified` headers** - If URLs haven't changed, they're skipped
2. **No manual ingestion triggered** - No recent API calls to `/api/ingest`
3. **Cron job may not be running** - Vercel cron may be disabled or misconfigured

### Evidence

```sql
-- Recent light_refresh_runs (last 5):
started_at: 2025-11-15 12:00:02 | ingested_count: 0 | urls_changed: 0
started_at: 2025-11-15 08:00:34 | ingested_count: 0 | urls_changed: 0
started_at: 2025-11-15 04:00:34 | ingested_count: 0 | urls_changed: 0
started_at: 2025-11-15 00:00:34 | ingested_count: 0 | urls_changed: 0
started_at: 2025-11-14 20:00:33 | ingested_count: 0 | urls_changed: 0
```

## Current State

### Database State

- **page_html**: 12,716 rows (HTML is being stored)
- **page_chunks**: 0 rows (chunks are NOT being created/stored)
- **page_entities**: Unknown count (need to verify)
- **Last HTML update**: 2025-11-17 16:06:08
- **Last chunk creation**: Never (table is empty)

### Code Path Analysis

1. **`ingest.js`** (lines 631-699):
   - ✅ Creates chunks from text
   - ✅ Deletes old chunks for URL
   - ✅ Inserts new chunks
   - ⚠️ **BUT**: Only runs if URLs are detected as changed

2. **`light-refresh.js`**:
   - ✅ Checks for changed URLs
   - ❌ **Returns 0 changed URLs** (no ingestion triggered)

3. **`cleanup_orphaned_records()`**:
   - ❌ **BUG**: Deletes ALL chunks due to incorrect SQL

## Impact

### Critical Issues

1. **Chatbot RAG search broken** - No chunks = no semantic search
2. **Risk score: 80** - Dashboard shows "Chunking Health: 0" (critical)
3. **Total risk: 95** - Primarily due to missing chunks

### Affected Systems

- `/api/chat.js` - RAG search queries `page_chunks`
- `/api/tools.js` - `match_page_chunks` RPC function
- Dashboard health monitoring - Shows critical chunking issue

## Fixes Required

### Fix #1: Correct `cleanup_orphaned_records()` Function

**Priority:** CRITICAL  
**Action:** Update SQL to match chunks by URL, not csv_metadata_id

```sql
CREATE OR REPLACE FUNCTION cleanup_orphaned_records()
RETURNS TABLE(orphaned_chunks BIGINT, orphaned_entities BIGINT)
LANGUAGE plpgsql
AS $$
DECLARE
  v_chunks BIGINT;
  v_entities BIGINT;
BEGIN
  -- Delete page_chunks that have no matching page_entities by URL
  DELETE FROM page_chunks pc
  WHERE NOT EXISTS (
    SELECT 1 FROM page_entities pe 
    WHERE pe.url = pc.url  -- ✅ FIX: Match by URL, not csv_metadata_id
  );
  GET DIAGNOSTICS v_chunks = ROW_COUNT;
  
  -- Delete page_entities that reference non-existent csv_metadata
  DELETE FROM page_entities pe
  WHERE pe.csv_metadata_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM csv_metadata cm 
      WHERE cm.id = pe.csv_metadata_id
    );
  GET DIAGNOSTICS v_entities = ROW_COUNT;
  
  RETURN QUERY SELECT v_chunks, v_entities;
END;
$$;
```

### Fix #2: Trigger Manual Ingestion

**Priority:** HIGH  
**Action:** Manually trigger ingestion for all URLs in `page_html`

```bash
# Option 1: Use light-refresh with force flag
curl -X GET "https://your-vercel-url/api/light-refresh?action=run&force=true"

# Option 2: Manually ingest URLs from page_html
# (Need to create script to fetch URLs and call /api/ingest)
```

### Fix #3: Verify Cron Job Configuration

**Priority:** MEDIUM  
**Action:** Check Vercel cron configuration for light-refresh job

- Verify cron schedule is active
- Check if job is running but failing silently
- Review Vercel function logs for errors

## Verification Steps

### Step 1: Fix the Function

```sql
-- Apply the corrected function
-- (See Fix #1 above)

-- Verify function exists and is correct
SELECT routine_definition 
FROM information_schema.routines 
WHERE routine_name = 'cleanup_orphaned_records';
```

### Step 2: Test Manual Ingestion

```bash
# Test with a single URL
curl -X POST "https://your-vercel-url/api/ingest" \
  -H "Authorization: Bearer $INGEST_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.alanranger.com/photographic-workshops-near-me"}'

# Verify chunks were created
SELECT COUNT(*) FROM page_chunks WHERE url = 'https://www.alanranger.com/photographic-workshops-near-me';
```

### Step 3: Monitor Chunk Creation

```sql
-- Check chunk count after ingestion
SELECT COUNT(*) as total_chunks FROM page_chunks;

-- Check chunks by URL
SELECT url, COUNT(*) as chunk_count 
FROM page_chunks 
GROUP BY url 
ORDER BY chunk_count DESC 
LIMIT 10;
```

## Prevention

### Recommendations

1. **Add regression test** for `cleanup_orphaned_records()` - Verify it doesn't delete valid chunks
2. **Add monitoring** - Alert when chunk count drops below threshold
3. **Review all cleanup functions** - Ensure they use correct join conditions
4. **Add logging** - Log how many chunks are deleted and why

### Code Review Checklist

- [ ] Verify foreign key relationships before writing cleanup SQL
- [ ] Test cleanup functions with sample data before deployment
- [ ] Add assertions/checks to prevent deleting all records
- [ ] Monitor chunk counts in health dashboard

## Conclusion

The `page_chunks` table is empty due to a **critical bug in the cleanup function** that deletes all chunks, combined with **no active ingestion** to repopulate the table. The fix requires:

1. **Immediate**: Correct the `cleanup_orphaned_records()` function SQL
2. **Short-term**: Trigger manual ingestion to repopulate chunks
3. **Long-term**: Add monitoring and regression tests to prevent recurrence

---

**Report Generated:** 2025-11-19 20:48 UTC  
**Investigator:** AI Assistant  
**Status:** ROOT CAUSES IDENTIFIED - FIXES REQUIRED

