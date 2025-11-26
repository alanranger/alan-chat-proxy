# Why Only 1 Article Shows - Investigation Findings

## Test Results
- **"what is aperture"**: 1 article in structured.articles
- **"what is depth of field"**: 1 article in structured.articles

## Code Flow Analysis

### Step 1: `handleTechnicalQueries` (lines 9886-9920)
- Calls `findArticles(client, { keywords: enriched, limit: sharpIntent ? 25 : 12 })`
- Calls `filterArticlesForSharpness(articles, sharpIntent)` - limits to 12
- Sets `structured.articles: articles || []`

**Test Result**: `handleTechnicalQueries` preserves all articles (tested with 3 articles, all 3 preserved)

### Step 2: `findArticles` function
- This is where the problem likely occurs
- If `filterArticleKeywords` returns empty (for "depth of field"), it falls back to `enhancedKeywords`
- Database query becomes very broad
- But should still return multiple articles

### Step 3: Database Query
- For "what is depth of field": Uses all keywords ["what", "is", "depth", "of", "field"]
- For "what is aperture": Uses just ["aperture"]
- Both should return multiple articles from database

## Hypothesis

The issue is likely that `findArticles` is only returning 1 article because:

1. **Database query is too broad** (for "depth of field") and returns many irrelevant articles
2. **Scoring/filtering removes all but 1 article** before `handleTechnicalQueries` receives them
3. **Equipment keyword filtering** (if incorrectly applied) filters out all but 1 article

## Next Steps

1. Check what `findArticles` actually returns for these queries
2. Check if `processAndSortResults` is limiting articles to 1
3. Check if equipment keyword filtering is removing articles incorrectly


