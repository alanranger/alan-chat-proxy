-- Update cleanup function to work with master baseline system
-- Since we have ONE master baseline for ALL jobs, we should:
-- 1. Keep the master baseline (only one, not per-job)
-- 2. Keep only the latest 'after' test per job (no 'before' tests needed)

CREATE OR REPLACE FUNCTION cleanup_old_regression_test_results(
  p_job_id INTEGER
)
RETURNS JSONB AS $$
DECLARE
  v_deleted_count INTEGER := 0;
  v_kept_count INTEGER := 0;
  v_master_baseline_id BIGINT;
  v_latest_after_id BIGINT;
  v_result JSONB;
BEGIN
  -- Get the master baseline ID (shared across all jobs, not per-job)
  SELECT id INTO v_master_baseline_id
  FROM regression_test_results
  WHERE test_phase = 'before'
  AND is_fixed_baseline = TRUE
  ORDER BY test_timestamp DESC
  LIMIT 1;

  -- Get the latest 'after' test result for this job
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
    -- Keep master baseline if it belongs to this job
    (id = COALESCE(v_master_baseline_id, -1) AND job_id = p_job_id)
    -- Keep latest after test for this job
    OR id = COALESCE(v_latest_after_id, -1)
  );

  -- Delete all other test results for this job
  -- This includes: all old 'before' tests, all old 'after' tests (except latest)
  DELETE FROM regression_test_results
  WHERE job_id = p_job_id
  AND id != COALESCE(v_master_baseline_id, -1)  -- Keep master baseline
  AND id != COALESCE(v_latest_after_id, -1);    -- Keep latest after test

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  -- Build result
  v_result := jsonb_build_object(
    'ok', true,
    'job_id', p_job_id,
    'deleted_count', v_deleted_count,
    'kept_count', v_kept_count,
    'master_baseline_id', v_master_baseline_id,
    'latest_after_id', v_latest_after_id,
    'message', format('Cleaned up %s old test results, kept %s (master baseline + latest after test)', 
                      v_deleted_count, v_kept_count)
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update the cleanup all function to also handle master baseline correctly
CREATE OR REPLACE FUNCTION cleanup_all_old_regression_test_results()
RETURNS JSONB AS $$
DECLARE
  v_job_id INTEGER;
  v_job_cleanup JSONB;
  v_total_deleted INTEGER := 0;
  v_total_kept INTEGER := 0;
  v_results JSONB[] := ARRAY[]::JSONB[];
  v_master_baseline_id BIGINT;
BEGIN
  -- Get master baseline ID
  SELECT id INTO v_master_baseline_id
  FROM regression_test_results
  WHERE test_phase = 'before'
  AND is_fixed_baseline = TRUE
  ORDER BY test_timestamp DESC
  LIMIT 1;

  -- Loop through all jobs that have regression test results
  FOR v_job_id IN 
    SELECT DISTINCT job_id
    FROM regression_test_results
    ORDER BY job_id
  LOOP
    v_job_cleanup := cleanup_old_regression_test_results(v_job_id);
    v_total_deleted := v_total_deleted + (v_job_cleanup->>'deleted_count')::INTEGER;
    v_total_kept := v_total_kept + (v_job_cleanup->>'kept_count')::INTEGER;
    v_results := v_results || v_job_cleanup;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'total_deleted', v_total_deleted,
    'total_kept', v_total_kept,
    'master_baseline_id', v_master_baseline_id,
    'job_results', v_results,
    'message', format('Cleaned up %s old test results across all jobs, kept %s (1 master baseline + latest after test per job)', 
                      v_total_deleted, v_total_kept)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION cleanup_old_regression_test_results(INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION cleanup_all_old_regression_test_results() TO service_role;

-- Comments
COMMENT ON FUNCTION cleanup_old_regression_test_results(INTEGER) IS 
  'Cleans up old regression test results for a job. Keeps: 1) Master baseline (if belongs to this job), 2) Latest after test. Deletes all old before tests and old after tests.';

COMMENT ON FUNCTION cleanup_all_old_regression_test_results() IS 
  'Cleans up old regression test results for all jobs. Keeps: 1) Master baseline (one total), 2) Latest after test per job.';

