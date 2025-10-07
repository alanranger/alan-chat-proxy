# Scraper Configuration Strategy

## 🎯 **Problem Identified**

The scraper is reading **the same JSON-LD schema repeated on multiple pages**, creating duplicates. The issue is that events are listed on multiple calendar pages, each containing the same JSON-LD data.

## ✅ **Solution: Focus on Primary Source Pages**

Instead of scraping all pages, focus the scraper on these **4 primary source pages**:

### **Primary Source Pages:**

1. **`https://www.alanranger.com/photography-services-near-me`**
   - **Purpose**: Service and course products
   - **Contains**: Product JSON-LD with prices, availability
   - **Expected**: ~48 course products

2. **`https://www.alanranger.com/beginners-photography-lessons/`**
   - **Purpose**: Course events
   - **Contains**: Event JSON-LD with dates, times, locations
   - **Expected**: ~48 course events

3. **`https://www.alanranger.com/photographic-workshops-near-me`**
   - **Purpose**: Workshop events
   - **Contains**: Event JSON-LD with dates, times, locations
   - **Expected**: ~80 workshop events

4. **`https://www.alanranger.com/photo-workshops-uk`**
   - **Purpose**: Workshop products
   - **Contains**: Product JSON-LD with prices, availability
   - **Expected**: ~80 workshop products

## 🔧 **Implementation Strategy**

### **Option 1: Update Scraper Configuration**
- Modify the scraper to **only process these 4 primary pages**
- **Skip all other pages** that contain duplicate JSON-LD
- **Re-run the scraper** to get clean data

### **Option 2: Filter Existing Data**
- Use the `FOCUSED_SCRAPER_APPROACH.sql` to filter existing data
- **Only include events from primary source pages**
- **Eliminate duplicates** from calendar pages

### **Option 3: Hybrid Approach**
- **Keep the current scraper** for all content (articles, services, etc.)
- **Add a filter** to only use events from primary source pages
- **Use the focused approach** for event data only

## 📊 **Expected Results**

With the focused approach, you should get:
- ✅ **~48 course events** (from beginners-photography-lessons)
- ✅ **~80 workshop events** (from photographic-workshops-near-me)
- ✅ **~48 course products** (from photography-services-near-me)
- ✅ **~80 workshop products** (from photo-workshops-uk)
- ✅ **No duplicates** - each event appears only once
- ✅ **Real data** from JSON-LD (locations, times, prices)

## 🚀 **Next Steps**

1. **Test the focused approach** with `FOCUSED_SCRAPER_APPROACH.sql`
2. **Verify the event counts** match your CSV files
3. **Update the chatbot** to use the focused views
4. **Consider updating the scraper** to focus on primary pages

This approach will give you **clean, accurate data** without duplicates while preserving all the real information from your website's JSON-LD.



