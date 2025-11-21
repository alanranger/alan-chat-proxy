-- Cleanup old regression test results
-- Keep only: 1) Master fixed baseline (is_fixed_baseline = TRUE) 2) Latest test result per job
-- This prevents database bloat from jobs running frequently

-- Ensure is_fixed_baseline column exists (in case migration wasn't applied)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'regression_test_results' 
    AND column_name = 'is_fixed_baseline'
  ) THEN
    ALTER TABLE regression_test_results
      ADD COLUMN is_fixed_baseline BOOLEAN NOT NULL DEFAULT FALSE;
    
    CREATE INDEX IF NOT EXISTS idx_regression_test_results_fixed_baseline 
      ON regression_test_results(job_id, is_fixed_baseline) 
      WHERE is_fixed_baseline = TRUE;
    
    CREATE UNIQUE INDEX IF NOT EXISTS idx_regression_test_results_one_fixed_per_job
      ON regression_test_results(job_id)
      WHERE is_fixed_baseline = TRUE AND test_phase = 'before';
  END IF;
END $$;

-- Function to clean up old regression test results for a specific job
-- Keeps: 1) Fixed baseline (is_fixed_baseline = TRUE) 2) Latest test result per phase
CREATE OR REPLACE FUNCTION cleanup_old_regression_test_results(
  p_job_id INTEGER
)
RETURNS JSONB AS $$
DECLARE
  v_deleted_count INTEGER := 0;
  v_kept_count INTEGER := 0;
  v_fixed_baseline_id BIGINT;
  v_latest_before_id BIGINT;
  v_latest_after_id BIGINT;
  v_result JSONB;
BEGIN
  -- Get the fixed baseline ID (if exists) - NEVER DELETE THIS
  SELECT id INTO v_fixed_baseline_id
  FROM regression_test_results
  WHERE job_id = p_job_id
    AND is_fixed_baseline = TRUE
    AND test_phase = 'before'
  LIMIT 1;

  -- Get the latest 'before' test result (if not the fixed baseline)
  SELECT id INTO v_latest_before_id
  FROM regression_test_results
  WHERE job_id = p_job_id
    AND test_phase = 'before'
    AND (v_fixed_baseline_id IS NULL OR id != v_fixed_baseline_id)
  ORDER BY test_timestamp DESC
  LIMIT 1;

  -- Get the latest 'after' test result
  SELECT id INTO v_latest_after_id
  FROM regression_test_results
  WHERE job_id = p_job_id
    AND test_phase = 'after'
  ORDER BY test_timestamp DESC
  LIMIT 1;

  -- Count what we're keeping
  SELECT COUNT(*) INTO v_kept_count
  FROM regression_test_results
  WHERE job_id = p_job_id
    AND (
      id = COALESCE(v_fixed_baseline_id, -1)
      OR id = COALESCE(v_latest_before_id, -1)
      OR id = COALESCE(v_latest_after_id, -1)
    );

  -- Delete all other test results for this job (except the ones we're keeping)
  DELETE FROM regression_test_results
  WHERE job_id = p_job_id
    AND id != COALESCE(v_fixed_baseline_id, -1)
    AND id != COALESCE(v_latest_before_id, -1)
    AND id != COALESCE(v_latest_after_id, -1);

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  -- Build result
  v_result := jsonb_build_object(
    'ok', true,
    'job_id', p_job_id,
    'deleted_count', v_deleted_count,
    'kept_count', v_kept_count,
    'fixed_baseline_id', v_fixed_baseline_id,
    'latest_before_id', v_latest_before_id,
    'latest_after_id', v_latest_after_id,
    'message', format('Cleaned up %s old test results, kept %s (including fixed baseline if exists)', 
                      v_deleted_count, v_kept_count)
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clean up old regression test results for all jobs
CREATE OR REPLACE FUNCTION cleanup_all_old_regression_test_results()
RETURNS JSONB AS $$
DECLARE
  v_job_id INTEGER;
  v_total_deleted INTEGER := 0;
  v_job_results JSONB := '[]'::jsonb;
  v_result JSONB;
  v_job_cleanup JSONB;
BEGIN
  -- Loop through all jobs that have regression test results
  FOR v_job_id IN 
    SELECT DISTINCT job_id 
    FROM regression_test_results
    ORDER BY job_id
  LOOP
    -- Clean up each job
    v_job_cleanup := cleanup_old_regression_test_results(v_job_id);
    v_total_deleted := v_total_deleted + (v_job_cleanup->>'deleted_count')::INTEGER;
    v_job_results := v_job_results || jsonb_build_array(v_job_cleanup);
  END LOOP;

  v_result := jsonb_build_object(
    'ok', true,
    'total_deleted', v_total_deleted,
    'jobs_processed', jsonb_array_length(v_job_results),
    'job_results', v_job_results,
    'message', format('Cleaned up %s total old test results across %s jobs', 
                      v_total_deleted, jsonb_array_length(v_job_results))
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION cleanup_old_regression_test_results(INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION cleanup_all_old_regression_test_results() TO service_role;

-- Function to run VACUUM FULL on regression_test_results table
-- This reclaims disk space after cleanup. Note: VACUUM FULL requires exclusive lock.
CREATE OR REPLACE FUNCTION vacuum_full_regression_test_results()
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
  v_size_before BIGINT;
  v_size_after BIGINT;
BEGIN
  -- Get size before VACUUM
  SELECT pg_total_relation_size('regression_test_results') INTO v_size_before;

  -- Run VACUUM FULL (requires exclusive lock, may block)
  -- Note: This cannot be run inside a transaction, so it's a separate function
  EXECUTE 'VACUUM FULL regression_test_results';

  -- Get size after VACUUM
  SELECT pg_total_relation_size('regression_test_results') INTO v_size_after;

  v_result := jsonb_build_object(
    'ok', true,
    'size_before_bytes', v_size_before,
    'size_after_bytes', v_size_after,
    'size_freed_bytes', GREATEST(0, v_size_before - v_size_after),
    'size_before', pg_size_pretty(v_size_before),
    'size_after', pg_size_pretty(v_size_after),
    'size_freed', pg_size_pretty(GREATEST(0, v_size_before - v_size_after)),
    'message', format('VACUUM FULL completed. Freed %s', pg_size_pretty(GREATEST(0, v_size_before - v_size_after)))
  );

  RETURN v_result;
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'ok', false,
    'error', SQLERRM,
    'message', 'VACUUM FULL failed: ' || SQLERRM
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION vacuum_full_regression_test_results() TO service_role;

-- Comment on functions
COMMENT ON FUNCTION cleanup_old_regression_test_results(INTEGER) IS 
  'Cleans up old regression test results for a job. Keeps: 1) Fixed baseline (is_fixed_baseline = TRUE), 2) Latest test result per phase. Never deletes the fixed baseline.';

COMMENT ON FUNCTION cleanup_all_old_regression_test_results() IS 
  'Cleans up old regression test results for all jobs. Keeps: 1) Fixed baseline per job, 2) Latest test result per phase per job.';

COMMENT ON FUNCTION vacuum_full_regression_test_results() IS 
  'Runs VACUUM FULL on regression_test_results table to reclaim disk space. Requires exclusive lock and may block other operations. Should be run during low-traffic periods.';

