# Regression Investigation: "what is macro photography"

## Query Details
- **Query**: "what is macro photography"
- **Regression**: 12 articles (baseline 878) → 3 articles (current 924)
- **Test IDs**: Baseline #878, Current #924

## Baseline Results (Test #878)
- **Article Count**: 12 articles in `structured.articles`
- **Response Type**: `services` (not `technical_answer`)
- **Key Observation**: Baseline returned services, not articles. The 12 articles were in `structured.articles` but the response type was `services`.

## Current Results (Test #924)
- **Article Count**: 3 articles in `structured.articles`
- **Response Type**: `services` (same as baseline)
- **Articles**:
  1. "Unlocking the Art of MACRO PHOTOGRAPHY: Techniques and Tips" (2025-04-30) - Proper article
  2. "Closeup Macro Photography Practice Assignment- Free Lesson" (2025-11-23) - **NEW assignment article**
  3. "Macro Photography Workshop - Abstract and Macro Warwickshire" (2019-11-12) - Product/workshop

## Keyword Analysis
- **Extracted Keywords**: `["what","is","macro","photography"]`
- **Filtered Keywords**: `["macro"]` ✅ (filterArticleKeywords works correctly)
- **Equipment Keyword Detection**: `false` (macro is in genreKeywords, not equipmentKeywords)
- **No Equipment Filtering Applied**: Correct behavior

## Key Findings

### 1. Response Type Mismatch
- Both baseline and current return `type: "services"` instead of `type: "advice"` or `type: "technical_answer"`
- This suggests the query is NOT being handled by `handleTechnicalQueries`
- The query is likely being routed to a different handler (possibly services handler)

### 2. Article Count Drop
- Baseline: 12 articles
- Current: 3 articles
- **9 articles missing** from current results

### 3. New Assignment Article
- "Closeup Macro Photography Practice Assignment" (published 2025-11-23) appears in current results
- This is the same pattern as "what is depth of field" and "what is aperture"

### 4. Different Pattern from "what is depth of field"
- "what is macro photography" is NOT handled by `handleTechnicalQueries` (response type is `services`)
- "what is depth of field" IS handled by `handleTechnicalQueries` (response type is `advice`)
- This suggests different code paths are involved

## Questions to Investigate
1. Why is this query returning `type: "services"` instead of `type: "technical_answer"`?
2. Where are the 9 missing articles from baseline?
3. Is this query being handled by a different code path than "what is depth of field"?
4. Why does the new assignment article rank #2 instead of #1?

## Next Steps
1. Check if "what is macro photography" should be handled by `handleTechnicalQueries`
2. Investigate why it's returning services instead of technical answer
3. Check the services handler code path to see if it has similar issues


