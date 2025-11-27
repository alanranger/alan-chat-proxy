# Migration Plan: Single Source of Truth for 64 Questions

## Current Situation
- **Interactive Testing**: 40 questions (business/logistics/person queries)
- **Regression Test**: 40 questions (technical "how do I" queries)
- **Overlap**: 6 exact matches + 10 same questions (different wording) = 16 questions appear in both
- **Total Unique**: 64 testable questions (6 exact + 10 same + 24 unique Interactive + 24 unique Regression)

## Goal
Create a single canonical 64Q list that:
1. All tools use (interactive testing, regression test, cron dashboard)
2. Preserves historical test results (can still view old 40Q tests)
3. Allows continued fixing of identified issues
4. Enables consistent regression testing going forward

## Migration Strategy

### Phase 1: Create Canonical 64Q List ✅
- [x] Create `testing-scripts/canonical-64q-questions.json` with all 64 questions
- [ ] Create `testing-scripts/question-mapping.json` mapping old questions → canonical
- [ ] Verify all identified issues (Q16-Q36) are in canonical list

### Phase 2: Update Tools (Non-Breaking, Can Deploy Incrementally)
1. **Edge Function** (`supabase/functions/run-40q-regression-test/index.ts`):
   - Update `QUERIES` array to use canonical 64Q list
   - Update `total_questions` to 64
   - Rename function to `run-64q-regression-test` (or keep name, update internally)
   - **Impact**: New tests will use 64Q, old tests remain in DB

2. **Interactive Testing** (`public/interactive-testing.html`):
   - Update `testQuestions` array to use canonical 64Q list
   - Add backward compatibility: when loading old regression tests, map old questions to canonical
   - **Impact**: UI now shows 64 questions, can still load old 40Q tests

3. **Regression Comparison** (`public/regression-comparison.html`):
   - Update `QUERIES` array to use canonical 64Q list
   - Update `QUERY_CATEGORIES` to match
   - Add mapping logic: when comparing old tests, map old questions to canonical
   - **Impact**: Can compare old 40Q tests against new 64Q tests (with mapping)

4. **Cron Dashboard** (`public/cron-dashboard.html`):
   - Update any hardcoded question counts (40 → 64)
   - Ensure it can display results for both old (40Q) and new (64Q) tests
   - **Impact**: Dashboard shows correct counts for both test versions

### Phase 3: Database Schema (Preserve History)
1. **Add column** to `regression_test_results`:
   ```sql
   ALTER TABLE regression_test_results 
   ADD COLUMN question_set_version TEXT DEFAULT 'legacy-40q';
   ```
   - Old tests: `question_set_version = 'legacy-40q'`
   - New tests: `question_set_version = 'canonical-64q'`

2. **Create mapping function** (optional, for on-demand migration):
   - Maps old test results to canonical questions
   - Can be run on-demand to migrate old results
   - Preserves all historical data

3. **Update comparison logic**:
   - When comparing tests, check `question_set_version`
   - If different versions, use mapping to align questions
   - Ensure comparisons work across versions

### Phase 4: Continue Fixing Issues
- All identified issues (Q16, Q17, Q18, Q19, Q20, Q21, Q22, Q24, Q25, Q32, Q33, Q36) are in the canonical 64Q list
- Continue fixing incrementally
- Run regression tests against baseline 964 (will need to map old questions to canonical)

## Implementation Steps

### Step 1: Create Canonical List & Mapping ✅
- [x] Create `canonical-64q-questions.json`
- [ ] Create `question-mapping.json` (maps old Interactive/Regression questions → canonical)
- [ ] Verify all 64 questions are included
- [ ] Verify all identified issues are in canonical list

### Step 2: Update Edge Function
- [ ] Read canonical list from JSON file (or hardcode in TypeScript)
- [ ] Update `QUERIES` array
- [ ] Update `total_questions` to 64
- [ ] Deploy and test

### Step 3: Update Interactive Testing
- [ ] Update `testQuestions` array to use canonical list
- [ ] Add backward compatibility for loading old tests
- [ ] Test loading old regression test
- [ ] Test with new 64Q list

### Step 4: Update Regression Comparison
- [ ] Update `QUERIES` array to use canonical list
- [ ] Update `QUERY_CATEGORIES` to match
- [ ] Add mapping logic for old tests
- [ ] Test comparing old vs new tests

### Step 5: Database Migration
- [ ] Add `question_set_version` column
- [ ] Set existing tests to `'legacy-40q'`
- [ ] Test new tests get `'canonical-64q'`

### Step 6: Validation
- [ ] Run new 64Q regression test
- [ ] Verify interactive testing works
- [ ] Verify regression comparison works
- [ ] Verify historical data is accessible
- [ ] Verify baseline 964 can still be used (with mapping)

## Files to Modify

1. `testing-scripts/canonical-64q-questions.json` ✅ (CREATED)
2. `testing-scripts/question-mapping.json` (NEW - maps old → canonical)
3. `supabase/functions/run-40q-regression-test/index.ts` (UPDATE - use 64Q)
4. `public/interactive-testing.html` (UPDATE - use 64Q, add backward compat)
5. `public/regression-comparison.html` (UPDATE - use 64Q, add mapping)
6. `public/cron-dashboard.html` (UPDATE - if needed)
7. `supabase/migrations/YYYYMMDD_add_question_set_version.sql` (NEW)
8. `api/admin.js` (UPDATE - if it references question count)

## Risk Mitigation

1. **Preserve Historical Data**: All old test results remain in database with `question_set_version = 'legacy-40q'`
2. **Backward Compatibility**: Tools can read both old and new test results
3. **Gradual Rollout**: Update tools one at a time, test each
4. **Rollback Plan**: Keep old question lists in comments, can revert quickly
5. **Baseline Compatibility**: Baseline 964 (legacy-40q) can still be used with mapping

## Timeline

- **Phase 1**: 30 minutes (create canonical list and mapping) ✅
- **Phase 2**: 1-2 hours (update all tools)
- **Phase 3**: 30 minutes (database migration)
- **Phase 4**: Ongoing (continue fixing issues)

**Total Estimated Time**: 2-3 hours

## Next Steps

1. Create `question-mapping.json` to map old questions to canonical
2. Update edge function to use 64Q list
3. Update interactive testing UI
4. Update regression comparison UI
5. Add database column for version tracking
6. Test end-to-end
