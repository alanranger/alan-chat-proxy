-- Kill any connections holding locks on the table
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE pid <> pg_backend_pid()
  AND query ILIKE '%regression_test_results%';

-- Truncate first (faster release of locks if needed)
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'regression_test_results') THEN
    TRUNCATE TABLE regression_test_results;
  END IF;
END $$;

-- Drop with cascade
DROP TABLE IF EXISTS regression_test_results CASCADE;

-- Verify removal
SELECT to_regclass('public.regression_test_results') AS table_exists;

