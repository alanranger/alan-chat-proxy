-- Register db-health-monitor as a cron job (runs every 6 hours)
SELECT cron.schedule(
  'db-health-monitor',
  '0 */6 * * *',
  $$ SELECT db_health_monitor(); $$
);

