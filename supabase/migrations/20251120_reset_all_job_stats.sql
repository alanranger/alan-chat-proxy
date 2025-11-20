-- Create function to delete all job run statistics from public.job_run_details
-- This allows clearing all bogus/inflated run counts with one click

CREATE OR REPLACE FUNCTION delete_all_job_run_details()
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
  FROM public.job_run_details;
  
  -- Delete all records from public.job_run_details
  DELETE FROM public.job_run_details;
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  
  -- Count records after deletion (should be 0)
  SELECT COUNT(*) INTO v_after_count
  FROM public.job_run_details;
  
  -- Return result as JSON
  RETURN jsonb_build_object(
    'deleted_count', v_deleted_count,
    'remaining_count', v_after_count,
    'before_count', v_before_count
  );
END;
$$;

