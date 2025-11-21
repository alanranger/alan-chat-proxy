-- Update analyze_regression_test_run to use master baseline instead of test run's baseline_test_id
-- This ensures ALL jobs compare against the same master baseline

CREATE OR REPLACE FUNCTION analyze_regression_test_run(p_test_run_id bigint)
RETURNS TABLE(regression_detected boolean, regression_severity text, should_rollback boolean, detailed_analysis jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_run RECORD;
  v_comparison RECORD;
  v_should_rollback BOOLEAN := FALSE;
  v_detailed_analysis JSONB;
  v_master_baseline_id BIGINT;
  v_baseline_id_to_use BIGINT;
BEGIN
  SELECT * INTO v_run
  FROM regression_test_runs
  WHERE id = p_test_run_id;
  
  IF v_run.after_test_id IS NULL THEN
    RETURN QUERY SELECT FALSE, 'none', FALSE, '{}'::JSONB;
    RETURN;
  END IF;
  
  -- Get the master baseline (shared across all jobs)
  SELECT id INTO v_master_baseline_id
  FROM regression_test_results
  WHERE test_phase = 'before'
  AND is_fixed_baseline = TRUE
  ORDER BY test_timestamp DESC
  LIMIT 1;
  
  -- Use master baseline if it exists, otherwise fallback to test run's baseline_test_id
  IF v_master_baseline_id IS NOT NULL THEN
    v_baseline_id_to_use := v_master_baseline_id;
  ELSIF v_run.baseline_test_id IS NOT NULL THEN
    v_baseline_id_to_use := v_run.baseline_test_id;
  ELSE
    -- No baseline available
    RETURN QUERY SELECT FALSE, 'none', FALSE, '{}'::JSONB;
    RETURN;
  END IF;
  
  -- Use detailed comparison with master baseline
  SELECT * INTO v_comparison
  FROM compare_regression_test_results_detailed(v_baseline_id_to_use, v_run.after_test_id);
  
  -- Update the run record with baseline used
  UPDATE regression_test_runs
  SET 
    baseline_test_id = v_baseline_id_to_use, -- Update to master baseline
    regression_detected = v_comparison.regression_detected,
    regression_severity = v_comparison.regression_severity,
    status = CASE 
      WHEN v_comparison.regression_detected AND v_comparison.regression_severity IN ('severe', 'moderate')
      THEN 'regression_detected'
      ELSE 'completed'
    END
  WHERE id = p_test_run_id;
  
  -- Determine if rollback is needed (severe or moderate regressions)
  v_should_rollback := v_comparison.regression_detected 
    AND v_comparison.regression_severity IN ('severe', 'moderate');
  
  -- Build detailed analysis JSONB
  v_detailed_analysis := jsonb_build_object(
    'regression_details', v_comparison.regression_details,
    'article_changes', v_comparison.article_changes,
    'answer_quality_changes', v_comparison.answer_quality_changes,
    'query_specific_regressions', v_comparison.query_specific_regressions,
    'baseline_stats', v_comparison.baseline_stats,
    'current_stats', v_comparison.current_stats,
    'baseline_used', v_baseline_id_to_use,
    'is_master_baseline', (v_baseline_id_to_use = v_master_baseline_id)
  );
  
  RETURN QUERY SELECT 
    v_comparison.regression_detected,
    v_comparison.regression_severity,
    v_should_rollback,
    v_detailed_analysis;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION analyze_regression_test_run(bigint) TO service_role;

-- Comment on function
COMMENT ON FUNCTION analyze_regression_test_run(bigint) IS 
  'Analyzes a regression test run by comparing the after test against the MASTER BASELINE (shared across all jobs). If no master baseline exists, falls back to the test run''s baseline_test_id. This ensures all jobs use the same reference point for regression detection.';

