# Database Audit Report

**Audit Date:** 2025-11-19T19:33:28.845Z

**Total Tables Scanned:** 63

**Total Database Size:** 1.09 GB (1113.42 MB)

## Summary by Classification

- **ACTIVE**: 34 tables
- **EMPTY**: 17 tables
- **CRITICAL**: 9 tables
- **CACHE**: 2 tables
- **LEGACY**: 1 tables

## Largest Tables

| Table Name | Size | Rows | Classification |
|------------|------|------|----------------|
| page_html | 1084 MB | 12716 | CRITICAL |
| job_run_details | 13 MB | 51444 | ACTIVE |
| page_entities | 3672 kB | 673 | CRITICAL |
| page_text | 3464 kB | 427 | ACTIVE |
| database_maintenance_run_table | 3008 kB | 18110 | ACTIVE |
| light_refresh_runs | 1104 kB | 564 | ACTIVE |
| csv_metadata | 992 kB | 990 | CRITICAL |
| schema_audit_logs | 576 kB | 84 | ACTIVE |
| csv_metadata_backup_2025_10_19 | 456 kB | 871 | LEGACY |
| db_health_snapshots | 384 kB | 2724 | ACTIVE |

## Redundant Tables Recommended for Deletion

**Total Potential Space Recovery:** 0.99 MB

| Table Name | Size | Rows | Classification | Notes |
|------------|------|------|----------------|-------|
| csv_metadata_backup_2025_10_19 | 456 kB | 871 | LEGACY | Backup/snapshot table - candidate for deletion |
| tmp_priced_w | 64 kB | 9 | CACHE | Temporary/cache table - can be rebuilt |
| event_product_links_manual | 48 kB | 0 | EMPTY | No rows - safe to delete if unused |
| blog_articles | 40 kB | 0 | EMPTY | No rows - safe to delete if unused |
| chat_performance_metrics | 40 kB | 0 | EMPTY | No rows - safe to delete if unused |
| chat_question_frequency | 40 kB | 0 | EMPTY | No rows - safe to delete if unused |
| event_dates | 40 kB | 0 | EMPTY | No rows - safe to delete if unused |
| site_urls | 32 kB | 0 | EMPTY | No rows - safe to delete if unused |
| tmp_priced_c | 32 kB | 0 | CACHE | Temporary/cache table - can be rebuilt |
| course_products | 32 kB | 0 | EMPTY | No rows - safe to delete if unused |
| workshop_products | 32 kB | 0 | EMPTY | No rows - safe to delete if unused |
| category | 24 kB | 0 | EMPTY | No rows - safe to delete if unused |
| product_schema | 24 kB | 0 | EMPTY | No rows - safe to delete if unused |
| debug_logs | 24 kB | 0 | EMPTY | No rows - safe to delete if unused |
| location | 24 kB | 0 | EMPTY | No rows - safe to delete if unused |
| event_product_links_overrides | 16 kB | 0 | EMPTY | No rows - safe to delete if unused |
| taxonomy_synonym | 16 kB | 0 | EMPTY | No rows - safe to delete if unused |
| mapping_audit_log | 16 kB | 0 | EMPTY | No rows - safe to delete if unused |
| series_category | 8192 bytes | 0 | EMPTY | No rows - safe to delete if unused |
| series_product | 8192 bytes | 0 | EMPTY | No rows - safe to delete if unused |

## Critical Tables (DO NOT TOUCH)

| Table Name | Size | Rows | Risk |
|------------|------|------|------|
| page_html | 1084 MB | 12716 | HIGH |
| page_entities | 3672 kB | 673 | HIGH |
| csv_metadata | 992 kB | 990 | HIGH |
| event | 192 kB | 131 | HIGH |
| page_chunks | 104 kB | 0 | HIGH |
| series | 96 kB | 8 | HIGH |
| chat_interactions | 64 kB | 0 | HIGH |
| chat_sessions | 64 kB | 8 | HIGH |
| product | 64 kB | 17 | HIGH |

## Full Table-by-Table Breakdown

### page_html

- **Size:** 1084 MB (1084.41 MB)
- **Rows:** 12716 (0 dead)
- **Indexes:** 5
- **Scans:** 73 total
- **Classification:** CRITICAL
- **Risk:** HIGH
- **Notes:** Core chatbot table - DO NOT DELETE
- **Code References:** api/jobs/db-maintenance.js

### job_run_details

- **Size:** 13 MB (12.52 MB)
- **Rows:** 51444 (0 dead)
- **Indexes:** 1
- **Scans:** 2914 total
- **Classification:** ACTIVE
- **Risk:** MEDIUM
- **Notes:** Referenced in application code
- **Code References:** api/admin.js

### page_entities

- **Size:** 3672 kB (3.59 MB)
- **Rows:** 673 (0 dead)
- **Indexes:** 23
- **Scans:** 562032449 total
- **Classification:** CRITICAL
- **Risk:** HIGH
- **Notes:** Core chatbot table - DO NOT DELETE
- **Code References:** api/chat.js, api/csv-import.js, api/tools.js

### page_text

- **Size:** 3464 kB (3.38 MB)
- **Rows:** 427 (0 dead)
- **Indexes:** 1
- **Scans:** 21327 total
- **Classification:** ACTIVE
- **Risk:** MEDIUM

### database_maintenance_run_table

- **Size:** 3008 kB (2.94 MB)
- **Rows:** 18110 (166 dead)
- **Indexes:** 2
- **Scans:** 28110 total
- **Classification:** ACTIVE
- **Risk:** MEDIUM

### light_refresh_runs

- **Size:** 1104 kB (1.08 MB)
- **Rows:** 564 (0 dead)
- **Indexes:** 3
- **Scans:** 1156 total
- **Classification:** ACTIVE
- **Risk:** MEDIUM
- **Notes:** Referenced in application code
- **Code References:** api/light-refresh.js

### csv_metadata

- **Size:** 992 kB (0.97 MB)
- **Rows:** 990 (0 dead)
- **Indexes:** 10
- **Scans:** 4216638 total
- **Classification:** CRITICAL
- **Risk:** HIGH
- **Notes:** Core chatbot table - DO NOT DELETE
- **Code References:** api/csv-import.js, api/light-refresh.js

### schema_audit_logs

- **Size:** 576 kB (0.56 MB)
- **Rows:** 84 (0 dead)
- **Indexes:** 4
- **Scans:** 412 total
- **Classification:** ACTIVE
- **Risk:** MEDIUM

### csv_metadata_backup_2025_10_19

- **Size:** 456 kB (0.45 MB)
- **Rows:** 871 (0 dead)
- **Indexes:** 0
- **Scans:** 64 total
- **Classification:** LEGACY
- **Risk:** LOW
- **Notes:** Backup/snapshot table - candidate for deletion

### db_health_snapshots

- **Size:** 384 kB (0.38 MB)
- **Rows:** 2724 (0 dead)
- **Indexes:** 1
- **Scans:** 1395 total
- **Classification:** ACTIVE
- **Risk:** MEDIUM

### db_health_alerts

- **Size:** 360 kB (0.35 MB)
- **Rows:** 2748 (0 dead)
- **Indexes:** 1
- **Scans:** 1394 total
- **Classification:** ACTIVE
- **Risk:** MEDIUM

### url_last_processed

- **Size:** 288 kB (0.28 MB)
- **Rows:** 464 (0 dead)
- **Indexes:** 5
- **Scans:** 40674 total
- **Classification:** ACTIVE
- **Risk:** MEDIUM
- **Notes:** Referenced in application code
- **Code References:** api/light-refresh.js

### database_maintenance_run

- **Size:** 224 kB (0.22 MB)
- **Rows:** 1811 (26 dead)
- **Indexes:** 1
- **Scans:** 38036 total
- **Classification:** ACTIVE
- **Risk:** MEDIUM

### event

- **Size:** 192 kB (0.19 MB)
- **Rows:** 131 (0 dead)
- **Indexes:** 5
- **Scans:** 1609 total
- **Classification:** CRITICAL
- **Risk:** HIGH
- **Notes:** Core chatbot table - DO NOT DELETE

### event_product_links_auto

- **Size:** 136 kB (0.13 MB)
- **Rows:** 132 (0 dead)
- **Indexes:** 3
- **Scans:** 1850969 total
- **Classification:** ACTIVE
- **Risk:** MEDIUM
- **Notes:** Referenced in application code
- **Code References:** api/admin.js

### page_chunks

- **Size:** 104 kB (0.10 MB)
- **Rows:** 0 (0 dead)
- **Indexes:** 11
- **Scans:** 544766 total
- **Classification:** CRITICAL
- **Risk:** HIGH
- **Notes:** Core chatbot table - DO NOT DELETE
- **Code References:** api/chat.js, api/csv-import.js, api/tools.js, api/db-health.js

### series

- **Size:** 96 kB (0.09 MB)
- **Rows:** 8 (0 dead)
- **Indexes:** 5
- **Scans:** 1930 total
- **Classification:** CRITICAL
- **Risk:** HIGH
- **Notes:** Core chatbot table - DO NOT DELETE

### chat_events

- **Size:** 88 kB (0.09 MB)
- **Rows:** 32 (0 dead)
- **Indexes:** 4
- **Scans:** 5944471 total
- **Classification:** ACTIVE
- **Risk:** MEDIUM
- **Notes:** Referenced in application code
- **Code References:** api/chat.js

### product_display_price

- **Size:** 80 kB (0.08 MB)
- **Rows:** 139 (0 dead)
- **Indexes:** 2
- **Scans:** 10428475 total
- **Classification:** ACTIVE
- **Risk:** MEDIUM

### chat_feedback

- **Size:** 80 kB (0.08 MB)
- **Rows:** 1 (0 dead)
- **Indexes:** 4
- **Scans:** 343 total
- **Classification:** ACTIVE
- **Risk:** MEDIUM

### url_http_status

- **Size:** 72 kB (0.07 MB)
- **Rows:** 147 (0 dead)
- **Indexes:** 1
- **Scans:** 557 total
- **Classification:** ACTIVE
- **Risk:** MEDIUM

### content_improvement_tracking

- **Size:** 64 kB (0.06 MB)
- **Rows:** 19 (0 dead)
- **Indexes:** 3
- **Scans:** 13558 total
- **Classification:** ACTIVE
- **Risk:** MEDIUM

### content_events

- **Size:** 64 kB (0.06 MB)
- **Rows:** 5 (0 dead)
- **Indexes:** 3
- **Scans:** 1113 total
- **Classification:** ACTIVE
- **Risk:** MEDIUM

### chat_interactions

- **Size:** 64 kB (0.06 MB)
- **Rows:** 0 (0 dead)
- **Indexes:** 6
- **Scans:** 6177052 total
- **Classification:** CRITICAL
- **Risk:** HIGH
- **Notes:** Core chatbot table - DO NOT DELETE
- **Code References:** api/chat.js, api/jobs/db-maintenance.js

### chat_sessions

- **Size:** 64 kB (0.06 MB)
- **Rows:** 8 (2 dead)
- **Indexes:** 3
- **Scans:** 186503 total
- **Classification:** CRITICAL
- **Risk:** HIGH
- **Notes:** Core chatbot table - DO NOT DELETE
- **Code References:** api/chat.js, api/jobs/db-maintenance.js

### product

- **Size:** 64 kB (0.06 MB)
- **Rows:** 17 (0 dead)
- **Indexes:** 3
- **Scans:** 1903 total
- **Classification:** CRITICAL
- **Risk:** HIGH
- **Notes:** Core chatbot table - DO NOT DELETE

### tmp_priced_w

- **Size:** 64 kB (0.06 MB)
- **Rows:** 9 (0 dead)
- **Indexes:** 3
- **Scans:** 129 total
- **Classification:** CACHE
- **Risk:** LOW
- **Notes:** Temporary/cache table - can be rebuilt

### chat_analytics_daily

- **Size:** 48 kB (0.05 MB)
- **Rows:** 45 (52 dead)
- **Indexes:** 2
- **Scans:** 68261 total
- **Classification:** ACTIVE
- **Risk:** MEDIUM

### event_product_links_manual

- **Size:** 48 kB (0.05 MB)
- **Rows:** 0 (0 dead)
- **Indexes:** 5
- **Scans:** 42137 total
- **Classification:** EMPTY
- **Risk:** LOW
- **Notes:** No rows - safe to delete if unused

### product_price_overrides

- **Size:** 48 kB (0.05 MB)
- **Rows:** 1 (0 dead)
- **Indexes:** 2
- **Scans:** 780 total
- **Classification:** ACTIVE
- **Risk:** MEDIUM

### event_product_overrides

- **Size:** 48 kB (0.05 MB)
- **Rows:** 1 (0 dead)
- **Indexes:** 2
- **Scans:** 914 total
- **Classification:** ACTIVE
- **Risk:** MEDIUM

### event_product

- **Size:** 48 kB (0.05 MB)
- **Rows:** 58 (0 dead)
- **Indexes:** 2
- **Scans:** 844 total
- **Classification:** ACTIVE
- **Risk:** MEDIUM

### blog_articles

- **Size:** 40 kB (0.04 MB)
- **Rows:** 0 (0 dead)
- **Indexes:** 4
- **Scans:** 95 total
- **Classification:** EMPTY
- **Risk:** LOW
- **Notes:** No rows - safe to delete if unused

### chat_performance_metrics

- **Size:** 40 kB (0.04 MB)
- **Rows:** 0 (0 dead)
- **Indexes:** 4
- **Scans:** 97 total
- **Classification:** EMPTY
- **Risk:** LOW
- **Notes:** No rows - safe to delete if unused

### chat_question_frequency

- **Size:** 40 kB (0.04 MB)
- **Rows:** 0 (0 dead)
- **Indexes:** 4
- **Scans:** 2706572 total
- **Classification:** EMPTY
- **Risk:** LOW
- **Notes:** No rows - safe to delete if unused

### event_dates

- **Size:** 40 kB (0.04 MB)
- **Rows:** 0 (0 dead)
- **Indexes:** 4
- **Scans:** 12764 total
- **Classification:** EMPTY
- **Risk:** LOW
- **Notes:** No rows - safe to delete if unused

### course_family_product_map

- **Size:** 32 kB (0.03 MB)
- **Rows:** 3 (0 dead)
- **Indexes:** 1
- **Scans:** 2231 total
- **Classification:** ACTIVE
- **Risk:** MEDIUM

### site_urls

- **Size:** 32 kB (0.03 MB)
- **Rows:** 0 (0 dead)
- **Indexes:** 3
- **Scans:** 85 total
- **Classification:** EMPTY
- **Risk:** LOW
- **Notes:** No rows - safe to delete if unused

### job_progress

- **Size:** 32 kB (0.03 MB)
- **Rows:** 3 (26 dead)
- **Indexes:** 1
- **Scans:** 5347 total
- **Classification:** ACTIVE
- **Risk:** MEDIUM
- **Notes:** Referenced in application code
- **Code References:** api/admin.js

### category_synonym

- **Size:** 32 kB (0.03 MB)
- **Rows:** 4 (0 dead)
- **Indexes:** 1
- **Scans:** 123 total
- **Classification:** ACTIVE
- **Risk:** MEDIUM

### event_product_links

- **Size:** 32 kB (0.03 MB)
- **Rows:** 1 (0 dead)
- **Indexes:** 1
- **Scans:** 462 total
- **Classification:** ACTIVE
- **Risk:** MEDIUM

### event_product_map

- **Size:** 32 kB (0.03 MB)
- **Rows:** 2 (0 dead)
- **Indexes:** 1
- **Scans:** 125 total
- **Classification:** ACTIVE
- **Risk:** MEDIUM

### tmp_priced_c

- **Size:** 32 kB (0.03 MB)
- **Rows:** 0 (0 dead)
- **Indexes:** 3
- **Scans:** 119 total
- **Classification:** CACHE
- **Risk:** LOW
- **Notes:** Temporary/cache table - can be rebuilt

### series_product_map

- **Size:** 32 kB (0.03 MB)
- **Rows:** 1 (0 dead)
- **Indexes:** 1
- **Scans:** 220 total
- **Classification:** ACTIVE
- **Risk:** MEDIUM

### event_product_mapping_rules

- **Size:** 32 kB (0.03 MB)
- **Rows:** 34 (0 dead)
- **Indexes:** 1
- **Scans:** 114 total
- **Classification:** ACTIVE
- **Risk:** MEDIUM

### event_blacklist

- **Size:** 32 kB (0.03 MB)
- **Rows:** 2 (0 dead)
- **Indexes:** 1
- **Scans:** 364 total
- **Classification:** ACTIVE
- **Risk:** MEDIUM

### series_product_url

- **Size:** 32 kB (0.03 MB)
- **Rows:** 7 (0 dead)
- **Indexes:** 1
- **Scans:** 250 total
- **Classification:** ACTIVE
- **Risk:** MEDIUM

### location_synonym

- **Size:** 32 kB (0.03 MB)
- **Rows:** 4 (0 dead)
- **Indexes:** 1
- **Scans:** 123 total
- **Classification:** ACTIVE
- **Risk:** MEDIUM

### event_product_links_courses

- **Size:** 32 kB (0.03 MB)
- **Rows:** 1 (0 dead)
- **Indexes:** 1
- **Scans:** 247 total
- **Classification:** ACTIVE
- **Risk:** MEDIUM

### course_products

- **Size:** 32 kB (0.03 MB)
- **Rows:** 0 (0 dead)
- **Indexes:** 3
- **Scans:** 86 total
- **Classification:** EMPTY
- **Risk:** LOW
- **Notes:** No rows - safe to delete if unused

### workshop_products

- **Size:** 32 kB (0.03 MB)
- **Rows:** 0 (0 dead)
- **Indexes:** 3
- **Scans:** 86 total
- **Classification:** EMPTY
- **Risk:** LOW
- **Notes:** No rows - safe to delete if unused

### course_events_override

- **Size:** 32 kB (0.03 MB)
- **Rows:** 1 (0 dead)
- **Indexes:** 1
- **Scans:** 259 total
- **Classification:** ACTIVE
- **Risk:** MEDIUM

### course_family_series_map

- **Size:** 32 kB (0.03 MB)
- **Rows:** 3 (0 dead)
- **Indexes:** 1
- **Scans:** 559 total
- **Classification:** ACTIVE
- **Risk:** MEDIUM

### category

- **Size:** 24 kB (0.02 MB)
- **Rows:** 0 (0 dead)
- **Indexes:** 2
- **Scans:** 123 total
- **Classification:** EMPTY
- **Risk:** LOW
- **Notes:** No rows - safe to delete if unused

### product_schema

- **Size:** 24 kB (0.02 MB)
- **Rows:** 0 (0 dead)
- **Indexes:** 2
- **Scans:** 83 total
- **Classification:** EMPTY
- **Risk:** LOW
- **Notes:** No rows - safe to delete if unused

### debug_logs

- **Size:** 24 kB (0.02 MB)
- **Rows:** 0 (0 dead)
- **Indexes:** 2
- **Scans:** 259705 total
- **Classification:** EMPTY
- **Risk:** LOW
- **Notes:** No rows - safe to delete if unused

### location

- **Size:** 24 kB (0.02 MB)
- **Rows:** 0 (0 dead)
- **Indexes:** 2
- **Scans:** 123 total
- **Classification:** EMPTY
- **Risk:** LOW
- **Notes:** No rows - safe to delete if unused

### event_product_links_overrides

- **Size:** 16 kB (0.02 MB)
- **Rows:** 0 (0 dead)
- **Indexes:** 1
- **Scans:** 610732 total
- **Classification:** EMPTY
- **Risk:** LOW
- **Notes:** No rows - safe to delete if unused

### taxonomy_synonym

- **Size:** 16 kB (0.02 MB)
- **Rows:** 0 (0 dead)
- **Indexes:** 1
- **Scans:** 121 total
- **Classification:** EMPTY
- **Risk:** LOW
- **Notes:** No rows - safe to delete if unused

### _audit_baseline_counts

- **Size:** 16 kB (0.02 MB)
- **Rows:** 48 (0 dead)
- **Indexes:** 0
- **Scans:** 105 total
- **Classification:** ACTIVE
- **Risk:** MEDIUM

### mapping_audit_log

- **Size:** 16 kB (0.02 MB)
- **Rows:** 0 (0 dead)
- **Indexes:** 1
- **Scans:** 103 total
- **Classification:** EMPTY
- **Risk:** LOW
- **Notes:** No rows - safe to delete if unused

### series_category

- **Size:** 8192 bytes (0.01 MB)
- **Rows:** 0 (0 dead)
- **Indexes:** 1
- **Scans:** 121 total
- **Classification:** EMPTY
- **Risk:** LOW
- **Notes:** No rows - safe to delete if unused

### series_product

- **Size:** 8192 bytes (0.01 MB)
- **Rows:** 0 (0 dead)
- **Indexes:** 1
- **Scans:** 123 total
- **Classification:** EMPTY
- **Risk:** LOW
- **Notes:** No rows - safe to delete if unused

