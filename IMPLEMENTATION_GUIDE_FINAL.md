# Combined CSV + Scraper Implementation Guide

## 🎯 **Complete Solution Overview**

This implementation combines:
- **CSV data** for accurate event information (dates, times, locations)
- **Scraped data** for product information (prices, availability, product URLs)
- **Intelligent mapping** between events and products

## 📁 **Files Created/Updated**

### **New API Endpoint:**
- `api/csv-events-import.js` - Handles CSV event data import

### **Updated Files:**
- `bulk.html` - Added CSV import functionality
- `api/bulk-upload.js` - Already supports CSV processing

### **SQL Scripts:**
- `COMBINED_CSV_SCRAPER_FINAL.sql` - Complete database implementation

## 🚀 **Implementation Steps**

### **Step 1: Deploy the New API Endpoint**
1. Copy `api/csv-events-import.js` to your API directory
2. Ensure environment variables are set:
   - `INGEST_TOKEN`
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`

### **Step 2: Update the Bulk Upload Interface**
1. Replace `bulk.html` with the updated version
2. The new interface includes:
   - CSV file upload for events
   - Import type selection (events/products)
   - Import result display

### **Step 3: Run the Database Script**
1. Execute `COMBINED_CSV_SCRAPER_FINAL.sql` in your Supabase database
2. This creates the necessary views for the combined approach

### **Step 4: Import CSV Data**
1. Open `bulk.html` in your browser
2. Select your CSV files (events)
3. Choose "Events" as the import type
4. Click "Import CSV Data"
5. Verify the import was successful

### **Step 5: Update Chatbot Configuration**
1. Update `api/chat.js` to use `v_event_product_pricing_combined`
2. This view provides complete event-product data

## 📊 **Expected Results**

After implementation, you should have:

- ✅ **~128 unique events** (from CSV files)
- ✅ **Real dates, times, locations** (from CSV)
- ✅ **Real prices, availability** (from scraped data)
- ✅ **No duplicates** (clean CSV data)
- ✅ **Complete information** (both sources combined)

## 🔧 **CSV Format Requirements**

### **Event CSV Format:**
```csv
event_url,start_date,start_time,end_date,end_time,location,title
https://www.alanranger.com/beginners-photography-lessons/camera-courses-for-beginners-coventry-oct1,2025-10-02,19:00,2025-10-02,21:00,Coventry West Midlands,Camera Courses for Beginners Coventry Oct1
```

### **Required Columns:**
- `event_url` - The event page URL
- `start_date` - Event start date (YYYY-MM-DD)
- `start_time` - Event start time (HH:MM)
- `end_date` - Event end date (YYYY-MM-DD)
- `end_time` - Event end time (HH:MM)
- `location` - Event location
- `title` - Event title

## 🎯 **How It Works**

### **1. CSV Import Process:**
1. User uploads CSV file via `bulk.html`
2. File is sent to `/api/csv-events-import`
3. CSV data is parsed and transformed into JSON-LD format
4. Data is inserted into `page_entities` table
5. Events are marked as CSV source

### **2. Data Combination:**
1. `v_events_csv_source` - Gets event data from CSV imports
2. `v_products_scraped` - Gets product data from web scraping
3. `v_event_product_mappings` - Maps events to products intelligently
4. `v_event_product_pricing_combined` - Final view with all data

### **3. Intelligent Mapping:**
- **Courses** → Photography service pages
- **Workshops** → Workshop product pages
- **Location-based** → Specific workshop products
- **Fallback** → Default products for each type

## 🔍 **Testing the Implementation**

### **1. Test CSV Import:**
```bash
# Test the import endpoint
curl -X POST http://localhost:3000/api/csv-events-import \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"csvData": "event_url,start_date,start_time\nhttps://example.com,2025-10-02,19:00", "csvType": "events"}'
```

### **2. Test Database Views:**
```sql
-- Check CSV events
SELECT COUNT(*) FROM v_events_csv_source;

-- Check product data
SELECT COUNT(*) FROM v_products_scraped;

-- Check combined data
SELECT COUNT(*) FROM v_event_product_pricing_combined;
```

### **3. Test Chatbot Integration:**
- Update `api/chat.js` to use `v_event_product_pricing_combined`
- Test event queries to ensure data is complete

## 🚨 **Troubleshooting**

### **Common Issues:**

1. **CSV Import Fails:**
   - Check CSV format matches requirements
   - Verify required columns are present
   - Check authentication token

2. **Missing Product Data:**
   - Ensure web scraping is running
   - Check product URLs are correct
   - Verify product data in `page_entities`

3. **Mapping Issues:**
   - Check URL patterns in mapping logic
   - Verify event subtypes are correct
   - Test individual mappings

### **Debug Queries:**
```sql
-- Check imported events
SELECT * FROM page_entities WHERE kind = 'event' AND raw->>'provider' = 'Alan Ranger Photography';

-- Check product data
SELECT * FROM page_entities WHERE kind = 'product' AND price IS NOT NULL;

-- Check mappings
SELECT * FROM v_event_product_pricing_combined LIMIT 10;
```

## 📈 **Benefits of This Approach**

1. **Best of Both Worlds:** Accurate event data + real product data
2. **No Duplicates:** Clean CSV data as source of truth
3. **Real Prices:** Scraped product information
4. **Scalable:** Easy to update CSV data
5. **Reliable:** No dependency on complex deduplication logic
6. **Complete:** All information available in one view

## 🔄 **Maintenance**

### **Regular Updates:**
1. **CSV Data:** Update event CSV files as needed
2. **Web Scraping:** Keep running for product data
3. **Database:** Monitor view performance
4. **Chatbot:** Test queries regularly

### **Monitoring:**
- Check event counts match expectations
- Verify product data is up-to-date
- Test chatbot responses for accuracy
- Monitor database performance

This implementation provides a robust, scalable solution that combines the accuracy of CSV data with the completeness of scraped product information!


