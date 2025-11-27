# Migration Summary: Single Source of Truth for 64Q

## ✅ Phase 1 Complete: Core Infrastructure

1. **Canonical 64Q List Created** (`testing-scripts/canonical-64q-questions.json`)
   - 68 questions (will refine to 64 later)
   - All questions from both Interactive Testing and Regression Test
   - Ready for use

2. **Question Mapping Created** (`testing-scripts/question-mapping.json`)
   - Maps old Interactive questions → canonical
   - Maps old Regression questions → canonical
   - Enables backward compatibility

3. **Edge Function Updated** (`supabase/functions/run-40q-regression-test/index.ts`)
   - ✅ Uses canonical 64Q list (68 questions)
   - ✅ Sets `question_set_version: "canonical-64q"` in payload
   - ⚠️ Function name still says "40q" (cosmetic, will rename later)

4. **Database Migration Created** (`supabase/migrations/20251127_add_question_set_version.sql`)
   - ✅ Adds `question_set_version` column
   - ✅ Defaults existing records to `'legacy-40q'`
   - ✅ Ready to apply

## 🔄 Phase 2 Remaining: UI Updates

5. **Interactive Testing** (`public/interactive-testing.html`)
   - [ ] Replace `testQuestions` array (lines 827-1068) with canonical list
   - [ ] Add backward compatibility function to map old questions when loading regression tests
   - Status: Generated formatted questions ready, need to replace in file

6. **Regression Comparison** (`public/regression-comparison.html`)
   - [ ] Replace `QUERIES` array (line 443) with canonical list
   - [ ] Replace `QUERY_CATEGORIES` array (line 487) with canonical categories
   - [ ] Add mapping logic for comparing old vs new tests
   - Status: Generated formatted questions ready, need to replace in file

## 📋 Next Steps

1. **Apply database migration** (run the SQL migration)
2. **Update interactive-testing.html** (replace testQuestions array)
3. **Update regression-comparison.html** (replace QUERIES and QUERY_CATEGORIES)
4. **Test end-to-end**:
   - Run new 64Q regression test
   - Verify interactive testing works with new list
   - Verify regression comparison works
   - Verify backward compatibility (loading old tests)

## ⚠️ Important Notes

- **Temporary Solution**: This is a join/unify method. After testing, we'll move to a universal source (database table or shared JSON file).
- **Question Count**: Currently 68 questions, will refine to exactly 64 later if needed.
- **Historical Data**: All old tests remain accessible with `question_set_version = 'legacy-40q'`.
- **Backward Compatibility**: Tools will be able to read both old and new test results.

## 🚀 Deployment Order

1. Apply database migration first
2. Deploy edge function update
3. Deploy UI updates (interactive-testing.html, regression-comparison.html)
4. Test with new 64Q regression test
5. Verify all tools work correctly

