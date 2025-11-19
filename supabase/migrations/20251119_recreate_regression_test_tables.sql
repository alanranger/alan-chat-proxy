-- Recreate regression test tables that were accidentally dropped
-- These tables are essential for regression testing functionality

-- Table: regression_test_runs
-- Tracks test run sessions that include baseline and after tests
CREATE TABLE IF NOT EXISTS regression_test_runs (
    id BIGSERIAL PRIMARY KEY,
    job_id INTEGER NOT NULL,
    job_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'running',
    baseline_test_id BIGINT,
    after_test_id BIGINT,
    regression_detected BOOLEAN DEFAULT FALSE,
    regression_severity TEXT,
    job_executed BOOLEAN DEFAULT FALSE,
    run_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table: regression_test_results
-- Stores individual test results (baseline or after) for each job
CREATE TABLE IF NOT EXISTS regression_test_results (
    id BIGSERIAL PRIMARY KEY,
    job_id INTEGER NOT NULL,
    test_phase TEXT NOT NULL CHECK (test_phase IN ('before', 'after')),
    test_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    successful_tests INTEGER NOT NULL DEFAULT 0,
    failed_tests INTEGER NOT NULL DEFAULT 0,
    avg_confidence NUMERIC(5, 3),
    total_questions INTEGER NOT NULL DEFAULT 0,
    results JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_regression_test_runs_job_id ON regression_test_runs(job_id);
CREATE INDEX IF NOT EXISTS idx_regression_test_runs_status ON regression_test_runs(status);
CREATE INDEX IF NOT EXISTS idx_regression_test_runs_run_started_at ON regression_test_runs(run_started_at DESC);

CREATE INDEX IF NOT EXISTS idx_regression_test_results_job_id ON regression_test_results(job_id);
CREATE INDEX IF NOT EXISTS idx_regression_test_results_test_phase ON regression_test_results(test_phase);
CREATE INDEX IF NOT EXISTS idx_regression_test_results_test_timestamp ON regression_test_results(test_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_regression_test_results_job_phase ON regression_test_results(job_id, test_phase);

-- Foreign key constraints
ALTER TABLE regression_test_runs
    DROP CONSTRAINT IF EXISTS fk_regression_test_runs_baseline,
    ADD CONSTRAINT fk_regression_test_runs_baseline 
        FOREIGN KEY (baseline_test_id) 
        REFERENCES regression_test_results(id) 
        ON DELETE SET NULL;

ALTER TABLE regression_test_runs
    DROP CONSTRAINT IF EXISTS fk_regression_test_runs_after,
    ADD CONSTRAINT fk_regression_test_runs_after 
        FOREIGN KEY (after_test_id) 
        REFERENCES regression_test_results(id) 
        ON DELETE SET NULL;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_regression_test_runs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS trigger_regression_test_runs_updated_at ON regression_test_runs;
CREATE TRIGGER trigger_regression_test_runs_updated_at
    BEFORE UPDATE ON regression_test_runs
    FOR EACH ROW
    EXECUTE FUNCTION update_regression_test_runs_updated_at();

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON regression_test_runs TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON regression_test_results TO service_role;
GRANT USAGE, SELECT ON SEQUENCE regression_test_runs_id_seq TO service_role;
GRANT USAGE, SELECT ON SEQUENCE regression_test_results_id_seq TO service_role;

