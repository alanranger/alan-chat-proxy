------------------------------------
-- Force drop locked table

BEGIN;

-- Kill all backends touching the table
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE pid <> pg_backend_pid()
  AND query ILIKE '%regression_test_runs%';

-- Drop table SAFELY
DROP TABLE IF EXISTS regression_test_runs CASCADE;

COMMIT;

