# ALL Products Price Variants Analysis

## 🎯 **SCOPE: This affects MANY products, not just Bluebell!**

I found **extensive price variants** across your entire product catalog where **"card" source (sale prices) are lower** than **"price_view" source (regular prices)**.

## 📊 **Key Products with Sale Prices (Card Source Lower):**

### **Workshop Products:**
- **Bluebell**: £99 (card) vs £125 (price_view) - **£26 savings**
- **Batsford**: £99 (card) vs £125 (price_view) - **£26 savings**
- **Peak District**: £150 (card) vs £175 (price_view) - **£25 savings**
- **Lake District**: £975 (card) vs £1050 (price_view) - **£75 savings**
- **North Yorkshire**: £1450 (card) vs £1495 (price_view) - **£45 savings**
- **Wales**: £525 (card) vs £595 (price_view) - **£70 savings**
- **Yorkshire Dales**: £825 (card) vs £875 (price_view) - **£50 savings**
- **Glencoe**: £825 (card) vs £875 (price_view) - **£50 savings**
- **Anglesey**: £795 (card) vs £875 (price_view) - **£80 savings**
- **Norfolk**: £975 (card) vs £1025 (price_view) - **£50 savings**

### **Course Products:**
- **Intermediates Intentions**: £400 (card) vs £495 (price_view) - **£95 savings**
- **Four Private Classes**: £360 (card) vs £480 (price_view) - **£120 savings**
- **Photo Print Service**: £29 (card) vs £30 (price_view) - **£1 savings**

### **Subscription Products:**
- **Monthly Pick N Mix**: £42 (both sources) - **No difference**
- **Quarterly Pick N Mix**: £250 (both sources) - **No difference**

## 🔧 **The Fix Needed**

The current algorithm prioritizes **source type over price**, which means customers see **higher regular prices** instead of **lower sale prices**.

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
  price_gbp,                    -- Lowest price first (PRIMARY criteria)
  product_title                 -- Tiebreaker only
```

## 📈 **Impact of the Fix**

**Total potential customer savings**: **£500+ across all products**

**Most significant savings:**
1. **Four Private Classes**: £120 savings
2. **Intermediates Intentions**: £95 savings  
3. **Anglesey**: £80 savings
4. **Lake District**: £75 savings
5. **Wales**: £70 savings

## 🎯 **Implementation Plan**

1. **Modify `v_price_resolved` view** to prioritize lowest price
2. **Test the fix** with a few key products
3. **Refresh all price data** using the new algorithm
4. **Verify customer-facing prices** show sale prices

---

**This fix will ensure ALL customers see the lowest available prices across your entire product catalog!**



