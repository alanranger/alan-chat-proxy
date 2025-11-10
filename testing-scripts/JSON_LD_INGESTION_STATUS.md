# JSON-LD Ingestion Status Report

**Generated:** 2025-11-10 22:00:00

## Summary

✅ **JSON-LD data is being successfully ingested!**

## Current Status

### Entity Counts with JSON-LD Data

| Entity Type | Total Entities | Has JSON Data | Has @type | Has Name | Has Description |
|------------|----------------|---------------|-----------|----------|-----------------|
| **Event** | 197 | 197 (100%) | 197 (100%) | 197 (100%) | 78 (40%) |
| **Product** | 76 | 76 (100%) | 76 (100%) | 76 (100%) | 76 (100%) |
| **Service** | 223 | 223 (100%) | 223 (100%) | 72 (32%) | 64 (29%) |

### Product Entities (Sample)

All 76 product entities have complete JSON-LD data including:
- ✅ `@type`: "Product"
- ✅ `name`: Product name
- ✅ `description`: Full product description
- ✅ JSON size: 2-3KB per product

**Example Products:**
- Lightroom Courses for Beginners (3KB JSON)
- Bluebell Woodlands Photography (2.8KB JSON)
- Landscape Photography Snowdonia (2.7KB JSON)
- Coastal Northumberland Photography (2.6KB JSON)
- Landscape Photography Workshop Norfolk (2.6KB JSON)

### Event Entities

All 197 event entities have JSON-LD data:
- ✅ `@type`: "LocalBusiness" or "Event"
- ✅ `name`: Event name
- ⚠️ Only 40% have descriptions (78/197)

**Note:** Some events show `@type: "LocalBusiness"` instead of "Event" - this is expected as the ingest prioritizes LocalBusiness for event URLs.

## Service Reconciliation Status

### Current State
- **Total service rows in csv_metadata:** 528
- **Service entities in page_entities:** 40
- **Missing service entities:** 488

### Reconciliation Solution

A new endpoint has been created: `/api/tools?action=reconcile_services`

**How to use:**
1. Call `POST /api/tools?action=reconcile_services`
2. It will:
   - Find all missing service entities (488)
   - Process them in batches of 10
   - Ingest each missing service URL
   - Return progress and results

**Note:** This should be run:
- Manually when needed
- Via cron job periodically
- NOT on every single URL ingestion (that was causing timeouts)

## Recommendations

1. ✅ **JSON-LD ingestion is working well** - All products and events have JSON data
2. ⚠️ **Service reconciliation needed** - 488 services missing entities
3. ✅ **Product entities have complete data** - All fields populated
4. ⚠️ **Event descriptions** - Only 40% have descriptions (may need investigation)

## Next Steps

1. Run service reconciliation: `POST /api/tools?action=reconcile_services`
2. Monitor ingestion for any issues
3. Consider investigating why only 40% of events have descriptions

