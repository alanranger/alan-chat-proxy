-- Update job_progress table structure
DROP TABLE IF EXISTS public.job_progress CASCADE;

CREATE TABLE IF NOT EXISTS public.job_progress (
  jobid INTEGER NOT NULL,
  step INTEGER NOT NULL,
  total_steps INTEGER NOT NULL,
  progress INTEGER NOT NULL,              -- 0–100
  message TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (jobid)
);

-- Add the upsert helper
CREATE OR REPLACE FUNCTION update_job_progress(
  p_jobid INTEGER,
  p_step INTEGER,
  p_total INTEGER,
  p_message TEXT
)
RETURNS void 
LANGUAGE plpgsql 
AS $$
BEGIN
  INSERT INTO job_progress(jobid, step, total_steps, progress, message, updated_at)
  VALUES (p_jobid, p_step, p_total, LEAST(100, CEIL(100.0 * p_step / p_total)), p_message, NOW())
  ON CONFLICT (jobid)
  DO UPDATE SET
    step = EXCLUDED.step,
    total_steps = EXCLUDED.total_steps,
    progress = EXCLUDED.progress,
    message = EXCLUDED.message,
    updated_at = NOW();
END;
$$;

-- Add the reset helper
CREATE OR REPLACE FUNCTION clear_job_progress(p_jobid INTEGER)
RETURNS void 
LANGUAGE plpgsql 
AS $$
BEGIN
  DELETE FROM job_progress WHERE jobid = p_jobid;
END;
$$;

