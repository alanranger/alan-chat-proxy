-- Function to run VACUUM ANALYZE on a table
-- VACUUM ANALYZE can run in a function (unlike VACUUM FULL which requires exclusive lock)

CREATE OR REPLACE FUNCTION public.vacuum_table(p_table_name text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result jsonb;
BEGIN
  -- Run VACUUM ANALYZE on the specified table
  -- Note: Table name must be schema-qualified (e.g., 'public.job_run_details')
  EXECUTE format('VACUUM ANALYZE %I', p_table_name);
  
  v_result := jsonb_build_object(
    'ok', true,
    'table', p_table_name,
    'message', 'VACUUM ANALYZE completed successfully'
  );
  
  RETURN v_result;
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'ok', false,
    'table', p_table_name,
    'error', SQLERRM,
    'message', 'VACUUM ANALYZE failed: ' || SQLERRM
  );
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.vacuum_table(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.vacuum_table(text) TO anon;

