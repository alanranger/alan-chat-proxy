# Product JSON-LD Entity Creation Fix

## Problem
The ingest code was only creating one entity from the "best" JSON-LD object, ignoring Product JSON-LD when it wasn't the "best" one.

## Solution
Modified `api/ingest.js` to:
1. Find Product JSON-LD objects in addition to the "best" JSON-LD
2. Create/update a Product entity when Product JSON-LD is found
3. Allow both Event and Product entities to coexist for the same URL

## Changes Made

**File**: `api/ingest.js`
**Location**: After line 919 (after entities array is created)

**Added Code**:
- Finds Product JSON-LD objects (different from the "best" one)
- Creates a Product entity with proper fields (price, availability, etc.)
- Adds it to the entities array so it gets processed and stored

## Testing

**Test URL**: `https://www.alanranger.com/photo-workshops-uk/woodland-photography-walk-warwickshire`

**Expected Result**:
- Event entity created/updated (from LocalBusiness JSON-LD)
- Product entity created/updated (from Product JSON-LD)
- Both entities should have `last_seen` updated to current time

**Current Status**:
- ✅ Code modified
- ⚠️ Needs deployment to Vercel
- ⚠️ Product entity not yet updated (needs re-ingest after deployment)

## Next Steps

1. **Deploy to Vercel** - The code changes need to be deployed
2. **Re-run ingest** - Test the URL again after deployment
3. **Verify** - Check that both Event and Product entities are created/updated

## Data Flow

1. HTML fetched → 8 JSON-LD scripts found
2. JSON-LD extracted → Product JSON-LD identified (idx 3)
3. "Best" JSON-LD selected → LocalBusiness (idx 0) for Event entity
4. **NEW**: Product JSON-LD also processed → Product entity created
5. Both entities stored in `page_entities` table
6. Product entity flows through to `v_products_unified_open` view

