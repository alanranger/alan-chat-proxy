# Migration Guide: From Hardwired to Scalable Mapping System

## Overview
This guide explains how to migrate from the current hardwired mapping system to a scalable, rule-based system that can automatically handle new events and products.

## Current Issues to Fix First

### 1. Run the Final Comprehensive Fix
```sql
-- Execute this first to fix current data issues
\i FINAL_COMPREHENSIVE_FIX.sql
```

This will fix:
- ✅ Location extraction (many "Location TBD" issues)
- ✅ Missing date/time data
- ✅ Subtype classification (all showing "event")
- ✅ Price mapping issues

### 2. Verify the Fix
```sql
-- Check the results
SELECT 
  COUNT(*) as total_events,
  COUNT(CASE WHEN event_location != 'Location TBD' THEN 1 END) as with_locations,
  COUNT(CASE WHEN subtype != 'event' THEN 1 END) as properly_classified,
  COUNT(CASE WHEN price_gbp IS NOT NULL THEN 1 END) as with_prices
FROM v_event_product_pricing_corrected;
```

## Migration to Scalable System

### Step 1: Deploy the Scalable System
```sql
-- Execute the scalable mapping system
\i SCALABLE_MAPPING_SYSTEM.sql
```

### Step 2: Test the New System
```sql
-- Compare old vs new mappings
SELECT 
  'Old System' as system,
  COUNT(*) as total_events,
  COUNT(CASE WHEN method = 'hardwired_correct' THEN 1 END) as hardwired_mappings
FROM v_event_product_pricing_corrected

UNION ALL

SELECT 
  'New System' as system,
  COUNT(*) as total_events,
  COUNT(CASE WHEN method = 'rule_based' THEN 1 END) as rule_based_mappings
FROM v_event_product_pricing_scalable;
```

### Step 3: Update Chatbot to Use New System
Update `api/chat.js` to use the new scalable view:

```javascript
// Change from:
// client.from("v_event_product_pricing_corrected")

// To:
client.from("v_event_product_pricing_scalable")
```

## How the Scalable System Works

### 1. Rule-Based Mapping
Instead of hardwired logic, the system uses a `event_product_mapping_rules` table:

```sql
-- Example: Add a new mapping rule
SELECT add_mapping_rule(
  'New Workshop Type',
  '%new-workshop-pattern%',
  '%photo-workshops-uk/new-workshop-product%',
  90
);
```

### 2. Automatic Classification
The system automatically:
- **Classifies events** by URL patterns (course vs workshop)
- **Extracts locations** from URL keywords
- **Derives times** based on event type
- **Maps to products** using rule priority

### 3. Easy Management
```sql
-- Add new mapping rule
SELECT add_mapping_rule('Lakeside Workshops', '%lakeside%', '%photo-workshops-uk/lakeside-workshop%', 85);

-- Update existing rule
SELECT update_mapping_rule(1, priority := 95);

-- Disable a rule
SELECT update_mapping_rule(1, is_active := false);
```

## Benefits of the Scalable System

### ✅ **Automatic Handling of New Content**
- New events automatically get mapped based on URL patterns
- New products automatically get linked if they match patterns
- No code changes needed for new content

### ✅ **Easy Maintenance**
- Add new mapping rules via SQL
- Update priorities to change mapping behavior
- Disable rules without deleting them

### ✅ **Audit Trail**
- All mapping changes are logged
- Easy to track what changed and when
- Rollback capability

### ✅ **Fallback System**
- If no rule matches, falls back to existing fuzzy matching
- Gradual migration possible
- No data loss

## Migration Strategy

### Phase 1: Fix Current Issues (Immediate)
1. Run `FINAL_COMPREHENSIVE_FIX.sql`
2. Verify all issues are resolved
3. Test chatbot functionality

### Phase 2: Deploy Scalable System (Next)
1. Run `SCALABLE_MAPPING_SYSTEM.sql`
2. Test new system alongside old system
3. Compare results

### Phase 3: Switch to New System (Final)
1. Update chatbot to use new views
2. Monitor for any issues
3. Remove old hardwired views when confident

## Monitoring and Maintenance

### Daily Checks
```sql
-- Check for unmapped events
SELECT COUNT(*) FROM v_events_norm e
LEFT JOIN v_event_product_links_scalable m ON e.event_url = m.event_url
WHERE m.event_url IS NULL;
```

### Weekly Reviews
```sql
-- Review mapping quality
SELECT 
  method,
  COUNT(*) as count,
  AVG(specificity) as avg_score
FROM v_event_product_pricing_scalable
GROUP BY method;
```

### Adding New Rules
When new event types are added to the website:

1. **Identify the pattern**: What URL pattern identifies this event type?
2. **Find the product**: What product should it map to?
3. **Add the rule**: Use `add_mapping_rule()` function
4. **Test**: Verify the mapping works
5. **Monitor**: Check that new events get mapped correctly

## Example: Adding a New Workshop Type

```sql
-- 1. Add the mapping rule
SELECT add_mapping_rule(
  'Mountain Photography Workshops',
  '%mountain-photography%',
  '%photo-workshops-uk/mountain-photography-workshop%',
  90
);

-- 2. Test the mapping
SELECT get_event_product_mapping('https://www.alanranger.com/photographic-workshops-near-me/mountain-photography-scotland');

-- 3. Verify it appears in the scalable view
SELECT * FROM v_event_product_pricing_scalable 
WHERE event_url ILIKE '%mountain-photography%';
```

## Rollback Plan

If issues arise, you can easily rollback:

```sql
-- Switch chatbot back to old system
-- In api/chat.js, change back to:
client.from("v_event_product_pricing_corrected")

-- Or disable specific rules
UPDATE event_product_mapping_rules 
SET is_active = false 
WHERE rule_name = 'Problematic Rule';
```

This scalable system ensures that as your website grows and new events/products are added, the mapping system will automatically handle them without requiring code changes or manual intervention.




