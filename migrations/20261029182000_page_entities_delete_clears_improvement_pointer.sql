-- Deleting a page_entities row must not fail because an improvement note
-- still points at it. Keep the note; clear the pointer.
ALTER TABLE public.content_improvement_tracking
  DROP CONSTRAINT content_improvement_tracking_implemented_content_id_fkey;

ALTER TABLE public.content_improvement_tracking
  ADD CONSTRAINT content_improvement_tracking_implemented_content_id_fkey
  FOREIGN KEY (implemented_content_id)
  REFERENCES public.page_entities(id)
  ON DELETE SET NULL;
