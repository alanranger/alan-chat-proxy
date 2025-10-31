# 40Q Interactive Testing Results Analysis
**Date:** 2025-10-31  
**Total Questions:** 40  
**Pass:** 8 (20%)  
**Fail:** 32 (80%)

## Summary by Category

| Category | Pass | Fail | Issues |
|----------|------|------|--------|
| Event Queries | 5 | 0 | 2 questions with 75% related scores |
| General Queries | 3 | 1 | Missing articles, service tiles |
| Equipment Recommendations | 1 | 4 | Wrong routing, irrelevant answers, article capping |
| Course/Workshop Logistics | 0 | 5 | Wrong routing, missing content, edge cases |
| Business Information | 1 | 4 | Missing service tiles, wrong content types |
| Technical Photography Concepts | 0 | 4 | No answers, wrong articles, missing content |
| Person Queries | 1 | 3 | Wrong content types (should use landing pages) |
| Technical Advice | 0 | 5 | Wrong routing, missing articles, edge cases |

## Critical Issues by Priority

### 🔴 P1: Routing Failures (Wrong Intent/Type)

**Questions Affected:**
- Q9: "What gear or equipment do I need to bring to a workshop?" → Should find from workshop pages/chunks
- Q10: "What is the difference between prime and zoom lenses?" → Didn't answer question
- Q11: "What memory card should I buy?" → Totally irrelevant answer
- Q14: "Is the online photography course really free?" → Wrong course referenced
- Q17: "How do I get personalised feedback on my images" → Should show 1-2-1 service tile
- Q22: "What is long exposure..." → Wrong routing (should find article tiles)
- Q25: "What is white balance..." → Should answer but didn't
- Q26: "What is HDR photography?" → Incorrect initial response
- Q27: "Who is Alan Ranger..." → Good answer but wrong related content
- Q28: "Where is Alan Ranger based?" → Irrelevant answer
- Q31: "Can I hire you as a professional photographer..." → Should answer directly
- Q35: "How do I improve my composition..." → Wrong routing
- Q36: "How do I use flash photography?" → Should say "I don't have an answer"

**Root Causes:**
- Classification routing incorrect
- Content not being retrieved from correct sources
- Hardcoded routes missing these patterns

### 🔴 P1: Missing or Empty Initial Responses

**Questions Affected:**
- Q23: "What is the exposure triangle..." → **No bot initial response**
- Q38: "How do I subscribe to the free online photography course?" → Empty

**Root Causes:**
- Answer generation failing for technical concepts
- Edge case not handled

### 🟡 P2: Article Selection & Capping Issues

**Questions Affected:**
- Q5: "My pictures never seem sharp..." → Previously showed more articles (focus, sharp, blurry tags)
- Q7: "What tripod do you recommend" → **Should show ALL related articles with no cap**
- Q10: "What is the difference between prime and zoom lenses?" → Some relevant, some not
- Q24: "What is depth of field..." → Wrong article links, better articles exist
- Q25: "What is white balance..." → No related articles but articles exist in DB
- Q26: "What is HDR photography?" → Articles available that weren't picked (e.g., "what is bracketing")

**Root Causes:**
- Articles hardcapped at 6 (`pickArticles()` returns `result.slice(0,6)`)
- Scoring/relevance algorithm not matching best articles
- Need to remove cap for equipment/technical questions

### 🟡 P2: Service/Landing Page Tiles Not Showing

**Questions Affected:**
- Q6: "What types of photography services do you offer?" → Note says "no service tiles showing" but marked Pass
- Q17: "How do I get personalised feedback..." → Should show 1-2-1 private lesson service tile
- Q19: "Do you offer gift vouchers?" → Should show gift voucher service tile
- Q20: "What is your cancellation policy..." → Should show landing page tile
- Q21: "Where is your gallery..." → Should show landing and service pages
- Q27: "Who is Alan Ranger..." → Should use landing pages (about-alan, ethics, testimonials)
- Q28: "Where is Alan Ranger based?" → Should use landing page data
- Q34: "who is alan ranger" → Should show orange pill linked to about-alan page (not articles)

**Root Causes:**
- Services not being retrieved/returned in structured data
- Landing pages not being used for person queries
- Service filtering not working correctly

### 🟡 P2: Course vs Workshop Confusion

**Questions Affected:**
- Q15: "What courses do you offer for complete beginners?" → Talks about workshops, not courses
- Q16: "How many weeks is the beginners' photography course?" → Should detect 3 weeks from data

**Root Causes:**
- Classification not distinguishing courses from workshops
- Course data not being retrieved separately

### 🟡 P2: Content Type Preference Issues

**Questions Affected:**
- Q27, Q34: Person queries should show landing pages, not articles
- Q31: Professional hire query should filter services to professional services only
- Multiple questions: Should prefer landing pages over articles for certain query types

**Root Causes:**
- No logic to prioritize landing pages for person/business info queries
- Service filtering too broad

### 🟡 P2: URLs in Responses (Presentation)

**Questions Affected:**
- Q19: "Do you offer gift vouchers?" → Shouldn't show URL in response
- Q27: "Who is Alan Ranger..." → Shouldn't show URL link in response
- Q34: "who is alan ranger" → Shouldn't need URL in response

**Root Causes:**
- Hardcoded answers including URLs
- Should present cleaner responses

### 🟢 P3: Edge Cases Needing Special Handling

**Questions Affected:**
- Q12: "Do you I get a certificate with the photography course" → Should show free online photography course tile
- Q14: "Is the online photography course really free" → Edge case
- Q36: "How do I subscribe to the free online photography course?" → Edge case again
- Q18: "How long are your workshops?" → Picked 3 events but unclear why those 3
- Q4: "when are your next Autumn workshops..." → Missing some 2026 workshops at Batsford

**Root Causes:**
- "Free online photography course" needs special routing/display logic
- Event selection criteria unclear
- Date filtering may be too restrictive

### 🟢 P3: Answer Quality Issues

**Questions Affected:**
- Q7: "What tripod do you recommend" → Previously gave conversational response, now only 10% score
- Q13: "Do I need a laptop for the lightroom course" → Should answer in initial response (50% score)
- Q25: "What is white balance..." → Should answer with brief summary conversation style
- Q26: "What is HDR photography?" → Should answer conversationally from article data
- Q33: "peter orton" → Should be more natural conversational answer, not just meta description
- Q35: "How do I improve my composition..." → Should respond conversationally from data
- Q40: "How do I improve my photography skills?" → Should respond conversationally from data

**Root Causes:**
- Answer generation not extracting/summarizing from retrieved content
- Relying too heavily on structured data instead of generating conversational answers

## Recommendations

### Immediate Fixes (P1)

1. **Fix Missing Initial Responses:**
   - Q23 (exposure triangle): Ensure technical questions generate answers from article content
   - Q38 (free course subscribe): Handle edge case

2. **Fix Wrong Routing:**
   - Add pattern matches for equipment questions (gear, memory card, prime/zoom lenses)
   - Add pattern match for "personalised feedback" → 1-2-1 service
   - Fix "long exposure" routing to articles
   - Fix professional hire routing

3. **Fix Article Retrieval:**
   - Remove or make configurable the 6-article cap for equipment/technical questions
   - Improve article scoring to match best articles first
   - Ensure fallback searches return relevant content

### Short-term Fixes (P2)

4. **Fix Service/Landing Page Tiles:**
   - Ensure services are returned in structured data for service queries
   - Add landing page retrieval for person queries
   - Filter services by category (professional vs tuition)

5. **Fix Course vs Workshop:**
   - Distinguish courses from workshops in classification
   - Retrieve course data separately

6. **Improve Answer Quality:**
   - Generate conversational answers from article chunks for technical questions
   - Extract key information from content rather than returning raw data

### Medium-term Improvements (P3)

7. **Handle Edge Cases:**
   - Add special routing for "free online photography course" queries
   - Improve event selection criteria/logging

8. **Clean Up Responses:**
   - Remove URLs from hardcoded responses where not needed
   - Present cleaner, more natural responses

## Code Locations for Fixes

- **Article capping:** `public/chat.html:1899` - `pickArticles()` returns `result.slice(0,6)`
- **Article retrieval:** `api/chat.js:4121` - `findArticles()` limit = 12
- **Service filtering:** `api/chat.js:3854` - `findServices()`
- **Answer generation:** `api/chat.js` - `generateEvidenceBasedAnswer()`, `generateArticleAnswer()`
- **Routing:** `api/chat.js` - `classifyQuery()`, `tryRagFirst()`

