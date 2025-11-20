-- Function to terminate a running job by PID
-- This allows manual cancellation of stuck jobs

CREATE OR REPLACE FUNCTION public.terminate_job_process(p_pid integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_result jsonb;
  v_pid_exists boolean;
BEGIN
  -- Check if PID exists in pg_stat_activity
  SELECT EXISTS(
    SELECT 1 FROM pg_stat_activity 
    WHERE pid = p_pid 
    AND datname = current_database()
  ) INTO v_pid_exists;
  
  IF NOT v_pid_exists THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Process not found',
      'pid', p_pid
    );
  END IF;
  
  -- Terminate the process
  PERFORM pg_terminate_backend(p_pid);
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Process terminated',
    'pid', p_pid
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM,
    'pid', p_pid
  );
END;
$function$;

