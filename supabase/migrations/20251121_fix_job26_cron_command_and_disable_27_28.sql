-- Fix job 26 cron command and disable jobs 27 and 28
-- Job 26 should call trigger_refresh_master_job() which handles all batches internally
-- Jobs 27 and 28 should be disabled since they're chained internally by job 26

-- Fix job 26 to use the correct function
SELECT cron.alter_job(
  job_id := 26,
  command := 'SELECT trigger_refresh_master_job();'
);

-- Disable jobs 27 and 28 since they're handled internally by job 26
-- These jobs will still exist but won't run on schedule
-- They can be manually triggered if needed, but normally job 26 handles everything
SELECT cron.alter_job(
  job_id := 27,
  active := false
);

SELECT cron.alter_job(
  job_id := 28,
  active := false
);

