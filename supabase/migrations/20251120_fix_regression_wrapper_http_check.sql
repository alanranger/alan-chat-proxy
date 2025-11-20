-- Fix regression wrapper functions to check HTTP response status before waiting
-- This prevents infinite waiting when HTTP requests fail (e.g., 503 errors)

CREATE OR REPLACE FUNCTION public.refresh_v_products_unified_with_regression_test()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET statement_timeout TO '20min'
AS $function$
DECLARE
  v_test_run_id BIGINT;
  v_baseline_test_id BIGINT;
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
  v_total_steps INTEGER := 3;
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

  v_step := 1;
  PERFORM update_job_progress(v_job_id, v_step, v_total_steps, 'Running baseline regression test');

  INSERT INTO regression_test_runs (job_id, job_name, status)
  VALUES (v_job_id, v_job_name, 'running')
  RETURNING id INTO v_test_run_id;

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
        'test_phase', 'before'
      )
    ) INTO v_request_id;

    -- Check HTTP response status before waiting for test result
    v_http_response := wait_for_http_response(v_request_id, 30);
    IF NOT (v_http_response->>'success')::boolean THEN
      RAISE WARNING 'Baseline test HTTP request failed (job 21): status_code=%, error=%',
        v_http_response->>'status_code',
        v_http_response->>'error';
      -- Don't wait for test result if HTTP request failed
    ELSE
      -- HTTP request succeeded, wait for test result
      v_baseline_test_id := wait_for_test_result(v_test_run_id, 'before', 300);
      IF v_baseline_test_id IS NOT NULL THEN
        UPDATE regression_test_runs SET baseline_test_id = v_baseline_test_id WHERE id = v_test_run_id;
      END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Baseline test error (job 21): %', SQLERRM;
  END;

  v_step := 2;
  PERFORM update_job_progress(v_job_id, v_step, v_total_steps, 'Refreshing unified product catalog');
  PERFORM refresh_v_products_unified();
  PERFORM upsert_display_price_all();

  v_step := 3;
  PERFORM update_job_progress(v_job_id, v_step, v_total_steps, 'Running after regression test');

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

    -- Check HTTP response status before waiting for test result
    v_http_response := wait_for_http_response(v_request_id, 30);
    IF NOT (v_http_response->>'success')::boolean THEN
      RAISE WARNING 'After test HTTP request failed (job 21): status_code=%, error=%',
        v_http_response->>'status_code',
        v_http_response->>'error';
      -- Don't wait for test result if HTTP request failed
    ELSE
      -- HTTP request succeeded, wait for test result
      v_after_test_id := wait_for_test_result(v_test_run_id, 'after', 300);
      IF v_after_test_id IS NOT NULL THEN
        UPDATE regression_test_runs SET after_test_id = v_after_test_id WHERE id = v_test_run_id;
      END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'After test error (job 21): %', SQLERRM;
  END;

  IF v_baseline_test_id IS NOT NULL AND v_after_test_id IS NOT NULL THEN
    BEGIN
      SELECT * INTO v_regression_analysis FROM analyze_regression_test_run(v_test_run_id);
      IF v_regression_analysis.regression_detected THEN
        RAISE WARNING 'REGRESSION DETECTED (job 21): Severity %, rollback=%',
          v_regression_analysis.regression_severity,
          v_regression_analysis.should_rollback;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  UPDATE regression_test_runs
  SET status = 'completed', job_executed = TRUE
  WHERE id = v_test_run_id;

  PERFORM update_job_progress(v_job_id, v_total_steps, v_total_steps, 'Completed');

  RETURN 'Product pricing refreshed. Regression tests completed.';

EXCEPTION WHEN OTHERS THEN
  IF v_test_run_id IS NOT NULL THEN
    UPDATE regression_test_runs
    SET status = 'failed', notes = SQLERRM
    WHERE id = v_test_run_id;
  END IF;
  PERFORM update_job_progress(v_job_id, GREATEST(1, LEAST(v_total_steps, v_step)), v_total_steps, 'Failed: ' || SQLERRM);
  RAISE;
END;
$function$;

CREATE OR REPLACE FUNCTION public.cleanup_orphaned_records_with_regression_test()
RETURNS TABLE(orphaned_chunks bigint, orphaned_entities bigint, test_status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET statement_timeout TO '20min'
AS $function$
DECLARE
  v_test_run_id BIGINT;
  v_baseline_test_id BIGINT;
  v_after_test_id BIGINT;
  v_regression_api_url TEXT;
  v_request_id BIGINT;
  v_http_response jsonb;
  v_cleanup_result RECORD;
  v_regression_analysis RECORD;
  v_edge_url TEXT;
  v_service_key TEXT;
  v_job_id CONSTANT INTEGER := 31;
  v_job_name CONSTANT TEXT := 'cleanup-orphaned-records';
  v_step INTEGER := 0;
  v_total_steps INTEGER := 3;
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

  v_step := 1;
  PERFORM update_job_progress(v_job_id, v_step, v_total_steps, 'Running baseline regression test');

  INSERT INTO regression_test_runs (job_id, job_name, status)
  VALUES (v_job_id, v_job_name, 'running')
  RETURNING id INTO v_test_run_id;

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
        'test_phase', 'before'
      )
    ) INTO v_request_id;

    -- Check HTTP response status before waiting for test result
    v_http_response := wait_for_http_response(v_request_id, 30);
    IF NOT (v_http_response->>'success')::boolean THEN
      RAISE WARNING 'Baseline test HTTP request failed (job 31): status_code=%, error=%',
        v_http_response->>'status_code',
        v_http_response->>'error';
      -- Don't wait for test result if HTTP request failed
    ELSE
      -- HTTP request succeeded, wait for test result
      v_baseline_test_id := wait_for_test_result(v_test_run_id, 'before', 300);
      IF v_baseline_test_id IS NOT NULL THEN
        UPDATE regression_test_runs SET baseline_test_id = v_baseline_test_id WHERE id = v_test_run_id;
      END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Baseline test error (job 31): %', SQLERRM;
  END;

  v_step := 2;
  PERFORM update_job_progress(v_job_id, v_step, v_total_steps, 'Cleaning orphaned records');
  SELECT * INTO v_cleanup_result FROM cleanup_orphaned_records();

  v_step := 3;
  PERFORM update_job_progress(v_job_id, v_step, v_total_steps, 'Running after regression test');

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

    -- Check HTTP response status before waiting for test result
    v_http_response := wait_for_http_response(v_request_id, 30);
    IF NOT (v_http_response->>'success')::boolean THEN
      RAISE WARNING 'After test HTTP request failed (job 31): status_code=%, error=%',
        v_http_response->>'status_code',
        v_http_response->>'error';
      -- Don't wait for test result if HTTP request failed
    ELSE
      -- HTTP request succeeded, wait for test result
      v_after_test_id := wait_for_test_result(v_test_run_id, 'after', 300);
      IF v_after_test_id IS NOT NULL THEN
        UPDATE regression_test_runs SET after_test_id = v_after_test_id WHERE id = v_test_run_id;
      END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'After test error (job 31): %', SQLERRM;
  END;

  IF v_baseline_test_id IS NOT NULL AND v_after_test_id IS NOT NULL THEN
    BEGIN
      SELECT * INTO v_regression_analysis FROM analyze_regression_test_run(v_test_run_id);
      IF v_regression_analysis.regression_detected THEN
        RAISE WARNING 'REGRESSION DETECTED (job 31): Severity %, rollback=%',
          v_regression_analysis.regression_severity,
          v_regression_analysis.should_rollback;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  UPDATE regression_test_runs
  SET status = 'completed', job_executed = TRUE
  WHERE id = v_test_run_id;

  PERFORM update_job_progress(v_job_id, v_total_steps, v_total_steps, 'Completed');

  RETURN QUERY SELECT
    v_cleanup_result.orphaned_chunks,
    v_cleanup_result.orphaned_entities,
    CASE
      WHEN v_baseline_test_id IS NOT NULL AND v_after_test_id IS NOT NULL
        THEN 'Regression tests completed. Check regression_test_runs table.'
      ELSE 'Regression tests triggered. Some tests may still be running.'
    END::TEXT;

EXCEPTION WHEN OTHERS THEN
  IF v_test_run_id IS NOT NULL THEN
    UPDATE regression_test_runs
    SET status = 'failed', notes = SQLERRM
    WHERE id = v_test_run_id;
  END IF;
  PERFORM update_job_progress(v_job_id, GREATEST(1, LEAST(v_total_steps, v_step)), v_total_steps, 'Failed: ' || SQLERRM);
  RAISE;
END;
$function$;

