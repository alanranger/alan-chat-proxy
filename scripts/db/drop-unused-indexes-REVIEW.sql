-- ============================================================================
-- REVIEW BEFORE RUNNING — Drop unused / duplicate indexes (Supabase: alan-chat-rag)
-- Generated 2026-06-28 to reduce write-IO amplification (Disk IO Budget alert).
--
-- WHY: Every INSERT/UPDATE/DELETE must maintain EVERY index on a table. Indexes
-- that are never read are pure write-IO + disk-space overhead. All indexes below
-- have idx_scan = 0 over the whole DB lifetime (pg_stat_database.stats_reset IS NULL,
-- i.e. stats were never reset, so "0 scans" is trustworthy, not a recent artefact).
--
-- SAFETY:
--   * Only NON-unique, NON-primary-key indexes are listed (constraints are untouched).
--   * DROP INDEX is fully reversible — every index here was created by a migration,
--     so it can be recreated from supabase/migrations if a query pattern needs it later.
--   * Plain DROP INDEX takes a very brief lock; these are unused so impact is nil.
--     (If you prefer zero-lock, change each to: DROP INDEX CONCURRENTLY — but that
--      cannot run inside a transaction/migration wrapper.)
--
-- HOW TO RUN: paste into Supabase SQL editor, or run via the postgres-rw MCP.
-- Re-verify the list is still accurate first with STEP 0 below.
-- ============================================================================

-- STEP 0 — RE-VERIFY (run this first; it should still return the same names) -----
-- SELECT s.relname AS table_name, s.indexrelname AS index_name,
--        pg_size_pretty(pg_relation_size(s.indexrelid)) AS size
-- FROM pg_stat_user_indexes s
-- JOIN pg_index i ON i.indexrelid = s.indexrelid
-- WHERE s.idx_scan = 0 AND NOT i.indisunique AND NOT i.indisprimary
--   AND s.schemaname = 'public'
-- ORDER BY pg_relation_size(s.indexrelid) DESC;

-- ----------------------------------------------------------------------------
-- ⚠️  REVIEW THESE FIRST — recently created, may be for a feature not yet querying:
--   product_reviews_* (table created 2026-06-02). If the reviews feature is live
--   but just hasn't been queried since deploy, KEEP these three. Otherwise drop.
-- DROP INDEX IF EXISTS public.idx_product_reviews_slug_active;   -- product_reviews (40 kB)
-- DROP INDEX IF EXISTS public.idx_product_reviews_url_active;    -- product_reviews (40 kB)
-- DROP INDEX IF EXISTS public.idx_product_reviews_date;          -- product_reviews (40 kB)
-- ----------------------------------------------------------------------------

BEGIN;

-- Largest first (most write-IO / space saved) -------------------------------
DROP INDEX IF EXISTS public.gsc_pqd_query_date_idx;                                  -- gsc_page_query_daily (6704 kB)
DROP INDEX IF EXISTS public.gsc_pqd_page_date_idx;                                   -- gsc_page_query_daily (2016 kB)
DROP INDEX IF EXISTS public.idx_chat_interactions_confidence;                        -- chat_interactions (1896 kB)
DROP INDEX IF EXISTS public.idx_gsc_page_metrics_28d_run_id;                         -- gsc_page_metrics_28d (1136 kB)
DROP INDEX IF EXISTS public.idx_gsc_page_metrics_28d_page_url;                        -- gsc_page_metrics_28d (1064 kB)
DROP INDEX IF EXISTS public.page_html_new_content_hash_idx;                          -- page_html (952 kB)
DROP INDEX IF EXISTS public.idx_page_entities_title_trgm;                            -- page_entities (832 kB)
DROP INDEX IF EXISTS public.gsc_pqd_date_idx;                                        -- gsc_page_query_daily (656 kB)
DROP INDEX IF EXISTS public.idx_chat_interactions_intent;                            -- chat_interactions (592 kB)
DROP INDEX IF EXISTS public.idx_chat_interactions_page_context;                      -- chat_interactions (592 kB)
DROP INDEX IF EXISTS public.page_html_new_created_at_idx;                            -- page_html (320 kB)
DROP INDEX IF EXISTS public.idx_portfolio_segment_metrics_28d_site_segment_scope_created; -- portfolio_segment_metrics_28d (264 kB)
DROP INDEX IF EXISTS public.page_html_new_url_idx;                                   -- page_html (256 kB)
DROP INDEX IF EXISTS public.page_chunks_created_idx;                                 -- page_chunks (232 kB)
DROP INDEX IF EXISTS public.idx_dash_subseg_windows_site_scope_end;                  -- dashboard_subsegment_windows (224 kB)
DROP INDEX IF EXISTS public.idx_portfolio_snapshots_v2_kpi_segment_scope_created;    -- portfolio_snapshots_v2 (200 kB)
DROP INDEX IF EXISTS public.page_chunks_url_idx;                                     -- page_chunks (168 kB)  [dup of idx_page_chunks_url]
DROP INDEX IF EXISTS public.idx_keyword_rankings_property_url;                       -- keyword_rankings (160 kB)
DROP INDEX IF EXISTS public.idx_opt_events_type;                                     -- optimisation_task_events (152 kB)
DROP INDEX IF EXISTS public.idx_dfs_domain_backlink_rows_domain_ingested;            -- dfs_domain_backlink_rows (136 kB)
DROP INDEX IF EXISTS public.idx_keyword_rankings_segment_source;                     -- keyword_rankings (128 kB)
DROP INDEX IF EXISTS public.idx_dfs_domain_backlink_rows_domain_urlkey;              -- dfs_domain_backlink_rows (128 kB)
DROP INDEX IF EXISTS public.idx_page_chunks_csv_metadata_id;                         -- page_chunks (128 kB)
DROP INDEX IF EXISTS public.idx_keyword_target_metrics_cache_page_url;               -- keyword_target_metrics_cache (128 kB)
DROP INDEX IF EXISTS public.idx_page_entities_source_url;                            -- page_entities (120 kB)
DROP INDEX IF EXISTS public.idx_opt_events_owner;                                    -- optimisation_task_events (112 kB)
DROP INDEX IF EXISTS public.idx_page_entities_entity_hash;                           -- page_entities (104 kB)
DROP INDEX IF EXISTS public.idx_schema_audit_logs_url;                               -- schema_audit_logs (104 kB)  [dup]
DROP INDEX IF EXISTS public.idx_page_entities_norm_title;                            -- page_entities (104 kB)
DROP INDEX IF EXISTS public.idx_page_chunks_csv_type;                                -- page_chunks (104 kB)
DROP INDEX IF EXISTS public.idx_opt_events_task;                                     -- optimisation_task_events (96 kB)
DROP INDEX IF EXISTS public.idx_keyword_target_metrics_cache_fetched_at;             -- keyword_target_metrics_cache (96 kB)
DROP INDEX IF EXISTS public.idx_keyword_rankings_keyword;                            -- keyword_rankings (96 kB)
DROP INDEX IF EXISTS public.idx_url_last_processed_url;                              -- url_last_processed (88 kB)  [dup]
DROP INDEX IF EXISTS public.idx_regression_test_runs_status;                         -- regression_test_runs (80 kB)
DROP INDEX IF EXISTS public.idx_portfolio_segment_metrics_28d_site_created;          -- portfolio_segment_metrics_28d (80 kB)
DROP INDEX IF EXISTS public.booking_sheet_transactions_year_date_idx;                -- booking_sheet_transactions (80 kB)
DROP INDEX IF EXISTS public.idx_domain_rank_pending_engine_last_seen;                -- domain_rank_pending (80 kB)
DROP INDEX IF EXISTS public.idx_debug_logs_message_search;                           -- debug_logs (72 kB)
DROP INDEX IF EXISTS public.idx_csv_metadata_tags;                                   -- csv_metadata (72 kB)
DROP INDEX IF EXISTS public.idx_page_entities_tags;                                  -- page_entities (72 kB)
DROP INDEX IF EXISTS public.idx_csv_metadata_categories;                             -- csv_metadata (72 kB)
DROP INDEX IF EXISTS public.idx_rev_gsc_policy_property_url;                          -- revenue_gsc_joined_with_policy (72 kB)
DROP INDEX IF EXISTS public.idx_schema_audit_logs_timestamp;                         -- schema_audit_logs (64 kB)
DROP INDEX IF EXISTS public.idx_page_entities_categories;                            -- page_entities (64 kB)
DROP INDEX IF EXISTS public.booking_sheet_transactions_canonical_product_idx;        -- booking_sheet_transactions (64 kB)
DROP INDEX IF EXISTS public.idx_csv_metadata_publish_date;                           -- csv_metadata (64 kB)
DROP INDEX IF EXISTS public.idx_regression_test_runs_job_id;                         -- regression_test_runs (56 kB)
DROP INDEX IF EXISTS public.idx_dfs_backlink_baseline_edges_domain;                  -- dfs_backlink_baseline_edges (56 kB)
DROP INDEX IF EXISTS public.booking_sheet_transactions_landing_page_idx;             -- booking_sheet_transactions (56 kB)
DROP INDEX IF EXISTS public.product_display_price_title_idx;                         -- product_display_price (56 kB)
DROP INDEX IF EXISTS public.booking_sheet_transactions_category_idx;                 -- booking_sheet_transactions (48 kB)
DROP INDEX IF EXISTS public.idx_portfolio_snapshots_v2_run_id;                       -- portfolio_snapshots_v2 (48 kB)
DROP INDEX IF EXISTS public.idx_csv_metadata_kind;                                   -- csv_metadata (48 kB)
DROP INDEX IF EXISTS public.idx_portfolio_segment_metrics_28d_run_id;                -- portfolio_segment_metrics_28d (48 kB)
DROP INDEX IF EXISTS public.booking_sheet_transactions_jlr_idx;                      -- booking_sheet_transactions (48 kB)
DROP INDEX IF EXISTS public.idx_page_slug_catalog_product_slug;                      -- page_slug_catalog (48 kB)
DROP INDEX IF EXISTS public.idx_csv_metadata_start_date;                             -- csv_metadata (48 kB)
DROP INDEX IF EXISTS public.booking_sheet_transactions_channel_idx;                  -- booking_sheet_transactions (48 kB)
DROP INDEX IF EXISTS public.revenue_snapshots_tier_revenue_idx;                      -- revenue_snapshots (40 kB)
DROP INDEX IF EXISTS public.idx_event_url_lower;                                     -- event (40 kB)
DROP INDEX IF EXISTS public.idx_page_entities_start_date;                            -- page_entities (40 kB)
DROP INDEX IF EXISTS public.idx_page_entities_publish_date;                          -- page_entities (40 kB)
DROP INDEX IF EXISTS public.idx_dash_subseg_windows_run;                             -- dashboard_subsegment_windows (40 kB)
DROP INDEX IF EXISTS public.idx_dfs_page_backlinks_cache_domain_fetched;             -- dfs_page_backlinks_cache (40 kB)
DROP INDEX IF EXISTS public.light_refresh_runs_created_at_idx;                       -- light_refresh_runs (32 kB)
DROP INDEX IF EXISTS public.idx_chat_feedback_rating;                                -- chat_feedback (16 kB)
DROP INDEX IF EXISTS public.idx_chat_feedback_timestamp;                             -- chat_feedback (16 kB)
DROP INDEX IF EXISTS public.idx_url_last_processed_etag;                             -- url_last_processed (16 kB)
DROP INDEX IF EXISTS public.idx_url_last_processed_updated;                          -- url_last_processed (16 kB)
DROP INDEX IF EXISTS public.idx_audit_debug_logs_property_date;                      -- audit_debug_logs (16 kB)  [dup]
DROP INDEX IF EXISTS public.idx_audit_debug_logs_created_at;                         -- audit_debug_logs (16 kB)
DROP INDEX IF EXISTS public.idx_portfolio_audit_runs_created;                        -- portfolio_audit_runs (16 kB)
DROP INDEX IF EXISTS public.idx_regression_test_results_fixed_baseline;              -- regression_test_results (16 kB)
DROP INDEX IF EXISTS public.idx_regression_test_results_job_phase;                   -- regression_test_results (16 kB)
DROP INDEX IF EXISTS public.idx_opt_cycles_objective_status;                         -- optimisation_task_cycles (16 kB)
DROP INDEX IF EXISTS public.idx_opt_cycles_due_at;                                   -- optimisation_task_cycles (16 kB)
DROP INDEX IF EXISTS public.idx_product_product_url;                                 -- product (16 kB)  [dup]
DROP INDEX IF EXISTS public.idx_event_product_overrides_product;                     -- event_product_overrides (16 kB)
DROP INDEX IF EXISTS public.idx_shared_audits_share_id;                              -- shared_audits (16 kB)  [dup]
DROP INDEX IF EXISTS public.idx_shared_audits_expires_at;                            -- shared_audits (16 kB)
DROP INDEX IF EXISTS public.gsc_url_inspection_cache_property_idx;                   -- gsc_url_inspection_cache (16 kB)
DROP INDEX IF EXISTS public.idx_trad_seo_rule_overrides_property;                    -- traditional_seo_rule_overrides (16 kB)
DROP INDEX IF EXISTS public.idx_trad_seo_rule_overrides_page;                        -- traditional_seo_rule_overrides (16 kB)
DROP INDEX IF EXISTS public.event_product_mapping_canonical_idx;                     -- event_product_mapping (16 kB)
DROP INDEX IF EXISTS public.idx_chat_feedback_confidence;                            -- chat_feedback (16 kB)
DROP INDEX IF EXISTS public.idx_regression_test_results_test_timestamp;              -- regression_test_results (16 kB)
DROP INDEX IF EXISTS public.idx_regression_test_results_test_phase;                  -- regression_test_results (16 kB)
DROP INDEX IF EXISTS public.idx_debug_logs_timestamp;                                -- debug_logs (16 kB)
DROP INDEX IF EXISTS public.idx_debug_logs_type;                                     -- debug_logs (16 kB)
DROP INDEX IF EXISTS public.idx_debug_logs_property_url;                             -- debug_logs (16 kB)
DROP INDEX IF EXISTS public.idx_regression_test_results_job_id;                      -- regression_test_results (16 kB)
DROP INDEX IF EXISTS public.idx_chat_analytics_daily_date;                           -- chat_analytics_daily (16 kB)  [dup]
DROP INDEX IF EXISTS public.idx_domain_strength_domains_is_competitor;               -- domain_strength_domains (16 kB)
DROP INDEX IF EXISTS public.idx_domain_strength_domains_domain_type_source;          -- domain_strength_domains (16 kB)
DROP INDEX IF EXISTS public.idx_domain_strength_domains_domain_type;                 -- domain_strength_domains (16 kB)
DROP INDEX IF EXISTS public.idx_domain_strength_domains_segment;                     -- domain_strength_domains (16 kB)
DROP INDEX IF EXISTS public.idx_opt_tasks_owner;                                     -- optimisation_tasks (16 kB)
DROP INDEX IF EXISTS public.idx_opt_tasks_keyword;                                   -- optimisation_tasks (16 kB)
DROP INDEX IF EXISTS public.idx_opt_tasks_url_clean;                                 -- optimisation_tasks (16 kB)
DROP INDEX IF EXISTS public.idx_opt_tasks_status;                                    -- optimisation_tasks (16 kB)
DROP INDEX IF EXISTS public.idx_optim_tasks_due;                                     -- optimisation_tasks (16 kB)
DROP INDEX IF EXISTS public.idx_optimisation_tasks_is_test_task;                     -- optimisation_tasks (16 kB)
DROP INDEX IF EXISTS public.idx_mentions_baseline_runs_started_at;                   -- mentions_baseline_runs (16 kB)
DROP INDEX IF EXISTS public.idx_mentions_baseline_entries_last_seen;                 -- mentions_baseline_entries (16 kB)
DROP INDEX IF EXISTS public.idx_mentions_baseline_entries_alert_level;               -- mentions_baseline_entries (16 kB)
DROP INDEX IF EXISTS public.idx_mentions_baseline_entries_platform;                  -- mentions_baseline_entries (16 kB)
DROP INDEX IF EXISTS public.idx_mentions_baseline_entries_score;                     -- mentions_baseline_entries (16 kB)
DROP INDEX IF EXISTS public.idx_chat_events_event_type;                              -- chat_events (16 kB)
DROP INDEX IF EXISTS public.idx_chat_events_session_id;                              -- chat_events (16 kB)
DROP INDEX IF EXISTS public.idx_page_entities_products_seen;                         -- page_entities (16 kB)
DROP INDEX IF EXISTS public.idx_page_entities_kind_date;                             -- page_entities (16 kB)
DROP INDEX IF EXISTS public.idx_impl_audit_snapshots_lookup;                         -- impl_audit_snapshots (16 kB)
DROP INDEX IF EXISTS public.idx_citation_consistency_runs_started_at;                -- citation_consistency_runs (16 kB)
DROP INDEX IF EXISTS public.idx_citation_consistency_entries_last_seen;              -- citation_consistency_entries (16 kB)
DROP INDEX IF EXISTS public.idx_citation_consistency_entries_alert;                  -- citation_consistency_entries (16 kB)
DROP INDEX IF EXISTS public.idx_event_product_event_url_lower;                       -- event_product (16 kB)
DROP INDEX IF EXISTS public.gsc_backfill_runs_range_idx;                             -- gsc_backfill_runs (16 kB)
DROP INDEX IF EXISTS public.canonical_products_service_page_idx;                     -- canonical_products (16 kB)
DROP INDEX IF EXISTS public.canonical_products_category_idx;                         -- canonical_products (16 kB)
DROP INDEX IF EXISTS public.idx_dfs_backlink_summary_cache_fetched_at;               -- dfs_backlink_summary_cache (16 kB)
DROP INDEX IF EXISTS public.idx_gsc_timeseries_property;                             -- gsc_timeseries (16 kB)
DROP INDEX IF EXISTS public.idx_dfs_page_backlinks_cache_fetched_at;                 -- dfs_page_backlinks_cache (16 kB)
DROP INDEX IF EXISTS public.dfs_backlink_tile_baseline_saved_at_idx;                 -- dfs_backlink_tile_baseline (16 kB)
DROP INDEX IF EXISTS public.idx_traditional_seo_snapshots_property_created;          -- traditional_seo_score_snapshots (16 kB)
DROP INDEX IF EXISTS public.idx_traditional_seo_rules_category;                      -- traditional_seo_rules (16 kB)
DROP INDEX IF EXISTS public.traditional_seo_evaluation_cache_updated_at_idx;         -- traditional_seo_evaluation_cache (16 kB)
DROP INDEX IF EXISTS public.idx_dfs_backlink_ingest_state_updated;                   -- dfs_backlink_ingest_state (16 kB)
DROP INDEX IF EXISTS public.idx_content_events_event_url_start;                      -- content_events (16 kB)
DROP INDEX IF EXISTS public.revenue_funnel_priorities_task_idx;                      -- revenue_funnel_priorities (16 kB)
DROP INDEX IF EXISTS public.idx_content_events_start_at;                             -- content_events (16 kB)
DROP INDEX IF EXISTS public.revenue_snapshots_property_period_idx;                   -- revenue_snapshots (16 kB)
DROP INDEX IF EXISTS public.idx_trad_seo_kw_overrides_property;                      -- traditional_seo_target_keyword_overrides (16 kB)
DROP INDEX IF EXISTS public.revenue_funnel_scenarios_property_idx;                   -- revenue_funnel_scenarios (16 kB)  [dup]
DROP INDEX IF EXISTS public.revenue_funnel_targets_property_idx;                     -- revenue_funnel_targets (16 kB)
DROP INDEX IF EXISTS public.revenue_funnel_tier_weights_property_idx;                -- revenue_funnel_tier_weights (16 kB)
DROP INDEX IF EXISTS public.revenue_funnel_lever_weights_property_idx;               -- revenue_funnel_lever_weights (16 kB)
DROP INDEX IF EXISTS public.idx_ga4_site_metrics_28d_captured;                       -- ga4_site_metrics_28d (16 kB)
DROP INDEX IF EXISTS public.idx_ke_domain_metrics_cache_fetched_at;                  -- ke_domain_metrics_cache (16 kB)
DROP INDEX IF EXISTS public.idx_improvement_tracking_status;                         -- content_improvement_tracking (16 kB)
DROP INDEX IF EXISTS public.idx_improvement_tracking_question;                       -- content_improvement_tracking (16 kB)  [dup]
DROP INDEX IF EXISTS public.idx_audit_cron_schedule_next_run;                        -- audit_cron_schedule (16 kB)
DROP INDEX IF EXISTS public.idx_exam_member_links_supabase_user;                     -- exam_member_links (8 kB)
DROP INDEX IF EXISTS public.idx_portfolio_snapshots_period;                          -- portfolio_snapshots (8 kB)
DROP INDEX IF EXISTS public.idx_module_results_ms_member_module;                     -- module_results_ms (8 kB)
DROP INDEX IF EXISTS public.idx_portfolio_snapshots_created;                         -- portfolio_snapshots (8 kB)

-- Remaining duplicate-index pairs where the redundant copy was NOT idx_scan=0
-- (keep the UNIQUE/constraint index, drop the redundant plain index) ----------
DROP INDEX IF EXISTS public.idx_event_url_unique;                                    -- event: dup of UNIQUE event_url_key
DROP INDEX IF EXISTS public.idx_epla_event_url;                                      -- event_product_links_auto: dup of pkey
DROP INDEX IF EXISTS public.idx_ga4_site_metrics_28d_property_end;                   -- ga4_site_metrics_28d: dup of UNIQUE uq_*
DROP INDEX IF EXISTS public.idx_gsc_page_timeseries_lookup;                          -- gsc_page_timeseries: dup of UNIQUE *_key
DROP INDEX IF EXISTS public.idx_gsc_timeseries_property_date;                        -- gsc_timeseries: dup of UNIQUE *_key
-- NOTE: page_chunks (url) duplicate already handled above (dropped the unused
--       page_chunks_url_idx; KEPT idx_page_chunks_url, which IS used).
-- NOTE: page_chunks has TWO unique indexes on (url, chunkhash) —
--       page_chunks_url_chunkhash_uidx and ux_page_chunks_url_chunkhash. One is
--       redundant, but verify which your upsert ON CONFLICT targets before dropping.
DROP INDEX IF EXISTS public.idx_overrides_product_url;                              -- product_price_overrides: dup of pkey
DROP INDEX IF EXISTS public.idx_series_canonical_url_unique;                         -- series: dup of UNIQUE series_canonical_url_key

COMMIT;

-- After dropping, refresh planner stats:
ANALYZE;
