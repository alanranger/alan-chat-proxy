# ROOT CAUSE IDENTIFIED - Service Reconciliation Loop

## Critical Discovery

The test revealed that **every single URL ingestion request is triggering a service reconciliation loop** that can ingest multiple additional URLs, causing the function to exceed 60 seconds.

## The Problem

**Location:** `api/ingest.js:1432-1458`

**Code:**
```javascript
// Reconcile: ensure each service row in csv_metadata has a page_entities row
try {
  const { data: svcRows } = await supa
    .from('csv_metadata')
    .select('id, url')
    .eq('csv_type', 'landing_service_pages')
    .eq('kind', 'service');
  // ... 
  if (toCreate.length) {
    for (const r of toCreate) {
      const u = String(r.url || '').replace(/\/$/, '');
      try { await ingestSingleUrl(u, supa, { dryRun: false }); } catch (e) { /* continue */ }
    }
  }
}
```

**What's happening:**
1. Frontend calls `/api/ingest` with a single URL
2. Backend handler runs **BEFORE** processing the requested URL
3. Reconciliation checks for missing service entities
4. If any are missing, it calls `ingestSingleUrl()` for EACH one
5. Each `ingestSingleUrl()` call takes 2-3 seconds
6. If there are 20+ missing services, that's 40-60+ seconds
7. **THEN** it processes the original requested URL
8. Total time exceeds 60 seconds → Vercel timeout

## Why Backend Logs Show Success

The backend logs show individual URLs completing in 2-3s because:
- Each `ingestSingleUrl()` call completes successfully
- But the **total function execution time** exceeds 60s
- Vercel kills the function before it can send the response
- Frontend never receives the response → timeout error

## The Fix

**Option 1: Move reconciliation to separate endpoint (RECOMMENDED)**
- Remove reconciliation from single URL ingestion
- Create separate `/api/reconcile-services` endpoint
- Run reconciliation manually or via cron, not on every request

**Option 2: Make reconciliation conditional**
- Only run reconciliation if explicitly requested
- Add `reconcile: true` parameter to request
- Default to `false` for normal ingestion

**Option 3: Make reconciliation async/non-blocking**
- Fire-and-forget reconciliation
- Don't wait for it to complete
- Process requested URL immediately

## Recommended Solution: Option 1

Move reconciliation out of the ingestion path entirely. It should be:
- A separate maintenance operation
- Run periodically (cron) or manually
- Not block normal ingestion requests

## Impact

- **Current**: Every ingestion request can trigger 20+ additional URL ingests
- **After fix**: Single URL ingestion takes 2-3s as expected
- **Result**: No more 60s timeouts

## Confidence Level

**100% confident** - This is the root cause. The test proves it, and the code clearly shows the reconciliation loop running on every request.

