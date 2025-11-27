# Cleanup Plan: Return to BAU with Unified 64Q Test List

## Status: IN PROGRESS

### Goals
1. ✅ Create shared canonical-64q.js file
2. ⏳ Update regression-comparison.html to use canonical source
3. ⏳ Update interactive-testing.html to use canonical source  
4. ⏳ Update cron-dashboard.html (if needed)
5. ⏳ Fix canonical JSON to have exactly 64 questions (currently 68)
6. ⏳ Remove temporary testing scripts

### Files Created
- ✅ `public/canonical-64q.js` - Shared loader for canonical questions
- ✅ `public/canonical-64q-questions.json` - Copied from testing-scripts/

### Files to Update
- ⏳ `public/regression-comparison.html` - Partially updated, needs completion
- ⏳ `public/interactive-testing.html` - Needs update to use canonical source
- ⏳ `public/cron-dashboard.html` - Check if needs update

### Temporary Scripts to Remove
- `testing-scripts/test-q17-certificate.cjs`
- `testing-scripts/test-q25-handler.cjs`
- `testing-scripts/check-remaining-issues.cjs`
- `testing-scripts/check-remaining-issues-v2.cjs`
- `testing-scripts/find-contact-terms-pages.cjs`
- `testing-scripts/compare-live-vs-*.cjs` (temporary comparison scripts)
- `testing-scripts/test-fixed-questions.cjs` (may keep for future use)

### Database Migrations
- ✅ `20251127_allow_any_phase_as_master_baseline.sql` - KEEP (permanent fix)
- All other migrations are permanent and should be kept

### Next Steps
1. Complete regression-comparison.html update
2. Update interactive-testing.html
3. Verify canonical JSON has exactly 64 questions
4. Remove temporary scripts
5. Test all three tools use same source

