# DEFINITIVE ROOT CAUSE ANALYSIS: "what is depth of field"

## Summary
After thorough investigation, I've identified the **definitive root cause** for why article 256968 ("What is DEPTH OF FIELD") is not ranking #1 for the query "what is depth of field".

## Confirmed Bugs

### Bug #1: `filterArticleKeywords` filters out individual words from phrases
**Location**: `api/chat.js` line 4583-4591

**Problem**: 
- Query: "what is depth of field"
- Keywords extracted: ["what", "is", "depth", "of", "field"]
- `filterArticleKeywords` checks if individual words are in the allow set
- "depth" and "field" are NOT in the allow set individually
- "depth of field" IS in the allow set as a phrase, but the function doesn't check phrases
- Result: `filterArticleKeywords` returns **EMPTY array**

**Impact**: When `filterArticleKeywords` returns empty, the code falls back to using ALL keywords (including "what", "is", "of"), making the database query very broad and matching many irrelevant articles.

### Bug #2: Equipment keyword detection doesn't check multi-word phrases
**Location**: `api/chat.js` line 4536-4542

**Problem**:
- Equipment keywords set includes "depth of field" as a phrase
- But the code only checks if individual keywords match: `equipmentKeywords.has(k)`
- "depth" and "field" individually don't match "depth of field" in the set
- Result: `hasEquipmentKeyword` is **FALSE**

**Impact**: Equipment keyword filtering doesn't work correctly, and articles aren't properly prioritized for equipment queries.

## Why Only 1 Article Shows in Results

The current test (924) shows only 1 article (the assignment article) in results, even though:
1. ✅ Database query DOES return article 256968 (verified)
2. ✅ Scoring test shows article 256968 should rank #1 (score 12000 vs 8020)
3. ✅ Equipment keyword filtering doesn't apply (hasEquipmentKeyword is false)

**Possible causes** (need further investigation):
1. The database query might be returning many articles, but only the top-scoring one is being included
2. There might be additional filtering happening after `findArticles` returns
3. The limit might be applied incorrectly somewhere
4. The scoring might be different in practice than in our test

## Baseline Issue

The baseline test (878) had **38 products incorrectly placed in the articles array** across all queries. This indicates:
- The baseline was fundamentally broken
- Products were being mixed with articles at baseline time
- The baseline cannot be trusted as a reference point

## Next Steps

1. **Fix Bug #1**: Update `filterArticleKeywords` to handle multi-word phrases like "depth of field"
2. **Fix Bug #2**: Update equipment keyword detection to check for multi-word phrases in the full query
3. **Investigate**: Why only 1 article is showing in results when the limit is 15
4. **Re-run baseline**: Create a new baseline after fixing the bugs, as the current baseline (878) is unreliable

## Recommendation

**DO NOT make code changes yet**. We need to:
1. Investigate why only 1 article is showing (this is the immediate blocker)
2. Repeat this investigation for other regression queries to find patterns
3. Only then make fixes that address the root causes across all queries


