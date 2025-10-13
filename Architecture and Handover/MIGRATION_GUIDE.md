# Migration Guide: Current System Architecture & Data Flow

## 🎯 **Current System Overview**

The Alan Ranger Photography Chat Bot uses a **hybrid data approach** combining:
- **CSV metadata** for structured content information
- **Web scraping** for dynamic content and pricing
- **Database views** for intelligent data combination

## 📊 **Current Database Schema**

### **Core Tables**
- **`csv_metadata`** - Structured metadata from CSV imports (categories, tags, dates, locations)
- **`page_entities`** - Structured data from JSON-LD extraction (products, events, articles)
- **`page_chunks`** - Text chunks with embeddings for RAG (Retrieval-Augmented Generation)
- **`light_refresh_runs`** - Logs for automated refresh system
- **`url_last_processed`** - Change detection for incremental updates

### **Key Views**
- **`v_events_for_chat`** - Combined event data with pricing and availability
- **`v_blog_content`** - Blog posts with categories and tags
- **`v_articles_unified`** - Unified article view with metadata
- **`v_product_content`** - Product catalog with pricing
- **`v_service_content`** - Service pages with course information

## 🔄 **Current Data Flow**

### **STEP 1: CSV IMPORT → csv_metadata table**
Seven CSV types are imported into the `csv_metadata` table:
- **Blog Articles (01)** → `csv_metadata.csv_type='blog'`
- **Course Events (02)** → `csv_metadata.csv_type='course_events'`
- **Workshop Events (03)** → `csv_metadata.csv_type='workshop_events'`
- **Course Products (04)** → `csv_metadata.csv_type='course_products'`
- **Workshop Products (05)** → `csv_metadata.csv_type='workshop_products'`
- **Site URLs (06)** → `csv_metadata.csv_type='site_urls'`
- **Product Schema (07)** → `csv_metadata.csv_type='product_schema'`

### **STEP 2: ENHANCED INGEST → page_entities table**
Four sub-steps in the ingestion process:
1. **Fetch HTML** for all URLs → `page_html` table
2. **Extract text and JSON-LD** from HTML content
3. **Create page_chunks** with CSV context and embeddings
4. **Enhance page_entities** with CSV metadata and structured data extraction

### **STEP 3: EXISTING VIEWS (Enhanced with CSV data)**
Four main database views filter `page_entities` by `kind` attribute:
- **`v_blog_content`** → Uses `page_entities` WHERE `kind='article'`
- **`v_service_content`** → Uses `page_entities` WHERE `kind='service'`
- **`v_product_content`** → Uses `page_entities` WHERE `kind='product'`
- **`v_events_for_chat`** → Uses `page_entities` WHERE `kind='event'`

### **STEP 4: CHAT SYSTEM (Unchanged)**
Three main functions query the enhanced `page_entities` table:
- **`findArticles()`** → Queries `v_articles_unified` view (now with CSV metadata)
- **`findProducts()`** → Queries `page_entities` table (now with CSV metadata)
- **`findEvents()`** → Queries `page_entities` table (now with CSV metadata)

**All existing chat logic works unchanged** - the enhanced data is transparent to the frontend.

## ✅ **Migration Status: COMPLETE**

### **1. Structured Data Fields - RESOLVED**
The ingestion process now extracts structured data from page content:
- ✅ **Database schema updated** - All 10 structured data fields exist in tables and views
- ✅ **Data extraction implemented** - Enhanced `lib/htmlExtractor.js` extracts structured data
- ✅ **Ingestion process enhanced** - `api/ingest.js` populates structured data fields
- ✅ **Frontend parsing eliminated** - Rich product cards now use database fields

### **2. Data Source Inconsistency**
- **Event data** comes from `v_events_for_chat` (has all structured fields but they're NULL)
- **Product data** comes from `page_entities` (has all structured fields but they're NULL)
- **Rich content** exists in `page_chunks` but isn't being parsed into structured fields

## 🔧 **Migration Strategy: Fix at Source**

### **Phase 1: Enhance Data Ingestion (Recently Completed)** ✅
**JSON-LD Prioritization Fix (October 2025):**
- **Problem**: Blog articles were getting wrong descriptions from Organization JSON-LD instead of FAQPage
- **Solution**: Added intelligent JSON-LD prioritization in `api/ingest.js`
  - Blog articles: `FAQPage` > `Article` > `WebSite` > `Organization`
  - Single entity per URL (prevents duplicates)
- **Result**: Correct descriptions now extracted from main content, not metadata

### **Phase 1b: Enhanced Data Ingestion (Ready to Implement)**
1. **Modify `api/ingest.js`** to extract structured data from page content
2. **Add parsing logic** for all 10 structured data fields:
   - `participants`, `experience_level`, `equipment_needed`, `location_address`
   - `time_schedule`, `fitness_level`, `what_to_bring`, `course_duration`
   - `instructor_info`, `availability_status`
3. **Store structured data** in appropriate database fields
4. **Re-run ingestion** to populate all fields

### **Phase 2: Database Schema (Completed)**
✅ **All fields added** to `page_entities` and `csv_metadata` tables
✅ **All views updated** to include new structured data fields
✅ **Database ready** for structured data ingestion

### **Phase 3: Update Chat Logic**
1. **Update `api/chat.js`** to use structured fields from database
2. **Remove frontend parsing** of unstructured content
3. **Use direct database fields** for product cards

## 📋 **Implementation Steps**

### **Step 1: Analyze Current Data**
```sql
-- Check what structured data exists
SELECT 
  COUNT(*) as total_events,
  COUNT(CASE WHEN participants IS NOT NULL THEN 1 END) as with_participants,
  COUNT(CASE WHEN fitness_level IS NOT NULL THEN 1 END) as with_fitness,
  COUNT(CASE WHEN experience_level IS NOT NULL THEN 1 END) as with_experience
FROM v_events_for_chat;

-- Check page content for structured data
SELECT chunk_text 
FROM page_chunks 
WHERE url LIKE '%devon%' 
LIMIT 3;
```

### **Step 2: Enhance Ingestion Process**
1. **Add parsing functions** to `api/ingest.js`:
   - Extract participants from page text
   - Extract fitness level from page text
   - Extract experience level from page text
   - Extract equipment needed from page text

2. **Update database insertion** to include structured fields

### **Step 3: Re-run Data Ingestion**
1. **Clear existing data** (if needed)
2. **Re-run ingestion** with enhanced parsing
3. **Verify structured data** is populated

### **Step 4: Update Chat System**
1. **Update `api/chat.js`** to use structured fields
2. **Remove frontend parsing** logic
3. **Test product cards** display correctly

## 🎯 **Expected Results**

After migration:
- ✅ **Structured data** extracted from page content
- ✅ **Database fields** populated with real data
- ✅ **Product cards** show rich information (participants, fitness, equipment)
- ✅ **Consistent data** across all views
- ✅ **No frontend parsing** needed

## 🔍 **Testing & Validation**

### **Test Structured Data Extraction**
```sql
-- Verify structured data is populated
SELECT 
  event_url,
  participants,
  fitness_level,
  experience_level,
  equipment_needed
FROM v_events_for_chat 
WHERE participants IS NOT NULL 
LIMIT 5;
```

### **Test Chat System**
- Test "Devon workshop" query
- Verify product cards show bullet points
- Check participants, fitness, equipment display

## 🚨 **Rollback Plan**

If issues arise:
1. **Revert ingestion changes** in `api/ingest.js`
2. **Keep current frontend parsing** as fallback
3. **Gradual migration** - fix one field at a time

## 📈 **Benefits of Source Fix**

1. **Single source of truth** - structured data in database
2. **Better performance** - no frontend parsing needed
3. **Consistent data** - same extraction logic for all content
4. **Scalable** - new content automatically gets structured data
5. **Maintainable** - centralized parsing logic

This migration approach fixes the root cause by ensuring structured data is extracted and stored during ingestion, rather than trying to parse it in the frontend every time.

---

## 📋 **HANDOVER NOTES - October 2025**

### **✅ COMPLETED MIGRATIONS**
1. **JSON-LD Prioritization** - Blog articles now prioritize FAQPage over Organization JSON-LD
2. **Structured Data Extraction** - All 10 fields extracted during ingestion
3. **Product Card Integration** - Chat API includes structured data in product objects
4. **Database View Updates** - `v_events_for_chat` includes product mappings and structured data
5. **Location Address Over-capture Fix** - Fixed regex patterns to stop at * delimiter (December 2025)
6. **Time Schedule & Duration Fixes** - Fixed "out duration in milliseconds" issues with proper regex patterns (December 2025)
7. **Product Card Styling Updates** - Updated bullet points to white while keeping labels green (December 2025)
8. **Vercel Cache Management** - Implemented force redeploy strategy for database updates (December 2025)

### **🔧 CRITICAL FILES TO KNOW**
- **`api/ingest.js`** - Main ingestion logic with JSON-LD prioritization, batch processing optimization
- **`api/chat.js`** - Chat API with product enrichment, malformed text filtering
- **`lib/htmlExtractor.js`** - Structured data extraction patterns, location/time regex fixes
- **`public/chat.html`** - Product card styling, meaningless value filtering, bullet point styling
- **`test-chat-system.js`** - Comprehensive test suite with 100 questions across 5 categories
- **`v_events_for_chat`** - Database view for events with product mappings

### **⚠️ KNOWN ISSUES**
1. **Equipment/Experience Fields** - Some products show `null` for these fields
   - **Location**: `lib/htmlExtractor.js` regex patterns
   - **Fix**: Test patterns against actual page content
2. **Data Freshness** - Some articles have old descriptions
   - **Fix**: Run full ingestion to update with new JSON-LD prioritization
3. **Vercel Caching** - API responses may be cached, requiring force redeploy to see database updates
   - **Fix**: Use `git commit --allow-empty` to force Vercel redeploy when database changes are made
4. **Equipment Advice Response Quality** - Equipment advice queries return raw scraped content instead of synthesized advice
   - **Location**: `api/chat.js` `generateDirectAnswer` function
   - **Current Issue**: Responses like "rotto 405 Pro Geared Head..." instead of natural advice framework
   - **Fix**: Implement enhanced equipment advice synthesis

### **🧪 QUICK TEST COMMANDS**
```bash
# Run comprehensive test suite (100 questions across 5 categories)
node test-chat-system.js

# Test specific course queries
node test-course-product.js
node test-lightroom-course.js

# Test live chat - Beginners course
curl -X POST "https://alan-chat-proxy.vercel.app/api/chat" \
  -H "Content-Type: application/json" \
  -d '{"query": "beginners photography course"}'

# Test live chat - Lightroom course
curl -X POST "https://alan-chat-proxy.vercel.app/api/chat" \
  -H "Content-Type: application/json" \
  -d '{"query": "when is the next lightroom course"}'

# Test database - Check structured data
SELECT url, participants, fitness_level, equipment_needed, experience_level, 
       time_schedule, course_duration, location_address
FROM page_entities WHERE kind = 'product' LIMIT 5;

# Force Vercel redeploy (if database changes not reflected)
git commit --allow-empty -m "Force Vercel redeploy to clear cache"
git push
```

### **🔧 NEXT DEVELOPMENT PRIORITIES**
1. **Improve Equipment Advice Responses** - Implement enhanced synthesis for equipment advice queries
   - **Target**: `api/chat.js` `generateDirectAnswer` function
   - **Goal**: Natural advice framework instead of raw scraped content
2. **Refine Equipment/Experience Extraction** - Debug regex patterns for missing fields
3. **Run Full Ingestion** - Update all content with new JSON-LD prioritization

### **🚨 EMERGENCY ROLLBACK**
If issues arise:
1. **Revert `api/chat.js`** - Remove structured data fields from product enrichment
2. **Revert `api/ingest.js`** - Remove JSON-LD prioritization logic
3. **Keep database schema** - Structured data fields can remain in database

### **📝 DOCUMENTATION MAINTENANCE**
**⚠️ STANDING ORDER: Update this handover section regularly!**
- **After every fix** - Document what was changed and the solution
- **After architecture changes** - Update pipeline documentation
- **When new issues arise** - Add to known issues with root cause analysis
- **Keep test commands current** - Update SQL queries and curl commands
- **Date all updates** - Use "Month YYYY" format for tracking

**Last Updated**: January 2025 (Systematic chatbot analysis - restore point before major fixes)

---

## 🚨 **CRITICAL SYSTEM ANALYSIS - January 2025**

### **Current System Status: PARTIALLY BROKEN**

The chatbot system has become **over-specialized** for events and articles while **under-specialized** for other content types, leading to systematic failures in intent detection, content routing, and confidence scoring.

### **What's Working Well** ✅
- **Events**: 595 returned, high quality responses with proper event cards
- **Articles**: 823 returned, good quality responses with proper formatting  
- **Event Queries**: 52 queries handled well
- **Advice Queries**: 120 queries (though quality varies significantly)

### **What's Broken** ❌
- **Landing Pages**: Only 2 returned (should be much higher for general queries)
- **Services**: 32 returned (likely mismatched content)
- **Products**: 75 returned (likely mismatched content)
- **Product Queries**: 0 detected (critical failure - no product-specific queries identified)
- **Intent Detection**: Systematic misclassification of query types
- **Confidence Scoring**: High confidence (90%+) for completely wrong answers
- **Content Routing**: Wrong content types returned for queries
- **Malformed Responses**: Navigation text, wrong URLs, truncated answers

### **Root Cause Analysis Required**

#### **Phase 1: Current State Documentation**
1. **Map existing logic flow** in `chat.js`:
   - Document `detectIntent` function logic
   - Map each intent path (advice, events, products)
   - Document search functions (`findArticles`, `findEvents`, `findServices`, `findLanding`)
   - Document confidence scoring logic

2. **Database content audit**:
   - Count entities by kind (article, event, product, service, landing)
   - Sample content quality for each kind
   - Identify malformed content patterns

#### **Phase 2: Intent Detection Analysis**
1. **Test intent classification** with known good/bad examples:
   - Equipment questions → should be advice
   - Workshop questions → should be events  
   - Service inquiries → should be advice
   - About questions → should be advice

2. **Identify misclassification patterns**:
   - What types of queries are being misclassified?
   - Are there keyword conflicts in the logic?

#### **Phase 3: Search Function Analysis**
1. **Test each search function independently**:
   - `findArticles` - does it return relevant articles?
   - `findEvents` - does it return relevant events?
   - `findServices` - does it return relevant services?
   - `findLanding` - does it return relevant landing pages?

2. **Cross-entity search analysis**:
   - When does it trigger?
   - What does it return?
   - Why is it returning wrong content types?

#### **Phase 4: Confidence Scoring Analysis**
1. **Test confidence calculation**:
   - Why are wrong answers getting high confidence?
   - What factors are inflating scores?
   - Where should penalties be applied?

#### **Phase 5: Content Quality Analysis**
1. **Sample malformed responses**:
   - Navigation text in answers
   - Wrong article titles
   - Missing URLs
   - Truncated responses

### **Strategic Approach: Intelligent Salvage with Safeguards**

#### **Core Principles**
1. **Preserve the Good**: Keep all event/article logic exactly as is
2. **Fix Intent Detection**: Properly identify product/service/landing queries
3. **Improve Routing**: Each intent calls the right search function
4. **Add Fallbacks**: If confidence is low, fall back to "I don't have specific information"

#### **Success Criteria**
- **Preserve**: Event and article responses remain high quality
- **Fix**: Intent detection accuracy >90%
- **Fix**: Search function relevance >80%
- **Fix**: Confidence scoring reflects actual relevance
- **Fix**: Malformed content eliminated

#### **Risk Mitigation**
1. **Backup current `chat.js`** before any changes ✅ (Restore point created)
2. **Create isolated test environment** 
3. **Test each fix in isolation** before integration
4. **Rollback plan** if anything breaks

### **Investigation Tools Needed**
1. **Isolated test functions** for each component
2. **Query classification test suite** 
3. **Search function test suite**
4. **Confidence scoring test suite**
5. **Content quality audit tools**

### **Emergency Status**
- **System**: Partially functional (events/articles work, everything else broken)
- **User Impact**: High (wrong answers damage trust)
- **Priority**: Critical (systematic failure across multiple components)
- **Timeline**: Systematic analysis required before any fixes