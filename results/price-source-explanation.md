# Price Source Explanation: "card" vs "price_view"

## 🔍 **What is "card" source?**

The **"card" source** represents prices extracted from **product card data** - this is the price information that appears on the main product listing pages or product cards on your website.

## 🔍 **What is "price_view" source?**

The **"price_view" source** represents prices extracted from **dedicated price view pages** - this is likely from more detailed product pages or specific pricing sections.

## 📊 **How the Price Selection Works**

The system uses a sophisticated price resolution algorithm in the `v_price_resolved` view:

### **Priority Order:**
1. **Lowest price first** (`ORDER BY price_gbp`)
2. **Source preference** (`price_view` gets priority over `card`)
3. **Product title** (as tiebreaker)

### **Current Logic:**
```sql
ORDER BY 
  price_gbp,                    -- Lowest price first
  CASE source
    WHEN 'price_view' THEN 0    -- price_view gets priority
    ELSE 1                      -- card gets lower priority
  END,
  product_title                 -- Tiebreaker
```

## 🎯 **Why Bluebell Shows £125 Instead of £99**

For Bluebell Photography Workshops:
- **Card source**: £99 (from product card data)
- **Price_view source**: £125 (from detailed price view)

**The system chooses £125 because:**
1. Both prices are different (£99 vs £125)
2. The algorithm prioritizes `price_view` source over `card` source
3. So even though £99 is lower, £125 wins due to source preference

## 🤔 **What This Means**

### **"card" source** likely represents:
- **Product listing prices** (main product pages)
- **Potentially older/simpler pricing** data
- **Card-based display prices**

### **"price_view" source** likely represents:
- **Detailed pricing pages**
- **More current/accurate pricing** data
- **Dedicated price calculation views**

## 📋 **The Question**

**Which price source should be trusted more?**

1. **Current behavior**: Trusts `price_view` (more detailed/current)
2. **Alternative**: Trust lowest price regardless of source
3. **Alternative**: Trust `card` source (simpler/listing prices)

## 🔧 **Technical Details**

The price resolution happens in this chain:
1. `v_price_candidates` - Collects prices from both sources
2. `v_price_resolved` - Applies priority logic to select best price
3. `product_display_price` - Stores the resolved price
4. `v_products_unified` - Uses the stored price for mappings

---

**Recommendation**: The current logic seems reasonable (prioritizing more detailed price views), but if you want to show the lower price (£99 for Bluebell), we could modify the algorithm to prioritize lowest price over source preference.



