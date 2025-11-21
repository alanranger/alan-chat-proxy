-- Add cleanup calls to regression test job functions
-- After each job completes regression tests, clean up old results (keep master + latest)
-- Then run VACUUM FULL to reclaim space

-- Update refresh_v_products_unified_with_regression_test (job 21)
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
  v_cleanup_result JSONB;
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

    v_http_response := wait_for_http_response(v_request_id, 30);
    IF NOT (v_http_response->>'success')::boolean THEN
      RAISE WARNING 'Baseline test HTTP request failed (job 21): status_code=%, error=%',
        v_http_response->>'status_code',
        v_http_response->>'error';
    ELSE
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

  -- Clean up old regression test results (keep master + latest)
  BEGIN
    v_cleanup_result := cleanup_old_regression_test_results(v_job_id);
    RAISE NOTICE 'Cleaned up old regression test results for job %: %', v_job_id, v_cleanup_result->>'message';
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Failed to cleanup old regression test results: %', SQLERRM;
  END;

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

-- Update cleanup_orphaned_records_with_regression_test (job 31)
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
  v_cleanup_test_result JSONB;
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

    v_http_response := wait_for_http_response(v_request_id, 30);
    IF NOT (v_http_response->>'success')::boolean THEN
      RAISE WARNING 'Baseline test HTTP request failed (job 31): status_code=%, error=%',
        v_http_response->>'status_code',
        v_http_response->>'error';
    ELSE
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

  -- Clean up old regression test results (keep master + latest)
  BEGIN
    v_cleanup_test_result := cleanup_old_regression_test_results(v_job_id);
    RAISE NOTICE 'Cleaned up old regression test results for job %: %', v_job_id, v_cleanup_test_result->>'message';
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Failed to cleanup old regression test results: %', SQLERRM;
  END;

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

-- Update light_refresh_all_batches_with_regression_test (job 26)
CREATE OR REPLACE FUNCTION public.light_refresh_all_batches_with_regression_test()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET statement_timeout TO '45min'
AS $function$
DECLARE
  v_master_test_run_id BIGINT;
  v_baseline_test_id BIGINT;
  v_after_test_id BIGINT;
  v_regression_api_url TEXT;
  v_request_id BIGINT;
  v_http_response jsonb;
  v_regression_analysis RECORD;
  v_batch_results TEXT[];
  v_result TEXT;
  v_step INTEGER := 0;
  v_total_steps INTEGER := 5;
  v_edge_url TEXT;
  v_service_key TEXT;
  v_cleanup_result JSONB;
BEGIN
  BEGIN
    SELECT _internal.get_edge_base_url() INTO v_edge_url;
    SELECT _internal.get_service_role_key() INTO v_service_key;
  EXCEPTION WHEN OTHERS THEN
    v_edge_url := 'https://igzvwbvgvmzvvzoclufx.supabase.co';
    v_service_key := current_setting('app.supabase_service_key', true);
  END;
  v_regression_api_url := v_edge_url || '/functions/v1/run-40q-regression-test';

  v_step := 1;
  PERFORM update_job_progress(26, v_step, v_total_steps, 'Starting baseline comparison');

  INSERT INTO regression_test_runs (job_id, job_name, status)
  VALUES (26, 'light_refresh_all_batches', 'running')
  RETURNING id INTO v_master_test_run_id;

  BEGIN
    SELECT net.http_post(
      url := v_regression_api_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_service_key
      ),
      body := jsonb_build_object(
        'job_id', 26,
        'job_name', 'light_refresh_all_batches',
        'test_phase', 'before'
      )
    ) INTO v_request_id;

    v_http_response := wait_for_http_response(v_request_id, 30);
    IF NOT (v_http_response->>'success')::boolean THEN
      RAISE WARNING 'Baseline test HTTP request failed (job 26): status_code=%, error=%',
        v_http_response->>'status_code',
        v_http_response->>'error';
    ELSE
      v_baseline_test_id := wait_for_test_result(v_master_test_run_id, 'before', 300);
      IF v_baseline_test_id IS NOT NULL THEN
        UPDATE regression_test_runs SET baseline_test_id = v_baseline_test_id WHERE id = v_master_test_run_id;
      END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Baseline test error: %', SQLERRM;
  END;

  v_step := 2;
  PERFORM update_job_progress(26, v_step, v_total_steps, 'Processing first 1/3 of URLs');
  BEGIN
    v_batch_results := ARRAY[]::TEXT[];
    v_batch_results := v_batch_results || light_refresh_batch_with_regression_test(0, true, true);
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Error executing batches: %', SQLERRM;
  END;

  v_step := 3;
  PERFORM update_job_progress(26, v_step, v_total_steps, 'Processing second 1/3 of URLs');
  v_step := 4;
  PERFORM update_job_progress(26, v_step, v_total_steps, 'Processing final 1/3 of URLs');

  v_step := 5;
  PERFORM update_job_progress(26, v_step, v_total_steps, 'Running final regression test');
  BEGIN
    SELECT net.http_post(
      url := v_regression_api_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_service_key
      ),
      body := jsonb_build_object(
        'job_id', 26,
        'job_name', 'light_refresh_all_batches',
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
    RAISE WARNING 'After test error: %', SQLERRM;
  END;

  IF v_baseline_test_id IS NOT NULL AND v_after_test_id IS NOT NULL THEN
    BEGIN
      SELECT * INTO v_regression_analysis FROM analyze_regression_test_run(v_master_test_run_id);
      IF v_regression_analysis.regression_detected THEN
        RAISE WARNING 'REGRESSION DETECTED: Severity: %, Should rollback: %',
          v_regression_analysis.regression_severity,
          v_regression_analysis.should_rollback;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      NULL;
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

  PERFORM update_job_progress(26, v_total_steps, v_total_steps, 'Completed');
  v_result := 'All light refresh batches completed. Batches: ' || array_to_string(v_batch_results, ', ') || '. Regression tests completed.';
  RETURN v_result;
EXCEPTION WHEN OTHERS THEN
  UPDATE regression_test_runs
  SET status = 'failed', notes = SQLERRM
  WHERE id = v_master_test_run_id;
  RAISE;
END;
$function$;

-- Update light_refresh_batch_with_regression_test to also cleanup (for batches 27, 28)
CREATE OR REPLACE FUNCTION public.light_refresh_batch_with_regression_test(p_batch integer, p_chain_next boolean DEFAULT true, p_skip_regression_tests boolean DEFAULT false)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET statement_timeout TO '15min'
AS $function$
DECLARE
  v_test_run_id BIGINT;
  v_baseline_test_id BIGINT;
  v_after_test_id BIGINT;
  v_regression_api_url TEXT;
  v_request_id BIGINT;
  v_http_response jsonb;
  v_job_id INTEGER;
  v_job_name TEXT;
  v_regression_analysis RECORD;
  v_edge_url TEXT;
  v_service_key TEXT;
  v_result TEXT;
  v_step INTEGER := 0;
  v_total_steps INTEGER := 1;
  v_cleanup_result JSONB;
BEGIN
  v_job_id := CASE p_batch WHEN 0 THEN 26 WHEN 1 THEN 27 WHEN 2 THEN 28 ELSE NULL END;
  IF v_job_id IS NULL THEN
    RAISE EXCEPTION 'Invalid batch number: %', p_batch;
  END IF;
  v_job_name := 'light_refresh_batch' || p_batch;

  IF p_batch = 1 THEN
    v_total_steps := 1;
    v_step := 1;
    PERFORM update_job_progress(27, v_step, v_total_steps, 'Processing second 1/3 of URLs');
  ELSIF p_batch = 2 THEN
    v_total_steps := 1;
    v_step := 1;
    PERFORM update_job_progress(28, v_step, v_total_steps, 'Processing final 1/3 of URLs');
  END IF;

  BEGIN
    SELECT _internal.get_edge_base_url() INTO v_edge_url;
    SELECT _internal.get_service_role_key() INTO v_service_key;
  EXCEPTION WHEN OTHERS THEN
    v_edge_url := 'https://igzvwbvgvmzvvzoclufx.supabase.co';
    v_service_key := current_setting('app.supabase_service_key', true);
  END;
  v_regression_api_url := v_edge_url || '/functions/v1/run-40q-regression-test';

  IF NOT p_skip_regression_tests THEN
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

      v_http_response := wait_for_http_response(v_request_id, 30);
      IF NOT (v_http_response->>'success')::boolean THEN
        RAISE WARNING 'Baseline test HTTP request failed (job %): status_code=%, error=%',
          v_job_id,
          v_http_response->>'status_code',
          v_http_response->>'error';
      ELSE
        v_baseline_test_id := wait_for_test_result(v_test_run_id, 'before', 300);
        IF v_baseline_test_id IS NOT NULL THEN
          UPDATE regression_test_runs SET baseline_test_id = v_baseline_test_id WHERE id = v_test_run_id;
        END IF;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Baseline test error: %', SQLERRM;
    END;
  END IF;

  BEGIN
    SELECT net.http_post(
      url := v_edge_url || '/functions/v1/light-refresh?batch=' || p_batch,
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || v_service_key,
        'Content-Type', 'application/json'
      ),
      body := '{}'::jsonb
    ) INTO v_request_id;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Error calling light-refresh Edge Function: %', SQLERRM;
  END;

  IF NOT p_skip_regression_tests THEN
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
        RAISE WARNING 'After test HTTP request failed (job %): status_code=%, error=%',
          v_job_id,
          v_http_response->>'status_code',
          v_http_response->>'error';
      ELSE
        v_after_test_id := wait_for_test_result(v_test_run_id, 'after', 300);
        IF v_after_test_id IS NOT NULL THEN
          UPDATE regression_test_runs SET after_test_id = v_after_test_id WHERE id = v_test_run_id;
        END IF;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'After test error: %', SQLERRM;
    END;

    IF v_baseline_test_id IS NOT NULL AND v_after_test_id IS NOT NULL THEN
      BEGIN
        SELECT * INTO v_regression_analysis FROM analyze_regression_test_run(v_test_run_id);
        IF v_regression_analysis.regression_detected THEN
          RAISE WARNING 'REGRESSION DETECTED: Severity: %, Should rollback: %',
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

    -- Clean up old regression test results (keep master + latest) for batch jobs
    IF p_batch IN (1, 2) THEN
      BEGIN
        v_cleanup_result := cleanup_old_regression_test_results(v_job_id);
        RAISE NOTICE 'Cleaned up old regression test results for job %: %', v_job_id, v_cleanup_result->>'message';
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Failed to cleanup old regression test results: %', SQLERRM;
      END;
    END IF;
  END IF;

  v_result := 'Light refresh batch ' || p_batch || ' completed.';

  IF p_chain_next AND p_batch < 2 THEN
    BEGIN
      PERFORM light_refresh_batch_with_regression_test(p_batch + 1, true, TRUE);
      v_result := v_result || ' Batch ' || (p_batch + 1) || ' chained and completed.';
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'Error chaining to batch %: %', p_batch + 1, SQLERRM;
    END;
  END IF;

  IF p_batch = 1 THEN
    PERFORM update_job_progress(27, 1, 1, 'Completed');
  ELSIF p_batch = 2 THEN
    PERFORM update_job_progress(28, 1, 1, 'Completed');
  END IF;

  RETURN v_result;
EXCEPTION WHEN OTHERS THEN
  IF v_test_run_id IS NOT NULL THEN
    UPDATE regression_test_runs
    SET status = 'failed', notes = SQLERRM
    WHERE id = v_test_run_id;
  END IF;
  RAISE;
END;
$function$;

