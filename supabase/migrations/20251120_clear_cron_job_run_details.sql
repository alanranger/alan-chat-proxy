-- Function to clear all records from cron.job_run_details
-- This is needed because direct deletion via Supabase client may have permission issues

CREATE OR REPLACE FUNCTION public.clear_cron_job_run_details()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = cron, public
AS $$
DECLARE
  v_before_count int;
  v_deleted_count int;
  v_remaining_count int;
BEGIN
  -- Get count before deletion
  SELECT COUNT(*) INTO v_before_count FROM cron.job_run_details;

  -- Delete all records
  DELETE FROM cron.job_run_details;

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  -- Get count after deletion
  SELECT COUNT(*) INTO v_remaining_count FROM cron.job_run_details;

  RETURN jsonb_build_object(
    'before_count', v_before_count,
    'deleted_count', v_deleted_count,
    'remaining_count', v_remaining_count
  );
END;
$$;

-- Grant execute permission to authenticated users (required for Supabase API calls)
GRANT EXECUTE ON FUNCTION public.clear_cron_job_run_details() TO authenticated;
GRANT EXECUTE ON FUNCTION public.clear_cron_job_run_details() TO anon;

