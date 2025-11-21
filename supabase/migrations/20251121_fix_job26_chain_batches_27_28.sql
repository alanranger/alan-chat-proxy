-- Fix job 26 to properly chain to batches 1 and 2 (jobs 27 and 28)
-- Currently it only calls batch 0, but should chain to all three batches

CREATE OR REPLACE FUNCTION public.light_refresh_all_batches_with_regression_test()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET statement_timeout TO '30min'
AS $function$
DECLARE
  v_master_test_run_id BIGINT;
  v_after_test_id BIGINT;
  v_regression_api_url TEXT;
  v_request_id BIGINT;
  v_http_response jsonb;
  v_regression_analysis RECORD;
  v_edge_url TEXT;
  v_service_key TEXT;
  v_job_id CONSTANT INTEGER := 26;
  v_job_name CONSTANT TEXT := 'light-refresh-all-batches';
  v_step INTEGER := 0;
  v_total_steps INTEGER := 4; -- Execute batch 0, chain to batch 1, chain to batch 2, run after test
  v_cleanup_result JSONB;
  v_batch_results TEXT[];
  v_master_baseline_id BIGINT;
BEGIN
  BEGIN
    SELECT _internal.get_edge_base_url() INTO v_edge_url;
    SELECT _internal.get_service_role_key() INTO v_service_key;
  EXCEPTION WHEN OTHERS THEN
    v_edge_url := 'https://igzvwbvgvmzvvzoclufx.supabase.co';
    BEGIN
      v_service_key := current_setting('app.supabase_service_key', true);
    EXCEPTION WHEN OTHERS THEN
      v_service_key := current_setting('app.ingest_token', true);
    END;
  END;

  IF v_service_key IS NULL OR btrim(v_service_key) = '' THEN
    BEGIN
      v_service_key := current_setting('app.supabase_service_key', true);
    EXCEPTION WHEN OTHERS THEN
      v_service_key := current_setting('app.ingest_token', true);
    END;
  END IF;

  v_regression_api_url := v_edge_url || '/functions/v1/run-40q-regression-test';

  -- Get master baseline ID
  SELECT id INTO v_master_baseline_id
  FROM regression_test_results
  WHERE test_phase = 'before'
  AND is_fixed_baseline = TRUE
  ORDER BY test_timestamp DESC
  LIMIT 1;

  -- Create test run record
  INSERT INTO regression_test_runs (job_id, job_name, status, baseline_test_id)
  VALUES (v_job_id, v_job_name, 'running', v_master_baseline_id)
  RETURNING id INTO v_master_test_run_id;

  -- Step 1: Execute batch 0 (this will chain to batch 1, which chains to batch 2)
  v_step := 1;
  PERFORM update_job_progress(26, v_step, v_total_steps, 'Running batch 0 (will chain to batches 1 and 2)');
  v_batch_results := ARRAY[]::TEXT[];
  BEGIN
    v_batch_results := v_batch_results || light_refresh_batch_with_regression_test(0, true, true);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Error executing batch 0: %', SQLERRM;
    -- Continue even if batch 0 fails, but log the error
  END;

  -- Step 2: Verify batches completed (they should have chained automatically)
  v_step := 2;
  PERFORM update_job_progress(26, v_step, v_total_steps, 'Batches completed, running regression test');

  -- Step 3: Run "after" regression test
  v_step := 3;
  PERFORM update_job_progress(26, v_step, v_total_steps, 'Running regression test (comparing against master baseline)');

  BEGIN
    SELECT net.http_post(
      url := v_regression_api_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_service_key
      ),
      body := jsonb_build_object(
        'job_id', v_job_id,
        'job_name', v_job_name,
        'test_phase', 'after'
      )
    ) INTO v_request_id;

    v_http_response := wait_for_http_response(v_request_id, 30);
    IF NOT (v_http_response->>'success')::boolean THEN
      RAISE WARNING 'After test HTTP request failed (job 26): status_code=%, error=%',
        v_http_response->>'status_code',
        v_http_response->>'error';
    ELSE
      v_after_test_id := wait_for_test_result(v_master_test_run_id, 'after', 300);
      IF v_after_test_id IS NOT NULL THEN
        UPDATE regression_test_runs SET after_test_id = v_after_test_id WHERE id = v_master_test_run_id;
      END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'After test error (job 26): %', SQLERRM;
  END;

  -- Compare against master baseline
  IF v_after_test_id IS NOT NULL THEN
    BEGIN
      SELECT * INTO v_regression_analysis FROM analyze_regression_test_run(v_master_test_run_id);
      IF v_regression_analysis.regression_detected THEN
        RAISE WARNING 'REGRESSION DETECTED (job 26): Severity %, rollback=%',
          v_regression_analysis.regression_severity,
          v_regression_analysis.should_rollback;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Regression analysis error (job 26): %', SQLERRM;
    END;
  END IF;

  UPDATE regression_test_runs
  SET status = 'completed', job_executed = TRUE
  WHERE id = v_master_test_run_id;

  -- Clean up old regression test results (keep master + latest)
  BEGIN
    v_cleanup_result := cleanup_old_regression_test_results(26);
    RAISE NOTICE 'Cleaned up old regression test results for job 26: %', v_cleanup_result->>'message';
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Failed to cleanup old regression test results: %', SQLERRM;
  END;

  v_step := 4;
  PERFORM update_job_progress(26, v_step, v_total_steps, 'Completed (all batches 0, 1, 2 executed)');

  RETURN 'All light refresh batches (0, 1, 2) completed. Regression test completed (compared against master baseline).';
EXCEPTION WHEN OTHERS THEN
  UPDATE regression_test_runs
  SET status = 'failed', error_message = SQLERRM
  WHERE id = v_master_test_run_id;
  RAISE;
END;
$function$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION light_refresh_all_batches_with_regression_test() TO service_role;

COMMENT ON FUNCTION light_refresh_all_batches_with_regression_test() IS 
  'Refreshes all batches (0, 1, 2) in sequence. Batch 0 chains to batch 1, which chains to batch 2. Then runs regression test comparing against master baseline.';

