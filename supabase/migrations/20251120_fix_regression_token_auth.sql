-- Ensure regression test wrappers send the correct ingest token
-- Fixes 401 responses from /api/admin?action=run_regression_test

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
  v_ingest_token TEXT;
  v_regression_analysis RECORD;
  v_batch_results TEXT[];
  v_result TEXT;
  v_step INTEGER := 0;
  v_total_steps INTEGER := 5;
  v_default_ingest_token CONSTANT TEXT := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlnenZ3YnZndm16dnZ6b2NsdWZ4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzY3NzkyOCwiZXhwIjoyMDczMjUzOTI4fQ.W9tkTSYu6Wml0mUr-gJD6hcLMZDcbaYYaOsyDXuwd8M';
BEGIN
  -- Total steps: baseline (1), batch0 (2), batch1 (3), batch2 (4), final regression (5)
  
  -- Step 1: Baseline test
  v_step := 1;
  PERFORM update_job_progress(26, v_step, v_total_steps, 'Starting baseline comparison');
  
  BEGIN
    v_ingest_token := current_setting('app.ingest_token', true);
  EXCEPTION WHEN OTHERS THEN
    v_ingest_token := NULL;
  END;
  IF v_ingest_token IS NULL OR btrim(v_ingest_token) = '' THEN
    v_ingest_token := v_default_ingest_token;
  END IF;
  
  -- Create master test run record (using job_id 26 as the master)
  INSERT INTO regression_test_runs (job_id, job_name, status)
  VALUES (26, 'light_refresh_all_batches', 'running')
  RETURNING id INTO v_master_test_run_id;
  
  v_regression_api_url := 'https://alan-chat-proxy.vercel.app/api/admin?action=run_regression_test';
  
  -- Run 40Q regression test BEFORE all batches
  BEGIN
    SELECT net.http_post(
      url := v_regression_api_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_ingest_token
      ),
      body := jsonb_build_object(
        'job_id', 26,
        'job_name', 'light_refresh_all_batches',
        'test_phase', 'before'
      )
    ) INTO v_request_id;
    
    v_baseline_test_id := wait_for_test_result(v_master_test_run_id, 'before', 300);
    IF v_baseline_test_id IS NOT NULL THEN
      UPDATE regression_test_runs SET baseline_test_id = v_baseline_test_id WHERE id = v_master_test_run_id;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Baseline test error: %', SQLERRM;
  END;
  
  -- Step 2: Batch 0
  v_step := 2;
  PERFORM update_job_progress(26, v_step, v_total_steps, 'Processing first 1/3 of URLs');
  
  BEGIN
    v_batch_results := ARRAY[]::TEXT[];
    v_batch_results := v_batch_results || light_refresh_batch_with_regression_test(0, true, true);
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Error executing batches: %', SQLERRM;
  END;
  
  -- Step 3: Batch 1 (automatically chained, but we report progress)
  v_step := 3;
  PERFORM update_job_progress(26, v_step, v_total_steps, 'Processing second 1/3 of URLs');
  
  -- Step 4: Batch 2 (automatically chained, but we report progress)
  v_step := 4;
  PERFORM update_job_progress(26, v_step, v_total_steps, 'Processing final 1/3 of URLs');
  
  -- Step 5: Final regression test
  v_step := 5;
  PERFORM update_job_progress(26, v_step, v_total_steps, 'Running final regression test');
  
  BEGIN
    SELECT net.http_post(
      url := v_regression_api_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_ingest_token
      ),
      body := jsonb_build_object(
        'job_id', 26,
        'job_name', 'light_refresh_all_batches',
        'test_phase', 'after'
      )
    ) INTO v_request_id;
    
    v_after_test_id := wait_for_test_result(v_master_test_run_id, 'after', 300);
    IF v_after_test_id IS NOT NULL THEN
      UPDATE regression_test_runs SET after_test_id = v_after_test_id WHERE id = v_master_test_run_id;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'After test error: %', SQLERRM;
  END;
  
  -- Analyze regression test results
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
  
  -- Final step: Complete
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

CREATE OR REPLACE FUNCTION public.light_refresh_batch_with_regression_test(p_batch integer)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET statement_timeout TO '15min'
AS $function$
DECLARE
  v_test_run_id BIGINT;
  v_baseline_test_id BIGINT;
  v_after_test_id BIGINT;
  v_api_url TEXT;
  v_regression_api_url TEXT;
  v_request_id BIGINT;
  v_job_id INTEGER;
  v_job_name TEXT;
  v_regression_analysis RECORD;
  v_ingest_token TEXT;
  v_edge_url TEXT;
  v_service_key TEXT;
  v_default_ingest_token CONSTANT TEXT := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlnenZ3YnZndm16dnZ6b2NsdWZ4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzY3NzkyOCwiZXhwIjoyMDczMjUzOTI4fQ.W9tkTSYu6Wml0mUr-gJD6hcLMZDcbaYYaOsyDXuwd8M';
BEGIN
  -- Statement timeout is set at function level (15 minutes)
  -- This is needed because the function waits for HTTP responses (up to 5min each)
  
  -- Determine job ID and name based on batch
  v_job_id := CASE p_batch
    WHEN 0 THEN 26
    WHEN 1 THEN 27
    WHEN 2 THEN 28
    ELSE NULL
  END;
  
  IF v_job_id IS NULL THEN
    RAISE EXCEPTION 'Invalid batch number: %', p_batch;
  END IF;
  
  v_job_name := 'light_refresh_batch' || p_batch;
  
  BEGIN
    v_ingest_token := current_setting('app.ingest_token', true);
  EXCEPTION WHEN OTHERS THEN
    v_ingest_token := NULL;
  END;
  IF v_ingest_token IS NULL OR btrim(v_ingest_token) = '' THEN
    v_ingest_token := v_default_ingest_token;
  END IF;
  
  -- Get edge function URL and service key
  BEGIN
    SELECT _internal.get_edge_base_url() INTO v_edge_url;
    SELECT _internal.get_service_role_key() INTO v_service_key;
  EXCEPTION WHEN OTHERS THEN
    v_edge_url := 'https://igzvwbvgvmzvvzoclufx.supabase.co';
    v_service_key := v_ingest_token;
  END;
  
  -- Create test run record
  INSERT INTO regression_test_runs (job_id, job_name, status)
  VALUES (v_job_id, v_job_name, 'running')
  RETURNING id INTO v_test_run_id;
  
  v_regression_api_url := 'https://alan-chat-proxy.vercel.app/api/admin?action=run_regression_test';
  
  -- Step 1: Baseline test
  BEGIN
    SELECT net.http_post(
      url := v_regression_api_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_ingest_token
      ),
      body := jsonb_build_object(
        'job_id', v_job_id,
        'job_name', v_job_name,
        'test_phase', 'before'
      )
    ) INTO v_request_id;
    
    v_baseline_test_id := wait_for_test_result(v_test_run_id, 'before', 300);
    IF v_baseline_test_id IS NOT NULL THEN
      UPDATE regression_test_runs SET baseline_test_id = v_baseline_test_id WHERE id = v_test_run_id;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Baseline test error: %', SQLERRM;
  END;
  
  -- Step 2: Execute light refresh Edge Function
  BEGIN
    SELECT net.http_post(
      url := v_edge_url || '/functions/v1/light-refresh?batch=' || p_batch,
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || v_service_key,
        'Content-Type', 'application/json'
      ),
      body := '{}'::jsonb
    ) INTO v_request_id;
    
    RAISE NOTICE 'Light refresh batch % triggered (request_id: %)', p_batch, v_request_id;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Error calling light-refresh Edge Function: %', SQLERRM;
  END;
  
  -- Step 3: After test
  BEGIN
    SELECT net.http_post(
      url := v_regression_api_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_ingest_token
      ),
      body := jsonb_build_object(
        'job_id', v_job_id,
        'job_name', v_job_name,
        'test_phase', 'after'
      )
    ) INTO v_request_id;
    
    v_after_test_id := wait_for_test_result(v_test_run_id, 'after', 300);
    IF v_after_test_id IS NOT NULL THEN
      UPDATE regression_test_runs SET after_test_id = v_after_test_id WHERE id = v_test_run_id;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'After test error: %', SQLERRM;
  END;
  
  -- Step 4: Analyze if both completed
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
  
  RETURN 'Light refresh batch ' || p_batch || ' completed. Regression tests completed.';
  
EXCEPTION WHEN OTHERS THEN
  UPDATE regression_test_runs
  SET status = 'failed', notes = SQLERRM
  WHERE id = v_test_run_id;
  RAISE;
END;
$function$;

CREATE OR REPLACE FUNCTION public.light_refresh_batch_with_regression_test(p_batch integer, p_chain_next boolean DEFAULT true)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET statement_timeout TO '15min'
AS $function$
DECLARE
  v_test_run_id BIGINT;
  v_baseline_test_id BIGINT;
  v_after_test_id BIGINT;
  v_api_url TEXT;
  v_regression_api_url TEXT;
  v_request_id BIGINT;
  v_job_id INTEGER;
  v_job_name TEXT;
  v_regression_analysis RECORD;
  v_ingest_token TEXT;
  v_edge_url TEXT;
  v_service_key TEXT;
  v_result TEXT;
  v_default_ingest_token CONSTANT TEXT := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlnenZ3YnZndm16dnZ6b2NsdWZ4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzY3NzkyOCwiZXhwIjoyMDczMjUzOTI4fQ.W9tkTSYu6Wml0mUr-gJD6hcLMZDcbaYYaOsyDXuwd8M';
BEGIN
  -- Statement timeout is set at function level (15 minutes)
  -- This is needed because the function waits for HTTP responses (up to 5min each)
  
  -- Determine job ID and name based on batch
  v_job_id := CASE p_batch
    WHEN 0 THEN 26
    WHEN 1 THEN 27
    WHEN 2 THEN 28
    ELSE NULL
  END;
  
  IF v_job_id IS NULL THEN
    RAISE EXCEPTION 'Invalid batch number: %', p_batch;
  END IF;
  
  v_job_name := 'light_refresh_batch' || p_batch;
  
  BEGIN
    v_ingest_token := current_setting('app.ingest_token', true);
  EXCEPTION WHEN OTHERS THEN
    v_ingest_token := NULL;
  END;
  IF v_ingest_token IS NULL OR btrim(v_ingest_token) = '' THEN
    v_ingest_token := v_default_ingest_token;
  END IF;
  
  -- Get edge function URL and service key
  BEGIN
    SELECT _internal.get_edge_base_url() INTO v_edge_url;
    SELECT _internal.get_service_role_key() INTO v_service_key;
  EXCEPTION WHEN OTHERS THEN
    v_edge_url := 'https://igzvwbvgvmzvvzoclufx.supabase.co';
    v_service_key := v_ingest_token;
  END;
  
  -- Create test run record
  INSERT INTO regression_test_runs (job_id, job_name, status)
  VALUES (v_job_id, v_job_name, 'running')
  RETURNING id INTO v_test_run_id;
  
  v_regression_api_url := 'https://alan-chat-proxy.vercel.app/api/admin?action=run_regression_test';
  
  -- Step 1: Baseline test
  BEGIN
    SELECT net.http_post(
      url := v_regression_api_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_ingest_token
      ),
      body := jsonb_build_object(
        'job_id', v_job_id,
        'job_name', v_job_name,
        'test_phase', 'before'
      )
    ) INTO v_request_id;
    
    v_baseline_test_id := wait_for_test_result(v_test_run_id, 'before', 300);
    IF v_baseline_test_id IS NOT NULL THEN
      UPDATE regression_test_runs SET baseline_test_id = v_baseline_test_id WHERE id = v_test_run_id;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Baseline test error: %', SQLERRM;
  END;
  
  -- Step 2: Execute light refresh Edge Function
  BEGIN
    SELECT net.http_post(
      url := v_edge_url || '/functions/v1/light-refresh?batch=' || p_batch,
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || v_service_key,
        'Content-Type', 'application/json'
      ),
      body := '{}'::jsonb
    ) INTO v_request_id;
    
    RAISE NOTICE 'Light refresh batch % triggered (request_id: %)', p_batch, v_request_id;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Error calling light-refresh Edge Function: %', SQLERRM;
  END;
  
  -- Step 3: After test
  BEGIN
    SELECT net.http_post(
      url := v_regression_api_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_ingest_token
      ),
      body := jsonb_build_object(
        'job_id', v_job_id,
        'job_name', v_job_name,
        'test_phase', 'after'
      )
    ) INTO v_request_id;
    
    v_after_test_id := wait_for_test_result(v_test_run_id, 'after', 300);
    IF v_after_test_id IS NOT NULL THEN
      UPDATE regression_test_runs SET after_test_id = v_after_test_id WHERE id = v_test_run_id;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'After test error: %', SQLERRM;
  END;
  
  -- Step 4: Analyze if both completed
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
  
  v_result := 'Light refresh batch ' || p_batch || ' completed. Regression tests completed.';
  
  -- Step 5: Chain to next batch if enabled and this batch succeeded
  IF p_chain_next AND p_batch < 2 THEN
    BEGIN
      RAISE NOTICE 'Chaining to next batch: %', p_batch + 1;
      PERFORM light_refresh_batch_with_regression_test(p_batch + 1, true);
      v_result := v_result || ' Batch ' || (p_batch + 1) || ' chained and completed.';
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Error chaining to batch %: %', p_batch + 1, SQLERRM;
      -- Don't fail the current batch if chaining fails
    END;
  END IF;
  
  RETURN v_result;
  
EXCEPTION WHEN OTHERS THEN
  UPDATE regression_test_runs
  SET status = 'failed', notes = SQLERRM
  WHERE id = v_test_run_id;
  RAISE;
END;
$function$;

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
  v_api_url TEXT;
  v_regression_api_url TEXT;
  v_request_id BIGINT;
  v_job_id INTEGER;
  v_job_name TEXT;
  v_regression_analysis RECORD;
  v_ingest_token TEXT;
  v_edge_url TEXT;
  v_service_key TEXT;
  v_result TEXT;
  v_step INTEGER := 0;
  v_total_steps INTEGER := 1;
  v_default_ingest_token CONSTANT TEXT := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlnenZ3YnZndm16dnZ6b2NsdWZ4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzY3NzkyOCwiZXhwIjoyMDczMjUzOTI4fQ.W9tkTSYu6Wml0mUr-gJD6hcLMZDcbaYYaOsyDXuwd8M';
BEGIN
  -- Determine job ID and name based on batch
  v_job_id := CASE p_batch
    WHEN 0 THEN 26
    WHEN 1 THEN 27
    WHEN 2 THEN 28
    ELSE NULL
  END;
  
  IF v_job_id IS NULL THEN
    RAISE EXCEPTION 'Invalid batch number: %', p_batch;
  END IF;
  
  v_job_name := 'light_refresh_batch' || p_batch;
  
  -- Update progress for batch 1 and 2 (batch 0 progress is handled by master function)
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
    v_ingest_token := current_setting('app.ingest_token', true);
  EXCEPTION WHEN OTHERS THEN
    v_ingest_token := NULL;
  END;
  IF v_ingest_token IS NULL OR btrim(v_ingest_token) = '' THEN
    v_ingest_token := v_default_ingest_token;
  END IF;
  
  -- Get edge function URL and service key
  BEGIN
    SELECT _internal.get_edge_base_url() INTO v_edge_url;
    SELECT _internal.get_service_role_key() INTO v_service_key;
  EXCEPTION WHEN OTHERS THEN
    v_edge_url := 'https://igzvwbvgvmzvvzoclufx.supabase.co';
    v_service_key := v_ingest_token;
  END;
  
  -- Only create test run record and run regression tests if not skipping
  IF NOT p_skip_regression_tests THEN
    INSERT INTO regression_test_runs (job_id, job_name, status)
    VALUES (v_job_id, v_job_name, 'running')
    RETURNING id INTO v_test_run_id;
    
    v_regression_api_url := 'https://alan-chat-proxy.vercel.app/api/admin?action=run_regression_test';
    
    -- Step 1: Baseline test
    BEGIN
      SELECT net.http_post(
        url := v_regression_api_url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || v_ingest_token
        ),
        body := jsonb_build_object(
          'job_id', v_job_id,
          'job_name', v_job_name,
          'test_phase', 'before'
        )
      ) INTO v_request_id;
      
      v_baseline_test_id := wait_for_test_result(v_test_run_id, 'before', 300);
      IF v_baseline_test_id IS NOT NULL THEN
        UPDATE regression_test_runs SET baseline_test_id = v_baseline_test_id WHERE id = v_test_run_id;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Baseline test error: %', SQLERRM;
    END;
  END IF;
  
  -- Step 2: Execute light refresh Edge Function
  BEGIN
    SELECT net.http_post(
      url := v_edge_url || '/functions/v1/light-refresh?batch=' || p_batch,
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || v_service_key,
        'Content-Type', 'application/json'
      ),
      body := '{}'::jsonb
    ) INTO v_request_id;
    
    RAISE NOTICE 'Light refresh batch % triggered (request_id: %)', p_batch, v_request_id;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Error calling light-refresh Edge Function: %', SQLERRM;
  END;
  
  -- Step 3: After test (only if not skipping regression tests)
  IF NOT p_skip_regression_tests THEN
    BEGIN
      SELECT net.http_post(
        url := v_regression_api_url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || v_ingest_token
        ),
        body := jsonb_build_object(
          'job_id', v_job_id,
          'job_name', v_job_name,
          'test_phase', 'after'
        )
      ) INTO v_request_id;
      
      v_after_test_id := wait_for_test_result(v_test_run_id, 'after', 300);
      IF v_after_test_id IS NOT NULL THEN
        UPDATE regression_test_runs SET after_test_id = v_after_test_id WHERE id = v_test_run_id;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'After test error: %', SQLERRM;
    END;
    
    -- Step 4: Analyze if both completed
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
  END IF;
  
  v_result := 'Light refresh batch ' || p_batch || ' completed.';
  
  -- Step 5: Chain to next batch if enabled and this batch succeeded
  IF p_chain_next AND p_batch < 2 THEN
    BEGIN
      RAISE NOTICE 'Chaining to next batch: %', p_batch + 1;
      PERFORM light_refresh_batch_with_regression_test(p_batch + 1, true, true);
      v_result := v_result || ' Batch ' || (p_batch + 1) || ' chained and completed.';
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'Error chaining to batch %: %', p_batch + 1, SQLERRM;
    END;
  END IF;
  
  -- Update progress for individual jobs when they complete
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

