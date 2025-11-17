-- migration runs as supabase_admin (only place where owner change works)
DO $$
BEGIN
  -- 6-arg original
  BEGIN
    ALTER FUNCTION public.insert_job_run_detail(
      int, text, text, text, timestamptz, timestamptz
    ) OWNER TO supabase_admin;
    ALTER FUNCTION public.insert_job_run_detail(
      int, text, text, text, timestamptz, timestamptz
    ) SECURITY DEFINER;
  EXCEPTION WHEN undefined_function THEN
    RAISE NOTICE '6-arg function missing';
  END;

  -- 6-arg duplicate
  BEGIN
    ALTER FUNCTION public.insert_job_run_detail(
      int, text, text, text, timestamptz, timestamptz
    ) OWNER TO supabase_admin;
    ALTER FUNCTION public.insert_job_run_detail(
      int, text, text, text, timestamptz, timestamptz
    ) SECURITY DEFINER;
  EXCEPTION WHEN undefined_function THEN
    RAISE NOTICE 'duplicate 6-arg missing';
  END;

  -- 7-arg form (if exists)
  BEGIN
    ALTER FUNCTION public.insert_job_run_detail(
      int, text, text, text, timestamptz, timestamptz, int
    ) OWNER TO supabase_admin;
    ALTER FUNCTION public.insert_job_run_detail(
      int, text, text, text, timestamptz, timestamptz, int
    ) SECURITY DEFINER;
  EXCEPTION WHEN undefined_function THEN
    RAISE NOTICE '7-arg missing';
  END;
END $$;
