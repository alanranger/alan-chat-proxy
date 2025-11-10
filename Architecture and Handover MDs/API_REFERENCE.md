# API Reference Documentation

**Last Updated**: 2 Nov 2025  
**Purpose**: Comprehensive reference for all API endpoints in the alan-chat-proxy system

---

## Table of Contents

1. [Core Chat APIs](#core-chat-apis)
2. [Analytics APIs](#analytics-apis)
3. [Admin & Management APIs](#admin--management-apis)
4. [Data Ingestion APIs](#data-ingestion-apis)
5. [Utility APIs](#utility-apis)
6. [Automation APIs](#automation-apis)

---

## Core Chat APIs

### `/api/chat`

**Purpose**: Main chat interface endpoint - handles all user queries with RAG (Retrieval-Augmented Generation)

**Method**: `POST`

**Authentication**: None (public endpoint)

**Request Body**:
```json
{
  "query": "string (required)",
  "previousQuery": "string (optional)",
  "sessionId": "string (optional)",
  "pageContext": {
    "pathname": "string (optional)",
    "url": "string (optional)"
  }
}
```

**Response**:
```json
{
  "ok": true,
  "type": "advice|events|services|clarification",
  "answer": "string",
  "answer_markdown": "string",
  "confidence": 0.0-1.0,
  "sources": {
    "articles": ["url1", "url2"],
    "services": [...],
    "events": [...]
  },
  "structured": {
    "intent": "string",
    "topic": "string",
    "articles": [...],
    "services": [...],
    "events": [...],
    "products": [...],
    "pills": [...]
  },
  "debug": {
    "version": "string",
    "debugInfo": {...},
    "timestamp": "ISO string",
    "queryText": "string",
    "keywords": ["string"]
  }
}
```

**Features**:
- RAG-first approach with database search
- Intent detection and routing
- Related information enrichment
- Session logging and analytics
- Support for technical, business, event, and service queries

**Used By**: `chat.html`, `interactive-testing.html`, test scripts

---

## Analytics APIs

### `/api/analytics`

**Purpose**: Provides analytics dashboard data (overview, questions, sessions, performance, insights)

**Method**: `GET`

**Authentication**: `Authorization: Bearer <INGEST_TOKEN>`

**Query Parameters**:
- `action`: Required - one of: `overview`, `questions`, `sessions`, `session_detail`, `question_detail`, `performance`, `insights`, `feedback`, `feedback_submit`, `admin_counts`, `admin_preview`, `admin_delete`, `admin_clear_all`
- `days`: Optional - number of days (default: 7) for `overview` and `performance`
- `page`: Optional - page number for `sessions` (default: 1)
- `limit`: Optional - items per page for `sessions` (default: 20)
- `search`: Optional - search term for `sessions`
- `question`: Required for `question_detail` - question text
- `sessionId`: Required for `session_detail` - session ID

**Actions**:

#### `overview`
Returns overview statistics and recent sessions
```json
{
  "ok": true,
  "overview": {
    "totals": {
      "sessions": 0,
      "questions": 0,
      "interactions": 0,
      "avgConfidence": 0.0,
      "avgResponseTime": 0
    },
    "dailyData": [...],
    "recentSessions": [...]
  }
}
```

#### `questions`
Returns top questions list (limit: 1000)
```json
{
  "ok": true,
  "questions": {
    "topQuestions": [
      {
        "question_text": "string",
        "frequency": 0,
        "avg_confidence": 0.0,
        "last_seen": "ISO string",
        "last_page": "string"
      }
    ],
    "recentQuestions": [...]
  }
}
```

#### `sessions`
Returns paginated sessions list
```json
{
  "ok": true,
  "sessions": {
    "data": [...],
    "pagination": {
      "page": 1,
      "limit": 20,
      "pages": 1,
      "total": 0
    }
  }
}
```

#### `session_detail`
Returns detailed session information
```json
{
  "ok": true,
  "session": {
    "session": {...},
    "interactions": [...],
    "events": [...]
  }
}
```

#### `question_detail`
Returns detailed question information
```json
{
  "ok": true,
  "question": {
    "interactions": [...]
  }
}
```

#### `performance`
Returns performance metrics over time
```json
{
  "ok": true,
  "performance": [
    {
      "date": "YYYY-MM-DD",
      "questions": 0,
      "avgConfidence": 0.0,
      "avgResponseTime": 0
    }
  ]
}
```

#### `insights`
Returns improvement insights and recommendations
```json
{
  "ok": true,
  "insights": {
    "highPriority": [...],
    "mediumPriority": [...],
    "lowPriority": [...]
  }
}
```

#### `feedback`
Returns user feedback data
```json
{
  "ok": true,
  "feedback": [...]
}
```

#### `feedback_submit` (POST)
Submits user feedback
```json
{
  "ok": true,
  "message": "Feedback recorded successfully"
}
```

#### `admin_counts`
Returns data counts for admin panel
```json
{
  "ok": true,
  "counts": {
    "questions": 0,
    "sessions": 0,
    "interactions": 0
  }
}
```

#### `admin_preview`
Preview filtered data for deletion
```json
{
  "ok": true,
  "preview": {
    "interactions": [...],
    "sessions": [...],
    "questions": [...]
  }
}
```

#### `admin_delete` (POST)
Delete filtered data
```json
{
  "ok": true,
  "deleted": {
    "interactions": 0,
    "sessions": 0,
    "questions": 0
  }
}
```

#### `admin_clear_all` (POST)
Clear all data (dangerous!)
```json
{
  "ok": true,
  "deleted": {
    "interactions": 0,
    "sessions": 0,
    "questions": 0
  }
}
```

**Used By**: `analytics.html`

---

### `/api/chat-improvement`

**Purpose**: Provides improvement recommendations and insights for chat responses

**Method**: `GET` or `POST`

**Authentication**: `Authorization: Bearer <INGEST_TOKEN>`

**Query Parameters**:
- `action`: Required - one of: `analyze`, `recommendations`, `content_gaps`, `improvement_plan`, `generate_content`, `preview_improvements`, `improvement_status`, `list_implemented`, `ignore_question`, `implement_improvement`

**Actions**:

#### `analyze`
Analyzes chat responses and identifies improvement opportunities

#### `recommendations`
Returns improvement recommendations

#### `content_gaps`
Identifies content gaps in knowledge base

#### `improvement_plan`
Generates improvement plan

#### `generate_content`
Generates content for identified gaps

#### `preview_improvements`
Previews proposed improvements

#### `improvement_status`
Checks status of improvement implementation

#### `list_implemented`
Lists implemented improvements

#### `ignore_question` (POST)
Ignores a question from improvement recommendations

#### `implement_improvement` (POST)
Implements a specific improvement

**Used By**: `analytics.html` Insights tab

---

## Admin & Management APIs

### `/api/admin`

**Purpose**: Admin utilities for QA checks and data refresh operations

**Method**: `GET` or `POST`

**Authentication**: `Authorization: Bearer <INGEST_TOKEN>` or `Bearer b6c3f0c9e6f44cce9e1a4f3f2d3a5c76`

**Query Parameters**:
- `action`: Required - one of: `qa`, `aggregate_analytics`, `cron_status`, `refresh`

**Actions**:

#### `qa` (GET)
Runs QA spot checks on database tables and views
```json
{
  "ok": true,
  "checks": {
    "table_name": {
      "status": "ok|error",
      "count": 0,
      "sample": [...]
    }
  }
}
```

#### `aggregate_analytics` (POST)
Runs analytics aggregation for a specific date
```json
{
  "date": "YYYY-MM-DD (optional, defaults to today)"
}
```

Response:
```json
{
  "ok": true,
  "date": "YYYY-MM-DD"
}
```

#### `cron_status` (GET)
Checks status of automated cron jobs
```json
{
  "ok": true,
  "cron_jobs": [...]
}
```

#### `refresh` (POST)
Refreshes event-to-product mappings
```json
{
  "preview": true|false (optional)
}
```

Response:
```json
{
  "ok": true,
  "mappingsCreated": 0
}
```

**Used By**: `admin.html`

---

## Data Ingestion APIs

### `/api/ingest`

**Purpose**: Web scraping and data ingestion from URLs

**Method**: `POST`

**Authentication**: `Authorization: Bearer <INGEST_TOKEN>`

**Request Body** (Single URL):
```json
{
  "url": "string (required)",
  "dryRun": true|false (optional)
}
```

**Request Body** (Bulk NDJSON):
```
Content-Type: application/x-ndjson
[URL1]\n[URL2]\n...
```

**Response**:
```json
{
  "ok": true,
  "url": "string",
  "status": "success|error",
  "message": "string",
  "chunksCreated": 0,
  "entitiesCreated": 0
}
```

**Features**:
- Extracts structured data from HTML
- Creates page chunks for RAG
- Creates page entities (articles, products, events, services)
- Generates embeddings for semantic search
- Handles bulk ingestion via NDJSON streaming

**Used By**: `bulk-simple.html`

---

### `/api/csv-import`

**Purpose**: CSV metadata import for all content types

**Method**: `POST`

**Authentication**: `Authorization: Bearer <INGEST_TOKEN>`

**Request Body**:
```json
{
  "csvData": "string (CSV content)",
  "contentType": "blog|workshop|service|product|event"
}
```

**Response**:
```json
{
  "ok": true,
  "imported": 0,
  "errors": [...]
}
```

**Features**:
- Handles blog, workshop, service, product, and event imports
- Proper CSV parsing with quoted fields
- Creates page entities with structured data
- Validates and cleans data

**Used By**: `bulk-simple.html`

---

### `/api/extract`

**Purpose**: Extract structured data (events, articles, products, services) from URLs (read-only)

**Method**: `GET`

**Authentication**: None (public endpoint)

**Query Parameters**:
- `action`: Required - one of: `events-extract`, `articles-extract`, `products-extract`, `services-extract`, `extract-all`, `extract-events`
- `url`: Required - URL to extract from

**Response**:
```json
{
  "ok": true,
  "url": "string",
  "count": 0,
  "items": [...]
}
```

**Actions**:
- `events-extract`: Extracts event items from URL
- `articles-extract`: Extracts article items from URL
- `products-extract`: Extracts product items from URL
- `services-extract`: Extracts service items from URL
- `extract-all`: Extracts all types from URL
- `extract-events`: Alias for `events-extract` (back-compat)

**Used By**: `bulk-simple.html`, `xxx bulk.html`

---

## Utility APIs

### `/api/tools`

**Purpose**: Utility functions for data management (mapping, finalization, exports, counts)

**Method**: `GET` or `POST`

**Authentication**: `Authorization: Bearer <INGEST_TOKEN>` (most actions), Public export available when `PUBLIC_EXPORT_ENABLED=1`

**Query Parameters**:
- `action`: Required - one of: `health`, `verify`, `search`, `parity`, `cron_status`, `get_urls`, `finalize`, `export`, `export_unmapped`, `export_reconcile`, `counts`, `event_debug`

**Actions**:

#### `health` (GET)
Health check endpoint
```json
{
  "ok": true,
  "env": {
    "has_ingest_token": true,
    "has_supabase_url": true,
    "has_supabase_service_role_key": true,
    "has_supabase_anon_key": true,
    "embed_provider": "openai"
  },
  "db": {
    "page_chunks_count": 0
  }
}
```

#### `verify` (GET)
Verifies URL ingestion status
```json
{
  "ok": true,
  "url": "string",
  "chunks": 0,
  "totalLength": 0
}
```

#### `search` (POST)
Semantic search using embeddings
```json
{
  "query": "string",
  "topK": 10
}
```

Response:
```json
{
  "ok": true,
  "results": [...]
}
```

#### `parity` (GET)
Checks data parity between sources

#### `cron_status` (GET)
Checks cron job status

#### `get_urls` (GET)
Gets URLs from database
- `recent`: Optional - true/false for recent URLs only

#### `finalize` (POST)
Finalizes data processing pipeline
```json
{
  "ok": true,
  "message": "Data finalized"
}
```

#### `export` (GET)
Exports data as CSV
- `public`: Optional - 1 to enable public export (requires `PUBLIC_EXPORT_ENABLED=1`)

#### `export_unmapped` (GET)
Exports unmapped events/products

#### `export_reconcile` (GET)
Exports reconciliation data
- `public`: Optional - 1 to enable public export

#### `counts` (GET)
Returns data counts
```json
{
  "ok": true,
  "counts": {
    "page_chunks": 0,
    "page_entities": 0,
    "events": 0,
    "products": 0,
    "articles": 0
  }
}
```

#### `event_debug` (GET)
Debug endpoint for event data

**Used By**: `bulk-simple.html`, `admin.html`

---

## Automation APIs

### `/api/light-refresh`

**Purpose**: Automated content refresh system (runs every 8 hours via Vercel Cron)

**Method**: `GET` or `POST`

**Authentication**: `Authorization: Bearer <INGEST_TOKEN>` (for manual triggers)

**Query Parameters**:
- `action`: Optional - `status` for status check

**Response**:
```json
{
  "ok": true,
  "refreshed": 0,
  "errors": [...]
}
```

**Features**:
- Automatically refreshes content from source URLs
- Runs every 8 hours via Vercel Cron
- Can be triggered manually
- Updates embeddings and structured data

**Used By**: Vercel Cron job, `bulk-simple.html`

---

## Authentication

Most endpoints require authentication via Bearer token:

```
Authorization: Bearer <INGEST_TOKEN>
```

Where `INGEST_TOKEN` is set in environment variables.

Some endpoints accept alternative tokens:
- `admin.html` uses: `Bearer b6c3f0c9e6f44cce9e1a4f3f2d3a5c76` (legacy admin UI token)
- Public exports available when `PUBLIC_EXPORT_ENABLED=1`

---

## Error Responses

All endpoints return consistent error format:

```json
{
  "ok": false,
  "error": "error_code",
  "detail": "Human-readable error message",
  "stage": "optional stage identifier"
}
```

Common error codes:
- `unauthorized` - Authentication failed
- `bad_request` - Invalid request parameters
- `server_error` - Internal server error
- `missing_env` - Missing environment variable

---

## Environment Variables

Required environment variables:
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key
- `INGEST_TOKEN` - API authentication token
- `OPENAI_API_KEY` - OpenAI API key for embeddings

Optional:
- `PUBLIC_EXPORT_ENABLED` - Enable public CSV exports (set to "1")
- `ADMIN_UI_TOKEN` - Alternative admin UI token
- `BOTSONIC_API_KEY` - Botsonic API key (if using proxy.js)

---

## Rate Limits

- No explicit rate limits configured
- Vercel Hobby plan limits:
  - 100GB bandwidth/month
  - 100 hours execution time/month
  - 12 serverless functions

---

## Deprecated/Unused Endpoints

The following endpoints exist but are not actively used:

- `/api/chat-rag` - RAG prototype (functionality merged into `/api/chat`)
- `/api/proxy` - Botsonic API proxy (no active usage)

These endpoints are archived in `/Archive/api/` and can be removed if not needed.

---

**Last Updated**: 2 Nov 2025  
**Maintained By**: Development Team



