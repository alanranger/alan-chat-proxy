# Related Information Analysis - Root Cause Investigation

**Date**: 2025-11-01  
**Test**: 430-question deployed API test  
**Sample Size**: 100 responses

## 🔍 ROOT CAUSE IDENTIFIED

### Issue: Data Format Mismatch & Missing Enrichment

**Problem 1: Sources Format Mismatch**
- `buildRagResponse()` stores `sources` as an **array** of URLs/strings
- Analytics dashboard expects `sources` to be an **object** with `articles`, `services`, `events`, `products` arrays
- `structured.sources` is also an array instead of being removed

**Problem 2: Empty Structured Arrays**
- `structured.articles` relies on `context.results.articles` which may be empty
- `structured.services` relies on `context.results.services` which may be empty
- These arrays are not being populated from `ragResult.sources`

**Problem 3: Restrictive Enrichment Logic**
- `addServicesForEnrichment()` only adds services for:
  - `businessCategory === 'Business Information'` OR
  - `businessCategory === 'Course/Workshop Logistics'`
- Many advice queries are categorized as:
  - "General Queries" (default)
  - "Technical Photography Concepts"
  - "Equipment Recommendations"
  - "Person Queries"
  - "Technical Advice"
- These categories don't get services enrichment even when relevant!

**Problem 4: Sources Not Converted to Structured Format**
- `ragResult.sources` is an array but needs to be converted to structured format
- The `sources` array contains URLs but they're not mapped to `articles`, `services`, etc.

---

## 📊 EVIDENCE FROM TEST RESULTS

### Responses Without Related Info (3 examples):
1. **"What is color grading?"**
   - `sources`: Array of 25 URL strings
   - `structured.sources`: Array of 25 URLs
   - `structured.articles`: Empty array ❌
   - `structured.services`: Empty array ❌
   - **Issue**: URLs in `sources` array not converted to `articles` array

2. **"What are presets and how do I use them?"**
   - `sources`: Array of 1 URL string
   - `structured.sources`: Array of 1 URL
   - `structured.articles`: Empty array ❌
   - **Issue**: Source URL not converted to article

3. **"Can I get a refund if I can't attend?"**
   - `sources`: Array of 4 URL strings
   - `structured.sources`: Array of 4 URLs
   - `structured.articles`: Empty array ❌
   - `structured.services`: Empty array ❌
   - **Issue**: URLs not converted to structured format

### Responses With Related Info (for comparison):
- Event queries work correctly because `structured.events` is populated directly
- Services queries work when they match the restrictive business category logic

---

## 🔧 REQUIRED FIXES

### Fix 1: Convert Sources Array to Structured Format
**Location**: `buildRagResponse()` function (line ~8648)

**Current Code**:
```javascript
structured: {
  intent: context.finalType || 'advice',
  sources: context.finalSources || [],  // ❌ Array of URLs
  events: [],
  products: [],
  articles: context.results && context.results.articles || [],
  services: context.results && context.results.services || []
}
```

**Fix Needed**:
1. Remove `sources` from structured object (or convert it)
2. Ensure `articles` and `services` arrays are populated from `context.results` or `context.finalSources`
3. Convert `context.finalSources` URLs to article/service objects if needed

### Fix 2: Improve Enrichment Logic
**Location**: `addServicesForEnrichment()` function (line ~9881)

**Current Code**:
```javascript
if (businessCategory === 'Business Information' || businessCategory === 'Course/Workshop Logistics') {
  // Only adds services for these 2 categories
}
```

**Fix Needed**:
- Expand enrichment to include more business categories
- Add services for queries that mention services (e.g., "Do you offer gift vouchers?")
- Add articles for general advice queries

### Fix 3: Ensure Sources Are Converted to Structured Format
**Location**: `sendRagSuccessResponse()` function (line ~9928)

**Current Code**:
```javascript
ragResult.structured = await enrichAdviceWithRelatedInfo(client, context.query, ragResult.structured);
```

**Fix Needed**:
- Before enrichment, convert `ragResult.sources` array to `structured.articles` if they're article URLs
- Map URLs to article/service objects if they exist in the database

### Fix 4: Fix Sources Object Structure
**Location**: Wherever `sources` is used in responses

**Current Code**:
- `sources: context.finalSources || []` (array)

**Fix Needed**:
- Convert to: `sources: { articles: [], services: [], events: [], products: [] }`

---

## 📝 RECOMMENDATIONS

### Priority 1: Fix Sources Format (HIGH)
1. Update `buildRagResponse()` to convert sources array to structured format
2. Remove `structured.sources` array or convert it properly
3. Ensure `structured.articles` and `structured.services` are populated from `context.results`

### Priority 2: Improve Enrichment Logic (MEDIUM)
1. Expand `addServicesForEnrichment()` to include more business categories
2. Add keyword-based matching for common service queries
3. Make enrichment more aggressive for advice-type responses

### Priority 3: Convert Source URLs to Objects (MEDIUM)
1. When `sources` is an array of URLs, convert them to article/service objects
2. Use database lookup to find article/service objects by URL
3. Populate structured arrays with full objects, not just URLs

### Priority 4: Testing (HIGH)
1. Run test suite after fixes
2. Verify structured_response is stored correctly
3. Check analytics dashboard displays related information tiles

---

## 🎯 EXPECTED OUTCOME

After fixes:
- **Related information coverage**: Should increase from 57% to 80%+
- **Advice responses**: Should get articles/services enrichment
- **Sources format**: Should match analytics dashboard expectations
- **Structured data**: Should be properly stored in database

---

## 📋 NEXT STEPS

1. ✅ **Analysis Complete** - Root cause identified
2. 🔧 **Fix Sources Format** - Update `buildRagResponse()` and related functions
3. 🔧 **Improve Enrichment** - Expand business category logic
4. ✅ **Test** - Run 430-question test to verify improvements
5. ✅ **Verify** - Check analytics dashboard displays correctly

