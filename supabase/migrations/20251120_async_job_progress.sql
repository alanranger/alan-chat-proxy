-- Enable asynchronous job progress updates by writing through a separate HTTP call
-- This allows progress bars in the dashboard to update while long-running jobs execute

CREATE OR REPLACE FUNCTION public.record_job_progress(
  job_id integer,
  step integer,
  total_steps integer,
  message text,
  progress_override integer DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_progress integer;
BEGIN
  IF total_steps IS NULL OR total_steps <= 0 THEN
    v_progress := COALESCE(progress_override, 0);
  ELSE
    v_progress := COALESCE(progress_override, LEAST(100, CEIL(100.0 * step / total_steps)));
  END IF;

  INSERT INTO job_progress(jobid, step, total_steps, progress, message, updated_at)
  VALUES (job_id, step, total_steps, v_progress, COALESCE(message, 'In progress'), NOW())
  ON CONFLICT (jobid)
  DO UPDATE SET
    step = EXCLUDED.step,
    total_steps = EXCLUDED.total_steps,
    progress = EXCLUDED.progress,
    message = EXCLUDED.message,
    updated_at = NOW();
END;
$function$;


CREATE OR REPLACE FUNCTION public.update_job_progress(
  p_jobid integer,
  p_step integer,
  p_total integer,
  p_message text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_service_key text;
  v_progress integer;
  v_headers jsonb;
  v_body jsonb;
  v_request_id bigint;
  v_api_url constant text := 'https://igzvwbvgvmzvvzoclufx.supabase.co/rest/v1/rpc/record_job_progress';
BEGIN
  IF p_total IS NULL OR p_total <= 0 THEN
    v_progress := 0;
  ELSE
    v_progress := LEAST(100, CEIL(100.0 * p_step / p_total));
  END IF;

  BEGIN
    SELECT _internal.get_service_role_key() INTO v_service_key;
  EXCEPTION WHEN OTHERS THEN
    v_service_key := NULL;
  END;

  IF v_service_key IS NULL THEN
    PERFORM record_job_progress(p_jobid, p_step, p_total, p_message, v_progress);
    RETURN;
  END IF;

  v_headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'apikey', v_service_key,
    'Authorization', 'Bearer ' || v_service_key
  );

  v_body := jsonb_build_object(
    'job_id', p_jobid,
    'step', p_step,
    'total_steps', p_total,
    'message', COALESCE(p_message, 'In progress'),
    'progress_override', v_progress
  );

  BEGIN
    v_request_id := net.http_post(
      url := v_api_url,
      headers := v_headers,
      body := v_body
    );
  EXCEPTION WHEN OTHERS THEN
    PERFORM record_job_progress(p_jobid, p_step, p_total, p_message, v_progress);
    RETURN;
  END;

  BEGIN
    PERFORM net.http_get_result(v_request_id);
  EXCEPTION WHEN OTHERS THEN
    PERFORM record_job_progress(p_jobid, p_step, p_total, p_message, v_progress);
  END;
END;
$function$;

