-- Function to clear all records from cron.job_run_details
-- This is needed because direct deletion via Supabase client may have permission issues
-- Note: cron.job_run_details is a system table, so we use TRUNCATE which is more reliable

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

  -- Use TRUNCATE instead of DELETE for system tables (more reliable)
  -- TRUNCATE is faster and works better with system tables
  TRUNCATE TABLE cron.job_run_details;

  -- TRUNCATE doesn't set ROW_COUNT, so use the before_count as deleted_count
  v_deleted_count := v_before_count;

  -- Get count after truncation
  SELECT COUNT(*) INTO v_remaining_count FROM cron.job_run_details;
  
  -- Note: VACUUM cannot run inside a function - it must be run separately
  -- VACUUM will be handled by the API after this function completes

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

