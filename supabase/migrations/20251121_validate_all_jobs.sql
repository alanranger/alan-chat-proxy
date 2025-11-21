-- Comprehensive job validation function
-- Checks all active jobs for missing tables, functions, and other issues

CREATE OR REPLACE FUNCTION public.validate_all_jobs()
RETURNS TABLE(
  jobid BIGINT,
  jobname TEXT,
  command TEXT,
  status TEXT,
  issues TEXT[]
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  r_job RECORD;
  v_issues TEXT[];
  v_function_name TEXT;
  v_table_name TEXT;
  v_function_exists BOOLEAN;
  v_table_exists BOOLEAN;
  v_function_match TEXT;
  v_table_match TEXT;
BEGIN
  FOR r_job IN 
    SELECT j.jobid, j.jobname, j.command
    FROM cron.job j
    WHERE j.active = true
    ORDER BY j.jobid
  LOOP
    v_issues := ARRAY[]::TEXT[];
    
    -- Check for function calls in command
    -- Pattern: SELECT function_name(...)
    v_function_match := (regexp_match(r_job.command, 'SELECT\s+(\w+)\s*\(', 'i'))[1];
    
    IF v_function_match IS NOT NULL THEN
      -- Check if function exists
      SELECT EXISTS(
        SELECT 1 
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
          AND p.proname = v_function_match
      ) INTO v_function_exists;
      
      IF NOT v_function_exists THEN
        v_issues := v_issues || format('Function "%s" does not exist', v_function_match);
      END IF;
    END IF;
    
    -- Check for table references in DELETE/INSERT/UPDATE/TRUNCATE statements
    -- Pattern: DELETE FROM table_name, INSERT INTO table_name, UPDATE table_name, TRUNCATE table_name
    v_table_match := COALESCE(
      (regexp_match(r_job.command, '(?:DELETE\s+FROM|INSERT\s+INTO|UPDATE|TRUNCATE)\s+(\w+)', 'i'))[1],
      (regexp_match(r_job.command, 'FROM\s+(\w+)\s+WHERE', 'i'))[1]
    );
    
    IF v_table_match IS NOT NULL THEN
      -- Check if table exists
      SELECT EXISTS(
        SELECT 1 
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = v_table_match
      ) INTO v_table_exists;
      
      IF NOT v_table_exists THEN
        v_issues := v_issues || format('Table "%s" does not exist', v_table_match);
      END IF;
    END IF;
    
    -- Check for ANALYZE statements
    IF r_job.command ILIKE '%ANALYZE%' THEN
      v_table_match := (regexp_match(r_job.command, 'ANALYZE\s+(\w+)', 'i'))[1];
      IF v_table_match IS NOT NULL THEN
        SELECT EXISTS(
          SELECT 1 
          FROM information_schema.tables
          WHERE table_schema = 'public'
            AND table_name = v_table_match
        ) INTO v_table_exists;
        
        IF NOT v_table_exists THEN
          v_issues := v_issues || format('Table "%s" for ANALYZE does not exist', v_table_match);
        END IF;
      END IF;
    END IF;
    
    -- Return result (even if no issues, so we can see all jobs)
    RETURN QUERY SELECT 
      r_job.jobid,
      r_job.jobname,
      r_job.command,
      CASE 
        WHEN array_length(v_issues, 1) IS NULL THEN 'OK'
        ELSE 'ISSUES'
      END,
      v_issues;
  END LOOP;
END;
$function$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.validate_all_jobs() TO service_role;

COMMENT ON FUNCTION public.validate_all_jobs() IS 
  'Validates all active cron jobs for missing functions, tables, and other issues. Returns a table with job details and any issues found.';

