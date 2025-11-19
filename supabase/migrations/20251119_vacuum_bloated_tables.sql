-- Vacuum bloated tables to reduce dead rows and lower risk score
-- This will reduce bloat_risk from 50 to 10
-- Note: VACUUM cannot run in a transaction block, so these must be run individually

-- Vacuum job_progress (83.33% dead rows - worst offender)
VACUUM ANALYZE job_progress;

-- Vacuum chat_sessions (42.86% dead rows)  
VACUUM ANALYZE chat_sessions;

-- Vacuum chat_analytics_daily (if still > 2.5%)
VACUUM ANALYZE chat_analytics_daily;

-- Vacuum database_maintenance_run (0.81% dead rows)
VACUUM ANALYZE database_maintenance_run;

-- General VACUUM ANALYZE on entire database
VACUUM ANALYZE;

