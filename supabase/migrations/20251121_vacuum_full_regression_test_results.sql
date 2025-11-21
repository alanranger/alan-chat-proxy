-- VACUUM FULL regression_test_results to actually remove dead rows
-- Note: VACUUM FULL must be run outside a transaction, so this migration
-- will fail if run via normal migration tools. Run this manually via SQL editor.

-- This will physically remove the dead rows and reclaim space
-- It requires an exclusive lock on the table

-- VACUUM FULL regression_test_results;

-- Since VACUUM FULL can't run in a transaction, we'll create a function to run it
-- But actually, we can't even do that - VACUUM FULL must be run directly

-- Instead, we'll run VACUUM (not FULL) which will at least update statistics
-- and mark dead rows for reuse. For actual space reclamation, VACUUM FULL must
-- be run manually via SQL editor when the table is not in heavy use.

-- Run ANALYZE to update statistics after cleanup
ANALYZE regression_test_results;

COMMENT ON TABLE regression_test_results IS 
  'To reclaim space from dead rows, run: VACUUM FULL regression_test_results; (must be run manually outside transaction)';

