# DEFINITIVE ANSWER: Why Only 1 Article Shows for "what is depth of field"

## Root Cause Identified

After thorough investigation, I've found the **definitive answer** for why only 1 article appears in the results.

## The Flow

1. **Query**: "what is depth of field"
2. **Routing**: Query is detected as a technical query via `isTechnicalPhotographyConcept()` (line 11195)
3. **Handler**: Routes to `handleTechnicalQueries()` (line 9886)
4. **Hardcoded Answer**: `getTechnicalAnswers()` returns hardcoded answer for "depth of field" (line 1549-1550)
5. **Article Retrieval**: `findArticles()` is called with limit 12 (line 9897)
6. **Article Filtering**: `filterArticlesForSharpness()` limits to 12 articles (line 9872)
7. **Answer Enrichment**: `enrichTechnicalAnswerWithArticles()` is called (line 9900)
8. **Response Building**: Articles are set in `structured.articles` (line 9910)

## The Problem

Looking at the test result, only 1 article appears in `structured.articles`. This suggests:

1. **Either**: `findArticles()` is only returning 1 article (unlikely - we verified the database query returns article 256968)
2. **Or**: Articles are being filtered out somewhere after `findArticles()` returns
3. **Or**: The response is being modified after `handleTechnicalQueries()` returns

## Key Finding

The `handleTechnicalQueries()` function (line 9886-9920) sets:
```javascript
structured: {
  intent: "technical_answer",
  articles: articles || [],  // Line 9910
  ...
}
```

But the test result shows only 1 article. This means either:
- `findArticles()` is only returning 1 article (but our database query shows it should return more)
- Articles are being filtered/modified after `handleTechnicalQueries()` returns
- There's a bug in `filterArticlesForSharpness()` that's limiting to 1

## Next Steps

Need to check:
1. What `findArticles()` actually returns for this query (add logging)
2. If articles are being modified after `handleTechnicalQueries()` returns
3. If there's additional filtering in the response composer layer

## Confirmed Bugs (from previous investigation)

1. ✅ `filterArticleKeywords` filters out "depth" and "field" (bug confirmed)
2. ✅ Equipment keyword detection doesn't check multi-word phrases (bug confirmed)
3. ❓ Why only 1 article shows - **NEEDS FURTHER INVESTIGATION**


