-- Fix delete_job_run_details to delete from public.job_run_details instead of cron.job_run_details
-- The dashboard reads from public.job_run_details, so we need to delete from there

CREATE OR REPLACE FUNCTION delete_job_run_details(p_jobid INTEGER)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_before_count int;
  v_deleted_count int;
  v_after_count int;
BEGIN
  -- Count records before deletion from public.job_run_details
  SELECT COUNT(*) INTO v_before_count
  FROM public.job_run_details
  WHERE jobid = p_jobid;
  
  -- Delete all records for this job from public.job_run_details
  DELETE FROM public.job_run_details
  WHERE jobid = p_jobid;
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  
  -- Count records after deletion
  SELECT COUNT(*) INTO v_after_count
  FROM public.job_run_details
  WHERE jobid = p_jobid;
  
  -- Also delete from cron.job_run_details if it exists (for consistency)
  DELETE FROM cron.job_run_details
  WHERE jobid = p_jobid;
  
  -- Return result as JSON
  RETURN jsonb_build_object(
    'deleted_count', v_deleted_count,
    'remaining_count', v_after_count,
    'before_count', v_before_count
  );
END;
$$;

