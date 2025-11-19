-- Fix critical bug in cleanup_orphaned_records() function
-- BUG: Function was deleting ALL chunks because it compared pe.id = pc.csv_metadata_id
--      (csv_metadata_id references csv_metadata.id, NOT page_entities.id)
-- FIX: Match chunks to entities by URL instead

CREATE OR REPLACE FUNCTION cleanup_orphaned_records()
RETURNS TABLE(orphaned_chunks BIGINT, orphaned_entities BIGINT)
LANGUAGE plpgsql
AS $$
DECLARE
  v_chunks BIGINT;
  v_entities BIGINT;
BEGIN
  -- Delete page_chunks that have no matching page_entities by URL
  -- FIX: Match by URL, not by csv_metadata_id (which references csv_metadata, not page_entities)
  DELETE FROM page_chunks pc
  WHERE NOT EXISTS (
    SELECT 1 FROM page_entities pe 
    WHERE pe.url = pc.url
  );
  GET DIAGNOSTICS v_chunks = ROW_COUNT;
  
  -- Delete page_entities that reference non-existent csv_metadata
  DELETE FROM page_entities pe
  WHERE pe.csv_metadata_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM csv_metadata cm 
      WHERE cm.id = pe.csv_metadata_id
    );
  GET DIAGNOSTICS v_entities = ROW_COUNT;
  
  RETURN QUERY SELECT v_chunks, v_entities;
END;
$$;

-- Add comment explaining the fix
COMMENT ON FUNCTION cleanup_orphaned_records() IS 
'Cleans up orphaned records. FIXED: Now correctly matches page_chunks to page_entities by URL (not csv_metadata_id).';

