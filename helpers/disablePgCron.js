export async function disablePgCronJobs(supabase) {
  try {
    // List current cron jobs
    const { data: jobs, error } = await supabase.rpc("cron_job_list");

    if (error) return;

    // Disable each job by pausing it
    for (const job of jobs) {
      await supabase.rpc("cron_job_update", {
        job_id: job.jobid,
        schedule: null,       // removes schedule
        active: false
      });
    }
  } catch (err) {
    console.error("Failed to disable pg_cron jobs:", err);
  }
}

