-- Simple helper that lets us run a fixed SQL string and return json
-- Drop existing function if it exists (in case signature changed)
DROP FUNCTION IF EXISTS exec_sql(text);

CREATE FUNCTION exec_sql(text text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
BEGIN
  EXECUTE text INTO result;
  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION exec_sql(text) TO service_role;

