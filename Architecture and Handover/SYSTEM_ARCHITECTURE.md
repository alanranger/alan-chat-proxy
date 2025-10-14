# Alan Ranger Photography Chat Bot - Current System Architecture

**Date:** October 14, 2025  
**Status:** Updated with complete interactive testing results  
**Latest Analysis:** Complete 20-question interactive testing dataset analysis completed  

## 🏗️ **System Overview**

The Alan Ranger Photography Chat Bot is a **RAG (Retrieval-Augmented Generation) system** that combines CSV metadata, web scraping, and AI-powered responses to provide intelligent assistance about photography courses, workshops, equipment, and technical advice.

**Latest Analysis:** Complete interactive testing with business owner specifications shows 100% accuracy in target behavior vs current system performance gaps requiring implementation of interactive clarification system.

---

## 📊 **Current Data Flow Architecture**

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
2. **Extract text and JSON-LD** from HTML content with **intelligent prioritization**
   - **Blog articles**: Prioritize `FAQPage` > `Article` > `WebSite` > `Organization` JSON-LD
   - **Other content**: Use first valid JSON-LD object
   - **Single entity per URL**: Prevents duplicate entities with wrong descriptions
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

---

## 🗄️ **Current Database Schema (Supabase)**

### **Core Tables**
- **`csv_metadata`** - Structured metadata from all 7 CSV imports
  - **Fields**: `id`, `csv_type`, `url`, `title`, `categories`, `tags`, `publish_date`, `start_date`, `end_date`, `start_time`, `end_time`, `location_name`, `location_address`, `excerpt`, `image_url`, `json_ld_data`, `workflow_state`
  - **New Structured Data Fields**: `participants`, `experience_level`, `equipment_needed`, `time_schedule`, `fitness_level`, `what_to_bring`, `course_duration`, `instructor_info`, `availability_status`
- **`page_entities`** - Enhanced structured data from JSON-LD extraction + CSV metadata
  - **Fields**: `id`, `url`, `kind`, `title`, `description`, `date_start`, `date_end`, `location`, `price`, `price_currency`, `availability`, `sku`, `provider`, `source_url`, `raw`, `entity_hash`, `last_seen`, `page_url`, `norm_title`, `start_date`, `csv_type`, `csv_metadata_id`, `categories`, `tags`, `publish_date`, `location_name`, `location_address`, `excerpt`, `end_date`, `start_time`, `end_time`, `location_city_state_zip`, `image_url`, `json_ld_data`, `workflow_state`
  - **New Structured Data Fields**: `participants`, `experience_level`, `equipment_needed`, `time_schedule`, `fitness_level`, `what_to_bring`, `course_duration`, `instructor_info`, `availability_status`
- **`page_chunks`** - Text chunks with embeddings for RAG
  - **Fields**: `id`, `url`, `title`, `chunk_text`, `embedding`, `chunk_hash`, `created_at`, `content`, `hash`, `tokens`, `csv_type`, `csv_metadata_id`
- **`page_html`** - Raw HTML content for structured data extraction
  - **Fields**: `id`, `url`, `html_content`, `content_hash`, `created_at`, `updated_at`
- **`light_refresh_runs`** - Logs for automated refresh system
- **`url_last_processed`** - Change detection for incremental updates

### **Key Views**
- **`v_events_for_chat`** - Main events view for chat system
  - **Source**: `page_entities` WHERE `kind='event'`
  - **Fields**: `event_url`, `subtype`, `product_url`, `product_title`, `price_gbp`, `availability`, `date_start`, `date_end`, `start_time`, `end_time`, `event_location`, `map_method`, `confidence`, `participants`, `fitness_level`, `event_title`, `json_price`, `json_availability`, `price_currency`
  - **New Structured Data Fields**: `experience_level`, `equipment_needed`, `location_address`, `time_schedule`, `what_to_bring`, `course_duration`, `instructor_info`, `availability_status`
- **`v_articles_unified`** - Main articles view for chat system
  - **Source**: `page_entities` WHERE `kind='article'`
  - **Fields**: `id`, `title`, `page_url`, `categories`, `tags`, `image_url`, `publish_date`, `description`, `json_ld_data`, `last_seen`, `kind`, `source_type`
- **`v_blog_content`** - Blog posts with categories and tags
  - **Source**: `page_entities` WHERE `kind='article'`
  - **Fields**: `url`, `title`, `headline`, `publish_date`, `keywords`, `article_section`, `image_url`, `author`, `publisher`, `content_type`, `tags`, `categories`
- **`v_product_content`** - Product catalog with pricing
  - **Source**: `page_entities` WHERE `kind='product'`
  - Fields: `url`, `title`, `description`, `sku`, `price`, `price_currency`, `availability`, `tags`, `categories`, `image_urls`, `brand`, `content_type`, `price_tier`
  - **New Structured Data Fields**: `participants`, `experience_level`, `equipment_needed`, `location_address`, `time_schedule`, `fitness_level`, `what_to_bring`, `course_duration`, `instructor_info`, `availability_status`
- **`v_service_content`** - Service pages with course information
  - Fields: `url`, `title`, `location`, `service_type`, `tags`, `categories`, `image_url`, `provider`, `content_type`, `service_category`
  - **New Structured Data Fields**: `participants`, `experience_level`, `equipment_needed`, `location_address`, `time_schedule`, `fitness_level`, `what_to_bring`, `course_duration`, `instructor_info`, `availability_status`

---

## 🔧 **Current API Endpoints**

### **Core APIs**
- **`/api/chat`** - Main chat interface (RAG + response generation)
- **`/api/ingest`** - Web scraping and data ingestion
- **`/api/csv-import`** - CSV metadata import
- **`/api/tools`** - Utility functions (mapping, finalization)
- **`/api/light-refresh`** - Automated hourly refresh system

### **Data Management**
- **`/api/feedback`** - User feedback collection
- **`/api/analytics`** - Usage analytics and metrics

---

## 🎯 **Current Intent Detection & Routing**

### **Query Classification**
```
User Query → Intent Detection → Data Source → Response Type
     ↓              ↓              ↓              ↓
  "ISO question" → technical → articles → Direct Answer
  "Camera course" → events → products+events → Product Card + Event Tiles
  "Workshop dates" → events → events → Event Listings
  "Equipment advice" → equipment → articles+products → Recommendations
```

### **Intent Types**
- **`events`** - Course/workshop queries → Product cards + event tiles
- **`equipment`** - Equipment questions → Technical advice + recommendations
- **`technical`** - Technical questions → Direct answers from articles
- **`general`** - General questions → Mixed content types

---

## 🎨 **Current Frontend Components**

### **Chat Interface (`public/chat.html`)**
- **Real-time chat** with typing indicators
- **Markdown rendering** for rich text responses
- **Product cards** with pricing and details
- **Event tiles** with dates and locations
- **Debug panel** for development
- **Rich content extraction** from page text (participants, fitness, equipment)

### **Admin Interface (`public/bulk-simple.html`)**
- **CSV upload** for data management
- **Web scraping** controls
- **Mapping tools** for data relationships
- **Light refresh** monitoring
- **System architecture** diagram

---

## 🔄 **Current Automated Systems**

### **Light Refresh System**
```
Hourly Trigger → URL Change Detection → Selective Ingestion → Data Update
     ↓              ↓              ↓              ↓
  GitHub Actions → HEAD Requests → Changed URLs → Supabase Update
```

### **Data Pipeline**
```
CSV Upload → Bulk Processing → Entity Mapping → View Refresh → Chat Ready
     ↓              ↓              ↓              ↓              ↓
  File Upload → URL Processing → Data Enhancement → Finalization → Live System
```

---

## 🧠 **Current RAG (Retrieval-Augmented Generation) System**

### **Content Retrieval**
1. **Query Analysis** - Extract keywords and intent
2. **Vector Search** - Find relevant chunks using embeddings
3. **Context Building** - Combine multiple sources
4. **Response Generation** - Create structured markdown

### **Data Sources**
- **Articles** - Blog posts for technical questions (`v_blog_content`, `v_articles_unified`)
- **Products** - Course/workshop information (`v_product_content`)
- **Events** - Scheduled dates and locations (`v_events_for_chat`)
- **Services** - Service descriptions and details (`v_service_content`)

---

## 🎛️ **Current Configuration & Environment**

### **Environment Variables**
- **`SUPABASE_URL`** - Database connection
- **`SUPABASE_SERVICE_ROLE_KEY`** - Database access
- **`INGEST_TOKEN`** - API authentication
- **`VERCEL_AUTOMATION_BYPASS_SECRET`** - Deployment protection

### **External Services**
- **Supabase** - Database and authentication
- **Vercel** - Hosting and serverless functions
- **GitHub Actions** - Automated workflows
- **OpenAI** - Embeddings and AI processing

---

## 🔍 **Current Debugging & Monitoring**

### **Debug Tools**
- **Chat debug panel** - Real-time query analysis
- **API logging** - Request/response tracking
- **Database queries** - Direct data inspection
- **Light refresh logs** - Automated system monitoring
- **Comprehensive test suite** - `test-chat-system.js` with 100 questions across 5 categories:
  - **Technical Photography Concepts** (20 questions) - "what is iso", "what is aperture", etc.
  - **Equipment Recommendations** (20 questions) - "what tripod do you recommend", etc.
  - **Courses & Products** (20 questions) - "beginners photography course", "lightroom course", etc.
  - **Workshops & Events** (20 questions) - "bluebell workshop", "devon workshop", etc.
  - **Specific Locations & Dates** (20 questions) - "workshop in coventry", "workshop in peak district", etc.

### **Performance Metrics**
- **Response time** - Chat API performance
- **Data freshness** - Last ingestion timestamps
- **System health** - Error rates and success metrics

---

## 🚨 **Current Issues & Technical Debt**

### **Recently Fixed Issues** ✅
- **JSON-LD prioritization** - Fixed blog articles getting wrong descriptions from Organization JSON-LD instead of FAQPage
- **Duplicate entities** - Fixed ingestion creating multiple entities per URL with conflicting descriptions
- **Structured data extraction** - Enhanced regex patterns for 10 structured data fields (participants, experience_level, equipment_needed, etc.)
- **Product card bullet points** - Fixed chat API to include all structured data fields in product objects (October 2025)
- **HTML-based description generation** - Fixed blog articles to generate descriptions from actual HTML content instead of AI-generated JSON-LD (October 2025)
- **Location address over-capture** - Fixed regex patterns to stop at * delimiter instead of capturing Participants/Time text (December 2025)
- **Time schedule and duration fixes** - Fixed "out duration in milliseconds" and "in milliseconds" issues with proper regex patterns (December 2025)
- **Product card styling** - Updated bullet points to white while keeping labels green for better visual hierarchy (December 2025)

### **Remaining Issues**
- **Data freshness** - Some articles may still have old incorrect descriptions until next ingestion
- **Equipment/Experience extraction** - Some products still show `null` for `equipment_needed` and `experience_level` (extraction patterns may need refinement)

### **Architecture Improvements Completed** ✅
- **Enhanced data ingestion** - Extract structured data during scraping (database schema ready)
- **Source-based fixes** - Fixed data at ingestion level, not frontend level
- **JSON-LD prioritization** - Intelligent selection of best JSON-LD object per URL

---

## 📈 **Current System Performance**

### **Current Metrics**
- **857 URLs** in current import session
- **187 blog articles** imported
- **48 course events** imported
- **79 workshop events** imported
- **32 workshop products** imported
- **425 site URLs** imported
- **60 product schema** records imported

### **Data Quality Issues**
- **Structured data fields** - All 10 new fields (`participants`, `experience_level`, `equipment_needed`, etc.) are NULL - ready for ingestion process enhancement

---

## 🎯 **Next Steps for System Improvement**

### **Priority 1: Fix Data Ingestion**
1. **Enhance `api/ingest.js`** to extract structured data from page content
2. **Add parsing logic** for all 10 new structured data fields
3. **Re-run ingestion** to populate structured data

### **Priority 2: Test and Validate**
1. **Test structured data extraction** with sample pages
2. **Verify data consistency** across all views
3. **Update frontend** to use structured database fields instead of parsing

### **Priority 3: Optimize Chat System**
1. **Update `api/chat.js`** to use structured database fields
2. **Remove frontend parsing** of unstructured content
3. **Improve product card** display with rich structured data

---

*This architecture document reflects the current state of the system as of the latest analysis. The main focus should be on fixing data ingestion to extract structured data at the source rather than parsing it in the frontend.*

---

## 📋 **HANDOVER NOTES - October 2025**

### **🎯 What Was Accomplished**
1. **Fixed JSON-LD Prioritization** - Blog articles now get correct descriptions from FAQPage instead of Organization JSON-LD
2. **Implemented Structured Data Extraction** - All 10 fields now extracted during ingestion (participants, fitness_level, location_address, equipment_needed, experience_level, etc.)
3. **Fixed Product Card Display** - Chat API now includes all structured data fields in product objects
4. **Updated Database Views** - `v_events_for_chat` now properly maps events to products with structured data

### **🔧 Key Files Modified**
- **`api/ingest.js`** - JSON-LD prioritization logic, single entity per URL, batch processing optimization
- **`api/chat.js`** - Product enrichment to include structured data fields, malformed text filtering
- **`lib/htmlExtractor.js`** - Enhanced regex patterns for structured data extraction, location/time regex fixes
- **`public/chat.html`** - Product card styling updates, meaningless value filtering, bullet point styling
- **`test-chat-system.js`** - Comprehensive test suite with 100 questions across 5 categories
- **`v_events_for_chat`** - Database view updated to include product mappings and structured data

### **⚠️ Known Issues for Future Development**
1. **Equipment/Experience Extraction** - Some products still show `null` for `equipment_needed` and `experience_level`
   - **Root Cause**: Regex patterns may need refinement for specific content formats
   - **Solution**: Test extraction patterns against actual page content and adjust regex
2. **Data Freshness** - Some articles may have old incorrect descriptions until next ingestion
   - **Solution**: Run full ingestion to update all content with new JSON-LD prioritization
3. **Vercel Caching** - API responses may be cached, requiring force redeploy to see database updates
   - **Solution**: Use `git commit --allow-empty` to force Vercel redeploy when database changes are made
4. **Equipment Advice Response Quality** - Equipment advice queries return raw scraped content instead of synthesized advice
   - **Root Cause**: `generateDirectAnswer` function not properly synthesizing content from multiple articles
   - **Current Issue**: Responses like "rotto 405 Pro Geared Head..." instead of natural advice framework
   - **Solution**: Implement enhanced equipment advice synthesis in `api/chat.js`

### **🔧 Equipment Advice Improvement Plan**

#### **Current Problem**
Equipment advice queries (e.g., "what tripod do you recommend") return:
- ❌ Raw scraped content: "rotto 405 Pro Geared Head - Gitzo GT3532LS Legs..."
- ❌ Missing natural advice framework
- ❌ No synthesis of insights from multiple articles

#### **Target Solution**
Generate responses that:
- ✅ Start with advice framework: "Choosing the right [equipment] depends on several factors..."
- ✅ Synthesize key considerations from multiple articles (budget, weight, usage, terrain)
- ✅ Provide specific recommendations as supporting details
- ✅ Reference related articles for detailed information

#### **Implementation Strategy**
1. **Equipment Query Detection** - Identify equipment advice queries in `generateDirectAnswer`
2. **Content Synthesis** - Combine insights from multiple articles into coherent advice
3. **Response Structure** - Framework → Considerations → Recommendations → References
4. **Testing** - Validate with various equipment queries

#### **Expected Outcome**
**Instead of:** "rotto 405 Pro Geared Head - Gitzo GT3532LS Legs..."
**We get:** "Choosing the right tripod depends on several factors: your usage terrain, budget, weight requirements, and height needs. For landscape photography, you'll want something sturdy but portable. For travel, weight becomes crucial. Based on my experience, I recommend considering the Manfrotto 405 Pro Geared Head with Gitzo GT3532LS legs for serious landscape work, though the weight can be a consideration for longer hikes. For more detailed comparisons and specific recommendations, check out my articles on lightweight tripods and the Benro vs Gitzo vs Manfrotto comparison."

### **🧪 Testing Commands**
```sql
-- Test structured data extraction
SELECT url, participants, fitness_level, equipment_needed, experience_level 
FROM page_entities 
WHERE kind = 'product' 
  AND (participants IS NOT NULL OR fitness_level IS NOT NULL)
LIMIT 10;

-- Test product card data
SELECT url, title, participants, fitness_level, location_address, equipment_needed, experience_level
FROM page_entities 
WHERE url = 'https://www.alanranger.com/photo-workshops-uk/secrets-of-woodland-photography-workshop';
```

```bash
# Run comprehensive test suite (100 questions across 5 categories)
node test-chat-system.js

# Test specific course queries
node test-course-product.js
node test-lightroom-course.js
```

### **🚀 Next Steps for New Developer**
1. **Test live chat** - Verify all 5 bullet points display correctly in product cards
2. **Refine extraction patterns** - If `equipment_needed`/`experience_level` still show `null`, debug regex patterns
3. **Run full ingestion** - Update all content with new JSON-LD prioritization
4. **Improve equipment advice responses** - Implement enhanced synthesis for equipment advice queries
4. **Monitor performance** - Check if structured data extraction impacts ingestion speed

### **📞 Emergency Contacts**
- **Database**: Supabase project with all tables and views
- **Deployment**: Vercel with automatic deployments from GitHub
- **Documentation**: This file and `MIGRATION_GUIDE.md` contain full system details

### **📝 DOCUMENTATION MAINTENANCE**
**⚠️ IMPORTANT: Keep this handover section updated!**
- **Update after every major fix** - Document what was changed and why
- **Update after architecture changes** - Note any pipeline modifications
- **Update known issues** - Add new problems, mark resolved ones as ✅
- **Update testing commands** - Keep SQL queries and test commands current
- **Date all updates** - Use format "Month YYYY" for tracking changes

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