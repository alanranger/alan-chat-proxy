-- Create wrapper functions for long-running jobs (26, 27, 28)
-- These wrappers allow PostgreSQL to execute the full jobs internally
-- without HTTP/Vercel timeout issues

-- 1️⃣ Master job wrapper (Job 26)
CREATE OR REPLACE FUNCTION trigger_refresh_master_job()
RETURNS void 
LANGUAGE plpgsql 
AS $$
BEGIN
  PERFORM light_refresh_all_batches_with_regression_test();
END;
$$;

-- 2️⃣ Batch 1 wrapper (Job 27)
CREATE OR REPLACE FUNCTION trigger_refresh_batch1_job()
RETURNS void 
LANGUAGE plpgsql 
AS $$
BEGIN
  PERFORM light_refresh_batch_with_regression_test(1);
END;
$$;

-- 3️⃣ Batch 2 wrapper (Job 28)
CREATE OR REPLACE FUNCTION trigger_refresh_batch2_job()
RETURNS void 
LANGUAGE plpgsql 
AS $$
BEGIN
  PERFORM light_refresh_batch_with_regression_test(2);
END;
$$;

