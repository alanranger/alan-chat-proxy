-- Migration: Add RPC functions for managing cron.job_run_details
-- Date: 2025-11-16
-- Purpose: Enable API access to cron.job_run_details table via RPC functions
--          since the cron schema is not directly exposed to Supabase client

-- Function to delete job run details for a specific job
CREATE OR REPLACE FUNCTION delete_job_run_details(p_jobid int)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_before_count int;
  v_deleted_count int;
  v_after_count int;
BEGIN
  -- Count records before deletion
  SELECT COUNT(*) INTO v_before_count
  FROM cron.job_run_details
  WHERE jobid = p_jobid;
  
  -- Delete all records for this job
  DELETE FROM cron.job_run_details
  WHERE jobid = p_jobid;
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  
  -- Count records after deletion
  SELECT COUNT(*) INTO v_after_count
  FROM cron.job_run_details
  WHERE jobid = p_jobid;
  
  -- Return result as JSON
  RETURN jsonb_build_object(
    'deleted_count', v_deleted_count,
    'remaining_count', v_after_count,
    'before_count', v_before_count
  );
END;
$$;

-- Function to insert a job run detail record
CREATE OR REPLACE FUNCTION insert_job_run_detail(
  p_jobid int,
  p_command text,
  p_status text,
  p_return_message text,
  p_start_time timestamptz,
  p_end_time timestamptz,
  p_duration_ms int
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_inserted_id bigint;
  v_inserted_count int;
BEGIN
  -- Insert the record
  INSERT INTO cron.job_run_details (
    jobid,
    runid,
    job_pid,
    database,
    username,
    command,
    status,
    return_message,
    start_time,
    end_time,
    duration_ms
  ) VALUES (
    p_jobid,
    NULL, -- runid will be auto-generated
    NULL, -- job_pid
    NULL, -- database
    NULL, -- username
    p_command,
    p_status,
    p_return_message,
    p_start_time,
    p_end_time,
    p_duration_ms
  )
  RETURNING runid INTO v_inserted_id;
  
  v_inserted_count := 1;
  
  -- Return result as JSON
  RETURN jsonb_build_object(
    'inserted', v_inserted_count,
    'runid', v_inserted_id,
    'jobid', p_jobid
  );
EXCEPTION
  WHEN OTHERS THEN
    -- Return error information
    RETURN jsonb_build_object(
      'inserted', 0,
      'error', SQLERRM,
      'error_code', SQLSTATE
    );
END;
$$;

-- Grant execute permissions to authenticated users (adjust as needed for your security model)
GRANT EXECUTE ON FUNCTION delete_job_run_details(int) TO authenticated;
GRANT EXECUTE ON FUNCTION insert_job_run_detail(int, text, text, text, timestamptz, timestamptz, int) TO authenticated;

