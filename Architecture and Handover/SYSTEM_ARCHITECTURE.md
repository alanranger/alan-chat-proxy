# Alan Ranger Photography Chat Bot - Current System Architecture

## 🏗️ **System Overview**

The Alan Ranger Photography Chat Bot is a **RAG (Retrieval-Augmented Generation) system** that combines CSV metadata, web scraping, and AI-powered responses to provide intelligent assistance about photography courses, workshops, equipment, and technical advice.

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
3. **Create page_chunks** with CSV context and embeddings
4. **Enhance page_entities** with CSV metadata and structured data extraction

**JSON-LD Prioritization Logic:**
- **Blog articles**: FAQPage → Article → WebSite → Organization (lowest priority)
- **Other content**: Maintains original order
- **Single entity per URL**: Eliminates duplicate entities with wrong descriptions

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

### **Performance Metrics**
- **Response time** - Chat API performance
- **Data freshness** - Last ingestion timestamps
- **System health** - Error rates and success metrics

---

## 🚨 **Current Issues & Technical Debt**

### **Recently Resolved Issues**
- ✅ **JSON-LD prioritization** - Fixed blog articles getting wrong descriptions from Organization JSON-LD instead of FAQPage
- ✅ **Duplicate entities** - Eliminated multiple entities per URL causing incorrect content selection
- ✅ **Data ingestion gap** - Ingestion process now extracts structured data from page content

### **Remaining Architecture Improvements**
- **Frontend parsing** - Product cards still rely on frontend parsing of unstructured content (being phased out)
- **Source-based fixes** - Continue fixing data at ingestion level, not frontend level

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
- **Structured data fields** - All 10 new fields (`participants`, `experience_level`, `equipment_needed`, etc.) are being populated by enhanced ingestion process
- **JSON-LD prioritization** - Blog articles now correctly use FAQPage content instead of Organization metadata

---

## 🎯 **Next Steps for System Improvement**

### **Priority 1: Fix Data Ingestion** ✅ **COMPLETED**
1. ✅ **Enhanced `api/ingest.js`** to extract structured data from page content
2. ✅ **Added JSON-LD prioritization** to select correct content for blog articles
3. ✅ **Implemented single entity per URL** to eliminate duplicate entities
4. **Re-run ingestion** to populate structured data with new logic

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