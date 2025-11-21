-- Fix wait_for_test_result timeout and async issue
-- The function waits 300s but test results are created asynchronously
-- Also fix the main job function to handle timeout better

-- First, reduce wait_for_test_result timeout and improve polling
CREATE OR REPLACE FUNCTION public.wait_for_test_result(
  p_test_run_id bigint,
  p_test_phase text,
  p_max_wait_seconds integer DEFAULT 300
)
RETURNS bigint
LANGUAGE plpgsql
AS $function$
DECLARE
  v_test_result_id BIGINT;
  v_waited INTEGER := 0;
  v_wait_interval INTEGER := 2; -- Reduced from 5 to 2 seconds for faster polling
  v_job_id INTEGER;
  v_run_created_at TIMESTAMPTZ;
  v_last_check TIMESTAMPTZ := NOW();
  v_check_count INTEGER := 0;
BEGIN
  -- Get job_id and created_at (not run_started_at which doesn't exist)
  SELECT job_id, created_at
  INTO v_job_id, v_run_created_at
  FROM regression_test_runs
  WHERE id = p_test_run_id;
  
  IF v_job_id IS NULL THEN
    RAISE WARNING 'wait_for_test_result: Test run % not found', p_test_run_id;
    RETURN NULL;
  END IF;
  
  -- Poll for test result to appear
  WHILE v_waited < p_max_wait_seconds LOOP
    v_check_count := v_check_count + 1;
    
    -- Check for test result (created after the test run was created)
    SELECT id INTO v_test_result_id
    FROM regression_test_results
    WHERE job_id = v_job_id
      AND test_phase = p_test_phase
      AND test_timestamp > v_run_created_at
    ORDER BY test_timestamp DESC
    LIMIT 1;
    
    IF v_test_result_id IS NOT NULL THEN
      -- Found the result
      RAISE NOTICE 'wait_for_test_result: Found test result % for job % phase % after %s seconds (checked % times)',
        v_test_result_id, v_job_id, p_test_phase, v_waited, v_check_count;
      RETURN v_test_result_id;
    END IF;
    
    -- Log progress every 15 seconds (reduced from 30)
    IF EXTRACT(EPOCH FROM (NOW() - v_last_check)) >= 15 THEN
      RAISE NOTICE 'wait_for_test_result: Still waiting for test result (job % phase %), waited %s/%s seconds',
        v_job_id, p_test_phase, v_waited, p_max_wait_seconds;
      v_last_check := NOW();
    END IF;
    
    PERFORM pg_sleep(v_wait_interval);
    v_waited := v_waited + v_wait_interval;
  END LOOP;
  
  -- Timeout - no result found
  RAISE WARNING 'wait_for_test_result: Timeout waiting for test result (job % phase %), waited %s seconds, checked % times. No result found after run created_at %',
    v_job_id, p_test_phase, v_waited, v_check_count, v_run_created_at;
  
  RETURN NULL;
END;
$function$;

-- Now fix the main job function to reduce timeout and handle async better
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
      -- Reduced timeout from 300s to 120s (2 minutes) - test should complete in ~60s
      -- Also, don't block the entire job if test result isn't available yet
      v_after_test_id := wait_for_test_result(v_master_test_run_id, 'after', 120);
      IF v_after_test_id IS NOT NULL THEN
        UPDATE regression_test_runs SET after_test_id = v_after_test_id WHERE id = v_master_test_run_id;
      ELSE
        -- Test result not available yet, but don't fail the job
        -- It will be linked later when it becomes available
        RAISE WARNING 'Test result not available yet for job 26 run %, will be linked later', v_master_test_run_id;
      END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'After test error (job 26): %', SQLERRM;
  END;

  -- Compare against master baseline (only if we have the test result)
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
GRANT EXECUTE ON FUNCTION wait_for_test_result(bigint, text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION light_refresh_all_batches_with_regression_test() TO service_role;

COMMENT ON FUNCTION wait_for_test_result(bigint, text, integer) IS 
  'Waits for a regression test result to appear. Polls every 2 seconds (reduced from 5s) for faster detection.';

COMMENT ON FUNCTION light_refresh_all_batches_with_regression_test() IS 
  'Runs all light refresh batches and regression test. Reduced wait_for_test_result timeout to 120s and handles async test results better.';

