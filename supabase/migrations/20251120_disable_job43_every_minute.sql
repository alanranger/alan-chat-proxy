-- Disable Job 43 which is incorrectly scheduled to run every minute
-- This job should not run every minute as it drops regression test tables

UPDATE cron.job
SET active = false
WHERE jobid = 43 AND schedule = '*/1 * * * *';

