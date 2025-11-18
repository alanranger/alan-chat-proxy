-- Aggregate job run counts and last run metadata across public and cron schemas

create or replace function public.get_job_run_counts(p_job_ids integer[])
returns table(jobid integer, status text, run_count bigint)
language sql
stable
as $$
  select jobid, status, count(*) as run_count
  from (
    select jobid, status
    from public.job_run_details
    where jobid = any(p_job_ids)

    union all

    select jobid, status
    from cron.job_run_details
    where jobid = any(p_job_ids)
  ) combined
  group by jobid, status;
$$;

create or replace function public.get_job_last_runs(p_job_ids integer[])
returns table(
  jobid integer,
  status text,
  start_time timestamptz,
  end_time timestamptz,
  return_message text
)
language sql
stable
as $$
  with combined as (
    select jobid, status, start_time, end_time, return_message
    from public.job_run_details
    where jobid = any(p_job_ids)

    union all

    select jobid, status, start_time, end_time, return_message
    from cron.job_run_details
    where jobid = any(p_job_ids)
  ),
  ranked as (
    select *,
      row_number() over (
        partition by jobid
        order by coalesce(end_time, start_time) desc
      ) as rn
    from combined
  )
  select jobid, status, start_time, end_time, return_message
  from ranked
  where rn = 1;
$$;

