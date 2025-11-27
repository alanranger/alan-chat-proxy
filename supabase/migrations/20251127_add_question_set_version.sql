-- Add question_set_version column to regression_test_results
-- This allows tracking which question set was used (legacy-40q vs canonical-64q)
-- Old tests will default to 'legacy-40q', new tests will use 'canonical-64q'

ALTER TABLE regression_test_results
ADD COLUMN IF NOT EXISTS question_set_version TEXT DEFAULT 'legacy-40q';

-- Update existing records to be explicitly marked as legacy
UPDATE regression_test_results
SET question_set_version = 'legacy-40q'
WHERE question_set_version IS NULL;

-- Add comment
COMMENT ON COLUMN regression_test_results.question_set_version IS 
  'Question set version: legacy-40q (old 40Q tests) or canonical-64q (new unified 64Q tests)';

