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

### **1. Data Ingestion Pipeline**
```
CSV Files → csv_metadata → Enhanced with web scraping → page_entities
     ↓              ↓              ↓              ↓
Website URLs → HTML Extraction → JSON-LD Parsing → Structured Data
     ↓              ↓              ↓              ↓
Content Pages → Text Chunking → Embeddings → page_chunks
```

### **2. Chat Query Processing**
```
User Query → Intent Detection → Data Retrieval → Response Generation
     ↓              ↓              ↓              ↓
  Chat API → Topic Analysis → Supabase Views → Markdown Response
```

## 🚨 **Current Issues to Address**

### **1. Missing Structured Data Fields**
The ingestion process is not extracting structured data from page content:
- ✅ **Database schema updated** - All 10 structured data fields now exist in tables and views
- ❌ **Data extraction needed** - Fields exist but are NULL (need ingestion process enhancement)
- ❌ **Frontend parsing** - Still relying on frontend parsing instead of database fields

### **2. Data Source Inconsistency**
- **Event data** comes from `v_events_for_chat` (has all structured fields but they're NULL)
- **Product data** comes from `page_entities` (has all structured fields but they're NULL)
- **Rich content** exists in `page_chunks` but isn't being parsed into structured fields

## 🔧 **Migration Strategy: Fix at Source**

### **Phase 1: Enhance Data Ingestion (Ready to Implement)**
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