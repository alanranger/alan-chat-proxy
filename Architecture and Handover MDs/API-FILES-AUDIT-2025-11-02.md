# API Files Audit - 2 Nov 2025

**Purpose**: Audit all API JS files to determine which are still in use and verify documentation coverage.

---

## API Files Inventory

### ✅ Active & In Use (9 files)

| File | Purpose | Status | Usage | Documentation |
|------|---------|--------|-------|---------------|
| **chat.js** | Main chat interface (RAG + response generation) | ✅ ACTIVE | Used by `chat.html`, `interactive-testing.html`, test scripts | ✅ Documented in multiple MDs |
| **analytics.js** | Analytics dashboard data API | ✅ ACTIVE | Used by `analytics.html` | ✅ Documented in HANDOVER |
| **chat-improvement.js** | Insights/improvement recommendations API | ✅ ACTIVE | Used by `analytics.html` Insights tab | ✅ Documented in HANDOVER |
| **light-refresh.js** | Automated content refresh (runs every 8 hours) | ✅ ACTIVE | Vercel Cron job | ✅ Documented in HANDOVER |
| **admin.js** | Admin utilities (QA checks, data refresh) | ✅ ACTIVE | Used by `admin.html` | ⚠️ Partial (mentioned but not detailed) |
| **tools.js** | Utility functions (mapping, finalization, exports) | ✅ ACTIVE | Used by `bulk-simple.html`, `admin.html` | ⚠️ Partial (mentioned but not detailed) |
| **ingest.js** | Web scraping and data ingestion | ✅ ACTIVE | Used by `bulk-simple.html` | ⚠️ Partial (mentioned but not detailed) |
| **csv-import.js** | CSV metadata import | ✅ ACTIVE | Used by `bulk-simple.html` | ⚠️ Partial (mentioned but not detailed) |
| **extract.js** | Extract structured data from URLs | ✅ ACTIVE | Used by `bulk-simple.html` | ❌ Not documented |

---

### ⚠️ Unused / Deprecated (2 files)

| File | Purpose | Status | Usage | Documentation |
|------|---------|--------|-------|---------------|
| **chat-rag.js** | RAG prototype endpoint | ❌ UNUSED | Only referenced in test scripts (`test-rag-prototype.js`, `test-rag-comprehensive.js`) | ⚠️ Documented as "prototype" in Archive |
| **proxy.js** | Botsonic API proxy | ❌ UNUSED | No references found in active codebase | ❌ Not documented |

---

## Detailed Analysis

### Active Files

#### 1. **chat.js** ✅
- **Purpose**: Main chat interface endpoint - handles all user queries
- **Endpoint**: `/api/chat`
- **Status**: Primary active endpoint
- **Usage**: 
  - `public/chat.html` (main chat interface)
  - `public/interactive-testing.html`
  - `public/testbench-*.html` files
  - All test scripts
- **Documentation**: ✅ Well documented in multiple MD files

#### 2. **analytics.js** ✅
- **Purpose**: Provides analytics dashboard data (overview, questions, sessions, performance, insights)
- **Endpoint**: `/api/analytics`
- **Status**: Active
- **Usage**: `public/analytics.html` (all tabs)
- **Actions**: `overview`, `questions`, `sessions`, `session_detail`, `question_detail`, `performance`, `insights`, `feedback`, `feedback_submit`, `admin_counts`, `admin_preview`, `admin_delete`, `admin_clear_all`
- **Documentation**: ✅ Documented in HANDOVER_2025-10-28_CHAT_RECOVERY_UPDATED.md

#### 3. **chat-improvement.js** ✅
- **Purpose**: Provides improvement recommendations and insights for chat responses
- **Endpoint**: `/api/chat-improvement`
- **Status**: Active
- **Usage**: `public/analytics.html` Insights tab
- **Actions**: `analyze`, `recommendations`, `content_gaps`, `improvement_plan`, `generate_content`, `preview_improvements`, `improvement_status`, `list_implemented`, `ignore_question`, `implement_improvement`
- **Documentation**: ✅ Documented in HANDOVER_2025-10-28_CHAT_RECOVERY_UPDATED.md

#### 4. **light-refresh.js** ✅
- **Purpose**: Automated content refresh system (runs every 8 hours via Vercel Cron)
- **Endpoint**: `/api/light-refresh`
- **Status**: Active (automated)
- **Usage**: Vercel Cron job + manual trigger from `bulk-simple.html`
- **Documentation**: ✅ Documented in HANDOVER_2025-10-28_CHAT_RECOVERY_UPDATED.md

#### 5. **admin.js** ✅
- **Purpose**: Admin utilities for QA checks and data refresh operations
- **Endpoint**: `/api/admin`
- **Status**: Active
- **Usage**: `public/admin.html`
- **Actions**: `aggregate_analytics`, `cron_status`, `qa`, `refresh`
- **Documentation**: ⚠️ Mentioned but not detailed in MD files

#### 6. **tools.js** ✅
- **Purpose**: Utility functions for data management (mapping, finalization, exports, counts)
- **Endpoint**: `/api/tools`
- **Status**: Active
- **Usage**: `public/bulk-simple.html`, `public/admin.html`
- **Actions**: `parity`, `cron_status`, `get_urls`, `finalize`, `export`, `export_unmapped`, `export_reconcile`, `counts`, `verify`, `search`
- **Documentation**: ⚠️ Mentioned but not detailed in MD files

#### 7. **ingest.js** ✅
- **Purpose**: Web scraping and data ingestion from URLs
- **Endpoint**: `/api/ingest`
- **Status**: Active
- **Usage**: `public/bulk-simple.html`
- **Documentation**: ⚠️ Mentioned but not detailed in MD files

#### 8. **csv-import.js** ✅
- **Purpose**: CSV metadata import
- **Endpoint**: `/api/csv-import`
- **Status**: Active
- **Usage**: `public/bulk-simple.html`
- **Documentation**: ⚠️ Mentioned but not detailed in MD files

#### 9. **extract.js** ✅
- **Purpose**: Extract structured data (events, articles, products, services) from URLs
- **Endpoint**: `/api/extract`
- **Status**: Active
- **Usage**: `public/bulk-simple.html`, `public/xxx bulk.html`
- **Actions**: `events-extract`, `articles-extract`, `products-extract`, `services-extract`, `extract-all`, `extract-events`
- **Documentation**: ❌ Not documented in MD files

---

### Unused Files

#### 10. **chat-rag.js** ❌
- **Purpose**: RAG prototype endpoint (simplified RAG-first approach)
- **Endpoint**: `/api/chat-rag`
- **Status**: UNUSED / DEPRECATED
- **Usage**: Only referenced in test scripts:
  - `testing-scripts/test-rag-prototype.js`
  - `testing-scripts/test-rag-comprehensive.js`
- **Note**: This was a prototype. The functionality is now integrated into `chat.js` via `tryRagFirst()` function
- **Recommendation**: ⚠️ **Consider archiving or removing** - functionality merged into chat.js
- **Documentation**: ⚠️ Mentioned as "prototype" in Archive/ROOT_AND_BRANCH_ANALYSIS.md

#### 11. **proxy.js** ❌
- **Purpose**: Botsonic API proxy (forwards requests to Writesonic Botsonic API)
- **Endpoint**: `/api/proxy`
- **Status**: UNUSED / DEPRECATED
- **Usage**: No references found in active codebase
- **Note**: Appears to be for external Botsonic integration that's no longer used
- **Recommendation**: ⚠️ **Consider archiving or removing** - no active usage
- **Documentation**: ❌ Not documented

---

## Documentation Coverage

### Well Documented ✅
- `chat.js` - Documented in multiple MD files
- `analytics.js` - Documented in HANDOVER
- `chat-improvement.js` - Documented in HANDOVER
- `light-refresh.js` - Documented in HANDOVER

### Partially Documented ⚠️
- `admin.js` - Mentioned but not detailed
- `tools.js` - Mentioned but not detailed
- `ingest.js` - Mentioned but not detailed
- `csv-import.js` - Mentioned but not detailed

### Not Documented ❌
- `extract.js` - No documentation found
- `proxy.js` - No documentation found
- `chat-rag.js` - Only mentioned as prototype in Archive

---

## Recommendations

### 1. Documentation Updates Needed
Create or update documentation for:
- **`admin.js`**: Document all actions (`aggregate_analytics`, `cron_status`, `qa`, `refresh`)
- **`tools.js`**: Document all utility actions
- **`ingest.js`**: Document ingestion process and endpoints
- **`csv-import.js`**: Document CSV import format and process
- **`extract.js`**: Document extraction actions and usage

### 2. Unused Files
- **`chat-rag.js`**: 
  - ✅ **ARCHIVED** to `/Archive/api/chat-rag.js`
  - Functionality merged into chat.js via `tryRagFirst()` function
- **`proxy.js`**: 
  - ✅ **ARCHIVED** to `/Archive/api/proxy.js`
  - Botsonic integration no longer used

### 3. Create API Reference Document
Create a comprehensive API reference document (`Architecture and Handover MDs/API_REFERENCE.md`) that includes:
- Purpose of each endpoint
- Request/response formats
- Authentication requirements
- Available actions/parameters
- Usage examples

---

## Summary

| Status | Count | Files |
|--------|-------|-------|
| ✅ Active | 9 | chat.js, analytics.js, chat-improvement.js, light-refresh.js, admin.js, tools.js, ingest.js, csv-import.js, extract.js |
| ❌ Unused | 2 | chat-rag.js, proxy.js |
| ✅ Well Documented | 4 | chat.js, analytics.js, chat-improvement.js, light-refresh.js |
| ⚠️ Partial Documentation | 4 | admin.js, tools.js, ingest.js, csv-import.js |
| ❌ Not Documented | 3 | extract.js, proxy.js, chat-rag.js |

---

**Next Steps**:
1. Update documentation for partially documented APIs
2. Create documentation for undocumented APIs
3. Decide on archiving/removing unused files
4. Create comprehensive API reference document

