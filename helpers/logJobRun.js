import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL;

const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

/**
 * Log a single job run event
 * Records:
 *  - jobid
 *  - status ("success" | "error")
 *  - return_message
 *  - start_time
 *  - end_time
 */
export async function logJobRun(jobid, status, return_message, start_time, end_time) {
  try {
    const { error } = await supabase
      .from('job_run_details')
      .insert([
        {
          jobid,
          status,
          return_message,
          start_time,
          end_time
        }
      ]);

    if (error) {
      console.error("Failed to insert job run log:", error);
      return false;
    }

    return true;
  } catch (e) {
    console.error("Unexpected error in logJobRun:", e);
    return false;
  }
}

