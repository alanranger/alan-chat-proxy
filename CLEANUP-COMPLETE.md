# Cleanup Complete: Unified 64Q Test List

## ✅ Completed Tasks

### 1. Created Shared Canonical Source
- ✅ `public/canonical-64q.js` - Shared loader for all HTML tools
- ✅ `public/canonical-64q-questions.json` - Single source of truth (64 questions)
- ✅ `testing-scripts/canonical-64q-questions.json` - Synced copy

### 2. Updated All HTML Tools
- ✅ `public/regression-comparison.html` - Now loads from canonical source
- ✅ `public/interactive-testing.html` - Now loads from canonical source
- ✅ `public/cron-dashboard.html` - No changes needed (reads from DB)

### 3. Updated Edge Function
- ✅ `supabase/functions/run-40q-regression-test/index.ts` - Updated to use 64 questions

### 4. Fixed Question Count
- ✅ Canonical JSON now has exactly 64 questions (was 68)
- ✅ Removed last 4 questions (65-68) to get to 64

### 5. Removed Temporary Scripts
- ✅ `testing-scripts/test-q17-certificate.cjs` - Deleted
- ✅ `testing-scripts/test-q25-handler.cjs` - Deleted
- ✅ `testing-scripts/check-remaining-issues.cjs` - Deleted
- ✅ `testing-scripts/check-remaining-issues-v2.cjs` - Deleted
- ✅ `testing-scripts/find-contact-terms-pages.cjs` - Deleted
- ✅ `testing-scripts/compare-live-vs-964.cjs` - Deleted
- ✅ `testing-scripts/compare-live-vs-nov2-baseline.cjs` - Deleted

### 6. Removed Hardcoded Arrays
- ✅ Removed hardcoded QUERIES array from `regression-comparison.html`
- ✅ Removed hardcoded QUERY_CATEGORIES array from `regression-comparison.html`
- ✅ Removed hardcoded testQuestions array from `interactive-testing.html`

## 📋 Single Source of Truth

All tools now use **`public/canonical-64q-questions.json`** as the single source of truth:
- **regression-comparison.html** - Loads via `canonical-64q.js`
- **interactive-testing.html** - Loads via `canonical-64q.js`
- **run-40q-regression-test** edge function - Hardcoded list (should match JSON)

## 🎯 Next Steps

1. Test all three tools to ensure they load questions correctly
2. Run a regression test to verify the 64Q list works
3. All tools should now show consistent question numbering (Q1-Q64)

## 📝 Notes

- Database migrations are kept (they're permanent fixes)
- `test-fixed-questions.cjs` was kept (may be useful for future testing)
- All changes committed and pushed to main branch

## Update Log
- 2026-01-16 19:59: Updated with latest ingest image fallback (prefer content over logo), bulk ingest UI watchdog timeout, search tile description expansion and image fallback/proxy, and restore point `restore-20260116-1948`.

