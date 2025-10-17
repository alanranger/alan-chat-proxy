---
title: "AI TODO (Working List)"
project: "Alan Ranger – Chat AI Bot"
maintainer: "Alan Ranger"
category: "Scratchpad / Working Memory"
last_updated: "2025-10-17 11:35"
purpose: >
  Repo-scoped, writable scratchpad used by Cursor AI to persist short-term memory,
  tasks, and next actions between chats. Read at session start and update after each change.
tags:
  - Cursor AI
  - MCP Notes
  - TODO
  - Handover
memory_policy:
  read_on_session_start: true
  file_id: "AI_TODO"
  promote_to_docs:
    map: "notes/promotion-map.json"
    target_root: "Architecture and Handover"
  rotate_when_lines_exceed: 200
  rotation_naming: "AI_TODO_2.md"
  update_log_section: "## Updates"
  update_last_updated_on_append: true
  last_updated_format: "YYYY-MM-DD HH:mm"
---

# AI TODO (Working List)

This is the AI’s running TODO list. Keep it short and actionable.

## Today
- [x] Continue complexity reductions per handover: L1886
- [x] Run exhaustive clarifications at depth 5 BEFORE/AFTER each change
- [ ] Investigate two fallback queries in live baseline (Q10, Q13) after complexity work
- [ ] Continue complexity reductions: next target L3049

## Next
- [ ] Move on to L3049, L3210, L3514, L3637 (one per patch)

## Blockers
- [ ] None (live UI and API healthy; baseline passing)

## Updates
- 2025-10-17 11:35 — Handover script created: `Architecture and Handover/HANDOVER_SCRIPT_2025-10-17.md`
- 2025-10-17 — Refactor (L4334): extracted `maybeProcessEarlyReturnFallback`; baseline parity, merged.
- 2025-10-17 — Refactor (L5500): extracted `scoreArticle`; baseline parity, merged.
- 2025-10-17 — Refactor (L5685): simplified Factor 2 accumulation; baseline parity, merged.
- 2025-10-17 — Refactor (L1886): introduced `matches`/`createRoute` helpers in `handleClarificationFollowUp`; BEFORE/AFTER live baseline 15/15 with 2 expected fallbacks; exhaustive clarifications run saved to `results/sonar-fixes/L1886/`.
- 2025-10-17 16:00 — Reduced L5505 to ≤15. Baseline parity. Merged 7e77127.
- 2025-10-17 16:08 — Reduced L5656 to ≤15. Baseline parity. Merged 0167d12.
- 2025-10-17 16:16 — Reduced L1145 to ≤15. Baseline parity. Merged 65e2325.
- 2025-10-17 16:22 — Reduced L1258 to ≤15. Baseline parity. Merged 33563c5.
- 2025-10-17 16:28 — Reduced L2784 to ≤15. Baseline parity. Merged 0d3c6e2.
- 2025-10-17 16:38 — Reduced L2521 to ≤15. Baseline parity. Merged e3a6e35.
- 2025-10-17 17:10 — Reduced L3039 getArticleAuxLinks to ≤15. Baseline parity. Merged 1fa21ba.
- 2025-10-17 17:23 — Reduced L3303 extractFromDescription to ≤15. Baseline parity. Merged ed15b3f.
- 2025-10-17 17:26 — Reduced L3611 buildProductPanelMarkdown to ≤15. Baseline parity. Merged 485f175.
- 2025-10-17 17:28 — Reduced L3133 extractRelatedLabel to ≤15. Baseline parity. Merged 58c00c2.
- 2025-10-17 17:30 — Reduced L3737 buildEventPills to ≤15. Baseline parity. Merged 84dc3b2.
- 2025-10-17 17:32 — Reduced L1528 generateClarificationOptionsFromEvidence to ≤15. Baseline parity. Merged 5889ac1.
- 2025-10-17 17:48 — Reduced L536 generateDirectAnswer from 100 to ≤15. Baseline parity. Merged fd52fb4.

## SonarQube Analysis Update (2025-10-17)
- **COMPLETED**: 19/21 functions (90% complete)
- **REMAINING**: 3 functions in chat.js + 9 functions in chat.html
- **COMPLETED BATCHES**:
  - Batch A: L536 (82), L1939 (72), L3039 (70) - COMPLETED (L4474 skipped due to previous failure)
  - Batch B: L3303 (65), L3611 (59), L3133 (54), L3737 (48), L1528 (42) - COMPLETED
- **REMAINING BATCHES**: 
  - Batch C: L2807 (17), L2574 (16), L3923 (bug fix) - Low priority
  - Frontend: 9 functions in chat.html (complexity 16-30)

## Core Chatbot Tasks (from before tangent)

### High Priority
- [ ] Render multi-day residential workshop tiles in events responses
- [ ] Ensure tripod article tiles render with title/url fallbacks
- [ ] Source clarification options only from evidence buckets; suppress generic fallbacks

### Testing & Validation
- [ ] Validate v_events_for_chat/v_events_real_data populated; remove empty tables
- [ ] Add regression tests for tripod and residential pricing/B&B flows

### Infrastructure
- [ ] Sync frontend to latest API contract; version bump
- [ ] Complete loops deep-dive analysis (currently in_progress)

### Completed ✅
- [x] Switch event retrieval to views/page_entities instead of CSV tables
- [x] Remove csvType gating and compute multi_day from dates/title
- [x] Execute live sweep and save JSON/CSV report with loops/issues
- [x] Analyze latest sweep JSON for loops and repeated clarifications
- [x] Bypass generic clarifications with evidence-first results

### Critical Issues
- [ ] Refactor ingest system - current approach is not working properly for content extraction

### Database Issues
- [ ] Investigate why workshop_events and course_events tables are empty
- [ ] Remove empty workshop_events and course_events tables from database
- [ ] Verify page_entities table has proper data for events

### Content & Data Quality
- [ ] Fix JSON-LD extraction issues (regex patterns not working)
- [ ] Ensure all blog articles are properly ingested with metadata
- [ ] Validate that event data is being extracted correctly from website

### System Architecture
- [ ] Review and fix the RAG system architecture - current approach too complex
- [ ] Simplify clarification logic to be more deterministic
- [ ] Implement proper content-based confidence scoring

### Performance & Reliability
- [ ] Fix the "band-aid" approach - system needs fundamental fixes, not query-specific patches
- [ ] Ensure system works for hundreds/thousands of queries, not just 2 specific ones
- [ ] Reduce time to fix issues (currently taking too long for simple problems)

### Supabase & Infrastructure
- [ ] Fix and update Supabase cron light refresh system
- [ ] Ensure light refresh is working properly for content updates

### Testing & Quality Assurance
- [ ] Revisit and update testbench-pro.html
- [ ] Test and validate all testbench functionality
- [ ] Update admin panel at https://alan-chat-proxy.vercel.app/admin.html
- [ ] Update analytics dashboard at https://alan-chat-proxy.vercel.app/analytics.html
- [ ] Ensure admin panel analytics aggregation is working properly
- [ ] Verify cron jobs are running correctly (daily at 1 AM)
- [ ] Test all admin panel functions: QA Check, Refresh Mappings, Finalize Data

### Immediate Actions
- [ ] Commit all changes and deploy to save current work
ok thi