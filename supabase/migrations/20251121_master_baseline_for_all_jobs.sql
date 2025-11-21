-- Update fixed baseline system to use ONE master baseline for ALL jobs
-- Instead of one per job, there should be only ONE master baseline that all jobs use

-- Drop the per-job unique index and create a global one
DROP INDEX IF EXISTS idx_regression_test_results_one_fixed_per_job;

-- Create unique index to ensure only ONE fixed baseline exists across ALL jobs
CREATE UNIQUE INDEX IF NOT EXISTS idx_regression_test_results_one_master_baseline
    ON regression_test_results(is_fixed_baseline)
    WHERE is_fixed_baseline = TRUE AND test_phase = 'before';

-- Update set_fixed_baseline function to unset ALL fixed baselines (not just for the job)
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

    -- Unset ALL fixed baselines across ALL jobs (only one master baseline allowed)
    UPDATE regression_test_results
    SET is_fixed_baseline = FALSE
    WHERE test_phase = 'before'
    AND is_fixed_baseline = TRUE;
    
    GET DIAGNOSTICS v_unset_count = ROW_COUNT;

    -- Set this baseline as the master fixed baseline
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
        'message', format('Master baseline updated. Unset %s old baseline(s), set new master baseline for all jobs.', v_unset_count)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update unset_fixed_baseline to unset the master baseline (no job_id needed)
CREATE OR REPLACE FUNCTION unset_fixed_baseline(
    p_job_id INTEGER DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_unset_count INTEGER;
BEGIN
    -- Unset the master baseline (only one exists, so job_id is optional)
    UPDATE regression_test_results
    SET is_fixed_baseline = FALSE
    WHERE test_phase = 'before'
    AND is_fixed_baseline = TRUE;
    
    GET DIAGNOSTICS v_unset_count = ROW_COUNT;

    RETURN jsonb_build_object(
        'ok', true,
        'unset_count', v_unset_count,
        'message', format('Master baseline unset. %s baseline(s) unset.', v_unset_count)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update get_fixed_baseline to return the master baseline (not job-specific)
CREATE OR REPLACE FUNCTION get_master_baseline()
RETURNS TABLE (
    id BIGINT,
    job_id INTEGER,
    test_phase TEXT,
    test_timestamp TIMESTAMPTZ,
    successful_tests INTEGER,
    failed_tests INTEGER,
    avg_confidence NUMERIC,
    total_questions INTEGER,
    results JSONB,
    created_at TIMESTAMPTZ,
    is_fixed_baseline BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        rtr.id,
        rtr.job_id,
        rtr.test_phase,
        rtr.test_timestamp,
        rtr.successful_tests,
        rtr.failed_tests,
        rtr.avg_confidence,
        rtr.total_questions,
        rtr.results,
        rtr.created_at,
        rtr.is_fixed_baseline
    FROM regression_test_results rtr
    WHERE rtr.test_phase = 'before'
    AND rtr.is_fixed_baseline = TRUE
    ORDER BY rtr.test_timestamp DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_master_baseline() TO service_role;

-- Comment on functions
COMMENT ON FUNCTION set_fixed_baseline(BIGINT, INTEGER) IS 
  'Sets a baseline as the MASTER fixed baseline for ALL jobs. Unsets any existing master baseline first. Only one master baseline exists across all jobs.';

COMMENT ON FUNCTION unset_fixed_baseline(INTEGER) IS 
  'Unsets the master fixed baseline. The job_id parameter is optional since there is only one master baseline for all jobs.';

COMMENT ON FUNCTION get_master_baseline() IS 
  'Returns the master fixed baseline that is used by ALL jobs for regression testing.';

