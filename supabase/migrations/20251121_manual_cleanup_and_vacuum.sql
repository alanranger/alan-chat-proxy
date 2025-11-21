-- Manual cleanup script to run after migrations
-- This can be called directly to clean up existing data and reclaim space
-- 
-- Usage:
-- 1. Run cleanup: SELECT cleanup_all_old_regression_test_results();
-- 2. Run VACUUM FULL (requires no active transactions): SELECT vacuum_full_regression_test_results();
--
-- Note: VACUUM FULL requires an exclusive lock and cannot run inside a transaction.
-- It should be run during low-traffic periods or scheduled as a separate job.

-- This migration file is for documentation - the actual functions are in 20251121_cleanup_regression_test_results.sql

