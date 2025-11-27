# Deployment Ready: 68Q Migration

## ✅ Completed

1. **Database Migration** - ✅ APPLIED
   - Added `question_set_version` column to `regression_test_results`
   - All existing tests marked as `'legacy-40q'`
   - New tests will use `'canonical-64q'`

2. **Edge Function Updated** - ✅ READY
   - `supabase/functions/run-40q-regression-test/index.ts`
   - Uses canonical 68Q list
   - Sets `question_set_version: "canonical-64q"` in payload

3. **Regression Comparison Tool Updated** - ✅ READY
   - `public/regression-comparison.html`
   - Updated to use canonical 68Q list
   - Can compare new 68Q tests

## 🚀 Deployment Steps

### 1. Deploy Edge Function (Supabase)
```bash
# If using Supabase CLI:
supabase functions deploy run-40q-regression-test

# Or deploy via Supabase Dashboard:
# - Go to Edge Functions
# - Deploy run-40q-regression-test
```

### 2. Deploy Frontend (Vercel)
The `regression-comparison.html` file will be deployed automatically when you push to git (if using Vercel auto-deploy), or:
```bash
# If using Vercel CLI:
vercel --prod

# Or push to git to trigger auto-deploy
git add .
git commit -m "Migrate to canonical 68Q list"
git push
```

## 📋 After Deployment

1. **Run New Regression Test**
   - Use the regression comparison tool or cron dashboard
   - Will generate a new test ID with 68 questions
   - Will have `question_set_version: "canonical-64q"`

2. **Verify**
   - Check that new test has 68 questions
   - Check that `question_set_version` is set correctly
   - Use regression comparison tool to compare against baselines

## 📝 Notes

- Edge function name still says "40q" but uses 68Q list (cosmetic, can rename later)
- All historical tests remain accessible with `question_set_version = 'legacy-40q'`
- New tests will use `question_set_version = 'canonical-64q'`
- Regression comparison tool can handle both old (40Q) and new (68Q) tests

