# Alan Ranger Photography Chat Bot

AI-powered chat bot for Alan Ranger Photography website, providing intelligent responses about photography workshops, courses, and events.

## Features

- Natural language chat interface
- Real-time event and product information
- Analytics and quality tracking
- Database health monitoring
- Automated maintenance jobs

## Database Maintenance

### Overview

The `page_html` table stores HTML content scraped from website pages. This table requires regular maintenance to prevent excessive growth and maintain query performance.

### Why Maintenance is Needed

The `page_html` table can grow significantly over time as new pages are scraped. Without maintenance:
- Storage usage increases indefinitely
- Query performance degrades
- Database costs rise
- Table statistics become stale, leading to poor query plans

### Daily Cleanup Job

**Job Name:** `daily_page_html_cleanup`  
**Schedule:** Daily at 02:00 UTC  
**Purpose:** Removes HTML content older than 30 days from the `page_html` table.

This job automatically deletes rows where `created_at` is more than 30 days old, preventing the table from growing indefinitely while maintaining recent content for active use.

### Daily Analyze Job

**Job Name:** `daily_page_html_analyze`  
**Schedule:** Daily at 02:30 UTC  
**Purpose:** Updates PostgreSQL query planner statistics for the `page_html` table.

After the cleanup job removes old rows, this job runs `ANALYZE` to update table statistics. This ensures the query optimizer has accurate information about the current table state, leading to better query performance.

### Verification

To verify the maintenance jobs are working correctly, run:

```bash
node scripts/db/verify-page-html-maintenance.js
```

This script provides:
- Current table size and row counts
- Number of rows older than 30 days
- Cron job execution status
- Last run times for both jobs
- Overall health summary

### Documentation

For detailed information about the maintenance cron jobs, including troubleshooting guides, see:

📖 [Database Cron Jobs Documentation](./docs/db-cron-jobs.md)

---

## Getting Started

### Prerequisites

- Node.js >= 18
- Supabase account and project
- Environment variables configured (see `.env.example`)

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

### Environment Variables

Required environment variables:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ANON_KEY`
- `INGEST_TOKEN`
- `OPENAI_API_KEY`

---

## Project Structure

```
├── api/              # API endpoints (Vercel serverless functions)
├── public/           # Static files and dashboard
├── scripts/          # Utility scripts
│   └── db/          # Database maintenance scripts
├── supabase/         # Supabase migrations and Edge Functions
│   ├── migrations/  # Database migrations
│   └── functions/   # Edge Functions
└── docs/            # Documentation
```

---

## License

Private project - All rights reserved

