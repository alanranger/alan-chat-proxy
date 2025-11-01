# 40Q Test Failure Analysis - 8 Consistent Failures

**Date:** November 1, 2025  
**Test:** 40-question deployed API test  
**Status:** ✅ CONFIRMED - Same 8 questions fail consistently across multiple test runs  
**Test Script:** `testing-scripts/test-40q-deployed.cjs`  
**Test Results:** 
- First run: `test results/deployed-analytics-test-2025-11-01T18-52-02-403Z.json`
- Second run: `test results/deployed-analytics-test-2025-11-01T19-09-12-735Z.json`

---

## 📋 Failed Questions (8/40)

All questions return **HTTP 500** (Internal Server Error) with no response body.

### 1. Services Query
**Question:** `"What types of photography services do you offer?"`  
**Category:** General Queries  
**Expected Routing:** `handleServiceQueries()` → `findServices()`  
**Error Pattern:** Services lookup failure

### 2. Equipment Comparison Query
**Question:** `"What is the difference between prime and zoom lenses?"`  
**Category:** Equipment Recommendations  
**Expected Routing:** Technical query → Equipment advice handler  
**Error Pattern:** Technical/equipment query handling failure

### 3. Free Course Query #1
**Question:** `"Is the online photography course really free"`  
**Category:** Course/Workshop Logistics  
**Expected Routing:** `handleServiceQueries()` → `enrichFreeCourseAnswer()`  
**Error Pattern:** Free course query enrichment failure

### 4. Free Course Query #2
**Question:** `"How do I subscribe to the free online photography course?"`  
**Category:** Technical Advice  
**Expected Routing:** `handleServiceQueries()` → `enrichFreeCourseAnswer()`  
**Error Pattern:** Free course query enrichment failure

### 5. Gallery/Feedback Query #1
**Question:** `"How do I get personalised feedback on my images"`  
**Category:** Business Information  
**Expected Routing:** Business category → Gallery/feedback handler  
**Error Pattern:** Missing or failing gallery/feedback handler

### 6. Gallery/Feedback Query #2
**Question:** `"Where is your gallery and can I submit my images for feedback?"`  
**Category:** Business Information  
**Expected Routing:** Business category → Gallery/feedback handler  
**Error Pattern:** Missing or failing gallery/feedback handler

### 7. Location-Based Person Query
**Question:** `"Can I hire you as a professional photographer in Coventry?"`  
**Category:** Person Queries  
**Expected Routing:** Person query handler → Location-based business query  
**Error Pattern:** Person query with location/business intent failure

### 8. Person Name Search
**Question:** `"peter orton"`  
**Category:** Person Queries  
**Expected Routing:** Person query handler → Name search  
**Error Pattern:** Person name search failure

---

## 🔍 Analysis

### Common Patterns

1. **Free Course Queries (2 failures)**
   - Both queries contain "free online photography course" or "free course"
   - Likely failing in `enrichFreeCourseAnswer()` function (line ~8865)
   - May be related to database query failures or response formatting

2. **Gallery/Feedback Queries (2 failures)**
   - Both queries mention "gallery" or "feedback"
   - No specific handler appears to exist for these queries
   - May be incorrectly routed or missing handler entirely

3. **Services Query (1 failure)**
   - Generic "types of services" query
   - Likely failing in `handleServiceQueries()` → `findServices()` chain
   - May be related to service lookup query construction

4. **Equipment/Technical Query (1 failure)**
   - Equipment comparison query
   - May be incorrectly routed or missing handler for lens comparisons

5. **Person Queries (2 failures)**
   - Location-based person query
   - Person name search query
   - Likely missing handlers or incorrect routing for person queries

### Code Locations to Investigate

#### 1. Free Course Query Handling
**File:** `api/chat.js`  
**Function:** `enrichFreeCourseAnswer()` (line ~8865)  
**Related:** `handleServiceQueries()` (line ~8931)  
**Potential Issues:**
- Database query failures in `findServices()` or `findArticles()` calls
- Missing error handling around `client.from('page_chunks').select()` calls
- Response formatting errors when building `enrichedAnswer`

#### 2. Service Query Handling
**File:** `api/chat.js`  
**Function:** `handleServiceQueries()` (line ~8931)  
**Function:** `findServices()` (line ~4115)  
**Potential Issues:**
- `buildPrimaryServicesQuery()` or `buildFallbackServicesQuery()` throwing exceptions
- Error handling missing around `processAndReturnServices()`
- Database connection issues

#### 3. Person Query Handling
**File:** `api/chat.js`  
**Function:** Person query handlers (need to locate)  
**Potential Issues:**
- Missing handler for person queries
- Incorrect routing causing fallthrough to error path
- Database queries failing for person lookups

#### 4. Gallery/Feedback Query Handling
**File:** `api/chat.js`  
**Function:** Need to locate gallery/feedback handler  
**Potential Issues:**
- No handler exists for gallery/feedback queries
- Incorrect business category routing
- Missing database queries for gallery information

#### 5. Technical/Equipment Query Handling
**File:** `api/chat.js`  
**Function:** `handleTechnicalQueryRouting()` (line ~9393)  
**Potential Issues:**
- Equipment comparison queries not handled correctly
- Missing handler for lens comparison queries
- Routing logic incorrectly classifying query type

---

## 🐛 Root Cause Hypothesis

All 8 failures return HTTP 500, indicating **unhandled exceptions** in the code. The main handler (`export default async function handler`) catches errors and returns 500 (lines 7074-7092), but the actual error messages are not being logged or returned.

### Likely Causes:

1. **Missing Error Handling**: Functions like `enrichFreeCourseAnswer()`, `findServices()`, or person query handlers may be throwing exceptions without try-catch blocks
2. **Database Query Failures**: Supabase queries may be failing silently or throwing unhandled errors
3. **Missing Handlers**: Some query types may not have handlers, causing fallthrough to error paths
4. **Routing Logic Issues**: Query classification may be incorrect, routing queries to wrong handlers

---

## 🔧 Recommended Fixes

### 1. Add Error Handling

Wrap all database queries and query handlers in try-catch blocks:

```javascript
async function enrichFreeCourseAnswer(client, qlcService, serviceResponse) {
  try {
    // ... existing code ...
  } catch (error) {
    console.error('enrichFreeCourseAnswer error:', error);
    return { enrichedAnswer: serviceResponse, services: [], articles: [] };
  }
}
```

### 2. Investigate Database Queries

Check if Supabase queries are returning errors:
- `findServices()` queries
- `findArticles()` queries  
- `page_chunks` queries in `enrichFreeCourseAnswer()`

### 3. Add Missing Handlers

Create handlers for:
- Gallery/feedback queries
- Person name searches
- Location-based person queries

### 4. Improve Error Logging

Ensure errors are logged with full context:
```javascript
catch (error) {
  console.error(`[ERROR] ${functionName}:`, {
    query: query,
    error: error.message,
    stack: error.stack
  });
  throw error; // Re-throw to be caught by main handler
}
```

### 5. Test Individual Queries

Test each of the 8 failing questions individually to identify exact failure points:
```bash
node -e "const https = require('https'); /* test single query */"
```

---

## 📊 Test Results Files

- **First Run:** `testing-scripts/test results/deployed-analytics-test-2025-11-01T18-52-02-403Z.json`
- **Second Run:** `testing-scripts/test results/deployed-analytics-test-2025-11-01T19-09-12-735Z.json`
- **Comparison Script:** `testing-scripts/compare-failed-questions.cjs`

---

## ✅ Verification Steps

After fixes are applied:

1. Run the 40Q test again: `node testing-scripts/test-40q-deployed.cjs`
2. Verify all 8 questions now return HTTP 200
3. Check that responses are valid and contain expected content
4. Verify analytics dashboard shows these questions correctly

---

## 📝 Notes

- All failures are **consistent** (not intermittent)
- All failures return **HTTP 500** (no response body)
- Success rate: **80%** (32/40 questions succeed)
- Average confidence of successful queries: **83.5%**
- These failures do not affect the analytics dashboard functionality (failed questions are not logged)

---

**Created:** November 1, 2025  
**For:** Other agent working on `api/chat.js` fixes


