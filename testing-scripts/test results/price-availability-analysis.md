# Price and Availability Analysis

## 🎯 **CONFIRMED: £99 is the Current Sale Price**

You're absolutely right! The **£99 from "card" source is the current sale price** and should be shown instead of £125.

## 📊 **Current Price Situation**

### **Bluebell Photography Workshops**
- **Sale Price (card)**: £99 ← **Should be used**
- **Regular Price (price_view)**: £125 ← Currently being used (incorrect)
- **Availability**: InStock (both variants)

### **Availability Information**
- **Status**: InStock
- **Schema**: `http://schema.org/InStock`
- **Shipping**: Does not ship (local workshops)
- **Return Policy**: 28-day full refund

## 🔧 **The Fix Needed**

The system needs to be modified to **prioritize lowest price over source preference** for the price resolution algorithm.

### **Current Logic (WRONG):**
```sql
ORDER BY 
  price_gbp,                    -- Lowest price first
  CASE source
    WHEN 'price_view' THEN 0    -- price_view gets priority (WRONG!)
    ELSE 1                      -- card gets lower priority
  END
```

### **Fixed Logic (CORRECT):**
```sql
ORDER BY 
  price_gbp,                    -- Lowest price first (this should be the primary criteria)
  product_title                 -- Tiebreaker only
```

## 📋 **Availability Per Variant**

**Current System Behavior:**
- Only shows **one availability status** per product (InStock)
- **No variant-specific availability** (e.g., "5 places left", "Sold out")
- **No capacity information** per price variant

**What's Available:**
- ✅ **Basic availability**: InStock/OutOfStock
- ❌ **Capacity numbers**: Not tracked per variant
- ❌ **Places available**: Not tracked per variant
- ❌ **Variant-specific stock**: Not implemented

## 🎯 **Recommendations**

### **1. Fix Price Priority (URGENT)**
- Modify `v_price_resolved` to prioritize lowest price
- Bluebell workshops will show £99 (sale price) instead of £125

### **2. Enhanced Availability (FUTURE)**
- Track capacity per event/workshop
- Show "X places left" instead of just "InStock"
- Implement variant-specific availability

### **3. Sale Price Indicators (FUTURE)**
- Add sale price indicators in the UI
- Show "Was £125, Now £99" format
- Track sale vs regular pricing

## 🔧 **Technical Implementation**

The fix requires modifying the `v_price_resolved` view to remove the source preference and rely purely on lowest price:

```sql
-- Remove this part:
CASE source
  WHEN 'price_view' THEN 0
  ELSE 1
END
```

This will ensure sale prices (£99) are always shown over regular prices (£125).

---

**Next Step**: Should I implement the price priority fix to show £99 for Bluebell workshops?




## Update Log
- 2026-01-16 19:59: Updated with latest ingest image fallback (prefer content over logo), bulk ingest UI watchdog timeout, search tile description expansion and image fallback/proxy, and restore point restore-20260116-1948.
