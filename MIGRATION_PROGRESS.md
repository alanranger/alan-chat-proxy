# Migration Progress: Single Source of Truth for 64Q

## ✅ Completed

1. **Created canonical 64Q list** (`testing-scripts/canonical-64q-questions.json`)
   - Contains 68 questions (will refine to 64 later)
   - Includes all questions from both Interactive Testing and Regression Test
   - Marked with source (both, both-same, interactive, regression)

2. **Created question mapping** (`testing-scripts/question-mapping.json`)
   - Maps old Interactive questions → canonical
   - Maps old Regression questions → canonical
   - Used for backward compatibility

3. **Updated Edge Function** (`supabase/functions/run-40q-regression-test/index.ts`)
   - ✅ Updated QUERIES array to use canonical list (68 questions)
   - ✅ Added `question_set_version: "canonical-64q"` to payload
   - ⚠️ Note: Function name still says "40q" but uses 64Q list (will rename later)

4. **Created Database Migration** (`supabase/migrations/20251127_add_question_set_version.sql`)
   - ✅ Adds `question_set_version` column to `regression_test_results`
   - ✅ Defaults existing records to `'legacy-40q'`
   - ✅ New tests will use `'canonical-64q'`

## 🔄 In Progress

5. **Update Interactive Testing** (`public/interactive-testing.html`)
   - [ ] Replace `testQuestions` array with canonical list
   - [ ] Add backward compatibility for loading old regression tests (map old questions)
   - [ ] Update question count display

6. **Update Regression Comparison** (`public/regression-comparison.html`)
   - [ ] Replace `QUERIES` array with canonical list
   - [ ] Update `QUERY_CATEGORIES` to match
   - [ ] Add mapping logic for comparing old vs new tests

## 📝 Notes

- Current canonical list has 68 questions (not 64) - will refine later
- This is a **temporary join/unify method** - will move to universal source (DB table or shared JSON) after testing
- All historical data is preserved with `question_set_version = 'legacy-40q'`
- New tests will use `question_set_version = 'canonical-64q'`

## 🚀 Next Steps

1. Update `interactive-testing.html` to use canonical list
2. Update `regression-comparison.html` to use canonical list
3. Test end-to-end with new 64Q regression test
4. Verify backward compatibility with old tests
5. Refine canonical list to exactly 64 questions (if needed)
6. **Future**: Move to universal source (database table or shared JSON file)

