-- Update all regression test job functions to skip "before" test
-- Since we have a master baseline, jobs should:
-- 1. Execute the job
-- 2. Run "after" regression test
-- 3. Compare against master baseline (handled by analyze_regression_test_run)

-- Update refresh_v_products_unified_with_regression_test (job 21)
CREATE OR REPLACE FUNCTION public.refresh_v_products_unified_with_regression_test()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET statement_timeout TO '20min'
AS $function$
DECLARE
  v_test_run_id BIGINT;
  v_after_test_id BIGINT;
  v_regression_api_url TEXT;
  v_request_id BIGINT;
  v_http_response jsonb;
  v_regression_analysis RECORD;
  v_edge_url TEXT;
  v_service_key TEXT;
  v_job_id CONSTANT INTEGER := 21;
  v_job_name CONSTANT TEXT := 'refresh-product-pricing-hourly';
  v_step INTEGER := 0;
  v_total_steps INTEGER := 2; -- Reduced from 3 (no before test)
  v_cleanup_result JSONB;
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

  -- Get master baseline ID (for reference, comparison happens in analyze_regression_test_run)
  SELECT id INTO v_master_baseline_id
  FROM regression_test_results
  WHERE test_phase = 'before'
  AND is_fixed_baseline = TRUE
  ORDER BY test_timestamp DESC
  LIMIT 1;

  -- Create test run record (baseline_test_id will be set by analyze_regression_test_run to master baseline)
  INSERT INTO regression_test_runs (job_id, job_name, status, baseline_test_id)
  VALUES (v_job_id, v_job_name, 'running', v_master_baseline_id)
  RETURNING id INTO v_test_run_id;

  -- Step 1: Execute the job
  v_step := 1;
  PERFORM update_job_progress(v_job_id, v_step, v_total_steps, 'Refreshing unified product catalog');
  PERFORM refresh_v_products_unified();
  PERFORM upsert_display_price_all();

  -- Step 2: Run "after" regression test
  v_step := 2;
  PERFORM update_job_progress(v_job_id, v_step, v_total_steps, 'Running regression test (comparing against master baseline)');

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
      RAISE WARNING 'After test HTTP request failed (job 21): status_code=%, error=%',
        v_http_response->>'status_code',
        v_http_response->>'error';
    ELSE
      v_after_test_id := wait_for_test_result(v_test_run_id, 'after', 300);
      IF v_after_test_id IS NOT NULL THEN
        UPDATE regression_test_runs SET after_test_id = v_after_test_id WHERE id = v_test_run_id;
      END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'After test error (job 21): %', SQLERRM;
  END;

  -- Compare against master baseline (analyze_regression_test_run uses master baseline automatically)
  IF v_after_test_id IS NOT NULL THEN
    BEGIN
      SELECT * INTO v_regression_analysis FROM analyze_regression_test_run(v_test_run_id);
      IF v_regression_analysis.regression_detected THEN
        RAISE WARNING 'REGRESSION DETECTED (job 21): Severity %, rollback=%',
          v_regression_analysis.regression_severity,
          v_regression_analysis.should_rollback;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Regression analysis error (job 21): %', SQLERRM;
    END;
  END IF;

  UPDATE regression_test_runs
  SET status = 'completed', job_executed = TRUE
  WHERE id = v_test_run_id;

  -- Clean up old regression test results (keep master + latest)
  BEGIN
    v_cleanup_result := cleanup_old_regression_test_results(v_job_id);
    RAISE NOTICE 'Cleaned up old regression test results for job %: %', v_job_id, v_cleanup_result->>'message';
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Failed to cleanup old regression test results: %', SQLERRM;
  END;

  PERFORM update_job_progress(v_job_id, v_total_steps, v_total_steps, 'Completed');

  RETURN 'Product pricing refreshed. Regression test completed (compared against master baseline).';
EXCEPTION WHEN OTHERS THEN
  UPDATE regression_test_runs
  SET status = 'failed', error_message = SQLERRM
  WHERE id = v_test_run_id;
  RAISE;
END;
$function$;

-- Update cleanup_orphaned_records_with_regression_test (job 31)
CREATE OR REPLACE FUNCTION public.cleanup_orphaned_records_with_regression_test()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET statement_timeout TO '20min'
AS $function$
DECLARE
  v_test_run_id BIGINT;
  v_after_test_id BIGINT;
  v_regression_api_url TEXT;
  v_request_id BIGINT;
  v_http_response jsonb;
  v_regression_analysis RECORD;
  v_edge_url TEXT;
  v_service_key TEXT;
  v_job_id CONSTANT INTEGER := 31;
  v_job_name CONSTANT TEXT := 'cleanup-orphaned-records';
  v_step INTEGER := 0;
  v_total_steps INTEGER := 2; -- Reduced from 3 (no before test)
  v_cleanup_test_result JSONB;
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
  RETURNING id INTO v_test_run_id;

  -- Step 1: Execute the job
  v_step := 1;
  PERFORM update_job_progress(v_job_id, v_step, v_total_steps, 'Cleaning up orphaned records');
  PERFORM cleanup_orphaned_records();

  -- Step 2: Run "after" regression test
  v_step := 2;
  PERFORM update_job_progress(v_job_id, v_step, v_total_steps, 'Running regression test (comparing against master baseline)');

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
      RAISE WARNING 'After test HTTP request failed (job 31): status_code=%, error=%',
        v_http_response->>'status_code',
        v_http_response->>'error';
    ELSE
      v_after_test_id := wait_for_test_result(v_test_run_id, 'after', 300);
      IF v_after_test_id IS NOT NULL THEN
        UPDATE regression_test_runs SET after_test_id = v_after_test_id WHERE id = v_test_run_id;
      END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'After test error (job 31): %', SQLERRM;
  END;

  -- Compare against master baseline
  IF v_after_test_id IS NOT NULL THEN
    BEGIN
      SELECT * INTO v_regression_analysis FROM analyze_regression_test_run(v_test_run_id);
      IF v_regression_analysis.regression_detected THEN
        RAISE WARNING 'REGRESSION DETECTED (job 31): Severity %, rollback=%',
          v_regression_analysis.regression_severity,
          v_regression_analysis.should_rollback;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Regression analysis error (job 31): %', SQLERRM;
    END;
  END IF;

  UPDATE regression_test_runs
  SET status = 'completed', job_executed = TRUE
  WHERE id = v_test_run_id;

  -- Clean up old regression test results (keep master + latest)
  BEGIN
    v_cleanup_test_result := cleanup_old_regression_test_results(v_job_id);
    RAISE NOTICE 'Cleaned up old regression test results for job %: %', v_job_id, v_cleanup_test_result->>'message';
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Failed to cleanup old regression test results: %', SQLERRM;
  END;

  PERFORM update_job_progress(v_job_id, v_total_steps, v_total_steps, 'Completed');

  RETURN CASE
    WHEN v_after_test_id IS NOT NULL
      THEN 'Regression tests completed. Check regression_test_runs table.'
    ELSE 'Regression tests triggered. Some tests may still be running.'
  END;
EXCEPTION WHEN OTHERS THEN
  UPDATE regression_test_runs
  SET status = 'failed', error_message = SQLERRM
  WHERE id = v_test_run_id;
  RAISE;
END;
$function$;

-- Update light_refresh_all_batches_with_regression_test (job 26)
-- This one is more complex as it chains batches, but we still skip the before test
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
  v_total_steps INTEGER := 3; -- Execute job, run batches, run after test
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

  -- Step 1: Execute batches (they skip their own regression tests when chained)
  v_step := 1;
  PERFORM update_job_progress(26, v_step, v_total_steps, 'Running light refresh batches');
  v_batch_results := ARRAY[]::TEXT[];
  v_batch_results := v_batch_results || light_refresh_batch_with_regression_test(0, true, true);

  -- Step 2: Run "after" regression test
  v_step := 2;
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

  v_step := 3;
  PERFORM update_job_progress(26, v_step, v_total_steps, 'Completed');

  RETURN 'All light refresh batches completed. Regression test completed (compared against master baseline).';
EXCEPTION WHEN OTHERS THEN
  UPDATE regression_test_runs
  SET status = 'failed', error_message = SQLERRM
  WHERE id = v_master_test_run_id;
  RAISE;
END;
$function$;

-- Note: light_refresh_batch_with_regression_test (jobs 27, 28) already skips regression tests when chained (p_skip_regression_tests = true)
-- So no changes needed there - they only run regression tests when run standalone

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION refresh_v_products_unified_with_regression_test() TO service_role;
GRANT EXECUTE ON FUNCTION cleanup_orphaned_records_with_regression_test() TO service_role;
GRANT EXECUTE ON FUNCTION light_refresh_all_batches_with_regression_test() TO service_role;

-- Comments
COMMENT ON FUNCTION refresh_v_products_unified_with_regression_test() IS 
  'Refreshes product pricing and runs regression test. Skips "before" test and compares "after" test against master baseline.';

COMMENT ON FUNCTION cleanup_orphaned_records_with_regression_test() IS 
  'Cleans up orphaned records and runs regression test. Skips "before" test and compares "after" test against master baseline.';

COMMENT ON FUNCTION light_refresh_all_batches_with_regression_test() IS 
  'Runs all light refresh batches and regression test. Skips "before" test and compares "after" test against master baseline.';

