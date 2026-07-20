# Price Variants Analysis

## 🔍 **DISCOVERY: Price Variants Found!**

The system has **price variants** for the same products, with different sources and timestamps:

### **📊 Bluebell Photography Workshops**
- **URL**: `https://www.alanranger.com/photo-workshops-uk/bluebell-woodlands-photography-workshops`
- **Variant 1**: £99 (from "card" source, 2025-10-11)
- **Variant 2**: £125 (from "price_view" source, 2025-10-19) ← **Currently Used**
- **Status**: System uses the **higher price (£125)** - the more recent one

### **📊 Fairy Glen Photography Workshop**
- **URL**: `https://www.alanranger.com/photo-workshops-uk/long-exposure-photography-workshop-fairy-glen`
- **Variant 1**: £125 (from "card" source, 2025-10-11)
- **Variant 2**: £125 (from "price_view" source, 2025-10-19) ← **Currently Used**
- **Status**: Same price (£125) from both sources - **No conflict**

### **📊 Snowdonia Photography Workshop**
- **URL**: `https://www.alanranger.com/photo-workshops-uk/landscape-photography-snowdonia-workshops`
- **Variant 1**: £595 (from "card" source, 2025-10-11)
- **Variant 2**: £595 (from "price_view" source, 2025-10-19) ← **Currently Used**
- **Status**: Same price (£595) from both sources - **No conflict**

## 🎯 **Key Findings**

### **1. Price Source Types**
- **"card" source**: Older data (2025-10-11)
- **"price_view" source**: Newer data (2025-10-19)

### **2. URL Format Differences**
- **Short URLs**: `bluebell-woodlands-photography-workshops` (card source)
- **Full URLs**: `https://www.alanranger.com/photo-workshops-uk/bluebell-woodlands-photography-workshops` (price_view source)

### **3. Current System Behavior**
- The system uses the **most recent price** (price_view source)
- For Bluebell: Uses £125 instead of £99
- This explains why some events show higher prices than expected

## 🤔 **Questions for Review**

1. **Should the system use the LOWER price (£99) for Bluebell workshops?**
2. **Are the "card" prices the correct/sale prices?**
3. **Are the "price_view" prices the regular/full prices?**
4. **Should we implement a "use lowest price" logic?**

## 📋 **Recommendations**

### **Option 1: Use Lowest Price**
- Modify the system to always use the lowest available price
- Bluebell would show £99 instead of £125

### **Option 2: Use Most Recent Price (Current)**
- Keep current behavior (most recent price)
- Bluebell continues to show £125

### **Option 3: Use Specific Source Priority**
- Prioritize "card" source over "price_view" source
- Bluebell would show £99 (card source)

### **Option 4: Manual Price Override**
- Manually set the correct prices for specific products
- Most control but requires maintenance

## 🔧 **Technical Implementation**

The price selection happens in the `v_products_unified` view, which joins with `product_display_price` table. The current logic uses the most recent price, but this could be modified to use the lowest price instead.

---

**Next Steps**: Please review the Bluebell pricing situation and decide which approach to take for handling price variants.




## Update Log
- 2026-01-16 19:59: Updated with latest ingest image fallback (prefer content over logo), bulk ingest UI watchdog timeout, search tile description expansion and image fallback/proxy, and restore point restore-20260116-1948.
