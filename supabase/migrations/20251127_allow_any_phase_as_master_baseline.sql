-- Allow any test (regardless of phase) to be set as master baseline
-- This removes the restriction that only 'before' phase tests can be baselines

-- Drop the old unique index that required test_phase = 'before'
DROP INDEX IF EXISTS idx_regression_test_results_one_master_baseline;

-- Create new unique index that allows any phase
CREATE UNIQUE INDEX IF NOT EXISTS idx_regression_test_results_one_master_baseline
    ON regression_test_results(is_fixed_baseline)
    WHERE is_fixed_baseline = TRUE;

-- Update set_fixed_baseline function to allow any phase
CREATE OR REPLACE FUNCTION set_fixed_baseline(
    p_test_result_id BIGINT,
    p_job_id INTEGER
)
RETURNS JSONB AS $$
DECLARE
    v_result JSONB;
    v_unset_count INTEGER;
    v_set_count INTEGER;
    v_test_phase TEXT;
BEGIN
    -- Verify the test result exists (any phase is allowed)
    SELECT test_phase INTO v_test_phase
    FROM regression_test_results 
    WHERE id = p_test_result_id 
    AND job_id = p_job_id;
    
    IF v_test_phase IS NULL THEN
        RETURN jsonb_build_object(
            'ok', false,
            'error', 'Test result not found for the given test_result_id and job_id'
        );
    END IF;

    -- Unset ALL fixed baselines across ALL jobs (only one master baseline allowed)
    UPDATE regression_test_results
    SET is_fixed_baseline = FALSE
    WHERE is_fixed_baseline = TRUE;
    
    GET DIAGNOSTICS v_unset_count = ROW_COUNT;

    -- Set this test as the master fixed baseline (regardless of phase)
    UPDATE regression_test_results
    SET is_fixed_baseline = TRUE
    WHERE id = p_test_result_id
    AND job_id = p_job_id;
    
    GET DIAGNOSTICS v_set_count = ROW_COUNT;

    RETURN jsonb_build_object(
        'ok', true,
        'test_result_id', p_test_result_id,
        'job_id', p_job_id,
        'test_phase', v_test_phase,
        'unset_count', v_unset_count,
        'set_count', v_set_count,
        'message', format('Master baseline updated (phase: %s). Unset %s old baseline(s), set new master baseline for all jobs.', v_test_phase, v_unset_count)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update unset_fixed_baseline to work with any phase
CREATE OR REPLACE FUNCTION unset_fixed_baseline(
    p_job_id INTEGER DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_unset_count INTEGER;
BEGIN
    -- Unset the master baseline (any phase)
    UPDATE regression_test_results
    SET is_fixed_baseline = FALSE
    WHERE is_fixed_baseline = TRUE;
    
    GET DIAGNOSTICS v_unset_count = ROW_COUNT;

    RETURN jsonb_build_object(
        'ok', true,
        'unset_count', v_unset_count,
        'message', format('Master baseline unset. %s baseline(s) unset.', v_unset_count)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update get_master_baseline to return any phase
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
    WHERE rtr.is_fixed_baseline = TRUE
    ORDER BY rtr.test_timestamp DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update comments
COMMENT ON FUNCTION set_fixed_baseline(BIGINT, INTEGER) IS 
  'Sets any test (regardless of phase) as the MASTER fixed baseline for ALL jobs. Unsets any existing master baseline first. Only one master baseline exists across all jobs.';

COMMENT ON FUNCTION unset_fixed_baseline(INTEGER) IS 
  'Unsets the master fixed baseline. The job_id parameter is optional since there is only one master baseline for all jobs. Works with any phase.';

COMMENT ON FUNCTION get_master_baseline() IS 
  'Returns the master fixed baseline (any phase) that is used by ALL jobs for regression testing.';

