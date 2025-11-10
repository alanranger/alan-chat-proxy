-- Fix csv_metadata unique constraint to allow multiple entries per URL with different start dates
ALTER TABLE csv_metadata DROP CONSTRAINT IF EXISTS csv_metadata_csv_type_url_key;
ALTER TABLE csv_metadata ADD CONSTRAINT csv_metadata_csv_type_url_start_date_key UNIQUE (csv_type, url, start_date);
