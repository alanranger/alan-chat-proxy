-- Fix update_question_frequency function - table was dropped but function still references it
-- Since the table was dropped as redundant, we should either:
-- 1. Remove the function (if not needed)
-- 2. Update the function to not use the table (if the functionality is still needed)

-- Option: Update the function to be a no-op since the table was dropped
-- The table was dropped because it was redundant - question frequency can be calculated on-demand
CREATE OR REPLACE FUNCTION public.update_question_frequency()
RETURNS void
LANGUAGE plpgsql
AS $function$
BEGIN
  -- Table was dropped as redundant - this function is now a no-op
  -- Question frequency can be calculated on-demand from chat_interactions
  RAISE NOTICE 'update_question_frequency: chat_question_frequency table was dropped. This function is now a no-op.';
  RETURN;
END;
$function$;

COMMENT ON FUNCTION public.update_question_frequency() IS 
  'No-op function. The chat_question_frequency table was dropped as redundant. Question frequency can be calculated on-demand from chat_interactions.';

