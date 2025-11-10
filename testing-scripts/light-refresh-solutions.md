# Solutions for Light-Refresh Change Detection

## Current Problem
- URLs don't have `last-modified` headers
- Edge Function marks them as "failed" (can't track changes)
- The API function (`api/light-refresh.js`) already assumes changed if no header, but Edge Function doesn't

## Solution Options

### Option 1: Use ETag Headers (Recommended - Lightweight)
**Pros:**
- Very fast (HEAD request only)
- Many websites provide ETag headers
- No content download needed

**Cons:**
- Not all websites have ETag headers
- Still need fallback for URLs without ETag

**Implementation:**
- Modify Edge Function to check for ETag header
- Store ETag in `url_last_processed` table
- Compare ETags to detect changes

### Option 2: Periodic Full Refresh (Simplest)
**Pros:**
- Simple to implement
- No change detection needed
- Guaranteed to catch all changes

**Cons:**
- Less efficient (re-ingests unchanged content)
- More API calls

**Implementation:**
- Re-ingest all URLs every N days (e.g., every 7 days)
- Track last full refresh date
- Skip change detection entirely

### Option 3: Content Hash (Most Accurate)
**Pros:**
- Most accurate change detection
- Works for all URLs

**Cons:**
- Requires downloading content (slower, more bandwidth)
- More expensive

**Implementation:**
- Download first N bytes of content
- Generate SHA-1 hash
- Store hash in `url_last_processed` table
- Compare hashes to detect changes

### Option 4: Hybrid Approach (Best Balance)
**Pros:**
- Uses best available method per URL
- Efficient and accurate

**Cons:**
- More complex implementation

**Implementation:**
1. Check for `last-modified` header (fastest)
2. If not available, check for ETag header (fast)
3. If not available, use periodic refresh (every 7 days)
4. Optionally: content hash for critical URLs

## Recommended Solution: Option 4 (Hybrid)

### Phase 1: Add ETag Support
1. Modify Edge Function to check ETag headers
2. Add `etag_header` column to `url_last_processed` table
3. Compare ETags to detect changes

### Phase 2: Add Periodic Refresh Fallback
1. Add `last_full_refresh_at` column
2. If no `last-modified` or ETag, re-ingest if last refresh > 7 days ago
3. This ensures all URLs get refreshed periodically

### Phase 3: (Optional) Content Hash for Critical URLs
1. For URLs that change frequently, use content hash
2. Download first 1KB of content
3. Generate hash and compare

## Implementation Priority

**Immediate (Quick Win):**
- Fix Edge Function to use ETag headers
- Add periodic refresh fallback (7 days)

**Short Term:**
- Add `etag_header` column to database
- Update Edge Function to check ETag

**Long Term:**
- Consider content hash for frequently changing URLs
- Add monitoring/alerting for refresh status

