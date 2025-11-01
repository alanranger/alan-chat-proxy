# Regression Analysis: "How do I get personalised feedback on my images"

## Problem
The query "How do I get personalised feedback on my images" is returning wrong content (ISO/Noise Clinic) instead of the correct service answer about private lessons.

## Root Cause Investigation

### What Changed Between Baselines

**Old Baseline (2025-11-01 09:04:38) - WORKING:**
- Type: "services" ✅
- Answer: "**Personalised Feedback**: Alan offers 1-2-1 private photography lessons..."
- Sources: `{ services: [] }` (empty, but answer was correct)

**New Baseline (2025-11-01 10:26:54) - BROKEN:**
- Type: "advice" ❌
- Answer: "Book the ISO & Noise Clinic..." (completely wrong)
- Articles: ISO articles found (wrong routing)

### Pattern Analysis

The pattern at line 1455 SHOULD match:
```javascript
matcher: (lc) => (lc.includes("personalised feedback") || lc.includes("personalized feedback")) && 
                 (lc.includes("image") || lc.includes("photo") || lc.includes("get") || lc.includes("how"))
```

Query: "How do I get personalised feedback on my images"
- ✅ Contains "personalised feedback"
- ✅ Contains "image"
- ✅ Contains "get"
- ✅ Contains "how"

**Pattern test: PASSES in isolation**

### Execution Path

The routing order in `tryRagFirst`:
1. `handleContactInfoQuery` - No match
2. `handleGiftVoucherQuery` - No match
3. `handleAboutAlanQuery` - No match
4. `handleEquipmentQuery` - No match (checks for camera/gear/tripod/lens/memory card)
5. `handleEventRoutingQuery` - No match
6. **`handleServiceQueries`** ← Should match here
7. `handleTechnicalQueries` - Should return null (no technical pattern matches)
8. `processRagFallback` - Falls through if nothing matched

### Possible Issues

1. **Server not restarted** - Code changes not loaded
2. **Pattern evaluation bug** - Pattern not matching when called from within function
3. **Early interception** - Something matching before `handleServiceQueries`
4. **Deployed code mismatch** - Deployed code different from local

## Solution

1. ✅ Pattern added at line 1455 (before generic "private" pattern)
2. ✅ Debug logging added to trace execution
3. ✅ Regression test script created: `test-personalised-feedback-regression.cjs`

## Next Steps

1. **Restart local server** to load new code
2. **Run regression test** to verify fix
3. **Check server console logs** for debug output showing routing
4. **Verify pattern matches** in actual execution
5. **Deploy and verify** deployed version matches local

## Test Script Usage

```bash
node testing-scripts/test-personalised-feedback-regression.cjs
```

This test will:
- Send the query to localhost:3000
- Validate the answer matches expected content
- Check for wrong content (ISO/noise)
- Report pass/fail with detailed errors

## Prevention

- Always run regression test before deploying
- Verify local and deployed produce same results
- Add debug logging to trace query routing
- Test individual queries after code changes

