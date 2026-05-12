-- Supports api/chat-improvement.js upsert(..., { onConflict: 'question' }).
-- Remove duplicate questions (keep row with largest id) so the unique index can be created.
DELETE FROM public.content_improvement_tracking
WHERE id IN (
  SELECT id
  FROM (
    SELECT id,
           ROW_NUMBER() OVER (PARTITION BY question ORDER BY id DESC) AS rn
    FROM public.content_improvement_tracking
  ) ranked
  WHERE ranked.rn > 1
);

CREATE UNIQUE INDEX uniq_improvement_tracking_question ON public.content_improvement_tracking (question);
