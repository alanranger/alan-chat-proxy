-- Add fixed baseline system to regression_test_results
-- This prevents regression creep by always comparing against a known good baseline

-- Add is_fixed_baseline column
ALTER TABLE regression_test_results
    ADD COLUMN IF NOT EXISTS is_fixed_baseline BOOLEAN NOT NULL DEFAULT FALSE;

-- Create index for efficient querying of fixed baselines
CREATE INDEX IF NOT EXISTS idx_regression_test_results_fixed_baseline 
    ON regression_test_results(job_id, is_fixed_baseline) 
    WHERE is_fixed_baseline = TRUE;

-- Create unique partial index to ensure only one fixed baseline per job
-- This prevents multiple fixed baselines for the same job
CREATE UNIQUE INDEX IF NOT EXISTS idx_regression_test_results_one_fixed_per_job
    ON regression_test_results(job_id)
    WHERE is_fixed_baseline = TRUE AND test_phase = 'before';

-- Function to set a baseline as fixed (and unset others for the same job)
CREATE OR REPLACE FUNCTION set_fixed_baseline(
    p_test_result_id BIGINT,
    p_job_id INTEGER
)
RETURNS JSONB AS $$
DECLARE
    v_result JSONB;
    v_unset_count INTEGER;
    v_set_count INTEGER;
BEGIN
    -- Verify the test result exists and is a baseline (test_phase = 'before')
    IF NOT EXISTS (
        SELECT 1 FROM regression_test_results 
        WHERE id = p_test_result_id 
        AND job_id = p_job_id 
        AND test_phase = 'before'
    ) THEN
        RETURN jsonb_build_object(
            'ok', false,
            'error', 'Test result not found or is not a baseline (must be test_phase = ''before'')'
        );
    END IF;

    -- Unset all other fixed baselines for this job
    UPDATE regression_test_results
    SET is_fixed_baseline = FALSE
    WHERE job_id = p_job_id
    AND test_phase = 'before'
    AND is_fixed_baseline = TRUE
    AND id != p_test_result_id;
    
    GET DIAGNOSTICS v_unset_count = ROW_COUNT;

    -- Set this baseline as fixed
    UPDATE regression_test_results
    SET is_fixed_baseline = TRUE
    WHERE id = p_test_result_id
    AND job_id = p_job_id;
    
    GET DIAGNOSTICS v_set_count = ROW_COUNT;

    RETURN jsonb_build_object(
        'ok', true,
        'test_result_id', p_test_result_id,
        'job_id', p_job_id,
        'unset_count', v_unset_count,
        'set_count', v_set_count,
        'message', 'Fixed baseline updated successfully'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to unset fixed baseline for a job
CREATE OR REPLACE FUNCTION unset_fixed_baseline(
    p_job_id INTEGER
)
RETURNS JSONB AS $$
DECLARE
    v_unset_count INTEGER;
BEGIN
    UPDATE regression_test_results
    SET is_fixed_baseline = FALSE
    WHERE job_id = p_job_id
    AND test_phase = 'before'
    AND is_fixed_baseline = TRUE;
    
    GET DIAGNOSTICS v_unset_count = ROW_COUNT;

    RETURN jsonb_build_object(
        'ok', true,
        'job_id', p_job_id,
        'unset_count', v_unset_count,
        'message', 'Fixed baseline unset successfully'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION set_fixed_baseline(BIGINT, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION unset_fixed_baseline(INTEGER) TO service_role;

-- Comment on column
COMMENT ON COLUMN regression_test_results.is_fixed_baseline IS 
    'Marks this baseline as the fixed reference point for regression tests. Only one fixed baseline per job. Prevents regression creep by always comparing against a known good state.';


