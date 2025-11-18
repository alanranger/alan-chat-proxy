create or replace function purge_old_db_health()
returns void as $$
begin
  delete from db_health_snapshots
  where collected_at < now() - interval '30 days';

  delete from db_health_alerts
  where alert_at < now() - interval '30 days';
end;
$$ language plpgsql;

