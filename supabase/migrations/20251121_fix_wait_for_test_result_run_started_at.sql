-- Fix wait_for_test_result to use created_at instead of non-existent run_started_at
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
  RAISE WARNING 'wait_for_test_result: Timeout waiting for test result (job % phase %), waited %s seconds, checked % times. No result found after run created_at %',
    v_job_id, p_test_phase, v_waited, v_check_count, v_run_created_at;
  
  RETURN NULL;
END;
$function$;

COMMENT ON FUNCTION wait_for_test_result(bigint, text, integer) IS 
  'Waits for a regression test result to be created. Uses created_at from regression_test_runs (not run_started_at which does not exist).';

