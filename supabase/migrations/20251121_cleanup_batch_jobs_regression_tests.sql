-- Clean up regression test results for batch jobs (26, 27, 28)
-- Since these jobs now run as a single combined job (26 handles all batches),
-- we should only keep:
-- 1. The master baseline (if it exists for any of these jobs)
-- 2. The latest 'after' test result for job 26 (which represents the complete refresh)

-- First, let's see what we have
DO $$
DECLARE
  v_master_baseline_id BIGINT;
  v_latest_job26_after_id BIGINT;
  v_deleted_count INTEGER;
BEGIN
  -- Find the master baseline (should be global, but check if it's for job 26, 27, or 28)
  SELECT id INTO v_master_baseline_id
  FROM regression_test_results
  WHERE is_fixed_baseline = TRUE
  ORDER BY test_timestamp DESC
  LIMIT 1;
  
  -- Find the latest 'after' test result for job 26
  SELECT id INTO v_latest_job26_after_id
  FROM regression_test_results
  WHERE job_id = 26
    AND test_phase = 'after'
  ORDER BY test_timestamp DESC
  LIMIT 1;
  
  RAISE NOTICE 'Master baseline ID: %', v_master_baseline_id;
  RAISE NOTICE 'Latest job 26 after test ID: %', v_latest_job26_after_id;
  
  -- Delete all regression test results for jobs 26, 27, 28 EXCEPT:
  -- 1. The master baseline (if it's for one of these jobs)
  -- 2. The latest 'after' test for job 26
  DELETE FROM regression_test_results
  WHERE job_id IN (26, 27, 28)
    AND id != COALESCE(v_master_baseline_id, -1)  -- Keep master baseline
    AND id != COALESCE(v_latest_job26_after_id, -1);  -- Keep latest job 26 after test
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % regression test results for jobs 26, 27, 28', v_deleted_count;
  
  -- Also clean up regression_test_runs for jobs 27 and 28 (keep only job 26 runs)
  DELETE FROM regression_test_runs
  WHERE job_id IN (27, 28);
  
  RAISE NOTICE 'Cleaned up regression_test_runs for jobs 27 and 28';
END $$;

-- Note: VACUUM FULL was run separately after this migration
-- The cleanup function (cleanup_old_regression_test_results) will now properly
-- keep only the master baseline + latest after test for job 26 going forward

