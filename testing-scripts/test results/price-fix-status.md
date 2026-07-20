# Price Fix Status Report

## ✅ **COMPLETED: Price Priority Algorithm Fixed**

### **What We Fixed:**
1. **Modified `v_price_resolved` view** to prioritize lowest price over source preference
2. **Updated `product_display_price` table** with correct sale prices for key products
3. **Fixed price resolution logic** to show sale prices instead of regular prices

### **Products Successfully Updated:**
- **Bluebell**: £99 (was £125) ✅
- **Batsford**: £99 (was £125) ✅  
- **Peak District**: £150 (was £175) ✅
- **Lake District**: £975 (was £1050) ✅
- **Anglesey**: £795 (was £875) ✅
- **Glencoe**: £825 (was £875) ✅
- **Norfolk**: £975 (was £1025) ✅
- **North Yorkshire**: £1450 (was £1495) ✅
- **Wales**: £525 (was £595) ✅
- **Yorkshire Dales**: £825 (was £875) ✅
- **Intermediates Intentions**: £400 (was £495) ✅
- **Four Private Classes**: £360 (was £480) ✅
- **Photo Print Service**: £29 (was £30) ✅

## ⚠️ **REMAINING ISSUE: View Dependencies**

### **Problem:**
The `v_products_unified_open` view is still showing old prices because it depends on a missing `v_products_unified` view.

### **Current Status:**
- ✅ `product_display_price` table has correct prices
- ❌ `v_products_unified_open` view shows old prices
- ❌ `v_event_product_mappings` shows old prices (depends on above view)

### **Root Cause:**
The view dependency chain is broken:
```
v_event_product_mappings 
  → v_event_product_final_enhanced 
    → v_products_unified_open 
      → v_products_unified (MISSING!)
```

## 🔧 **Next Steps Required:**

### **Option 1: Recreate Missing View**
- Create the missing `v_products_unified` view
- Ensure it properly joins with `product_display_price`

### **Option 2: Direct View Update**
- Update `v_products_unified_open` to directly use `product_display_price`
- Bypass the missing intermediate view

### **Option 3: Refresh All Views**
- Drop and recreate all dependent views
- Ensure proper data flow

## 📊 **Impact:**
- **Total Customer Savings**: £500+ across all products
- **Most Significant**: Four Private Classes (£120 savings)
- **Workshop Savings**: £25-£80 per workshop
- **Course Savings**: £95-£120 per course

---

**The price fix is 90% complete - just need to resolve the view dependency issue to make it fully functional.**




## Update Log
- 2026-01-16 19:59: Updated with latest ingest image fallback (prefer content over logo), bulk ingest UI watchdog timeout, search tile description expansion and image fallback/proxy, and restore point restore-20260116-1948.
