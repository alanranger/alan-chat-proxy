-- Fix job 26 cron command and disable jobs 27 and 28
-- Job 26 should call trigger_refresh_master_job() which handles all batches internally
-- Jobs 27 and 28 should be disabled since they're chained internally by job 26

-- Fix job 26 to use the correct function
UPDATE cron.job
SET command = 'SELECT trigger_refresh_master_job();'
WHERE jobid = 26;

-- Disable jobs 27 and 28 since they're handled internally by job 26
-- These jobs will still exist but won't run on schedule
-- They can be manually triggered if needed, but normally job 26 handles everything
UPDATE cron.job
SET active = false
WHERE jobid IN (27, 28);

COMMENT ON TABLE cron.job IS 'Job 26 runs trigger_refresh_master_job() which internally chains batches 0->1->2. Jobs 27 and 28 are disabled since they are handled internally.';

