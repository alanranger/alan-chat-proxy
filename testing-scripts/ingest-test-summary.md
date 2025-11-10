# Ingest Test Summary - Woodland Photography Walk URL

## URL Tested
`https://www.alanranger.com/photo-workshops-uk/woodland-photography-walk-warwickshire`

## ✅ What Was Updated

### 1. page_html ✅
- **Status**: Updated
- **Content Hash**: `814ede3dfa80858a995dd6431d2ea37a5b6c2e1b`
- **HTML Length**: 311,102 characters
- **JSON-LD Scripts Found**: 8 scripts
- **Updated**: 2025-11-10 15:23:45

### 2. page_chunks ✅
- **Status**: Updated
- **Chunks Created**: 2 new chunks
- **Embeddings**: Not generated yet (embedding = null)
- **Created**: 2025-11-10 15:23:46

### 3. page_entities ⚠️
- **Status**: Partially Updated
- **Entities Created**: 1 (should have been more)
- **Entity Created**: Event entity from LocalBusiness JSON-LD (idx 0)
- **Product Entity**: NOT updated (still from October)
- **Issue**: Only the "best" JSON-LD object is used, not all of them

## 📊 JSON-LD Objects Extracted (8 total)

From debug logs:
1. **idx 0**: LocalBusiness → Used (created event entity)
2. **idx 1**: LocalBusiness → Ignored
3. **idx 2**: Organization → Ignored
4. **idx 3**: **Product** → ⚠️ **IGNORED** (this is the one you added!)
5. **idx 4**: (no type) → Ignored
6. **idx 5**: (no type) → Ignored
7. **idx 6**: WebSite → Ignored
8. **idx 7**: WebSite → Ignored

## ⚠️ Issue Identified

**The Product JSON-LD (idx 3) was extracted but NOT used to create/update a product entity.**

**Why?**
- The ingest code only creates ONE entity from the "best" JSON-LD object
- It prioritizes JSON-LD objects in this order for event URLs:
  1. Event
  2. Course/EducationEvent
  3. LocalBusiness ← **This was selected**
  4. Organization
  5. WebSite

- Since there was no Event JSON-LD, it selected LocalBusiness (idx 0)
- The Product JSON-LD (idx 3) was ignored

## 🔍 Data Flow Check

### ✅ Working:
1. HTML fetched and stored
2. JSON-LD extracted (8 objects found)
3. Text chunks created (2 chunks)
4. One entity created (event from LocalBusiness)

### ❌ Not Working:
1. Product entity NOT updated (still from October)
2. Product JSON-LD NOT used to create entity
3. Only 1 entity created instead of multiple (one per JSON-LD type)

## 💡 Solution Needed

The ingest code needs to be modified to:
1. Create entities for ALL relevant JSON-LD types (not just the "best" one)
2. OR prioritize Product JSON-LD for product URLs
3. OR create separate entities for Product, Event, etc. when multiple types exist

## 📋 Current State

- **Old Product Entity**: Still exists (from October)
  - Price: £15
  - Availability: InStock
  - Last seen: 2025-10-12

- **New Event Entity**: Created (from LocalBusiness)
  - No price, no availability
  - Last seen: 2025-11-10 15:23:48

- **Product JSON-LD**: Extracted but not used

