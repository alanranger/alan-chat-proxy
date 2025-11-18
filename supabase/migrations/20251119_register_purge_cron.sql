select cron.schedule(
  'purge-db-health',
  '0 3 * * *',
  $$ select purge_old_db_health(); $$
);

