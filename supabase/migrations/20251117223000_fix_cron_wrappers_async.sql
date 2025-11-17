-- Revert wrapper functions to direct execution
-- The backend (admin.js) now handles fire-and-forget by not awaiting the RPC call
-- The wrapper functions still execute synchronously in PostgreSQL, but the HTTP request
-- returns immediately because we don't await the RPC call in the backend

-- 1️⃣ Master job wrapper (Job 26) - executes directly with 45min timeout
CREATE OR REPLACE FUNCTION trigger_refresh_master_job()
RETURNS void 
LANGUAGE plpgsql 
SECURITY DEFINER
SET statement_timeout TO '45min'
AS $$
BEGIN
  -- Execute the actual job - this will run for up to 45 minutes
  -- The backend doesn't await this, so HTTP request returns immediately
  PERFORM light_refresh_all_batches_with_regression_test();
END;
$$;

-- 2️⃣ Batch 1 wrapper (Job 27) - executes directly with 15min timeout
CREATE OR REPLACE FUNCTION trigger_refresh_batch1_job()
RETURNS void 
LANGUAGE plpgsql 
SECURITY DEFINER
SET statement_timeout TO '15min'
AS $$
BEGIN
  PERFORM light_refresh_batch_with_regression_test(1);
END;
$$;

-- 3️⃣ Batch 2 wrapper (Job 28) - executes directly with 15min timeout
CREATE OR REPLACE FUNCTION trigger_refresh_batch2_job()
RETURNS void 
LANGUAGE plpgsql 
SECURITY DEFINER
SET statement_timeout TO '15min'
AS $$
BEGIN
  PERFORM light_refresh_batch_with_regression_test(2);
END;
$$;

