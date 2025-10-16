---
title: "AI TODO (Working List)"
project: "Alan Ranger – Chat AI Bot"
maintainer: "Alan Ranger"
category: "Scratchpad / Working Memory"
last_updated: "2025-10-16 21:00"
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
- [ ] —
- [ ] —

## Next
- [ ] —

## Blockers
- [ ] —

## Updates
- 2025-10-16 21:00 — Scratchpad created
- 2025-10-16 — Fixed S2681 at chat.js:L4893. Baseline vs after: no regressions; 100% success rate. Merged.
- 2025-10-16 — Fixed S1871 at chat.js:L4984. Baseline vs after: no regressions; 100% success rate. Merged.
- 2025-10-16 — Fixed S2486 at chat.js:L4775. Added error handling for 2 unhandled database exceptions. Baseline vs after: no regressions; 100% success rate. Merged.

- [ ] add JSON-LD for the new workshop page

## Core Chatbot Tasks (from before tangent)

### High Priority
- [ ] Render multi-day residential workshop tiles in events responses
- [ ] Ensure tripod article tiles render with title/url fallbacks
- [ ] Source clarification options only from evidence buckets; suppress generic fallbacks

### Testing & Validation
- [ ] Run 10-key-query live verification and capture outputs
- [ ] Validate v_events_for_chat/v_events_real_data populated; remove empty tables
- [ ] Add regression tests for tripod and residential pricing/B&B flows

### Infrastructure
- [ ] Sync frontend to latest API contract; version bump
- [ ] Complete loops deep-dive analysis (currently in_progress)

### Completed ✅
- [x] Switch event retrieval to views/page_entities instead of CSV tables
- [x] Remove csvType gating and compute multi_day from dates/title
- [x] Run test-api-two-queries.js for tripod and residential pricing
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
