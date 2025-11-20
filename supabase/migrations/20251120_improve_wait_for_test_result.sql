-- Improve wait_for_test_result function with better error handling and diagnostics
-- Also add helper function to check HTTP response status

CREATE OR REPLACE FUNCTION public.wait_for_http_response(
  p_request_id bigint,
  p_max_wait_seconds integer DEFAULT 30
)
RETURNS jsonb
LANGUAGE plpgsql
AS $function$
DECLARE
  v_response RECORD;
  v_waited INTEGER := 0;
  v_wait_interval INTEGER := 1;
BEGIN
  -- Poll for HTTP response to appear
  WHILE v_waited < p_max_wait_seconds LOOP
    SELECT 
      status_code,
      content_type,
      error_msg,
      created
    INTO v_response
    FROM net._http_response
    WHERE id = p_request_id;
    
    IF v_response.status_code IS NOT NULL THEN
      -- Response received
      RETURN jsonb_build_object(
        'success', v_response.status_code >= 200 AND v_response.status_code < 300,
        'status_code', v_response.status_code,
        'error', v_response.error_msg,
        'content_type', v_response.content_type
      );
    END IF;
    
    PERFORM pg_sleep(v_wait_interval);
    v_waited := v_waited + v_wait_interval;
  END LOOP;
  
  -- Timeout - no response received
  RETURN jsonb_build_object(
    'success', false,
    'status_code', NULL,
    'error', format('HTTP request timeout after %s seconds', p_max_wait_seconds),
    'timeout', true
  );
END;
$function$;

-- Improved wait_for_test_result with better error handling and diagnostics
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
  v_wait_interval INTEGER := 5;
  v_job_id INTEGER;
  v_run_started_at TIMESTAMPTZ;
  v_last_check TIMESTAMPTZ := NOW();
  v_check_count INTEGER := 0;
BEGIN
  -- Get job_id and run_started_at once
  SELECT job_id, run_started_at
  INTO v_job_id, v_run_started_at
  FROM regression_test_runs
  WHERE id = p_test_run_id;
  
  IF v_job_id IS NULL THEN
    RAISE WARNING 'wait_for_test_result: Test run % not found', p_test_run_id;
    RETURN NULL;
  END IF;
  
  -- Poll for test result to appear
  WHILE v_waited < p_max_wait_seconds LOOP
    v_check_count := v_check_count + 1;
    
    -- Check for test result
    SELECT id INTO v_test_result_id
    FROM regression_test_results
    WHERE job_id = v_job_id
      AND test_phase = p_test_phase
      AND test_timestamp > v_run_started_at
    ORDER BY test_timestamp DESC
    LIMIT 1;
    
    IF v_test_result_id IS NOT NULL THEN
      -- Found the result
      RAISE NOTICE 'wait_for_test_result: Found test result % for job % phase % after %s seconds (checked % times)',
        v_test_result_id, v_job_id, p_test_phase, v_waited, v_check_count;
      RETURN v_test_result_id;
    END IF;
    
    -- Log progress every 30 seconds
    IF EXTRACT(EPOCH FROM (NOW() - v_last_check)) >= 30 THEN
      RAISE NOTICE 'wait_for_test_result: Still waiting for test result (job % phase %), waited %s/%s seconds',
        v_job_id, p_test_phase, v_waited, p_max_wait_seconds;
      v_last_check := NOW();
    END IF;
    
    PERFORM pg_sleep(v_wait_interval);
    v_waited := v_waited + v_wait_interval;
  END LOOP;
  
  -- Timeout - no result found
  RAISE WARNING 'wait_for_test_result: Timeout waiting for test result (job % phase %), waited %s seconds, checked % times. No result found after run_started_at %',
    v_job_id, p_test_phase, v_waited, v_check_count, v_run_started_at;
  
  RETURN NULL;
END;
$function$;

