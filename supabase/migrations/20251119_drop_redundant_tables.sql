-- Drop redundant tables identified by database audit
-- Generated: 2025-11-19T19:38:48.371Z
-- Total tables to drop: 20
-- Classification breakdown:
--   LEGACY: 1
--   CACHE: 2
--   EMPTY: 17

BEGIN;

-- ============================================================================
-- STEP 1: Kill all locks on redundant tables
-- ============================================================================

-- Kill all backend processes touching any of the redundant tables
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE pid <> pg_backend_pid()
  AND (
    query ILIKE '%csv_metadata_backup_2025_10_19%' OR
    query ILIKE '%tmp_priced_w%' OR
    query ILIKE '%event_product_links_manual%' OR
    query ILIKE '%blog_articles%' OR
    query ILIKE '%chat_performance_metrics%' OR
    query ILIKE '%chat_question_frequency%' OR
    query ILIKE '%event_dates%' OR
    query ILIKE '%site_urls%' OR
    query ILIKE '%tmp_priced_c%' OR
    query ILIKE '%course_products%' OR
    query ILIKE '%workshop_products%' OR
    query ILIKE '%category%' OR
    query ILIKE '%product_schema%' OR
    query ILIKE '%debug_logs%' OR
    query ILIKE '%location%' OR
    query ILIKE '%event_product_links_overrides%' OR
    query ILIKE '%taxonomy_synonym%' OR
    query ILIKE '%mapping_audit_log%' OR
    query ILIKE '%series_category%' OR
    query ILIKE '%series_product%'
  );

-- ============================================================================
-- STEP 2: Truncate tables (if they exist)
-- ============================================================================

-- Truncate csv_metadata_backup_2025_10_19 (LEGACY, 456 kB)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'csv_metadata_backup_2025_10_19') THEN
        TRUNCATE TABLE csv_metadata_backup_2025_10_19 CASCADE;
        RAISE NOTICE 'Truncated table: csv_metadata_backup_2025_10_19';
    ELSE
        RAISE NOTICE 'Table does not exist, skipping truncate: csv_metadata_backup_2025_10_19';
    END IF;
END $$;

-- Truncate tmp_priced_w (CACHE, 64 kB)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'tmp_priced_w') THEN
        TRUNCATE TABLE tmp_priced_w CASCADE;
        RAISE NOTICE 'Truncated table: tmp_priced_w';
    ELSE
        RAISE NOTICE 'Table does not exist, skipping truncate: tmp_priced_w';
    END IF;
END $$;

-- Truncate event_product_links_manual (EMPTY, 48 kB)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'event_product_links_manual') THEN
        TRUNCATE TABLE event_product_links_manual CASCADE;
        RAISE NOTICE 'Truncated table: event_product_links_manual';
    ELSE
        RAISE NOTICE 'Table does not exist, skipping truncate: event_product_links_manual';
    END IF;
END $$;

-- Truncate blog_articles (EMPTY, 40 kB)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'blog_articles') THEN
        TRUNCATE TABLE blog_articles CASCADE;
        RAISE NOTICE 'Truncated table: blog_articles';
    ELSE
        RAISE NOTICE 'Table does not exist, skipping truncate: blog_articles';
    END IF;
END $$;

-- Truncate chat_performance_metrics (EMPTY, 40 kB)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'chat_performance_metrics') THEN
        TRUNCATE TABLE chat_performance_metrics CASCADE;
        RAISE NOTICE 'Truncated table: chat_performance_metrics';
    ELSE
        RAISE NOTICE 'Table does not exist, skipping truncate: chat_performance_metrics';
    END IF;
END $$;

-- Truncate chat_question_frequency (EMPTY, 40 kB)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'chat_question_frequency') THEN
        TRUNCATE TABLE chat_question_frequency CASCADE;
        RAISE NOTICE 'Truncated table: chat_question_frequency';
    ELSE
        RAISE NOTICE 'Table does not exist, skipping truncate: chat_question_frequency';
    END IF;
END $$;

-- Truncate event_dates (EMPTY, 40 kB)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'event_dates') THEN
        TRUNCATE TABLE event_dates CASCADE;
        RAISE NOTICE 'Truncated table: event_dates';
    ELSE
        RAISE NOTICE 'Table does not exist, skipping truncate: event_dates';
    END IF;
END $$;

-- Truncate site_urls (EMPTY, 32 kB)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'site_urls') THEN
        TRUNCATE TABLE site_urls CASCADE;
        RAISE NOTICE 'Truncated table: site_urls';
    ELSE
        RAISE NOTICE 'Table does not exist, skipping truncate: site_urls';
    END IF;
END $$;

-- Truncate tmp_priced_c (CACHE, 32 kB)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'tmp_priced_c') THEN
        TRUNCATE TABLE tmp_priced_c CASCADE;
        RAISE NOTICE 'Truncated table: tmp_priced_c';
    ELSE
        RAISE NOTICE 'Table does not exist, skipping truncate: tmp_priced_c';
    END IF;
END $$;

-- Truncate course_products (EMPTY, 32 kB)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'course_products') THEN
        TRUNCATE TABLE course_products CASCADE;
        RAISE NOTICE 'Truncated table: course_products';
    ELSE
        RAISE NOTICE 'Table does not exist, skipping truncate: course_products';
    END IF;
END $$;

-- Truncate workshop_products (EMPTY, 32 kB)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'workshop_products') THEN
        TRUNCATE TABLE workshop_products CASCADE;
        RAISE NOTICE 'Truncated table: workshop_products';
    ELSE
        RAISE NOTICE 'Table does not exist, skipping truncate: workshop_products';
    END IF;
END $$;

-- Truncate category (EMPTY, 24 kB)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'category') THEN
        TRUNCATE TABLE category CASCADE;
        RAISE NOTICE 'Truncated table: category';
    ELSE
        RAISE NOTICE 'Table does not exist, skipping truncate: category';
    END IF;
END $$;

-- Truncate product_schema (EMPTY, 24 kB)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'product_schema') THEN
        TRUNCATE TABLE product_schema CASCADE;
        RAISE NOTICE 'Truncated table: product_schema';
    ELSE
        RAISE NOTICE 'Table does not exist, skipping truncate: product_schema';
    END IF;
END $$;

-- Truncate debug_logs (EMPTY, 24 kB)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'debug_logs') THEN
        TRUNCATE TABLE debug_logs CASCADE;
        RAISE NOTICE 'Truncated table: debug_logs';
    ELSE
        RAISE NOTICE 'Table does not exist, skipping truncate: debug_logs';
    END IF;
END $$;

-- Truncate location (EMPTY, 24 kB)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'location') THEN
        TRUNCATE TABLE location CASCADE;
        RAISE NOTICE 'Truncated table: location';
    ELSE
        RAISE NOTICE 'Table does not exist, skipping truncate: location';
    END IF;
END $$;

-- Truncate event_product_links_overrides (EMPTY, 16 kB)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'event_product_links_overrides') THEN
        TRUNCATE TABLE event_product_links_overrides CASCADE;
        RAISE NOTICE 'Truncated table: event_product_links_overrides';
    ELSE
        RAISE NOTICE 'Table does not exist, skipping truncate: event_product_links_overrides';
    END IF;
END $$;

-- Truncate taxonomy_synonym (EMPTY, 16 kB)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'taxonomy_synonym') THEN
        TRUNCATE TABLE taxonomy_synonym CASCADE;
        RAISE NOTICE 'Truncated table: taxonomy_synonym';
    ELSE
        RAISE NOTICE 'Table does not exist, skipping truncate: taxonomy_synonym';
    END IF;
END $$;

-- Truncate mapping_audit_log (EMPTY, 16 kB)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'mapping_audit_log') THEN
        TRUNCATE TABLE mapping_audit_log CASCADE;
        RAISE NOTICE 'Truncated table: mapping_audit_log';
    ELSE
        RAISE NOTICE 'Table does not exist, skipping truncate: mapping_audit_log';
    END IF;
END $$;

-- Truncate series_category (EMPTY, 8192 bytes)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'series_category') THEN
        TRUNCATE TABLE series_category CASCADE;
        RAISE NOTICE 'Truncated table: series_category';
    ELSE
        RAISE NOTICE 'Table does not exist, skipping truncate: series_category';
    END IF;
END $$;

-- Truncate series_product (EMPTY, 8192 bytes)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'series_product') THEN
        TRUNCATE TABLE series_product CASCADE;
        RAISE NOTICE 'Truncated table: series_product';
    ELSE
        RAISE NOTICE 'Table does not exist, skipping truncate: series_product';
    END IF;
END $$;

-- ============================================================================
-- STEP 3: Drop tables with CASCADE (if they exist)
-- ============================================================================

-- Drop csv_metadata_backup_2025_10_19 (LEGACY, 456 kB)
DROP TABLE IF EXISTS csv_metadata_backup_2025_10_19 CASCADE;

-- Drop tmp_priced_w (CACHE, 64 kB)
DROP TABLE IF EXISTS tmp_priced_w CASCADE;

-- Drop event_product_links_manual (EMPTY, 48 kB)
DROP TABLE IF EXISTS event_product_links_manual CASCADE;

-- Drop blog_articles (EMPTY, 40 kB)
DROP TABLE IF EXISTS blog_articles CASCADE;

-- Drop chat_performance_metrics (EMPTY, 40 kB)
DROP TABLE IF EXISTS chat_performance_metrics CASCADE;

-- Drop chat_question_frequency (EMPTY, 40 kB)
DROP TABLE IF EXISTS chat_question_frequency CASCADE;

-- Drop event_dates (EMPTY, 40 kB)
DROP TABLE IF EXISTS event_dates CASCADE;

-- Drop site_urls (EMPTY, 32 kB)
DROP TABLE IF EXISTS site_urls CASCADE;

-- Drop tmp_priced_c (CACHE, 32 kB)
DROP TABLE IF EXISTS tmp_priced_c CASCADE;

-- Drop course_products (EMPTY, 32 kB)
DROP TABLE IF EXISTS course_products CASCADE;

-- Drop workshop_products (EMPTY, 32 kB)
DROP TABLE IF EXISTS workshop_products CASCADE;

-- Drop category (EMPTY, 24 kB)
DROP TABLE IF EXISTS category CASCADE;

-- Drop product_schema (EMPTY, 24 kB)
DROP TABLE IF EXISTS product_schema CASCADE;

-- Drop debug_logs (EMPTY, 24 kB)
DROP TABLE IF EXISTS debug_logs CASCADE;

-- Drop location (EMPTY, 24 kB)
DROP TABLE IF EXISTS location CASCADE;

-- Drop event_product_links_overrides (EMPTY, 16 kB)
DROP TABLE IF EXISTS event_product_links_overrides CASCADE;

-- Drop taxonomy_synonym (EMPTY, 16 kB)
DROP TABLE IF EXISTS taxonomy_synonym CASCADE;

-- Drop mapping_audit_log (EMPTY, 16 kB)
DROP TABLE IF EXISTS mapping_audit_log CASCADE;

-- Drop series_category (EMPTY, 8192 bytes)
DROP TABLE IF EXISTS series_category CASCADE;

-- Drop series_product (EMPTY, 8192 bytes)
DROP TABLE IF EXISTS series_product CASCADE;

-- ============================================================================
-- STEP 4: Verify table removal
-- ============================================================================

-- Verify all redundant tables have been removed
SELECT 
    tablename,
    to_regclass('public.' || tablename) AS still_exists
FROM (
    VALUES
    ('csv_metadata_backup_2025_10_19'),
    ('tmp_priced_w'),
    ('event_product_links_manual'),
    ('blog_articles'),
    ('chat_performance_metrics'),
    ('chat_question_frequency'),
    ('event_dates'),
    ('site_urls'),
    ('tmp_priced_c'),
    ('course_products'),
    ('workshop_products'),
    ('category'),
    ('product_schema'),
    ('debug_logs'),
    ('location'),
    ('event_product_links_overrides'),
    ('taxonomy_synonym'),
    ('mapping_audit_log'),
    ('series_category'),
    ('series_product')
) AS t(tablename)
WHERE to_regclass('public.' || tablename) IS NOT NULL
ORDER BY tablename;

COMMIT;
