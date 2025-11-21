-- Reduce Edge Function timeout from 300s to 60s and improve error handling
-- Edge Functions typically complete in 1-2 seconds, so 60s is more than enough

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

  -- Call Edge Function and WAIT for response (reduced timeout to 60s)
  BEGIN
    SELECT net.http_post(
      url := v_edge_url || '/functions/v1/light-refresh?batch=' || p_batch,
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || v_service_key,
        'Content-Type', 'application/json'
      ),
      body := '{}'::jsonb
    ) INTO v_request_id;

    -- Wait for the Edge Function to complete (reduced from 300s to 60s - Edge Functions complete in 1-2s)
    v_http_response := wait_for_http_response(v_request_id, 60);
    IF NOT (v_http_response->>'success')::boolean THEN
      RAISE WARNING 'Light refresh Edge Function failed (batch %): status_code=%, error=%, timeout=%',
        p_batch,
        v_http_response->>'status_code',
        v_http_response->>'error',
        v_http_response->>'timeout';
      -- Continue execution even if Edge Function fails - don't block the entire job
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Error calling light-refresh Edge Function (batch %): %. Continuing anyway.', p_batch, SQLERRM;
    -- Don't raise exception - allow job to continue
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

  -- Chain to next batch if requested
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

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION light_refresh_batch_with_regression_test(integer, boolean, boolean) TO service_role;

COMMENT ON FUNCTION light_refresh_batch_with_regression_test(integer, boolean, boolean) IS 
  'Refreshes a batch of URLs. Waits up to 60s for Edge Function response (reduced from 300s). Continues even if Edge Function fails.';

