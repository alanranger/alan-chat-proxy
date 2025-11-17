// /api/admin.js
// Consolidated admin utilities
// Handles QA spot checks and data refresh operations
// Replaces: qa-spot-checks.js, refresh-mappings.js

import { createClient } from '@supabase/supabase-js';

// Prefer environment variables set in the deployment; fall back only if missing
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://igzvwbvgvmzvvzoclufx.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
// Match the hardcoded UI token as a fallback so the button works
const EXPECTED_TOKEN = (process.env.INGEST_TOKEN || '').trim() || 'b6c3f0c9e6f44cce9e1a4f3f2d3a5c76';

// Initialize Supabase client with error handling
if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('ERROR: SUPABASE_SERVICE_ROLE_KEY is not set!');
}

const supabase = SUPABASE_SERVICE_ROLE_KEY 
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  : null;

export default async function handler(req, res) {
  // Wrap entire handler in try-catch to ensure JSON responses
  try {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Content-Type', 'application/json');

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    // Authentication
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    if (!token || token !== EXPECTED_TOKEN) {
      return res.status(401).json({ error: 'unauthorized' });
    }

    const { action } = req.query || {};

    // Check if Supabase client is initialized
    if (!supabase) {
      return res.status(500).json({ 
        error: 'Server configuration error', 
        detail: 'Supabase client not initialized. Check SUPABASE_SERVICE_ROLE_KEY environment variable.' 
      });
    }

    // Read-only aggregate helper
    const fetchJobRunAggregates = async (jobIds = []) => {
      if (!Array.isArray(jobIds) || jobIds.length === 0) {
        return { statusAggregates: [], lastRunRows: [] };
      }

      // 1) Success / fail / total counts grouped by job + status
      const { data: statusAggregates, error: aggErr } = await supabase
        .from('job_run_details')
        .select('jobid, status, count: count(*)')
        .in('jobid', jobIds)
        .group('jobid, status');

      if (aggErr) {
        console.error('Error fetching status aggregates:', aggErr);
        return { statusAggregates: [], lastRunRows: [] };
      }

      // 2) Last run timestamps per job
      const { data: lastRunRows, error: lastErr } = await supabase
        .from('job_run_details')
        .select('jobid, last_run: max(start_time)')
        .in('jobid', jobIds)
        .group('jobid');

      if (lastErr) {
        console.error('Error fetching last run rows:', lastErr);
        return { statusAggregates, lastRunRows: [] };
      }

      return { statusAggregates, lastRunRows };
    };

    // QA Spot Checks (GET /api/admin?action=qa)
    if (req.method === 'GET' && action === 'qa') {
      const checks = [
        { name: 'page_entities', type: 'table', columns: 'url, kind, title, date_start, date_end, location, price', order: 'date_start', limit: 5 },
        { name: 'page_chunks', type: 'table', columns: 'url, tokens', order: 'tokens', limit: 3 },
        { name: 'event_product_links_auto', type: 'table', columns: 'event_url, product_url, score, method', order: 'score', limit: 10 },

        // Views (some may not exist in every environment)
        { name: 'v_events_real_data', type: 'view', columns: '*', order: 'date_start', limit: 5 },
        { name: 'v_event_product_final', type: 'view', columns: 'event_url, product_url, product_title, price_gbp, availability, start_time, end_time', order: 'event_url', limit: 5 },
        { name: 'v_event_product_final_enhanced', type: 'view', columns: 'event_url, product_url, product_title, price_gbp, availability, start_time, end_time, event_location, participants, fitness_level, event_title', order: 'event_url', limit: 5 },
        { name: 'v_events_for_chat', type: 'view', columns: '*', order: 'date_start', limit: 5 },

        { name: 'v_events_csv_source', type: 'view', columns: '*', order: 'date_start', limit: 5 },
        { name: 'v_products_scraped', type: 'view', columns: '*', order: 'last_seen', limit: 5 },
        
        // Legacy or optional views (ignore if missing)
        { name: 'v_event_product_mappings', type: 'view', columns: 'event_url, product_url, method, specificity, score', order: 'score', limit: 10 },
        { name: 'v_event_product_pricing_combined', type: 'view', columns: '*', order: 'price_gbp', limit: 5 },

        { name: 'v_blog_content', type: 'view', columns: 'url, title, tags', order: 'url', limit: 5 },
        { name: 'v_service_content', type: 'view', columns: 'url, title, tags', order: 'url', limit: 5 },
        { name: 'v_product_content', type: 'view', columns: 'url, title, tags', order: 'url', limit: 5 },
        { name: 'v_enriched_content_for_ai', type: 'view', columns: 'url, kind, title', order: 'url', limit: 10 }
      ];

      async function safeCount(name) {
        try {
          const { error, count } = await supabase.from(name).select('*', { count: 'exact', head: true });
          if (error) return { error: error.message };
          return { count: count ?? 0 };
        } catch (e) {
          return { error: String(e.message || e) };
        }
      }

      async function safeSample(name, columns, order, limit) {
        try {
          const q = supabase.from(name).select(columns).limit(limit);
          if (order) q.order(order, { ascending: true, nullsFirst: false });
          const { data, error } = await q;
          if (error) return { error: error.message };
          return { sample: data || [] };
        } catch (e) {
          return { error: String(e.message || e) };
        }
      }

      const out = {};
      for (const c of checks) {
        const cnt = await safeCount(c.name);
        const sam = await safeSample(c.name, c.columns, c.order, c.limit);
        if (cnt.error) out[c.name] = { status: 'error', detail: cnt.error };
        else out[c.name] = { status: 'ok', count: cnt.count, sample: sam.sample || [] };
      }

      return res.status(200).json({ ok: true, checks: out });
    }

    // Refresh Mappings (POST /api/admin?action=refresh)
    if (req.method === 'POST' && action === 'refresh') {
      try {
        // Attempt to raise statement timeout for this session (best-effort)
        try {
          await supabase.rpc('set_config', { parameter: 'statement_timeout', value: '120000', is_local: true });
      } catch (e) {
        // Ignore timeout config errors
      }

      // Get current count before refresh
      const { data: beforeData, error: beforeError } = await supabase
        .from('event_product_links_auto')
        .select('*', { count: 'exact', head: true });

      if (beforeError) {
        console.error('Error getting before count:', beforeError);
        return res.status(500).json({ 
          error: 'Failed to get before count', 
          detail: beforeError.message 
        });
      }

      const beforeCount = beforeData?.length || 0;

      // Call the refresh function directly
      console.log('Calling refresh_event_product_autolinks function...');
      const { error: refreshError } = await supabase
        .rpc('refresh_event_product_autolinks');

      if (refreshError) {
        console.error('Error calling refresh function:', refreshError);
        return res.status(500).json({ 
          error: 'Failed to refresh mappings', 
          detail: refreshError.message,
          code: refreshError.code,
          hint: refreshError.hint
        });
      }

      console.log('Refresh function completed successfully');

      // Get count after refresh
      const { data: afterData, error: afterError } = await supabase
        .from('event_product_links_auto')
        .select('*', { count: 'exact', head: true });

      if (afterError) {
        console.error('Error getting after count:', afterError);
        return res.status(500).json({ 
          error: 'Failed to get after count', 
          detail: afterError.message 
        });
      }

      const afterCount = afterData?.length || 0;
      const mappingsCreated = afterCount - beforeCount;

      // Get some sample mappings to show what was created
      const { data: sampleMappings, error: sampleError } = await supabase
        .from('event_product_links_auto')
        .select('event_url, product_url, score, method')
        .order('score', { ascending: false })
        .limit(5);

      if (sampleError) {
        console.error('Error getting sample mappings:', sampleError);
      }

      return res.status(200).json({
        ok: true,
        message: 'Event-product mappings refreshed successfully',
        beforeCount,
        afterCount,
        mappingsCreated,
        sampleMappings: sampleMappings || []
      });

      } catch (error) {
        console.error('Unexpected error in refresh-mappings:', error);
        return res.status(500).json({ 
          error: 'Internal server error', 
          detail: error.message 
        });
      }
    } else if (action === 'cron_status') {
      if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed for cron_status action' });
      }
      try {
        const { data: cronJobs, error: cronError } = await supabase
          .rpc('get_cron_jobs');

        if (cronError) {
          console.error('Error getting cron jobs:', cronError);
          return res.status(500).json({ 
            error: 'Failed to get cron jobs', 
            detail: cronError.message 
          });
        }

        return res.status(200).json({
          ok: true,
          cron_jobs: cronJobs || []
        });

      } catch (error) {
        console.error('Unexpected error in cron status check:', error);
        return res.status(500).json({ 
          error: 'Internal server error', 
          detail: error.message 
        });
      }
    } else if (action === 'aggregate_analytics') {
      if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed for aggregate_analytics action' });
      }
      try {
        const { date } = req.body || {};
        const targetDate = date || new Date().toISOString().split('T')[0];

        console.log('Running analytics aggregation for date:', targetDate);
        
        const { data: aggData, error: aggError } = await supabase
          .rpc('aggregate_daily_analytics', { target_date: targetDate });

        if (aggError) {
          console.error('Error running analytics aggregation:', aggError);
          return res.status(500).json({ 
            error: 'Failed to aggregate analytics', 
            detail: aggError.message 
          });
        }

        console.log('Analytics aggregation completed successfully');

        const { data: updateData, error: updateError } = await supabase
          .rpc('update_question_frequency');

        if (updateError) {
          console.error('Error updating question frequency:', updateError);
          return res.status(500).json({ 
            error: 'Failed to update question frequency', 
            detail: updateError.message 
          });
        }

        return res.status(200).json({
          ok: true,
          message: 'Analytics aggregation completed successfully',
          date: targetDate,
          aggregationResult: aggData,
          frequencyUpdateResult: updateData
        });

      } catch (error) {
        console.error('Unexpected error in analytics aggregation:', error);
        return res.status(500).json({ 
          error: 'Internal server error', 
          detail: error.message 
        });
      }
    }

    // Cron Job Management (GET /api/admin?action=cron_jobs)
    if (req.method === 'GET' && action === 'cron_jobs') {
      try {
        const { data: baseJobs, error: jobsError } = await supabase.rpc('get_cron_jobs');

        if (jobsError) {
          console.error('Error getting cron jobs:', jobsError);
          return res.status(500).json({ error: 'Failed to get cron jobs', detail: jobsError.message });
        }

        const jobs = baseJobs || [];
        const jobIds = jobs
          .map((job) => parseInt(job.jobid, 10))
          .filter((id) => Number.isFinite(id));

        let statusAggregates = [];
        let lastRunRows = [];
        if (jobIds.length > 0) {
          const aggregates = await fetchJobRunAggregates(jobIds);
          statusAggregates = aggregates.statusAggregates;
          lastRunRows = aggregates.lastRunRows;
        }

        const statsMap = new Map();
        jobIds.forEach((id) => {
          statsMap.set(id, { success_count: 0, failed_count: 0, total_runs: 0 });
        });

        statusAggregates.forEach((row) => {
          const jobId = parseInt(row.jobid, 10);
          if (!Number.isFinite(jobId)) return;

          const countValue = Number(row.count) || 0;
          const normalizedStatus = (row.status || '').toLowerCase();
          const current = statsMap.get(jobId) || { success_count: 0, failed_count: 0, total_runs: 0 };

          current.total_runs += countValue;
          if (normalizedStatus === 'succeeded' || normalizedStatus === 'success') {
            current.success_count += countValue;
          } else if (normalizedStatus === 'failed' || normalizedStatus === 'error') {
            current.failed_count += countValue;
          }

          statsMap.set(jobId, current);
        });

        const lastRunMap = new Map();
        lastRunRows.forEach((row) => {
          const jobId = parseInt(row.jobid, 10);
          if (!Number.isFinite(jobId) || !row.last_run) return;
          lastRunMap.set(jobId, row.last_run);
        });

        const enrichedJobs = jobs.map((job) => {
          const jobId = parseInt(job.jobid, 10);
          const stats = statsMap.get(jobId) || { success_count: 0, failed_count: 0, total_runs: 0 };
          const aggregatedLastRun = lastRunMap.get(jobId);

          return {
            ...job,
            total_runs: stats.total_runs,
            success_count: stats.success_count,
            failed_count: stats.failed_count,
            last_run: aggregatedLastRun || job.last_run || null
          };
        });

        return res.status(200).json({ ok: true, jobs: enrichedJobs });

      } catch (error) {
        console.error('Error getting cron jobs:', error);
        return res.status(500).json({ error: 'Internal server error', detail: error.message });
      }
    }

    // Get Cron Job Logs (GET /api/admin?action=cron_logs&jobid=19&limit=50)
    if (req.method === 'GET' && action === 'cron_logs') {
      try {
        const jobid = parseInt(req.query.jobid, 10);
        const limitParam = parseInt(req.query.limit, 10) || 50;
        const limit = Math.min(Math.max(limitParam, 1), 500);

        if (!Number.isFinite(jobid)) {
          return res.status(400).json({ error: 'jobid parameter required' });
        }

        const { data: logs, error: logsError } = await supabase
          .from('job_run_details')
          .select('id, jobid, status, command, return_message, start_time, end_time, duration_ms, created_at')
          .eq('jobid', jobid)
          .order('start_time', { ascending: false })
          .limit(limit);

        if (logsError) {
          console.error('Error querying job run details:', logsError);
          return res.status(500).json({ error: 'Failed to get logs', detail: logsError.message });
        }

        return res.status(200).json({ ok: true, logs: logs || [] });

      } catch (error) {
        console.error('Error getting cron logs:', error);
        return res.status(500).json({ error: 'Internal server error', detail: error.message });
      }
    }

    // Update Cron Job Schedule (POST /api/admin?action=update_cron_schedule)
    if (req.method === 'POST' && action === 'update_cron_schedule') {
      try {
        const { jobid, schedule } = req.body;

        if (!jobid || !schedule) {
          return res.status(400).json({ error: 'jobid and schedule parameters required' });
        }

        // Validate cron schedule format (basic check)
        const cronPattern = /^(\*|([0-9]|[1-5][0-9])|\*\/([0-9]|[1-5][0-9])) (\*|([0-9]|1[0-9]|2[0-3])|\*\/([0-9]|1[0-9]|2[0-3])) (\*|([1-9]|[12][0-9]|3[01])|\*\/([1-9]|[12][0-9]|3[01])) (\*|([1-9]|1[0-2])|\*\/([1-9]|1[0-2])) (\*|([0-6])|\*\/([0-6]))$/;
        if (!cronPattern.test(schedule)) {
          return res.status(400).json({ error: 'Invalid cron schedule format' });
        }

        // Update the schedule using cron.alter_job via a database function
        const { error } = await supabase.rpc('update_cron_schedule', {
          p_jobid: jobid,
          p_schedule: schedule
        });

        if (error) {
          return res.status(500).json({ error: 'Failed to update schedule', detail: error.message });
        }

        return res.status(200).json({ 
          ok: true, 
          message: 'Schedule updated successfully',
          jobid,
          schedule
        });

      } catch (error) {
        console.error('Error updating cron schedule:', error);
        return res.status(500).json({ error: 'Internal server error', detail: error.message });
      }
    }

    // Toggle Cron Job Active Status (POST /api/admin?action=toggle_cron_job)
    if (req.method === 'POST' && action === 'toggle_cron_job') {
      try {
        const { jobid, active } = req.body;

        if (jobid === undefined || active === undefined) {
          return res.status(400).json({ error: 'jobid and active parameters required' });
        }

        if (typeof active !== 'boolean') {
          return res.status(400).json({ error: 'active must be a boolean' });
        }

        // Toggle the active status using cron.alter_job via a database function
        const { error } = await supabase.rpc('toggle_cron_job_active', {
          p_jobid: jobid,
          p_active: active
        });

        if (error) {
          return res.status(500).json({ error: 'Failed to toggle job status', detail: error.message });
        }

        return res.status(200).json({ 
          ok: true, 
          message: `Job ${jobid} ${active ? 'activated' : 'paused'} successfully`,
          jobid,
          active
        });

      } catch (error) {
        console.error('Error toggling cron job status:', error);
        return res.status(500).json({ error: 'Internal server error', detail: error.message });
      }
    }

    // Run Regression Test (POST /api/admin?action=run_regression_test)
    if (req.method === 'POST' && action === 'run_regression_test') {
      try {
        const { job_id, job_name, test_phase } = req.body;

        if (!job_id || !test_phase) {
          return res.status(400).json({ error: 'job_id and test_phase (before/after) required' });
        }

        // Call the Edge Function to run the 40Q test
        const edgeFunctionUrl = `${SUPABASE_URL}/functions/v1/run-40q-regression-test`;
        
        const response = await fetch(edgeFunctionUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
          },
          body: JSON.stringify({
            job_id,
            job_name: job_name || `Job ${job_id}`,
            test_phase
          })
        });

        const data = await response.json();
        
        if (!data.ok) {
          throw new Error(data.error || 'Failed to run regression test');
        }

        return res.status(200).json({
          ok: true,
          test_result_id: data.test_result_id,
          successful_tests: data.successful_tests,
          failed_tests: data.failed_tests,
          avg_confidence: data.avg_confidence,
          total_questions: data.total_questions,
          duration: data.duration
        });

      } catch (error) {
        console.error('Error running regression test:', error);
        return res.status(500).json({ error: 'Internal server error', detail: error.message });
      }
    }

    // Compare Regression Test Results (POST /api/admin?action=compare_regression_tests)
    if (req.method === 'POST' && action === 'compare_regression_tests') {
      try {
        const { baseline_test_id, current_test_id } = req.body;

        if (!baseline_test_id || !current_test_id) {
          return res.status(400).json({ error: 'baseline_test_id and current_test_id required' });
        }

        // Call SQL function to compare
        const { data, error } = await supabase.rpc('compare_regression_test_results', {
          baseline_test_id,
          current_test_id
        });

        if (error) {
          throw new Error(error.message);
        }

        return res.status(200).json({
          ok: true,
          comparison: data[0] || data
        });

      } catch (error) {
        console.error('Error comparing regression tests:', error);
        return res.status(500).json({ error: 'Internal server error', detail: error.message });
      }
    }

    // Get Regression Test Results for a Job (GET /api/admin?action=regression_test_results&jobid=21)
    if (req.method === 'GET' && action === 'regression_test_results') {
      try {
        const jobid = parseInt(req.query.jobid);

        if (!jobid) {
          return res.status(400).json({ error: 'jobid parameter required' });
        }

        // Get latest test run for this job - use RPC function or query regression_test_runs
        // For now, we'll query regression_test_runs which should be in public schema
        const { data: testRun, error: runError } = await supabase
          .from('regression_test_runs')
          .select('*')
          .eq('job_id', jobid)
          .order('run_started_at', { ascending: false })
          .limit(1)
          .single();

        if (runError && runError.code !== 'PGRST116') {
          throw new Error(runError.message);
        }

        // Get baseline and after test results
        let baselineResult = null;
        let afterResult = null;
        let comparison = null;

        // If we have a test run, use its baseline/after IDs
        if (testRun) {
          if (testRun.baseline_test_id) {
            const { data, error } = await supabase
              .from('regression_test_results')
              .select('*')
              .eq('id', testRun.baseline_test_id)
              .single();
            if (!error) baselineResult = data;
          }

          if (testRun.after_test_id) {
            const { data, error } = await supabase
              .from('regression_test_results')
              .select('*')
              .eq('id', testRun.after_test_id)
              .single();
            if (!error) afterResult = data;
          }

          // Get comparison if both exist
          if (testRun.baseline_test_id && testRun.after_test_id) {
            const { data, error } = await supabase.rpc('compare_regression_test_results_detailed', {
              baseline_test_id: testRun.baseline_test_id,
              current_test_id: testRun.after_test_id
            });
            if (!error && data && data.length > 0) {
              comparison = data[0];
            }
          }
        } else {
          // No test run yet - check for standalone baseline and after test results
          const { data: baselineTests, error: baselineError } = await supabase
            .from('regression_test_results')
            .select('*')
            .eq('job_id', jobid)
            .eq('test_phase', 'before')
            .order('test_timestamp', { ascending: false })
            .limit(1);
          
          if (!baselineError && baselineTests && baselineTests.length > 0) {
            baselineResult = baselineTests[0];
          }
          
          // Also get latest after test if exists
          const { data: afterTests, error: afterError } = await supabase
            .from('regression_test_results')
            .select('*')
            .eq('job_id', jobid)
            .eq('test_phase', 'after')
            .order('test_timestamp', { ascending: false })
            .limit(1);
          
          if (!afterError && afterTests && afterTests.length > 0) {
            afterResult = afterTests[0];
            
            // If we have both baseline and after, try to compare
            if (baselineResult && afterResult) {
              const { data: compareData, error: compareError } = await supabase.rpc('compare_regression_test_results_detailed', {
                baseline_test_id: baselineResult.id,
                current_test_id: afterResult.id
              });
              if (!compareError && compareData && compareData.length > 0) {
                comparison = compareData[0];
              }
            }
          }
        }

        // Return results even if only baseline exists
        if (baselineResult || afterResult || testRun) {
          return res.status(200).json({
            ok: true,
            has_results: true,
            test_run: testRun || null,
            baseline: baselineResult,
            after: afterResult,
            comparison: comparison
          });
        }

        return res.status(200).json({
          ok: true,
          has_results: false,
          message: 'No regression test results found for this job'
        });

      } catch (error) {
        console.error('Error getting regression test results:', error);
        return res.status(500).json({ error: 'Internal server error', detail: error.message });
      }
    }

    // Run Cron Job Now (POST /api/admin?action=run_cron_job)
    if (req.method === 'POST' && action === 'run_cron_job') {
      try {
        const { jobid } = req.body;

        if (!jobid) {
          return res.status(400).json({ error: 'jobid parameter required' });
        }

        // Get job details
        const { data: jobData, error: jobError } = await supabase.rpc('get_cron_job_details', {
          p_jobid: jobid
        });

        if (jobError || !jobData || jobData.length === 0) {
          return res.status(404).json({ error: 'Job not found' });
        }

        const job = jobData[0];
        const startTime = new Date();
        
        let executionResult = null;
        let error = null;
        let recordsAffected = null;
        let regressionTestResults = null;

        try {
          // Execute the job command
          // For risky jobs, they use wrapper functions that return results
          // For other jobs, we execute the command directly
          
          const isRiskyJob = [21, 26, 27, 28, 31].includes(parseInt(jobid));
          
          if (isRiskyJob) {
            // Risky jobs use wrapper functions that handle regression testing
            let result;
            if (jobid == 21) {
              result = await supabase.rpc('refresh_v_products_unified_with_regression_test');
            } else if (jobid == 26) {
              result = await supabase.rpc('light_refresh_batch_with_regression_test', { p_batch: 0 });
            } else if (jobid == 27) {
              result = await supabase.rpc('light_refresh_batch_with_regression_test', { p_batch: 1 });
            } else if (jobid == 28) {
              result = await supabase.rpc('light_refresh_batch_with_regression_test', { p_batch: 2 });
            } else if (jobid == 31) {
              result = await supabase.rpc('cleanup_orphaned_records_with_regression_test');
            }
            
            if (result && result.data) {
              executionResult = result.data;
            }
            if (result && result.error) {
              error = result.error.message;
            }
            
            // Get regression test results - this is handled by the wrapper function
            // so we don't need to query job_run_details here
            const testRun = null;
            
            if (testRun) {
              const { data: comparison } = await supabase.rpc('analyze_regression_test_run', {
                p_run_id: testRun.id
              });
              regressionTestResults = {
                test_run: testRun,
                comparison: comparison && comparison.length > 0 ? comparison[0] : null
              };
            }
          } else {
            // For non-risky jobs, parse and execute the command
            const command = job.command.trim();
            
            // Handle multiple statements (e.g., Job 20 has two SELECT statements)
            const statements = command.split(/;\s*(?=SELECT)/i).filter(s => s.trim().length > 0);
            
            let allResults = [];
            let lastError = null;
            
            // Execute each statement
            for (const statement of statements) {
              // Parse function calls like: SELECT function_name(); or SELECT function_name(params);
              const functionCallMatch = statement.match(/SELECT\s+(\w+)\s*\(([^)]*)\)/i);
              
              if (functionCallMatch) {
                const functionName = functionCallMatch[1];
                const paramsStr = functionCallMatch[2].trim();
                
                // Parse parameters - try multiple common parameter names
                let params = {};
                if (paramsStr) {
                  // Handle different parameter formats
                  // Simple numeric: cleanup_old_chat_data(90)
                  const numMatch = paramsStr.match(/^(\d+)$/);
                  if (numMatch) {
                    const numValue = parseInt(numMatch[1]);
                    // Try common parameter names based on function name
                    if (functionName.includes('batch')) {
                      params = { p_batch: numValue };
                    } else if (functionName.includes('cleanup') && (functionName.includes('old_chat') || functionName.includes('old_debug'))) {
                      // cleanup_old_chat_data and cleanup_old_debug_logs use 'retention_days'
                      params = { retention_days: numValue };
                    } else if (functionName.includes('cleanup')) {
                      params = { days: numValue };
                    } else {
                      // Try generic parameter names
                      params = { days: numValue };
                    }
                  } else if (paramsStr.includes('CURRENT_DATE')) {
                    // Handle CURRENT_DATE - INTERVAL '7 days'
                    if (paramsStr.includes("INTERVAL '7 days'")) {
                      const dateValue = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
                      // Try common date parameter names
                      if (functionName.includes('analytics')) {
                        params = { target_date: dateValue };
                      } else {
                        params = { p_date: dateValue };
                      }
                    } else {
                      const dateValue = new Date().toISOString().split('T')[0];
                      if (functionName.includes('analytics')) {
                        params = { target_date: dateValue };
                      } else {
                        params = { p_date: dateValue };
                      }
                    }
                  } else if (paramsStr.match(/^\d+$/)) {
                    // Another numeric check
                    params = { p_days: parseInt(paramsStr) };
                  }
                }
                
                // Call the function via RPC - try with params first, then without
                let rpcData, rpcError;
                try {
                  
                  if (Object.keys(params).length > 0) {
                    const result = await supabase.rpc(functionName, params);
                    rpcData = result.data;
                    rpcError = result.error;
                    
                    // If that fails, try without params or with different param names
                    if (rpcError && paramsStr) {
                      // Try alternative parameter names based on function type
                      if (paramsStr.includes('CURRENT_DATE')) {
                        const dateValue = paramsStr.includes("INTERVAL '7 days'")
                          ? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
                          : new Date().toISOString().split('T')[0];
                        
                        // Try different date parameter names
                        const altNames = ['target_date', 'p_date', 'date_param', 'date'];
                        for (const paramName of altNames) {
                          const altResult = await supabase.rpc(functionName, { [paramName]: dateValue });
                          if (!altResult.error) {
                            rpcData = altResult.data;
                            rpcError = null;
                            break;
                          }
                        }
                      } else {
                        const numMatch = paramsStr.match(/^(\d+)$/);
                        if (numMatch) {
                          // Try with different numeric parameter names
                          // Order matters - try most common first
                          const altNames = functionName.includes('cleanup') && (functionName.includes('old_chat') || functionName.includes('old_debug'))
                            ? ['retention_days', 'days', 'p_days', 'p_value', 'value']
                            : functionName.includes('cleanup')
                            ? ['days', 'retention_days', 'p_days', 'p_value', 'value']
                            : ['p_value', 'p_days', 'days', 'value', 'batch', 'p_batch'];
                          for (const paramName of altNames) {
                            const altResult = await supabase.rpc(functionName, { [paramName]: parseInt(numMatch[1]) });
                            if (!altResult.error) {
                              rpcData = altResult.data;
                              rpcError = null;
                              break;
                            }
                          }
                        }
                      }
                    }
                  } else {
                    const result = await supabase.rpc(functionName);
                    rpcData = result.data;
                    rpcError = result.error;
                  }
                  
                  if (rpcError) {
                    error = rpcError.message;
                  } else {
                    executionResult = rpcData;
                    
                    // Extract records affected for specific functions
                    if (functionName.includes('cleanup')) {
                      recordsAffected = rpcData;
                    } else if (functionName.includes('check') || functionName.includes('validate') || functionName.includes('monitor')) {
                      recordsAffected = rpcData;
                    }
                  }
                } catch (rpcErr) {
                  lastError = rpcErr.message || 'Failed to execute function';
                }
                
                // Store result for this statement
                if (rpcData !== undefined) {
                  allResults.push({ function: functionName, result: rpcData, error: rpcError });
                }
              } else if (statement.includes('net.http_post')) {
                // For Edge Function calls, we can't easily execute them here
                // They'll be executed by pg_net, but we can't capture results easily
                allResults.push({ 
                  function: 'net.http_post', 
                  result: 'Job triggered (Edge Function call - check logs for results)',
                  error: null 
                });
              } else {
                // Unknown command format
                allResults.push({ 
                  function: 'unknown', 
                  result: 'Job command format not recognized - check logs for execution status',
                  error: null 
                });
              }
            }
            
            // Combine results from all statements
            if (allResults.length > 0) {
              if (allResults.length === 1) {
                executionResult = allResults[0].result;
                if (allResults[0].error) {
                  error = allResults[0].error;
                }
              } else {
                // Multiple statements - combine results
                executionResult = allResults.map(r => ({
                  function: r.function,
                  success: !r.error,
                  result: r.result,
                  error: r.error
                }));
              }
            }
            
            if (lastError && !error) {
              error = lastError;
            }
          }
          
          const endTime = new Date();
          const duration = (endTime - startTime) / 1000;

          // Try to get records affected for specific job types
          if (jobid == 31) {
            // Cleanup job returns orphaned_chunks and orphaned_entities
            if (executionResult && Array.isArray(executionResult) && executionResult.length > 0) {
              recordsAffected = executionResult[0];
            }
          }

          // Record the job execution via public.log_job_run so the dashboard stays in sync
          const executionSuccess = !error;
          let recordInserted = false;
          let recordCount = 0;
          let recordError = null;
          
          try {
            const { data: logData, error: logError } = await supabase.rpc('log_job_run', {
              jobid: parseInt(jobid),
              command: job.command,
              status: executionSuccess ? 'succeeded' : 'failed',
              return_message: executionSuccess 
                ? (executionResult ? JSON.stringify(executionResult).substring(0, 500) : 'Job completed successfully')
                : error || 'Job execution failed',
              start_time: startTime.toISOString(),
              end_time: endTime.toISOString()
            });
            
            if (logError) {
              console.error('Error logging job run via RPC:', logError);
              recordError = logError.message || 'Unknown RPC error';
            } else {
              recordInserted = true;
              recordCount = Array.isArray(logData) ? logData.length : logData ? 1 : 0;
              console.log(`Successfully logged job run for job ${jobid}:`, logData);
            }
          } catch (catchError) {
            recordError = catchError.message || String(catchError);
            console.error('Unexpected error logging job run:', catchError);
          }

          return res.status(200).json({
            ok: true,
            job: {
              id: jobid,
              name: job.jobname || job.name,
              command: job.command
            },
            execution: {
              success: executionSuccess,
              error: error,
              duration: duration,
              start_time: startTime.toISOString(),
              end_time: endTime.toISOString(),
              result: executionResult,
              records_affected: recordsAffected,
              record_inserted: recordInserted,
              record_count: recordCount,
              record_error: recordError
            },
            regression_test: regressionTestResults
          });

        } catch (execError) {
          const endTime = new Date();
          const duration = (endTime - startTime) / 1000;
          
          // Record the failed job execution via public.log_job_run
          try {
            const { error: logError } = await supabase.rpc('log_job_run', {
              jobid: parseInt(jobid),
              command: job.command,
              status: 'failed',
              return_message: execError.message || 'Job execution failed',
              start_time: startTime.toISOString(),
              end_time: endTime.toISOString()
            });
            
            if (logError) {
              console.error('Error logging failed job run via RPC:', logError);
            }
          } catch (recordError) {
            console.error('Unexpected error logging failed job run:', recordError);
          }
          
          return res.status(200).json({
            ok: true,
            job: {
              id: jobid,
              name: job.jobname || job.name,
              command: job.command
            },
            execution: {
              success: false,
              error: execError.message,
              duration: duration,
              start_time: startTime.toISOString(),
              end_time: endTime.toISOString()
            },
            regression_test: regressionTestResults
          });
        }

      } catch (error) {
        console.error('Error running cron job:', error);
        return res.status(500).json({ error: 'Internal server error', detail: error.message });
      }
    }

    // Reset Job Statistics (POST /api/admin?action=reset_job_stats)
    if (req.method === 'POST' && action === 'reset_job_stats') {
      try {
        const { jobid } = req.body;

        if (!jobid) {
          return res.status(400).json({ error: 'jobid parameter required' });
        }

        const jobIdInt = parseInt(jobid);

        // Use RPC function to delete job run details from public.job_run_details
        // First try using RPC function, if it doesn't exist, we'll get an error
        const { data: deleteResult, error: deleteError } = await supabase.rpc('delete_job_run_details', {
          p_jobid: jobIdInt
        });

        if (deleteError) {
          // If RPC doesn't exist, try alternative: use a SQL function via RPC
          // For now, return helpful error message
          console.error('Error deleting job run details:', deleteError);
          return res.status(500).json({ 
            error: 'Failed to reset job statistics', 
            detail: deleteError.message || 'RPC function delete_job_run_details may not exist or cannot access public.job_run_details.',
            code: deleteError.code,
            hint: deleteError.hint || "You may need to create an RPC function: CREATE OR REPLACE FUNCTION delete_job_run_details(p_jobid int) RETURNS jsonb AS $$ DELETE FROM public.job_run_details WHERE jobid = p_jobid; GET DIAGNOSTICS v_deleted_count = ROW_COUNT; RETURN jsonb_build_object('deleted_count', v_deleted_count); $$ LANGUAGE plpgsql SECURITY DEFINER;",
            fullError: JSON.stringify(deleteError)
          });
        }

        const deletedCount = deleteResult?.deleted_count || 0;
        const afterCount = deleteResult?.remaining_count || 0;
        
        console.log(`Reset stats for job ${jobIdInt}: Deleted ${deletedCount} records, ${afterCount || 0} remaining`);

        return res.status(200).json({
          ok: true,
          message: `Successfully reset statistics for job ${jobid}`,
          jobid: jobIdInt,
          deleted_count: deletedCount,
          remaining_count: afterCount
        });

      } catch (error) {
        console.error('Error resetting job statistics:', error);
        return res.status(500).json({ error: 'Internal server error', detail: error.message });
      }
    }

    // Default response
    return res.status(400).json({ 
      error: 'bad_request', 
      detail: 'Use ?action=qa for spot checks, ?action=refresh for mapping refresh, ?action=aggregate_analytics for analytics aggregation, ?action=cron_jobs for cron job list, ?action=cron_logs for logs, ?action=update_cron_schedule to update schedule, ?action=toggle_cron_job to pause/resume jobs, ?action=reset_job_stats to reset job statistics, ?action=run_regression_test to run 40Q test, ?action=compare_regression_tests to compare results, or ?action=run_cron_job to run a job now' 
    });
  } catch (error) {
    // Global error handler - ensure we always return JSON
    console.error('Unhandled error in admin handler:', error);
    return res.status(500).json({ 
      error: 'Internal server error', 
      detail: error.message || 'An unexpected error occurred' 
    });
  }
}
