-- Create table for tracking job progress
CREATE TABLE IF NOT EXISTS public.job_progress (
  jobid INTEGER NOT NULL,
  phase TEXT NOT NULL,
  percent INTEGER NOT NULL DEFAULT 0,
  message TEXT,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  PRIMARY KEY (jobid)
);

-- Add SQL helper function to update progress
CREATE OR REPLACE FUNCTION update_job_progress(
  in_jobid INTEGER,
  in_phase TEXT,
  in_percent INTEGER,
  in_message TEXT
)
RETURNS void 
LANGUAGE plpgsql 
AS $$
BEGIN
  INSERT INTO public.job_progress (jobid, phase, percent, message, updated_at)
  VALUES (in_jobid, in_phase, in_percent, in_message, NOW())
  ON CONFLICT (jobid)
  DO UPDATE SET
    phase = EXCLUDED.phase,
    percent = EXCLUDED.percent,
    message = EXCLUDED.message,
    updated_at = NOW();
END;
$$;

